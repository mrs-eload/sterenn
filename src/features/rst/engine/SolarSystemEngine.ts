import * as THREE from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { Body } from 'astronomy-engine';
import { BloomPipeline } from './render/BloomPipeline';
import { loadSkyboxTexture } from './render/skybox';
import { PickRegistry } from './camera/PickRegistry';
import { CameraController } from './camera/CameraController';
import { addLabel } from './labels';
import type { SizeModel } from './sizing';
import type { FrameContext, SceneEntity } from './SceneEntity';
import { eclipticToWorld } from './frames';
import { planetPosition } from './ephemeris';
import { LAGRANGE_NAMES, sunEarthLagrangePoints } from './bodies/lagrange.ts';
import type { LagrangeName } from './bodies/lagrange.ts';
import { SunEntity } from './bodies/SunEntity';
import { createPlanetBodies } from './bodies/solarSystem';
import type { EngineOptions, TrajectoryObjectConfig, Vec3 } from './types';
import { Object3D } from "three";

interface WorldPoint {
  t: number;
  pos: [number, number, number];
}

interface TrajectoryHandle {
  marker: THREE.Mesh |Object3D;
  points: WorldPoint[];
  /** Rotate the marker so its +Z nose axis tracks the trajectory tangent. */
  orient: boolean;
  /**
   * The marker's own rotation at add-time, kept as a calibration offset. Each
   * frame the tangent orientation is composed on top of it, so a caller can
   * still trim the model's nose/roll via its base rotation.
   */
  baseQuat: THREE.Quaternion;
}

