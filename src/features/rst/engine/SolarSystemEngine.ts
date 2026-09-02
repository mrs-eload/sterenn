import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { Body } from 'astronomy-engine';
import { BloomPipeline, BLOOM_LAYER } from './render/BloomPipeline';
import { loadSkyboxTexture } from './render/skybox';
import { addLabel } from './labels';
import { drawnRadius, pixelFloorScale, worldPerPixelAtUnitDistance } from './sizing';
import type { SizeModel } from './sizing';
import { KM_PER_AU, eclipticToWorld } from './frames';
import { planetPosition, geoMoonPosition } from './ephemeris';
import { PLANETS } from './bodies/planets.ts';
import { LAGRANGE_NAMES, sunEarthLagrangePoints } from './bodies/lagrange.ts';
import type { LagrangeName } from './bodies/lagrange.ts';
import { createEarth } from './bodies/earth.ts';
import type { EarthHandle } from './bodies/earth.ts';
import { createSun } from './bodies/sun.ts';
import type { SunHandle } from './bodies/sun.ts';
import { createMoon } from './bodies/moon.ts';
import type { PlanetHandle as PlanetBodyHandle } from './bodies/planetBody.ts';
import type { EngineOptions, TrajectoryObjectConfig, Vec3 } from './types';
import { Object3D } from "three";

interface PlanetHandle {
  body: Body;
  // An Object3D, not strictly a Mesh: Earth is a group (globe + clouds).
  mesh: THREE.Object3D;
  // The world radius the mesh geometry was built at. The pixel floor scales the
  // mesh relative to this, so a scale of 1 always means "true drawn size".
  baseRadius: number;
}

interface WorldPoint {
  t: number;
  pos: [number, number, number];
}

/**
 * A planet's dotted orbit trail. `samples` is the precomputed fine orbit (K×3
 * world coords, equal steps in time over one period); `positions` is the small
 * per-frame buffer the Points geometry draws, refilled from `samples` at a
 * variable density anchored to the planet's current phase (see updateOrbitTrails).
 */
interface OrbitTrail {
  geometry: THREE.BufferGeometry;
  positions: Float32Array;
  samples: Float32Array;
  periodMs: number;
  t0Ms: number;
  // If set, `samples` are offsets FROM this body (e.g. the Moon's ring is
  // geocentric): each frame the anchor's live world position is added back in, so
  // the ring rides along with it. Absent for heliocentric orbits (planets).
  anchor?: THREE.Object3D;
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

// The Sun's true radius (695,700 km) in AU, so it's to scale like the planets.
const SUN_RADIUS_AU = 695_700 / KM_PER_AU;

// The Moon's true mean radius (km) and sidereal orbital period about Earth (days).
const MOON_RADIUS_KM = 1737.4;
const MOON_SIDEREAL_DAYS = 27.321661;

const DAY_MS = 86_400_000;

// Orbit trails are drawn as dotted comet-tails, dense at the planet's live
// position and spreading out along the path it has already travelled. Each orbit
// is precomputed once as this many equal-time position samples over one period;
// every frame we read a variable-density subset from the table (no re-computing).
const ORBIT_SAMPLE_COUNT = 600;
// Cap on dots per orbit; the geometric spacing below usually settles well under it.
const ORBIT_DOT_COUNT = 260;

/**
 * Fraction-of-period offsets, one per orbit dot, measured *backward in time* from
 * the body's current position. The gaps grow geometrically, so dots crowd at the
 * body (the recent path) and spread out along the older trail behind it. We stop
 * short of a full period so the sparse tail never wraps back onto the dense head.
 */
function buildOrbitDotOffsets(): number[] {
  const offsets: number[] = [];
  let cursor = 0;
  let gap = 0.0002; // first gap: ~1.75 h for Earth, so the head reads solid
  const growth = 1.03; // gentle growth keeps the whole ring densely populated
  for (let i = 0; i < ORBIT_DOT_COUNT && cursor < 0.985; i += 1) {
    offsets.push(cursor);
    cursor += gap;
    gap *= growth;
  }
  return offsets;
}
const ORBIT_DOT_OFFSETS = buildOrbitDotOffsets();

// Frame-local scratch, reused to avoid per-frame allocation in the render loop.
const _dir = new THREE.Vector3();
const _origin = new THREE.Vector3(0, 0, 0);
const _worldUp = new THREE.Vector3(0, 1, 0); // ecliptic north in world space
const _lookMatrix = new THREE.Matrix4();
const _alignQuat = new THREE.Quaternion();
const _bodyWorld = new THREE.Vector3(); // a body's world position, for the pixel floor
const _screenCentre = new THREE.Vector2(0, 0); // NDC centre, for pivot/zoom raycasts
const _dollyOffset = new THREE.Vector3(); // camera→target offset, reused in onWheel
const _focusTarget = new THREE.Vector3(); // focused body's live world position, per frame
const _focusDelta = new THREE.Vector3(); // per-frame pan applied for click-to-focus
const _pointerNdc = new THREE.Vector2(); // pointer position in NDC, for click raycasts
const _anchorWorld = new THREE.Vector3(); // a trail anchor's world position (e.g. Earth, for the Moon ring)

// A pointer that moves less than this (in CSS px, squared) between down and up is
// a click, not a drag: a drag rotates, a click focuses the body under it.
const CLICK_SLOP_SQ = 5 * 5;

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
  private readonly controls: OrbitControls;
  private readonly resizeObserver: ResizeObserver;

