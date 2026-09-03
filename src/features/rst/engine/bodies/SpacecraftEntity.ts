import * as THREE from 'three';
import type { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { addLabel } from '../labels';
import { eclipticToWorld } from '../frames';
import { BLOOM_LAYER } from '../render/BloomPipeline';
import type { FrameContext, SceneEntity } from '../SceneEntity';
import type { PickRegistry } from '../camera/PickRegistry';
import type { TrajectoryObjectConfig } from '../types';

// Frame-local scratch for the nose-alignment maths, reused every frame.
const _dir = new THREE.Vector3();
const _origin = new THREE.Vector3(0, 0, 0);
const _worldUp = new THREE.Vector3(0, 1, 0); // ecliptic north in world space
const _lookMatrix = new THREE.Matrix4();
const _alignQuat = new THREE.Quaternion();

// The raw Horizons table is hourly, so at a close zoom its straight chords between
// samples read as a polygon. We subdivide every segment with a Catmull-Rom spline
// into this many pieces so the drawn path is a smooth curve, always.
const PATH_SUBDIVISIONS = 24;
// Default dash+gap pairs across the WHOLE path; the future (dashed) slice shows its
// share. Expressed as a count so the dash length scales with the path, not the
// zoom-less absolute AU. This default suits a short (~month) halo; a much longer
// path would get proportionally longer dashes, so callers override it via
// config.dash.pairs (see TrajectoryObjectConfig) — JWST needs ~66× this.
const PATH_DASH_PAIRS = 100;
// Default gap/dash ratio (1 = equal dash and gap), overridable via config.dash.
const PATH_DASH_GAP_RATIO = 1;
// The flown line's oldest end fades in over this fraction of the path (a per-vertex
// brightness ramp toward black), so the track eases out of the dark instead of
// popping into existence at the first sample.
const PATH_START_FADE_FRACTION = 0.06;

// Beyond this much time from the live clock — in EITHER direction — the path is
// dimmed to barely visible, so a decade-long trajectory (JWST's years of L2 halo
// loops) collapses to a readable ~2-year window around 'now' instead of an opaque
// tangle. A short craft (RST's ~month) sits entirely inside the window, unchanged.
const PATH_TIME_WINDOW_MS = 365.25 * 24 * 3600 * 1000; // 1 year, full brightness
// The fade eases from full to PATH_FAR_BRIGHTNESS across this band past the window,
// so the 1-year boundary is a soft ramp, not a hard edge.
const PATH_TIME_FADE_MS = 0.25 * PATH_TIME_WINDOW_MS;
// Brightness (0..1, multiplied onto the line colour) of the far, out-of-window
// path. Low enough to read as "barely there" over the starfield, not fully gone.
const PATH_FAR_BRIGHTNESS = 0.05;

interface WorldPoint {
  t: number;
  pos: [number, number, number];
}

/**
 * One component of a uniform Catmull-Rom spline through p1→p2, tangents from the
 * neighbours p0,p3, at t in [0,1]. Interpolating and C¹ — it hugs the real path
 * between the hourly samples instead of cutting the chord.
 */
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

/**
 * A per-vertex brightness ramp for the flown line: 0 at the oldest vertex, eased up
 * to 1 over the first PATH_START_FADE_FRACTION of the curve, then flat. One value
 * per vertex (not yet expanded to r,g,b); the per-frame dimming multiplies the
 * clock-distance fade onto it and writes the final colours. Multiplied onto the
 * line's colour, it fades the start out into the black sky.
 */
function startFadeBrightness(count: number): Float32Array {
  const brightness = new Float32Array(count);
  const fadeEnd = Math.max(1, Math.floor(count * PATH_START_FADE_FRACTION));
  for (let i = 0; i < count; i += 1) {
    const t = Math.min(1, i / fadeEnd);
    brightness[i] = t * t * (3 - 2 * t); // smoothstep, so the fade-in has no hard corners
  }
  return brightness;
}

/**
 * Brightness (0..1) for a path vertex at time `vertexTimeMs`, given the live clock
 * `simTimeMs`: full inside PATH_TIME_WINDOW_MS of now, then smoothstepped down to
 * PATH_FAR_BRIGHTNESS across the fade band, flat beyond. Symmetric — the deep past
 * and far future both dim — so only the ~2-year span around now reads clearly.
 */
function clockDistanceBrightness(vertexTimeMs: number, simTimeMs: number): number {
  const d = Math.abs(vertexTimeMs - simTimeMs);
  if (d <= PATH_TIME_WINDOW_MS) return 1;
  const f = Math.min(1, (d - PATH_TIME_WINDOW_MS) / PATH_TIME_FADE_MS);
  const eased = f * f * (3 - 2 * f); // smoothstep
  return 1 + (PATH_FAR_BRIGHTNESS - 1) * eased; // 1 → PATH_FAR_BRIGHTNESS
}

/**
 * A spacecraft (or any object placed by an explicit trajectory: a comet, a
 * probe), as a body-tree entity. Its scene-graph shape mirrors a Body:
 *
 *   <id>SystemGroup            ← its parent frame's origin
 *   ├─ <id>PathFlown           ← solid glowing curve: the distance already covered
 *   ├─ <id>PathPredicted       ← dashed glowing curve: the remaining prediction
 *   └─ BodyPlacement           ← translated to the interpolated position each frame
 *      ├─ marker (BodyVisual)  ← the model, its nose aimed down the trajectory
 *      └─ Label
 *
 * The path is one smooth Catmull-Rom curve (see PATH_SUBDIVISIONS) split at the
 * live clock: solid where the craft has been, dashed where it's predicted to go.
 * Both lines sit on the bloom layer so the glow pass lights them like the orbit
 * trails — a soft shine, not a flat 1px line. The split is just a per-frame draw
 * range over the precomputed curve (cheap: no geometry rebuilt each frame).
 *
 * The entity is frame-agnostic: it draws its path and rides its marker using the
 * points exactly as given, in whatever parent frame its SystemGroup is added to.
 * The engine parents it under the body it orbits (config.parentBody), so the
 * points — offsets from that body — land at the right place and the whole path
 * rides the body, just like the Moon (RST's L2 halo travels with Earth). The
 * scene graph supplies the frame, so this code never adds an anchor.
 *
 * Unlike a planet it isn't an ephemeris body: its position is interpolated from
 * an explicit table (a JPL Horizons vector table), and its path is an open
 * polyline rather than the periodic dotted OrbitTrail. BodyPlacement carries only
 * translation, so the nose orientation applies directly to the marker in the
 * parent frame (which is axis-aligned with the world under a translate-only
 * placement, so ecliptic-north-up still holds).
 */
export class SpacecraftEntity implements SceneEntity {
  readonly object3D = new THREE.Group();
  private readonly placement = new THREE.Group();
  private readonly marker: THREE.Object3D;
  private readonly points: WorldPoint[];
  // The smooth curve, split at the clock. Both geometries share the same dense
  // vertices (as separate attributes, so each owns its GL buffer); their draw
  // ranges — solid up to the craft, dashed beyond — are retuned every frame.
  private readonly flownGeometry: THREE.BufferGeometry | null;
  private readonly predictedGeometry: THREE.BufferGeometry | null;
  // Per-vertex colour buffers, rewritten each frame by the clock-distance dimming
  // (see updatePathDimming). The flown colour also carries the static start-fade,
  // baked in via flownStartFade; the predicted line is dimmed the same way.
  private readonly flownColorAttr: THREE.BufferAttribute | null;
  private readonly predictedColorAttr: THREE.BufferAttribute | null;
  // The flown line's static start-fade brightness (one value per vertex), the base
  // the per-frame clock-distance fade multiplies onto.
  private readonly flownStartFade: Float32Array | null;
  // Clock time the colour buffers were last rebuilt for, so a still clock (paused)
  // doesn't repeat the O(n) rewrite every frame. NaN forces the first pass to run.
  private lastDimSimTimeMs = Number.NaN;
  // Sim time (ms) at each dense curve vertex, ascending — for the split search.
  private readonly curveTimes: Float64Array;
  /** Aim the marker's +Z nose down the trajectory tangent each frame. */
  private readonly orient: boolean;
  /** The marker's own rotation at add-time, kept as a calibration offset. */
  private readonly baseQuat: THREE.Quaternion;
  private readonly disposables: Array<{ dispose: () => void }> = [];
  // Kept so we can unregister the marker on dispose — the frame toggle rebuilds
  // this entity, and without removal each rebuild would leave a stale pickable.
  private readonly picks: PickRegistry;
  // The label's CSS2D object, kept so dispose can tear down its DOM node. Removing
  // an ancestor from the scene graph doesn't fire the label's own 'removed' event,
  // so without this each frame toggle would strand a stale RST label in the overlay.
  private readonly label: CSS2DObject | null;

  constructor(config: TrajectoryObjectConfig, picks: PickRegistry) {
    this.picks = picks;
    this.object3D.name = `${config.id}SystemGroup`;
    this.placement.name = `${config.id}Placement`;
    this.object3D.add(this.placement);

    this.points = config.points.map((p) => ({
      t: p.timeMs,
      pos: eclipticToWorld(p.position),
    }));

    // The smooth path: densify the hourly samples into one Catmull-Rom curve, then
    // draw it as two glowing lines — a solid one for the flown part and a dashed
    // one for the predicted part — that share the vertices and split at the clock.
    const curve = this.buildCurve();
    this.curveTimes = curve.times;
    const pathColor = config.pathColor ?? config.color;
    if (curve.count >= 2) {
      this.flownGeometry = new THREE.BufferGeometry();
      this.flownGeometry.setAttribute('position', new THREE.BufferAttribute(curve.positions, 3));
      // Per-vertex colour, rewritten each frame (updatePathDimming): the static
      // start-fade (oldest vertex up from black, so the track eases out of the dark)
      // times the clock-distance fade (out-of-window path dimmed to barely visible).
      // vertexColors multiplies it onto the material colour; toward black the line
      // vanishes over the sky and blooms proportionally less — no hard edges.
      this.flownStartFade = startFadeBrightness(curve.count);
      this.flownColorAttr = new THREE.BufferAttribute(new Float32Array(curve.count * 3), 3);
      this.flownColorAttr.setUsage(THREE.DynamicDrawUsage); // rewritten every frame
      this.flownGeometry.setAttribute('color', this.flownColorAttr);
      const flownMaterial = new THREE.LineBasicMaterial({
        color: pathColor,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
      });
      this.disposables.push(this.flownGeometry, flownMaterial);
      const flown = new THREE.Line(this.flownGeometry, flownMaterial);
      flown.name = `${config.id}PathFlown`;
      flown.layers.enable(BLOOM_LAYER); // glow like the orbit trails
      this.object3D.add(flown);

      // The dashed, dimmer prediction. Dash length is a fixed fraction of the whole
      // path so it reads consistently as the flown/predicted boundary sweeps along.
      // `pairs` sets how many dash+gap pairs span the path (caller-tunable, so a
      // long path can keep a sensible absolute dash); `gapRatio` splits each pair.
      const dashPairs = config.dash?.pairs ?? PATH_DASH_PAIRS;
      const gapRatio = config.dash?.gapRatio ?? PATH_DASH_GAP_RATIO;
      const pairLength = (curve.length || 1) / dashPairs;
      const dashSize = pairLength / (1 + gapRatio);
      const gapSize = dashSize * gapRatio;
      this.predictedGeometry = new THREE.BufferGeometry();
      this.predictedGeometry.setAttribute('position', new THREE.BufferAttribute(curve.positions, 3));
      this.predictedGeometry.setAttribute('lineDistance', new THREE.BufferAttribute(curve.distances, 1));
      // Same per-frame clock-distance dimming as the flown line (no start-fade), so
      // predicted loops more than a year out fade to barely visible too.
      this.predictedColorAttr = new THREE.BufferAttribute(new Float32Array(curve.count * 3), 3);
      this.predictedColorAttr.setUsage(THREE.DynamicDrawUsage); // rewritten every frame
      this.predictedGeometry.setAttribute('color', this.predictedColorAttr);
      const predictedMaterial = new THREE.LineDashedMaterial({
        color: pathColor,
        vertexColors: true,
        transparent: true,
        opacity: 0.55, // a prediction reads as fainter than the flown track
        depthWrite: false,
        dashSize,
        gapSize,
      });
      this.disposables.push(this.predictedGeometry, predictedMaterial);
      const predicted = new THREE.Line(this.predictedGeometry, predictedMaterial);
      predicted.name = `${config.id}PathPredicted`;
      predicted.layers.enable(BLOOM_LAYER);
      this.object3D.add(predicted);
    } else {
      this.flownGeometry = null;
      this.predictedGeometry = null;
      this.flownColorAttr = null;
      this.predictedColorAttr = null;
      this.flownStartFade = null;
    }

    // The marker: a caller-supplied model, or a default sphere we own and dispose.
    if (config.object) {
      this.marker = config.object;
    } else {
      const geometry = new THREE.SphereGeometry(config.radius ?? 0.04, 16, 16);
      const material = new THREE.MeshBasicMaterial({ color: config.color });
      this.disposables.push(geometry, material);
      this.marker = new THREE.Mesh(geometry, material);
    }
    this.placement.add(this.marker);
    picks.addPickable(this.marker);

    if (config.label) {
      const cssColor = '#' + config.color.toString(16).padStart(6, '0');
      // The label rides the placement, but the marker is the registered pick/pivot
      // root — so pass the marker as the pivot, and clicking the label selects the
      // craft exactly as clicking the model does.
      this.label = addLabel(this.placement, config.label, cssColor, this.marker);
    } else {
      this.label = null;
    }

    // A sphere marker has no meaningful heading; only orient a custom object.
    this.orient = Boolean(config.orientToTrajectory && config.object);
    this.baseQuat = this.marker.quaternion.clone();
  }

  /**
   * Densify the trajectory into one smooth Catmull-Rom curve. Every hourly segment
   * is split into PATH_SUBDIVISIONS pieces, each carrying a time linearly
   * interpolated across the segment, so the curve stays monotonic in time (the
   * split search relies on that). Also returns the cumulative arc length per vertex
   * (`distances`) for the dashed material, and the total `length`.
   */
  private buildCurve(): {
    positions: Float32Array;
    distances: Float32Array;
    times: Float64Array;
    count: number;
    length: number;
  } {
    const raw = this.points;
    const n = raw.length;
    if (n < 2) {
      // Nothing to draw as a curve; hand back the lone point (or none) as times.
      const times = new Float64Array(n);
      for (let i = 0; i < n; i += 1) times[i] = raw[i].t;
      return { positions: new Float32Array(n * 3), distances: new Float32Array(n), times, count: n, length: 0 };
    }

    const count = (n - 1) * PATH_SUBDIVISIONS + 1;
    const positions = new Float32Array(count * 3);
    const distances = new Float32Array(count);
    const times = new Float64Array(count);
    const clamp = (i: number): number => Math.min(n - 1, Math.max(0, i));

    let w = 0;
    for (let i = 0; i < n - 1; i += 1) {
      const p0 = raw[clamp(i - 1)].pos;
      const p1 = raw[i].pos;
      const p2 = raw[i + 1].pos;
      const p3 = raw[clamp(i + 2)].pos;
      const t1 = raw[i].t;
      const t2 = raw[i + 1].t;
      // Include the segment's final vertex only on the last segment, so shared
      // endpoints aren't duplicated: (n-1)*SUBDIV + 1 vertices total.
      const steps = i === n - 2 ? PATH_SUBDIVISIONS + 1 : PATH_SUBDIVISIONS;
      for (let s = 0; s < steps; s += 1) {
        const f = s / PATH_SUBDIVISIONS;
        positions[w * 3] = catmullRom(p0[0], p1[0], p2[0], p3[0], f);
        positions[w * 3 + 1] = catmullRom(p0[1], p1[1], p2[1], p3[1], f);
        positions[w * 3 + 2] = catmullRom(p0[2], p1[2], p2[2], p3[2], f);
        times[w] = t1 + (t2 - t1) * f;
        w += 1;
      }
    }

    // Cumulative arc length along the dense curve, for the dashed material.
    for (let i = 1; i < count; i += 1) {
      const dx = positions[i * 3] - positions[(i - 1) * 3];
      const dy = positions[i * 3 + 1] - positions[(i - 1) * 3 + 1];
      const dz = positions[i * 3 + 2] - positions[(i - 1) * 3 + 2];
      distances[i] = distances[i - 1] + Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    return { positions, distances, times, count, length: distances[count - 1] };
  }

  update(ctx: FrameContext): void {
    const s = this.points;
    if (s.length === 0) return;
    const simTimeMs = ctx.simTimeMs;

    // Resolve the segment [lo, hi] and interpolation fraction for the current
    // time. The ends are clamped to the known ephemeris rather than extrapolated;
    // the adjacent segment still gives a heading there.
    let lo: number;
    let hi: number;
    if (simTimeMs <= s[0].t) {
      lo = 0;
      hi = Math.min(1, s.length - 1);
      this.placement.position.set(...s[0].pos);
    } else if (simTimeMs >= s[s.length - 1].t) {
      hi = s.length - 1;
      lo = Math.max(0, hi - 1);
      this.placement.position.set(...s[hi].pos);
    } else {
      // Binary search for the segment straddling the current time.
      lo = 0;
      hi = s.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (s[mid].t <= simTimeMs) lo = mid;
        else hi = mid;
      }
      const a = s[lo];
      const b = s[hi];
      const f = (simTimeMs - a.t) / (b.t - a.t || 1);
      this.placement.position.set(
        a.pos[0] + (b.pos[0] - a.pos[0]) * f,
        a.pos[1] + (b.pos[1] - a.pos[1]) * f,
        a.pos[2] + (b.pos[2] - a.pos[2]) * f,
      );
    }

    if (this.orient && hi !== lo) this.orientAlong(s[lo].pos, s[hi].pos);

    this.updatePathSplit(simTimeMs);
    this.updatePathDimming(simTimeMs);
  }

  /**
   * Fade the path by distance in time from the live clock: vertices within a year
   * of now stay full brightness, everything further eases down to barely visible
   * (see clockDistanceBrightness). Rewrites both colour buffers in place — cheap
   * enough at line resolution, and skipped entirely when the clock hasn't moved
   * (paused), which is the common case. The flown line also keeps its start-fade.
   */
  private updatePathDimming(simTimeMs: number): void {
    const flownAttr = this.flownColorAttr;
    const predictedAttr = this.predictedColorAttr;
    const startFade = this.flownStartFade;
    if (!flownAttr || !predictedAttr || !startFade) return;
    // The dimming depends only on the clock; a still clock needs no rewrite.
    if (simTimeMs === this.lastDimSimTimeMs) return;
    this.lastDimSimTimeMs = simTimeMs;

    const times = this.curveTimes;
    const n = times.length;
    const flown = flownAttr.array as Float32Array;
    const predicted = predictedAttr.array as Float32Array;
    for (let i = 0; i < n; i += 1) {
      const b = clockDistanceBrightness(times[i], simTimeMs);
      const j = i * 3;
      // Flown: start-fade × clock-distance fade. Predicted: clock-distance only.
      const fb = startFade[i] * b;
      flown[j] = fb;
      flown[j + 1] = fb;
      flown[j + 2] = fb;
      predicted[j] = b;
      predicted[j + 1] = b;
      predicted[j + 2] = b;
    }
    flownAttr.needsUpdate = true;
    predictedAttr.needsUpdate = true;
  }

  /**
   * Split the curve at the current time: the solid "flown" line draws vertices up
   * to now, the dashed "predicted" line draws the rest. Just two draw ranges over
   * the shared, precomputed vertices — no geometry is rebuilt. The dashed range
   * starts one vertex early so the two meet with no gap at the marker.
   */
  private updatePathSplit(simTimeMs: number): void {
    const flown = this.flownGeometry;
    const predicted = this.predictedGeometry;
    if (!flown || !predicted) return;

    const times = this.curveTimes;
    const n = times.length;

    // k = number of vertices already reached (time <= now).
    let k: number;
    if (simTimeMs <= times[0]) {
      k = 0;
    } else if (simTimeMs >= times[n - 1]) {
      k = n;
    } else {
      let lo = 0;
      let hi = n - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (times[mid] <= simTimeMs) lo = mid;
        else hi = mid;
      }
      k = lo + 1;
    }

    flown.setDrawRange(0, k); // vertices 0..k-1 (draws nothing when k < 2)
    const dashStart = Math.max(0, k - 1);
    predicted.setDrawRange(dashStart, n - dashStart);
  }

  /**
   * Aim the marker's nose down the trajectory. The chord of the current segment
   * (from → to, parent-frame AU) is the direction of travel; build a rotation
   * whose +Z axis points along it, using ecliptic north (+Y) as up so the model
   * doesn't roll unpredictably. The marker's base rotation is composed back in, so
   * a caller-set nose/roll trim survives. BodyPlacement adds no rotation, so this
   * parent-frame orientation is the marker's local quaternion directly.
   */
  private orientAlong(from: [number, number, number], to: [number, number, number]): void {
    _dir.set(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    // Two coincident points give no heading; keep the previous orientation.
    if (_dir.lengthSq() < 1e-20) return;
    _dir.normalize();

    // Matrix4.lookAt(eye, target, up) sets +Z = normalize(eye - target); with eye
    // on the travel direction and target at the origin, +Z lands on the tangent —
    // matching Object3D.lookAt's "+Z toward target" for non-cameras.
    _lookMatrix.lookAt(_dir, _origin, _worldUp);
    _alignQuat.setFromRotationMatrix(_lookMatrix);
    this.marker.quaternion.copy(_alignQuat).multiply(this.baseQuat);
  }

  dispose(): void {
    // Unregister the marker so a rebuilt spacecraft (frame toggle) doesn't leave a
    // dangling pickable. The marker itself may be a caller-owned model we don't
    // dispose; only our own geometry/materials are in `disposables`.
    this.picks.removePickable(this.marker);
    // Tear down the label's DOM node. Removing it from its parent fires its own
    // 'removed' event (the CSS2D cleanup hook); we also drop the element directly
    // so the overlay is clean regardless of three's version.
    if (this.label) {
      this.placement.remove(this.label);
      this.label.element.remove();
    }
    for (const r of this.disposables) r.dispose();
  }
}
