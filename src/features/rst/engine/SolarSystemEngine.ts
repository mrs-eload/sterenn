import * as THREE from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { BloomPipeline } from './render/BloomPipeline';
import { loadSkyboxTexture } from './render/skybox';
import { PickRegistry } from './camera/PickRegistry';
import { CameraController } from './camera/CameraController';
import type { SizeModel } from './sizing';
import type { FrameContext, SceneEntity } from './SceneEntity';
import { SunEntity } from './bodies/SunEntity';
import { createPlanetBodies } from './bodies/solarSystem';
import type { Body } from './bodies/Body';
import { LagrangeGroup } from './bodies/LagrangeGroup';
import type { LagrangeConfig } from './bodies/LagrangeGroup';
import { SpacecraftEntity } from './bodies/SpacecraftEntity';
import type { EngineOptions, TrajectoryObjectConfig, Vec3 } from './types';

/**
 * A self-contained heliocentric solar-system renderer built directly on
 * Three.js. Framework-free: construct it with a DOM container, feed it objects,
 * call start(); a React component just owns its lifecycle.
 *
 * Coordinate frame throughout: heliocentric, ecliptic of J2000, AU (see
 * frames.ts). The Sun sits at the origin. Planet positions come from
 * astronomy-engine each frame; custom objects are placed by an explicit
 * trajectory (e.g. a JPL Horizons vector table) and interpolated by time.
 */
export class SolarSystemEngine {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  // Renders billboarded HTML text labels in a transparent layer over the canvas.
  private readonly labelRenderer: CSS2DRenderer;
  public readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly resizeObserver: ResizeObserver;
  // All camera interaction (orbit, wheel-dolly, click-to-focus, adaptive
  // clipping). The engine owns the camera object; the controller drives it.
  private readonly cameraController: CameraController;
  // The shared pick seam: bodies register into it, the camera reads from it.
  private readonly picks = new PickRegistry();

  // The root of the body tree (see engine/README.md). Every entity's object3D is
  // parented here; it sits at the world origin (the Sun), so children expressed in
  // the heliocentric frame need no transform of their own.
  private readonly solarSystem = new THREE.Group();
  // Everything the engine advances each frame. The engine calls update(ctx) on
  // each and knows nothing else about them — see SceneEntity / bodies/.
  private readonly entities: SceneEntity[] = [];

  // The Earth body, kept so annotations (Lagrange points) can attach to it.
  private readonly earthBody: Body;
  // Every planet body by name, so a spacecraft can name the body it orbits and be
  // parented under it (see setSpacecraft).
  private readonly bodiesByName = new Map<string, Body>();
  // The single spacecraft entity, kept so it can be rebuilt/replaced without
  // touching the rest of the scene. Null until setSpacecraft is first called.
  private spacecraft: SpacecraftEntity | null = null;
  // Geometries/materials we create and must dispose to free GPU memory.
  private readonly disposables: Array<{ dispose: () => void }> = [];

  // Body sizing: true-scale vs. the compressed power-law (see sizing.ts + options).
  private readonly sizeModel: SizeModel;
  // The screen-space visibility floor in px, passed to each body (0 = no floor).
  private readonly minPixelRadius: number;

  // Selective-bloom post-processing (only the Sun and orbit dots glow). Owns the
  // two-composer pipeline; the engine just calls render()/setSize()/dispose().
  private readonly pipeline: BloomPipeline;

  private simTimeMs: number;
  private timeScale: number; // simulated seconds per real second (1 = real-time)
  private rafId: number | null = null;
  private lastFrameMs: number | null = null;
  private disposed = false;

  constructor(container: HTMLElement, options: EngineOptions = {}) {
    this.container = container;
    this.simTimeMs = (options.startDate ?? new Date()).getTime();
    this.timeScale = options.timeScale ?? 1;
    this.sizeModel = {
      sizeScale: options.sizeScale ?? 4.0,
      sizeCompression: options.sizeCompression ?? 0.5,
      trueScale: options.trueScale ?? false,
    };
    this.minPixelRadius = options.minPixelRadius ?? 0;

    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(width, height);
    container.appendChild(this.renderer.domElement);

    // A transparent overlay for text labels, pinned over the canvas. pointer-
    // events off so it never steals drags/zoom from OrbitControls beneath it.
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(width, height);
    const labelEl = this.labelRenderer.domElement;
    labelEl.style.position = 'absolute';
    labelEl.style.top = '0';
    labelEl.style.left = '0';
    labelEl.style.pointerEvents = 'none';
    container.appendChild(labelEl);

    this.scene = new THREE.Scene();
    // Dark fallback until (and unless) a skybox panorama finishes loading.
    this.scene.background = new THREE.Color(0x05070d);
    if (options.skyboxUrl) this.loadSkybox(options.skyboxUrl);

    // The tree root, at the origin. Entities parent here; the Sun is the first.
    this.solarSystem.name = 'SolarSystemGroup';
    this.scene.add(this.solarSystem);

    // near/far are placeholders — updateAdaptiveClipping() rewrites them every
    // frame from the view distance, so we can fly from 60 AU down onto a
    // true-scale globe without a fixed near plane clipping it first.
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.001, 5000);