  private readonly planets: PlanetHandle[] = [];
  // The realistic textured Earth, if built. Needs a per-frame update (spin +
  // day/night terminator) that the flat planets don't.
  private earth: EarthHandle | null = null;
  // The animated shader Sun. Its surface churn advances every frame off real dt.
  private sun: SunHandle | null = null;
  // The Moon (its own body file). Positioned each frame from its heliocentric
  // ephemeris, with a geocentric orbit ring that rides along with Earth.
  private moon: { handle: PlanetBodyHandle; baseRadius: number } | null = null;
  // Textured planets (all but Earth) that need a per-frame spin. See planetBody.ts.
  private readonly planetBodies: PlanetBodyHandle[] = [];
  private readonly trajectories: TrajectoryHandle[] = [];
  // One dotted comet-tail per planet orbit, refilled each frame from its table.
  private readonly orbitTrails: OrbitTrail[] = [];
  private readonly lagrangeMarkers: Array<{ name: LagrangeName; mesh: THREE.Mesh }> = [];
  // Geometries/materials we create and must dispose to free GPU memory.
  private readonly disposables: Array<{ dispose: () => void }> = [];
  // A soft round dot sprite, built once and shared by every orbit's Points
  // material so the paths read as dotted rings rather than solid lines.
  private dotTexture: THREE.CanvasTexture | null = null;

  // Cursor-pivot rotation: raycast against these on drag-start; fall back to the
  // ecliptic plane where the cursor is over empty space.
  private readonly raycaster = new THREE.Raycaster();
  private readonly eclipticPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly pickables: THREE.Object3D[] = [];
  // Pivot chosen on left-button-down, applied only if a drag actually follows —
  // so a bare click never moves anything.
  private pendingPivot: THREE.Vector3 | null = null;
  // Click-vs-drag discrimination: where the pointer went down (CSS px) and
  // whether it has since moved past CLICK_SLOP. A pointer-up with no move is a
  // click → focus the body under it; a move is a drag → rotate.
  private pointerDownScreen: { x: number; y: number } | null = null;
  private pointerMoved = false;

  // Click-to-focus: the body the camera is locked onto, or null. A click both
  // slews the body to screen-centre (a one-shot ease, `centeringFocus`) and, from
  // then on, follows the body's own motion so it stays framed where you left it.
  // Crucially the ongoing follow tracks only the body's *drift* between frames —
  // it never drags the orbit target back onto the body — so you can pan the body
  // off-centre and it stays there. The body remains the rotation and zoom pivot.
  private focusedBody: THREE.Object3D | null = null;
  // The focused body's world position last frame, for the drift-follow. Null
  // means "re-seed on the next frame" (just after a click), so we don't apply a
  // spurious jump the first frame.
  private focusPrevPos: THREE.Vector3 | null = null;
  // True only during the brief slew that brings a freshly clicked body to centre;
  // cleared once it arrives, after which pans are no longer pulled back.
  private centeringFocus = false;
  // Time constant (s) of the centre slew: small = a snappy slew.
  private readonly focusTau = 0.15;

  // Where recenter() returns the camera to.
  private readonly initialFocus: Vec3;
  private readonly initialViewDistance: number;

  // Body sizing: true-scale vs. the compressed power-law (see sizing.ts + options).
  private readonly sizeModel: SizeModel;
  // The screen-space visibility floor (see EngineOptions and applyBodyScales).
  private readonly minPixelRadius: number;
  // The Sun's base drawn radius, kept for the same per-frame rescale as the planets.
  private sunBaseRadius = 0;
  // Root object of each pickable body → its true radius (AU). Lets a raycast hit
  // (often a child mesh) resolve to the body's centre and size, so we orbit the
  // planet's centre and stop the zoom just outside its real surface.
  private readonly bodyRadii = new Map<THREE.Object3D, number>();

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
    this.initialFocus = options.focus ?? { x: 0, y: 0, z: 0 };
    this.initialViewDistance = options.viewDistance ?? 3;
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

