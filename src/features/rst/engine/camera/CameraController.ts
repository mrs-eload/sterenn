import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { eclipticToWorld } from '../frames';
import type { Vec3 } from '../types';
import type { PickRegistry } from './PickRegistry';

// Frame-local scratch, reused to avoid per-frame allocation in the input/render loop.
const _screenCentre = new THREE.Vector2(0, 0); // NDC centre, for pivot/zoom raycasts
const _dollyOffset = new THREE.Vector3(); // camera→target offset, reused in onWheel
const _focusTarget = new THREE.Vector3(); // focused body's live world position, per frame
const _focusDelta = new THREE.Vector3(); // per-frame pan applied for click-to-focus
const _pointerNdc = new THREE.Vector2(); // pointer position in NDC, for click raycasts

// A pointer that moves less than this (in CSS px, squared) between down and up is
// a click, not a drag: a drag rotates, a click focuses the body under it.
const CLICK_SLOP_SQ = 5 * 5;

export interface CameraControllerOptions {
  /** Where the camera orbits/zooms initially and where recenter() returns to (ecliptic AU). */
  focus: Vec3;
  /** Initial camera distance from the focus (AU). */
  viewDistance: number;
  /** Closest / farthest the camera may zoom (AU). */
  minDistance: number;
  maxDistance: number;
}

/**
 * All camera interaction, lifted out of the engine. Owns the OrbitControls and
 * every pointer/wheel handler; the engine just constructs it, calls update(dt)
 * once a frame, and delegates focusOn/recenter to it. It borrows the camera (the
 * engine still owns that object for rendering/sizing) and reads the shared
 * PickRegistry to decide what to pivot on or fly toward — so it never touches a
 * body directly.
 *
 * One rule ties zoom and rotation together: the point at screen-centre is the
 * pivot. Both re-anchor `controls.target` to it, so you rotate around whatever
 * you've centred and zoom flies straight toward it. Because that point is always
 * dead-ahead on the view axis, moving the target there never swings the view
 * (OrbitControls does camera.lookAt(target) every frame) — it only sets the orbit
 * radius. Rotation stages the pivot on left-button-down and commits on the first
 * drag move, so a bare click changes nothing (and instead focuses the body).
 */
export class CameraController {
  readonly controls: OrbitControls;

  // Cursor-pivot rotation: raycast against the pickables on drag-start; fall back
  // to the ecliptic plane where the cursor is over empty space.
  private readonly raycaster = new THREE.Raycaster();
  private readonly eclipticPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // Where recenter() returns the camera to.
  private readonly initialFocus: Vec3;
  private readonly initialViewDistance: number;

  // Pivot chosen on left-button-down, applied only if a drag actually follows —
  // so a bare click never moves anything.
  private pendingPivot: THREE.Vector3 | null = null;
  // Click-vs-drag discrimination: where the pointer went down (CSS px) and whether
  // it has since moved past CLICK_SLOP. A pointer-up with no move is a click →
  // focus the body under it; a move is a drag → rotate.
  private pointerDownScreen: { x: number; y: number } | null = null;
  private pointerMoved = false;