// Frame-local scratch, reused to avoid per-frame allocation in the render loop.
// (Trajectory-orientation maths; body positioning/trails/floor moved to bodies/.)
const _dir = new THREE.Vector3();
const _origin = new THREE.Vector3(0, 0, 0);
const _worldUp = new THREE.Vector3(0, 1, 0); // ecliptic north in world space
const _lookMatrix = new THREE.Matrix4();
const _alignQuat = new THREE.Quaternion();

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

  private readonly trajectories: TrajectoryHandle[] = [];
  private readonly lagrangeMarkers: Array<{ name: LagrangeName; mesh: THREE.Mesh }> = [];
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
    // entity. Annotations (Lagrange, trajectory objects) are still added the old
    // flat way; later slices move them too.
    this.addEntity(new SunEntity(this.sizeModel, this.picks));
    for (const body of createPlanetBodies({
      sizeModel: this.sizeModel,
      minPixelRadius: this.minPixelRadius,
      startTimeMs: this.simTimeMs,
      picks: this.picks,
    })) {
      this.addEntity(body);
    }
    // Position every body and fill its orbit trail before the first render.
    const initCtx = this.frameContext(0);
    for (const entity of this.entities) entity.update(initCtx);

    this.pipeline = new BloomPipeline(this.renderer, this.scene, this.camera, width, height);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
  }

  /** Track a disposable resource for teardown, and return it for convenience. */
  private track<T extends { dispose: () => void }>(resource: T): T {
    this.disposables.push(resource);
    return resource;
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
   * Add a custom object placed by an explicit trajectory (heliocentric ecliptic
   * AU points). Draws the full path and a marker that rides along it, its
   * position interpolated from the current simulation time.
   */
  addTrajectoryObject(config: TrajectoryObjectConfig): void {

    let geometry, material, marker;

    const points: WorldPoint[] = config.points.map((p) => ({
      t: p.timeMs,
      pos: eclipticToWorld(p.position),
    }));

    const pathPoints = points.map((p) => new THREE.Vector3(...p.pos));
    const pathGeometry = this.track(new THREE.BufferGeometry().setFromPoints(pathPoints));
    const pathMaterial = this.track(
      new THREE.LineBasicMaterial({ color: config.pathColor ?? config.color }),
    );
    this.scene.add(new THREE.Line(pathGeometry, pathMaterial));


    if(!config.object){
      geometry = new THREE.SphereGeometry(config.radius ?? 0.04, 16, 16);
      material = new THREE.MeshBasicMaterial({ color: config.color });
      const markerGeometry = this.track(geometry);
      const markerMaterial = this.track(material);
      marker = new THREE.Mesh(markerGeometry, markerMaterial);
    }else{
      marker = config.object;
    }



    this.scene.add(marker);
    this.picks.addPickable(marker);
    if (config.label) {
      const cssColor = '#' + config.color.toString(16).padStart(6, '0');
      addLabel(marker, config.label, cssColor);
    }

    const handle: TrajectoryHandle = {
      marker,
      points,
      // A sphere marker has no meaningful heading; only orient custom objects.
      orient: Boolean(config.orientToTrajectory && config.object),
      baseQuat: marker.quaternion.clone(),
    };
    this.updateTrajectoryMarker(handle);
    this.trajectories.push(handle);
  }

  /** Position a marker at the simulation time by interpolating its points. */
  private updateTrajectoryMarker(handle: TrajectoryHandle): void {
    const s = handle.points;
    if (s.length === 0) return;

    // Resolve the segment [lo, hi] and interpolation fraction for the current
    // time. The ends are clamped to the known ephemeris rather than
    // extrapolated; the adjacent segment still gives a heading there.
    let lo: number;
    let hi: number;
    if (this.simTimeMs <= s[0].t) {
      lo = 0;
      hi = Math.min(1, s.length - 1);
      handle.marker.position.set(...s[0].pos);
    } else if (this.simTimeMs >= s[s.length - 1].t) {
      hi = s.length - 1;
      lo = Math.max(0, hi - 1);
      handle.marker.position.set(...s[hi].pos);
    } else {
      // Binary search for the segment straddling the current time.
      lo = 0;
      hi = s.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (s[mid].t <= this.simTimeMs) lo = mid;
        else hi = mid;
      }
      const a = s[lo];
      const b = s[hi];
      const f = (this.simTimeMs - a.t) / (b.t - a.t || 1);
      handle.marker.position.set(
        a.pos[0] + (b.pos[0] - a.pos[0]) * f,
        a.pos[1] + (b.pos[1] - a.pos[1]) * f,
        a.pos[2] + (b.pos[2] - a.pos[2]) * f,
      );
    }

    if (handle.orient && hi !== lo) {
      this.orientMarkerAlongTrajectory(handle, s[lo].pos, s[hi].pos);
    }
  }

  /**
   * Aim the marker's nose down the trajectory. The chord of the current segment
   * (from → to, world AU) is the direction of travel; we build a rotation whose
   * +Z axis points along it, using ecliptic north (+Y) as the up reference so
   * the model doesn't roll unpredictably. The marker's base rotation is then
   * composed back in, so a caller-set nose/roll trim survives.
   */
  private orientMarkerAlongTrajectory(
    handle: TrajectoryHandle,
    from: [number, number, number],
    to: [number, number, number],
  ): void {
    _dir.set(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    // Two coincident points give no heading; keep the previous orientation.
    if (_dir.lengthSq() < 1e-20) return;
    _dir.normalize();

    // Matrix4.lookAt(eye, target, up) sets +Z = normalize(eye - target); with
    // eye on the travel direction and target at the origin, +Z lands on the
    // tangent — matching Object3D.lookAt's "+Z toward target" for non-cameras.
    _lookMatrix.lookAt(_dir, _origin, _worldUp);
    _alignQuat.setFromRotationMatrix(_lookMatrix);
    handle.marker.quaternion.copy(_alignQuat).multiply(handle.baseQuat);
  }

  /**
   * Drop point markers at the Sun–Earth Lagrange points. They look like fixed
   * dots but are recomputed from Earth's live position every frame, since the
   * points co-rotate with Earth (see lagrange.ts). Pass `names` to show a
   * subset — e.g. just L2 (where RST lives) and L3.
   */
  addLagrangePoints(config: {
    names?: LagrangeName[];
    color?: number;
    radius?: number;
    labels?: boolean;
  } = {}): void {
    const names = config.names ?? LAGRANGE_NAMES;
    const radius = config.radius ?? 0.005;
    const color = config.color ?? 0xff5599;
    const cssColor = '#' + color.toString(16).padStart(6, '0');
    for (const name of names) {
      const geometry = this.track(new THREE.SphereGeometry(radius, 12, 12));
      // Unlit so a marker reads as an annotation, not a lit body.
      const material = this.track(new THREE.MeshBasicMaterial({ color }));
      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.set(0.01,0.01,0.01)
      mesh.name = name;
      this.scene.add(mesh);
      this.picks.addPickable(mesh);
      this.lagrangeMarkers.push({ name, mesh });
      if (config.labels) addLabel(mesh, name, cssColor);
    }
    this.updateLagrangePositions();
  }

  /** Re-place the Lagrange markers from Earth's position at the current time. */
  private updateLagrangePositions(): void {
    if (this.lagrangeMarkers.length === 0) return;
    const earth = planetPosition(Body.Earth, new Date(this.simTimeMs));
    const points = sunEarthLagrangePoints(earth);
    for (const { name, mesh } of this.lagrangeMarkers) {
      const [x, y, z] = eclipticToWorld(points[name]);
      mesh.position.set(x, y, z);
    }
  }

  /** Jump the simulation to a specific instant. */
  setDate(date: Date): void {
    this.simTimeMs = date.getTime();
    // dt 0: scrubbing repositions every body but doesn't advance ambient animation.
    const ctx = this.frameContext(0);
    for (const entity of this.entities) entity.update(ctx);
    this.updateLagrangePositions();
    for (const handle of this.trajectories) this.updateTrajectoryMarker(handle);
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
      // Advance every body (Sun, planets, Moon) — each positions, spins, floors
      // and refills its own trail. Annotations are still updated below.
      const ctx = this.frameContext(dt);
      for (const entity of this.entities) entity.update(ctx);
      this.updateLagrangePositions();
      for (const handle of this.trajectories) this.updateTrajectoryMarker(handle);

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