    // near/far are placeholders — updateAdaptiveClipping() rewrites them every
    // frame from the view distance, so we can fly from 60 AU down onto a
    // true-scale globe without a fixed near plane clipping it first.
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.001, 5000);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    // Small enough (in AU) to reach a true-scale terrestrial planet's surface
    // (~2e-5 AU radius). The old 0.001 was ~44 Mars-radii — you'd stall far out.
    this.controls.minDistance = options.minDistance ?? 1e-5;
    this.controls.maxDistance = options.maxDistance ?? 60;
    // Zoom is handled by our own wheel dolly (onWheel), NOT OrbitControls'.
    // zoomToCursor's target-migration was the source of the "zoom stalls until
    // I pan" bug: it left the orbit target floating in empty space, so the
    // radius clamp bit long before you reached the planet. We instead re-anchor
    // the target to screen-centre before each dolly, so zoom always flies
    // straight toward whatever is centred and only stops at its surface.
    this.controls.enableZoom = false;

    // Orbit/zoom around the subject rather than always the Sun.
    this.setFocus(this.initialFocus, this.initialViewDistance);

    // The Sun lights everything from the origin. decay = 0 disables inverse-
    // square falloff so Neptune at 30 AU is lit the same as Mercury; a faint
    // ambient keeps the night side from reading as a hole in space while still
    // leaving a strong, clearly dark terminator on the side facing away.
    const sunLight = new THREE.PointLight(0xffffff, 2.5, 0, 0);
    this.scene.add(sunLight);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.04));

    this.buildSun();
    this.buildPlanets();
    // After the planets, so the Moon's ring can anchor to the built Earth.
    this.buildMoon();
    this.pipeline = new BloomPipeline(this.renderer, this.scene, this.camera, width, height);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());

    // Capture phase so we re-pivot BEFORE OrbitControls handles the same event.
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onPointerDown, true);
    el.addEventListener('pointermove', this.onPointerMove, true);
    el.addEventListener('pointerup', this.onPointerUp, true);
    // Our own zoom (OrbitControls' is disabled). passive:false so we can
    // preventDefault the page scroll.
    el.addEventListener('wheel', this.onWheel, { passive: false });
  }

  /**
   * One rule ties zoom and rotation together: the point at screen-centre is the
   * pivot. Both re-anchor `controls.target` to it, so you rotate around whatever
   * you've centred and zoom flies straight toward it. Because that point is
   * always dead-ahead on the view axis, moving the target there never swings the
   * view (OrbitControls does camera.lookAt(target) every frame) — it only sets
   * the orbit radius.
   *
   * Rotation stages the pivot on left-button-down and commits on the first drag
   * move, so a bare click changes nothing.
   */
  private readonly onPointerDown = (event: PointerEvent): void => {
    // Left button drives rotation and click-to-focus; leave pan (right/middle) alone.
    if (event.button !== 0) return;
    this.pointerDownScreen = { x: event.clientX, y: event.clientY };
    this.pointerMoved = false;
    // Stage a rotation pivot: a click-focused object wins (orbit exactly what you
    // locked onto, spacecraft included); else if a body is centred, orbit its
    // centre; else keep the existing target (already dead-ahead, so orbiting it
    // is right) — we do NOT snap to a far ecliptic-plane point, which made
    // rotation swing around a point past the planet. Committed on the first drag.
    this.pendingPivot =
      this.focusedBody?.getWorldPosition(new THREE.Vector3()) ?? this.centredBodyCentre();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.pointerDownScreen || this.pointerMoved) return;
    const dx = event.clientX - this.pointerDownScreen.x;
    const dy = event.clientY - this.pointerDownScreen.y;
    if (dx * dx + dy * dy <= CLICK_SLOP_SQ) return;
    // First movement past the slop: this is a drag, so commit the staged pivot.
    this.pointerMoved = true;
    if (this.pendingPivot) {
      this.controls.target.copy(this.pendingPivot);
      this.pendingPivot = null;
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const wasClick =
      event.button === 0 && this.pointerDownScreen !== null && !this.pointerMoved;
    this.pendingPivot = null;
    this.pointerDownScreen = null;
    if (!wasClick) return;
    // A bare left click focuses the body under the cursor (empty space releases
    // any focus). Arm the one-shot centre slew and re-seed the drift tracker so
    // updateFocusFollow brings it to screen-centre, then follows its motion.
    this.focusedBody = this.bodyAtPointer(event);
    this.focusPrevPos = null;
    this.centeringFocus = this.focusedBody !== null;
  };

  /** The pickable object under a pointer event, resolved to its pivot root, or null. */
  private bodyAtPointer(event: PointerEvent): THREE.Object3D | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    _pointerNdc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(_pointerNdc, this.camera);
    // Recurse: a registered pickable may be a Group with no geometry of its own
    // (a loaded spacecraft model like RST) — the ray hits its child meshes, and
    // resolvePivotRoot walks back up to the object we registered.
    const hit = this.raycaster.intersectObjects(this.pickables, true)[0]?.object ?? null;
    return this.resolvePivotRoot(hit);
  }

  /**
   * Resolve a raw raycast hit to the object we should pivot on: the nearest
   * ancestor we know a centre/size for (a planet, the Sun), else the nearest
   * ancestor we actually registered as pickable (a Lagrange marker, a spacecraft
   * model group). So clicking any part of any added object focuses that object,
   * not an arbitrary child mesh — which is what lets future spacecraft work with
   * no per-object wiring.
   */
  private resolvePivotRoot(hit: THREE.Object3D | null): THREE.Object3D | null {
    if (!hit) return null;
    for (let o: THREE.Object3D | null = hit; o; o = o.parent) {
      if (this.bodyRadii.has(o)) return o;
    }
    for (let o: THREE.Object3D | null = hit; o; o = o.parent) {
      if (this.pickables.includes(o)) return o;
    }
    return hit;
  }

  /**
   * Keep a click-focused body framed, in two independent parts:
   *
   *  1. Drift-follow (always): shift the orbit target and camera by the body's
   *     OWN movement since last frame. This keeps the body wherever you last put
   *     it — centred, or panned off to one side — as it travels, without ever
   *     yanking the target back onto the body. It's what lets pan work: a pan
   *     moves the target away from the body and this leaves that offset intact.
   *
   *  2. Centre slew (only just after a click): ease the target the rest of the
   *     way onto the body so the click brings it to screen-centre. It stops as
   *     soon as the body is centred, so it can't fight later pans.
   *
   * Both are framerate-independent (the slew is an exponential toward the body
   * with time constant focusTau), so the feel is identical at any frame rate.
   */
  private updateFocusFollow(dt: number): void {
    const body = this.focusedBody;
    if (!body) {
      this.focusPrevPos = null;
      return;
    }
    const pos = body.getWorldPosition(_focusTarget);

    // (1) Follow the body's own drift. Seed silently on the first frame after a
    // click (focusPrevPos null) so we don't apply a bogus jump.
    if (this.focusPrevPos) {
      _focusDelta.copy(pos).sub(this.focusPrevPos);
      this.controls.target.add(_focusDelta);
      this.camera.position.add(_focusDelta);
    } else {
      this.focusPrevPos = new THREE.Vector3();
    }
    this.focusPrevPos.copy(pos);

    // (2) One-shot slew to bring a freshly clicked body to centre.
    if (this.centeringFocus) {
      _focusDelta.copy(pos).sub(this.controls.target);
      const alpha = dt > 0 ? 1 - Math.exp(-dt / this.focusTau) : 1;
      _focusDelta.multiplyScalar(alpha);
      this.controls.target.add(_focusDelta);
      this.camera.position.add(_focusDelta);
      // Done once the body sits at the target, measured relative to the current
      // view distance so it's scale-independent (a near planet and a far one
      // both settle in the same number of frames).
      const viewRadius = this.camera.position.distanceTo(this.controls.target);
      if (pos.distanceTo(this.controls.target) < viewRadius * 1e-3) {
        this.centeringFocus = false;
      }
    }
  }

  /**
   * Fly toward (or away from) whatever is at screen-centre. We re-anchor the
   * orbit target first, then scale the camera→target distance. Anchoring is what
   * kills the old "zoom stalls until I pan" bug: the target sits on the thing
   * you're approaching, so the distance clamp only bites at its surface, never
   * out in empty space. A centred body anchors to its CENTRE and clamps the
   * dolly just outside its true surface, so you stop against the planet and then
   * orbit its centre cleanly. The step is exponential (constant ratio per
   * notch), so one scheme feels right from a 60-AU overview down to a surface.
   */
  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();

    const anchor = this.zoomAnchor();
    this.controls.target.copy(anchor.point);

    _dollyOffset.copy(this.camera.position).sub(this.controls.target);
    const radius = _dollyOffset.length();
    if (radius < 1e-12) return;

    // deltaY < 0 (scroll up) zooms in → factor < 1. 0.3 sets the notch strength.
    const factor = Math.exp((event.deltaY / 100) * 0.3);
    const next = Math.min(Math.max(radius * factor, anchor.minRadius), this.controls.maxDistance);
    _dollyOffset.setLength(next);
    this.camera.position.copy(this.controls.target).add(_dollyOffset);
    this.controls.update();
  };

  /** The body whose pickable is at screen-centre, resolved to its root, or null. */
  private centredBody(): THREE.Object3D | null {
    this.raycaster.setFromCamera(_screenCentre, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    for (let o: THREE.Object3D | null = hits[0]?.object ?? null; o; o = o.parent) {
      if (this.bodyRadii.has(o)) return o;
    }
    return null;
  }

  /** Centre (world AU) of the body at screen-centre, or null if none is centred. */
  private centredBodyCentre(): THREE.Vector3 | null {
    const body = this.centredBody();
    return body ? body.getWorldPosition(new THREE.Vector3()) : null;
  }

  /**
   * Where the wheel dolly aims, and how close it may get. A centred body → its
   * centre, stopping just outside its true surface. Empty space → the ecliptic
   * plane straight ahead (skipped if a grazing ray puts it absurdly far), else a
   * point at the current orbit radius; those clamp only at the global minimum.
   */
  private zoomAnchor(): { point: THREE.Vector3; minRadius: number } {
    // A click-focused object wins: zoom must fly toward whatever you locked onto,
    // even a spacecraft we have no radius for (radius 0 → stop at the global
    // floor). Otherwise fall back to whatever body is centred.
    const body = this.focusedBody ?? this.centredBody();
    if (body) {
      const radius = this.bodyRadii.get(body) ?? 0;
      return {
        point: body.getWorldPosition(new THREE.Vector3()),
        // Just clear of the surface, but never below the global floor.
        minRadius: Math.max(radius * 1.05, this.controls.minDistance),
      };
    }

    this.raycaster.setFromCamera(_screenCentre, this.camera);
    const onPlane = new THREE.Vector3();
    if (
      this.raycaster.ray.intersectPlane(this.eclipticPlane, onPlane) &&
      this.camera.position.distanceTo(onPlane) <= this.controls.maxDistance
    ) {
      return { point: onPlane, minRadius: this.controls.minDistance };
    }

    const radius = this.camera.position.distanceTo(this.controls.target);
    return {
      point: this.raycaster.ray.at(radius, new THREE.Vector3()),
      minRadius: this.controls.minDistance,
    };
  }

  /** Track a disposable resource for teardown, and return it for convenience. */
  private track<T extends { dispose: () => void }>(resource: T): T {
    this.disposables.push(resource);
    return resource;
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

  /**
   * Hold every body to a minimum apparent size (see sizing.ts for the maths).
   * A body scales *up* as you retreat so it never drops below the floor, then
   * relaxes to its true size the moment it's close enough to clear the floor on
   * its own — far away a guaranteed dot, up close honest proportions. The scale
   * is uniform, so textures, tilt, rings and Earth's atmosphere shell keep their
   * shape. Annotation markers (Lagrange, trajectory objects) are deliberately
   * excluded — their sizes are the caller's to choose.
   */
  private applyBodyScales(): void {
    if (this.minPixelRadius <= 0) return;
    const height = this.renderer.domElement.clientHeight || 1;
    const worldPerPixelPerDist = worldPerPixelAtUnitDistance(this.camera.fov, height);
    const cam = this.camera.position;

    const floorScale = (mesh: THREE.Object3D, baseRadius: number): void => {
      const dist = cam.distanceTo(mesh.getWorldPosition(_bodyWorld));
      mesh.scale.setScalar(pixelFloorScale(baseRadius, dist, worldPerPixelPerDist, this.minPixelRadius));
    };

    // if (this.sun) floorScale(this.sun.group, this.sunBaseRadius);
    for (const planet of this.planets) floorScale(planet.mesh, planet.baseRadius);
    if (this.moon) floorScale(this.moon.handle.object, this.moon.baseRadius);
  }

  /**
   * Slide the near/far planes with the view distance. A fixed near plane can't
   * serve both a 60-AU whole-system shot and a planet surface 1e-5 AU away: too
   * far and it clips the globe, too near and depth precision collapses across
   * the huge range. Tying both planes to the camera-to-target distance keeps a
   * constant far/near ratio (~1e5 — better than the old fixed 5e6), so the near
   * plane shrinks as you approach and never clips what you're flying toward,
   * while the far plane still reaches the rest of the scene at any zoom. The
   * skybox is a background (not depth-tested), so it's always drawn regardless.
   */
  private updateAdaptiveClipping(): void {
    const d = this.camera.position.distanceTo(this.controls.target);
    const near = Math.max(d * 1e-2, 1e-7);
    const far = Math.max(d * 1e3, 10);
    if (near !== this.camera.near || far !== this.camera.far) {
      this.camera.near = near;
      this.camera.far = far;
      this.camera.updateProjectionMatrix();
    }
  }

  private buildSun(): void {
    // An animated fBm-noise surface with a fresnel corona (see sun.ts). Still
    // unlit — the Sun is the light source, so its material ignores scene lights.
    this.sunBaseRadius = drawnRadius(SUN_RADIUS_AU, this.sizeModel);
    this.sun = this.track(createSun(this.sunBaseRadius));
    this.scene.add(this.sun.group);
    this.bodyRadii.set(this.sun.group, this.sunBaseRadius);
    addLabel(this.sun.group, 'Sun', '#ffcc66');
    // Put the disc and its corona on the bloom layer so they (and only they)
    // glow. enable() keeps layer 0 on, so they still render in the final scene.
    this.sun.group.traverse((o) => o.layers.enable(BLOOM_LAYER));
    // Pick against the lit disc, not the translucent corona shell.
    this.pickables.push(this.sun.core);
  }

  /**
   * A soft-edged white disc drawn once into a canvas and cached. PointsMaterial
   * without a map draws square dots; mapping this makes each orbit sample a round
   * dot with a feathered edge, which is what gives the dotted-ring look. Tinted
   * per orbit via the material's `color`.
   */
  private orbitDotTexture(): THREE.CanvasTexture {
    if (this.dotTexture) return this.dotTexture;
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const r = size / 2;
    const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
    gradient.addColorStop(0.0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.55, 'rgba(255,255,255,1)');
    gradient.addColorStop(1.0, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.dotTexture = this.track(texture);
    return texture;
  }

  /**
   * Build one body's dotted orbit trail. The orbit is sampled once into a fine
   * equal-time table (`samples`, world-space); the drawn dots are a small buffer
   * refilled each frame from that table at a density that crowds the body and
   * thins into the past (updateOrbitTrails). A fixed brightness ramp fades the
   * tail, so "where the body is now" reads brightest — the look the reference
   * shows. Pass `anchor` for a body that orbits another (the Moon): then the
   * samples are treated as offsets from that anchor's live position.
   */
  private addOrbitTrail(opts: {
    color: number;
    periodMs: number;
    t0Ms: number;
    sampleAt: (timeMs: number) => readonly [number, number, number];
    anchor?: THREE.Object3D;
  }): void {
    const { color, periodMs, t0Ms, sampleAt, anchor } = opts;

    const K = ORBIT_SAMPLE_COUNT;
    const samples = new Float32Array(K * 3);
    for (let i = 0; i < K; i += 1) {
      const [x, y, z] = sampleAt(t0Ms + (periodMs * i) / K);
      samples[i * 3] = x;
      samples[i * 3 + 1] = y;
      samples[i * 3 + 2] = z;
    }

    const dots = ORBIT_DOT_OFFSETS.length;
    const positions = new Float32Array(dots * 3); // (re)filled every frame
    const geometry = this.track(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Per-dot brightness ramp, constant across frames: full at the head (offset
    // 0, the planet), fading down the older tail. vertexColors multiplies this
    // onto the material's orbit colour.
    const colors = new Float32Array(dots * 3);
    for (let i = 0; i < dots; i += 1) {
      // Bright head, fading down the tail. The tight bloom radius keeps this
      // reading as a crisp shine rather than a spreading haze.
      const fade = 0.35 + 0.65 * (1 - i / Math.max(1, dots - 1));
      colors[i * 3] = fade;
      colors[i * 3 + 1] = fade;
      colors[i * 3 + 2] = fade;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = this.track(
      new THREE.PointsMaterial({
        color,
        vertexColors: true,
        map: this.orbitDotTexture(),
        // Constant pixel size at any zoom, so dots stay crisp from a whole-system
        // overview down to a close pass.
        size: 2.8,
        sizeAttenuation: false,
        transparent: true,
        opacity: 1,
        // Normal (not additive) blending: over the black sky the dots still read
        // bright, but they don't stack into hot spots where the ring is dense —
        // that stacking is what made the earlier version strobe.
        depthWrite: false,
      }),
    );

    const points = new THREE.Points(geometry, material);
    // Put the dots on the bloom layer (keeping layer 0 too) so the same glow pass
    // that lights the Sun blooms the orbits. Without this they'd be masked to
    // black in the bloom pass and stay matte.
    points.layers.enable(BLOOM_LAYER);
    this.scene.add(points);
    this.orbitTrails.push({ geometry, positions, samples, periodMs, t0Ms, anchor });
  }

  private buildPlanets(): void {
    const around = new Date(this.simTimeMs);
    for (const cfg of PLANETS) {
      const baseRadius = drawnRadius(cfg.radiusAu, this.sizeModel);
      let mesh: THREE.Object3D;
      if (cfg.body === Body.Earth) {
        // Earth gets the full realistic treatment (day/night/clouds); see earth.ts.
        this.earth = this.track(createEarth(baseRadius));
        mesh = this.earth.group;
        this.scene.add(mesh);
        // Pick against the globe child so click-to-pivot still lands on Earth.
        const globe = mesh.getObjectByName('Earth-globe');
        this.pickables.push(globe ?? mesh);
      } else if (cfg.create) {
        // Each other planet has its own file that builds a textured body (its
        // own map, tilt and spin). We add it, pick against its target, and keep
        // the handle so it gets spun every frame and disposed on teardown.
        const handle = this.track(cfg.create(baseRadius));
        this.planetBodies.push(handle);
        mesh = handle.object;
        this.scene.add(mesh);
        this.pickables.push(handle.pickTarget ?? mesh);
      } else {
        // Fallback for any planet without its own file: a flat coloured sphere.
        const geometry = this.track(
          new THREE.SphereGeometry(baseRadius, 24, 24),
        );
        const material = this.track(
          new THREE.MeshStandardMaterial({ color: cfg.color, roughness: 0.9, metalness: 0 }),
        );
        mesh = new THREE.Mesh(geometry, material);
        this.scene.add(mesh);
        this.pickables.push(mesh);
      }
      this.planets.push({ body: cfg.body, mesh, baseRadius });
      this.bodyRadii.set(mesh, baseRadius);
      // Name label in the planet's own colour. It tracks the mesh centre; the
      // per-frame pixel-floor scaling doesn't move it (the label sits at the
      // mesh origin, and its offset from the dot is screen-space, not world).
      addLabel(mesh, cfg.label, '#' + cfg.color.toString(16).padStart(6, '0'));

      // Orbit path: a dotted comet-tail, dense at the planet's live position and
      // spreading out along the older path behind it (see addOrbitTrail).
      this.addOrbitTrail({
        color: cfg.color,
        periodMs: cfg.orbitalPeriodDays * DAY_MS,
        t0Ms: around.getTime(),
        sampleAt: (timeMs) => eclipticToWorld(planetPosition(cfg.body, new Date(timeMs))),
      });
    }
    this.updatePlanetPositions();
  }

  /**
   * Build the Moon from its own body file (bodies/moon.ts): a lit grey sphere,
   * lit by the Sun so it shows phases, pickable/zoomable and spun like every other
   * body. Its orbit is drawn as a geocentric ring anchored to Earth — the Moon
   * orbits Earth, not the Sun, so a heliocentric ring would trace a meaningless
   * wiggle instead of a loop.
   */
  private buildMoon(): void {
    const baseRadius = drawnRadius(MOON_RADIUS_KM / KM_PER_AU, this.sizeModel);
    const handle = this.track(createMoon(baseRadius));
    const object = handle.object;
    this.scene.add(object);
    this.moon = { handle, baseRadius };
    this.pickables.push(handle.pickTarget ?? object);
    this.bodyRadii.set(object, baseRadius);
    addLabel(object, 'Moon', '#cfd3da');

    // Geocentric orbit ring: the samples are offsets from Earth (geoMoonPosition),
    // and updateOrbitTrails re-anchors them to Earth's live position each frame.
    if (this.earth) {
      this.addOrbitTrail({
        color: 0x9aa3b0,
        periodMs: MOON_SIDEREAL_DAYS * DAY_MS,
        t0Ms: this.simTimeMs,
        anchor: this.earth.group,
        sampleAt: (timeMs) => eclipticToWorld(geoMoonPosition(new Date(timeMs))),
      });
    }
    this.updateMoonPosition();
    // The planet trails were filled by buildPlanets; fill the Moon's now too so
    // it's correct even if something renders before the first animation frame.
    this.updateOrbitTrails();
  }

  /** Place and spin the Moon for the current sim time (position + tidal-lock spin). */
  private updateMoonPosition(): void {
    if (!this.moon) return;
    const [x, y, z] = eclipticToWorld(planetPosition(Body.Moon, new Date(this.simTimeMs)));
    this.moon.handle.object.position.set(x, y, z);
    this.moon.handle.update?.(this.simTimeMs);
  }

  private updatePlanetPositions(): void {
    const date = new Date(this.simTimeMs);
    for (const planet of this.planets) {
      const [x, y, z] = eclipticToWorld(planetPosition(planet.body, date));
      planet.mesh.position.set(x, y, z);
    }
    // Spin the textured planets on their axes (deterministic from sim time, so
    // scrubbing is exact). Positions and spin move together from one place.
    for (const body of this.planetBodies) body.update?.(this.simTimeMs);
    // Moon before the trails: its geocentric ring reads Earth's freshly-set
    // position (Earth is a planet above), and the ring is refilled in updateOrbitTrails.
    this.updateMoonPosition();
    this.updateOrbitTrails();
  }

  /**
   * Refill each orbit's dot buffer from its precomputed table. The head dot sits
   * at the planet's current orbital phase; every other dot steps a fixed fraction
   * of a period into the past (ORBIT_DOT_OFFSETS), with the gaps growing — so the
   * dots crowd the planet and spread out along the trail it came from. Positions
   * are interpolated between table entries, and the table is read circularly, so
   * the tail wraps smoothly around the loop. Cheap: only table lookups per frame.
   */
  private updateOrbitTrails(): void {
    const K = ORBIT_SAMPLE_COUNT;
    for (const trail of this.orbitTrails) {
      const phase = (this.simTimeMs - trail.t0Ms) / trail.periodMs;
      const head = phase - Math.floor(phase); // body's current phase, [0,1)
      // Geocentric rings (the Moon) store offsets from an anchor body; add its
      // live world position so the ring rides along. Heliocentric orbits: zero.
      let ax = 0;
      let ay = 0;
      let az = 0;
      if (trail.anchor) {
        trail.anchor.getWorldPosition(_anchorWorld);
        ax = _anchorWorld.x;
        ay = _anchorWorld.y;
        az = _anchorWorld.z;
      }
      const p = trail.positions;
      const s = trail.samples;
      let w = 0;
      for (let d = 0; d < ORBIT_DOT_OFFSETS.length; d += 1) {
        let f = head - ORBIT_DOT_OFFSETS[d];
        f -= Math.floor(f); // wrap into [0,1)
        const t = f * K;
        const lo = Math.floor(t) % K;
        const hi = (lo + 1) % K;
        const frac = t - Math.floor(t);
        const a = lo * 3;
        const b = hi * 3;
        p[w++] = ax + s[a] + (s[b] - s[a]) * frac;
        p[w++] = ay + s[a + 1] + (s[b + 1] - s[a + 1]) * frac;
        p[w++] = az + s[a + 2] + (s[b + 2] - s[a + 2]) * frac;
      }
      (trail.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  /**
   * Spin the Earth and refresh its day/night terminator. The Earth shader works
   * in world space (Sun at the origin), so it only needs Earth's world position,
   * already set by updatePlanetPositions just before this every frame.
   */
  private updateEarth(): void {
    if (!this.earth) return;
    this.earth.update(this.earth.group.position, this.simTimeMs);
  }

  /**
   * Point the camera at a heliocentric ecliptic position (AU) and back it off
   * by `distance` along a fixed oblique angle, so the controls orbit and zoom
   * around that point rather than the Sun.
   */
  private setFocus(focus: Vec3, distance: number): void {
    // An explicit reframe (initial load, Recenter, focusOn) releases any click-
    // focus lock so the camera doesn't immediately slew back to the old body.
    this.focusedBody = null;
    this.focusPrevPos = null;
    this.centeringFocus = false;
    const [tx, ty, tz] = eclipticToWorld(focus);
    this.controls.target.set(tx, ty, tz);
    // Elevated, pulled back along +Z for a three-quarter view of the ecliptic.
    const dir = new THREE.Vector3(0, 0.6, 1).normalize();
    this.camera.position.set(
      tx + dir.x * distance,
      ty + dir.y * distance,
      tz + dir.z * distance,
    );
    this.controls.update();
  }

  /** Recentre the camera on a heliocentric ecliptic point (AU). */
  focusOn(focus: Vec3, distance = 2): void {
    this.setFocus(focus, distance);
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
    this.pickables.push(marker);
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
      this.pickables.push(mesh);
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
    this.updatePlanetPositions();
    this.updateEarth();
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
    this.setFocus(this.initialFocus, this.initialViewDistance);
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
      // Surface churn runs on real elapsed time, independent of the sim clock.
      this.sun?.update(dt);
      this.updatePlanetPositions();
      this.updateEarth();
      this.updateLagrangePositions();
      for (const handle of this.trajectories) this.updateTrajectoryMarker(handle);

      // Slew/follow a click-focused body before OrbitControls settles this frame,
      // so the pan composes with any in-progress rotation or damping.
      this.updateFocusFollow(dt);
      this.controls.update();
      // Both depend on the camera's settled distance this frame: retune the
      // clip planes, then size bodies to the pixel floor.
      this.updateAdaptiveClipping();
      this.applyBodyScales();
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
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onPointerDown, true);
    el.removeEventListener('pointermove', this.onPointerMove, true);
    el.removeEventListener('pointerup', this.onPointerUp, true);
    el.removeEventListener('wheel', this.onWheel);
    this.controls.dispose();
    // The pipeline owns its composers/render targets and the dark material.
    this.pipeline.dispose();
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