  // Click-to-focus: the body the camera is locked onto, or null. A click both
  // slews the body to screen-centre (a one-shot ease, `centeringFocus`) and, from
  // then on, follows the body's own motion so it stays framed where you left it.
  // The ongoing follow tracks only the body's *drift* between frames — it never
  // drags the orbit target back onto the body — so you can pan the body off-centre
  // and it stays there. The body remains the rotation and zoom pivot.
  private focusedBody: THREE.Object3D | null = null;
  // The focused body's world position last frame, for the drift-follow. Null means
  // "re-seed on the next frame" (just after a click), so we don't apply a spurious
  // jump the first frame.
  private focusPrevPos: THREE.Vector3 | null = null;
  // True only during the brief slew that brings a freshly clicked body to centre;
  // cleared once it arrives, after which pans are no longer pulled back.
  private centeringFocus = false;
  // Time constant (s) of the centre slew: small = a snappy slew.
  private readonly focusTau = 0.15;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly domElement: HTMLElement,
    private readonly picks: PickRegistry,
    options: CameraControllerOptions,
  ) {
    this.initialFocus = options.focus;
    this.initialViewDistance = options.viewDistance;

    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    // Small enough (in AU) to reach a true-scale terrestrial planet's surface
    // (~2e-5 AU radius). The old 0.001 was ~44 Mars-radii — you'd stall far out.
    this.controls.minDistance = options.minDistance;
    this.controls.maxDistance = options.maxDistance;
    // Zoom is handled by our own wheel dolly (onWheel), NOT OrbitControls'.
    // zoomToCursor's target-migration was the source of the "zoom stalls until I
    // pan" bug: it left the orbit target floating in empty space, so the radius
    // clamp bit long before you reached the planet. We instead re-anchor the
    // target to screen-centre before each dolly, so zoom always flies straight
    // toward whatever is centred and only stops at its surface.
    this.controls.enableZoom = false;

    // Orbit/zoom around the subject rather than always the Sun.
    this.setFocus(options.focus, options.viewDistance);

    // Capture phase so we re-pivot BEFORE OrbitControls handles the same event.
    domElement.addEventListener('pointerdown', this.onPointerDown, true);
    domElement.addEventListener('pointermove', this.onPointerMove, true);
    domElement.addEventListener('pointerup', this.onPointerUp, true);
    // Our own zoom (OrbitControls' is disabled). passive:false so we can
    // preventDefault the page scroll.
    domElement.addEventListener('wheel', this.onWheel, { passive: false });
  }

  /**
   * One frame: slew/follow a click-focused body before OrbitControls settles (so
   * the pan composes with any in-progress rotation or damping), settle the
   * controls, then retune the clip planes to the new view distance.
   */
  update(dt: number): void {
    this.updateFocusFollow(dt);
    this.controls.update();
    this.updateAdaptiveClipping();
  }

  /** Recentre the camera on a heliocentric ecliptic point (AU). */
  focusOn(focus: Vec3, distance = 2): void {
    this.setFocus(focus, distance);
  }

  /** Return the camera to its initial focus and framing. */
  recenter(): void {
    this.setFocus(this.initialFocus, this.initialViewDistance);
  }

  dispose(): void {
    this.domElement.removeEventListener('pointerdown', this.onPointerDown, true);
    this.domElement.removeEventListener('pointermove', this.onPointerMove, true);
    this.domElement.removeEventListener('pointerup', this.onPointerUp, true);
    this.domElement.removeEventListener('wheel', this.onWheel);
    this.controls.dispose();
  }

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
    const rect = this.domElement.getBoundingClientRect();
    _pointerNdc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(_pointerNdc, this.camera);
    // Recurse: a registered pickable may be a Group with no geometry of its own
    // (a loaded spacecraft model like RST) — the ray hits its child meshes, and
    // resolvePivotRoot walks back up to the object we registered.
    const hit = this.raycaster.intersectObjects(this.picks.pickables, true)[0]?.object ?? null;
    return this.picks.resolvePivotRoot(hit);
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
    const hits = this.raycaster.intersectObjects(this.picks.pickables, false);
    for (let o: THREE.Object3D | null = hits[0]?.object ?? null; o; o = o.parent) {
      if (this.picks.isBody(o)) return o;
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
      const radius = this.picks.radiusOf(body) ?? 0;
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

  /**
   * Point the camera at a heliocentric ecliptic position (AU) and back it off by
   * `distance` along a fixed oblique angle, so the controls orbit and zoom around
   * that point rather than the Sun.
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

  /**
   * Slide the near/far planes with the view distance. A fixed near plane can't
   * serve both a 60-AU whole-system shot and a planet surface 1e-5 AU away: too
   * far and it clips the globe, too near and depth precision collapses across the
   * huge range. Tying both planes to the camera-to-target distance keeps a
   * constant far/near ratio (~1e5), so the near plane shrinks as you approach and
   * never clips what you're flying toward, while the far plane still reaches the
   * rest of the scene at any zoom. The skybox is a background (not depth-tested),
   * so it's always drawn regardless.
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
}