    // All camera interaction lives in the controller: it creates the OrbitControls,
    // wires the pointer/wheel handlers, frames the initial focus, and reads `picks`
    // to decide what to orbit/zoom toward.
    this.cameraController = new CameraController(
      this.camera,
      this.renderer.domElement,
      this.picks,
      {
        focus: options.focus ?? { x: 0, y: 0, z: 0 },
        viewDistance: options.viewDistance ?? 3,
        minDistance: options.minDistance ?? 1e-5,
        maxDistance: options.maxDistance ?? 60,
      },
    );

    // The Sun lights everything from the origin. decay = 0 disables inverse-
    // square falloff so Neptune at 30 AU is lit the same as Mercury; a faint
    // ambient keeps the night side from reading as a hole in space while still
    // leaving a strong, clearly dark terminator on the side facing away.
    const sunLight = new THREE.PointLight(0xffffff, 2.5, 0, 0);
    this.scene.add(sunLight);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.04));

    // The body tree: the Sun at the origin, then the eight planets (Earth
    // carrying the Moon as a child) — each a self-positioning, self-updating
    // entity. Lagrange points and trajectory objects join later, via
    // addLagrangePoints / setSpacecraft, as more entities.
    this.addEntity(new SunEntity(this.sizeModel, this.picks));
    const { bodies, earth } = createPlanetBodies({
      sizeModel: this.sizeModel,
      minPixelRadius: this.minPixelRadius,
      picks: this.picks,
    });
    this.earthBody = earth;
    for (const body of bodies) {
      this.addEntity(body);
      this.bodiesByName.set(body.name, body);
    }
    // Position every body and fill its orbit trail before the first render.
    const initCtx = this.frameContext(0);
    for (const entity of this.entities) entity.update(initCtx);

    this.pipeline = new BloomPipeline(this.renderer, this.scene, this.camera, width, height);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
  }

  /** Parent an entity under the solar-system group and enlist it for per-frame updates. */
  private addEntity(entity: SceneEntity): void {
    this.solarSystem.add(entity.object3D);
    this.entities.push(entity);
  }

  /** Bundle this frame's inputs for the entity update pass. */
  private frameContext(dt: number): FrameContext {
    return {
      simTimeMs: this.simTimeMs,
      dt,
      camera: this.camera,
      viewportHeight: this.renderer.domElement.clientHeight || 1,
    };
  }

  /**
   * Load an equirectangular panorama and set it as the scene background. Async:
   * the fallback colour stays until it resolves. If the engine is torn down
   * first, drop the texture rather than touch a dead scene.
   */
  private loadSkybox(url: string): void {
    loadSkyboxTexture(url, (texture) => {
      // If the engine was torn down before the load resolved, drop the texture
      // rather than touch a dead scene.
      if (this.disposed) {
        texture.dispose();
        return;
      }
      this.scene.background = texture;
      this.disposables.push(texture);
    });
  }

  /** Recentre the camera on a heliocentric ecliptic point (AU). */
  focusOn(focus: Vec3, distance = 2): void {
    this.cameraController.focusOn(focus, distance);
  }

  /**
   * Set (or replace) the spacecraft placed by an explicit trajectory. It becomes
   * a body-tree entity that draws the full path and rides a marker along it,
   * interpolated from the current simulation time — see SpacecraftEntity.
   *
   * Its trajectory points are offsets from the body named by `config.parentBody`,
   * so the craft is parented under that body's position and its path rides along,
   * like a moon (RST's L2 halo loops around Earth and travels with it). Calling
   * this again rebuilds only the spacecraft, reusing the caller's model object —
   * the old entity's own geometry is disposed and its marker/label torn down, but
   * the shared model isn't. Throws if `parentBody` names no known body.
   */
  setSpacecraft(config: TrajectoryObjectConfig): void {
    const parent = this.bodiesByName.get(config.parentBody);
    if (!parent) {
      throw new Error(
        `setSpacecraft: unknown parentBody "${config.parentBody}" (known: ${[...this.bodiesByName.keys()].join(', ')})`,
      );
    }

    if (this.spacecraft) {
      const idx = this.entities.indexOf(this.spacecraft);
      if (idx >= 0) this.entities.splice(idx, 1);
      this.spacecraft.object3D.parent?.remove(this.spacecraft.object3D);
      this.spacecraft.dispose();
      this.spacecraft = null;
    }

    const entity = new SpacecraftEntity(config, this.picks);
    // Ride the parent body's position (added under its placement, like a moon),
    // so the craft's offsets land at the right heliocentric spot and its path
    // travels with the parent. The parent updates before this entity (it was
    // added first), so its world transform is current when the marker is placed.
    parent.addRider(entity.object3D);
    this.entities.push(entity);
    this.spacecraft = entity;
    // Place it now so it's correct before the first frame.
    entity.update(this.frameContext(0));
  }

  /**
   * Show the Sun–Earth Lagrange points as an annotation on the Earth body. They
   * look like fixed dots but are recomputed from Earth's live position every
   * frame, since the points co-rotate with Earth (see lagrange.ts). Pass `names`
   * to show a subset — e.g. just L2 (where RST lives) and L3. The group is owned
   * by the Earth body, so it moves, updates and disposes with it.
   */
  addLagrangePoints(config: LagrangeConfig = {}): void {
    const group = new LagrangeGroup(config, this.picks);
    this.earthBody.attach(group);
    // Position the markers now so they're correct before the first frame.
    group.update(this.frameContext(0));
  }

  /** Jump the simulation to a specific instant. */
  setDate(date: Date): void {
    this.simTimeMs = date.getTime();
    // dt 0: scrubbing repositions every entity (bodies, their attachments, the
    // spacecraft) but doesn't advance ambient animation.
    const ctx = this.frameContext(0);
    for (const entity of this.entities) entity.update(ctx);
  }

  /** Current simulation instant. */
  getDate(): Date {
    return new Date(this.simTimeMs);
  }

  /** Change the clock rate: simulated seconds advanced per real second. */
  setTimeScale(secondsPerSecond: number): void {
    this.timeScale = secondsPerSecond;
  }

  /** Current clock rate (simulated seconds per real second). */
  getTimeScale(): number {
    return this.timeScale;
  }

  /** Return the camera to its initial focus and framing. */
  recenter(): void {
    this.cameraController.recenter();
  }

  /** Begin the animation loop. Idempotent. */
  start(): void {
    if (this.rafId !== null) return;
    this.lastFrameMs = null;
    const loop = (now: number): void => {
      this.rafId = requestAnimationFrame(loop);
      const dt = this.lastFrameMs === null ? 0 : (now - this.lastFrameMs) / 1000;
      this.lastFrameMs = now;

      // timeScale is simulated seconds per real second; dt is real seconds.
      this.simTimeMs += dt * this.timeScale * 1000;
      // Advance every entity — the Sun, the planets (each positions, spins,
      // floors, trails and updates its attachments), and the spacecraft. That's
      // the whole scene: the engine no longer touches any body directly.
      const ctx = this.frameContext(dt);
      for (const entity of this.entities) entity.update(ctx);

      // Drive the camera: follow any focused body, settle the controls, retune
      // the clip planes. Bodies floored themselves in their own update above.
      this.cameraController.update(dt);
      this.pipeline.render();
      this.labelRenderer.render(this.scene, this.camera);
    };
    this.rafId = requestAnimationFrame(loop);
    this.resizeObserver.observe(this.container);
  }

  /** Pause the animation loop. */
  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.resizeObserver.disconnect();
  }

  private handleResize(): void {
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.labelRenderer.setSize(width, height);
    // Keep the post-processing chain matched to the canvas.
    this.pipeline.setSize(width, height);
  }

  /** Fully release GPU resources, the canvas, and listeners. */
  dispose(): void {
    this.disposed = true;
    this.stop();
    // The controller owns the OrbitControls and the pointer/wheel listeners.
    this.cameraController.dispose();
    // The pipeline owns its composers/render targets and the dark material.
    this.pipeline.dispose();
    // Entities own their own GPU resources (they aren't in `disposables`).
    for (const entity of this.entities) entity.dispose();
    for (const resource of this.disposables) resource.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    // Tear down the label overlay and its DOM nodes.
    if (this.labelRenderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.labelRenderer.domElement);
    }
  }
}
