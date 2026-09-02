import * as THREE from 'three';
import { BLOOM_LAYER } from '../render/BloomPipeline';
import type { FrameContext, SceneEntity } from '../SceneEntity';

// Orbit trails are drawn as dotted comet-tails, dense at the body's live position
// and spreading out along the path it has already travelled. Each orbit is
// sampled into this many equal-time position samples over one period; every frame
// we read a variable-density subset from the table (no per-frame re-computing).
const ORBIT_SAMPLE_COUNT = 600;
// Cap on dots per orbit; the geometric spacing below usually settles well under it.
const ORBIT_DOT_COUNT = 260;

// How far back into the past the tail reaches, as a fraction of the period. The
// remaining slice (1 - this) is the deliberately-undrawn gap AHEAD of the body.
// Real orbits don't return to the same spot after one period (they precess — the
// Moon markedly so), so the table's two ends don't meet: that unavoidable
// non-closure is parked in this gap instead of showing up as a seam in the trail.
const ORBIT_TAIL_SPAN = 0.88;
// When we (re)build the table we place the body's head at this phase, leaving the
// gap centred ahead of it. The head then drifts as sim time advances, and we
// rebuild once it leaves the safe band below — cheaply, since the band is wide
// for slow planets and only the fast Moon rebuilds at all often.
const ORBIT_HEAD_PHASE = 0.94;
const ORBIT_HEAD_MIN = 0.90; // tail would touch the seam below this
const ORBIT_HEAD_MAX = 0.99; // head would run off the table above this

// The oldest end of the tail shrinks to nothing so the trail fades out instead of
// ending on a full-size dot. Only this many trailing dots taper; the rest stay
// full size. The last dot lands at ORBIT_TAIL_SHRINK_MIN × the base size.
const ORBIT_TAIL_SHRINK_COUNT = 24;
const ORBIT_TAIL_SHRINK_MIN = 0.15;

/**
 * Fraction-of-period offsets, one per orbit dot, measured *backward in time* from
 * the body's current position. The gaps grow geometrically, so dots crowd at the
 * body (the recent path) and spread out along the older trail behind it. We stop
 * at ORBIT_TAIL_SPAN so the sparse tail never reaches the non-closure gap.
 */
function buildOrbitDotOffsets(): number[] {
  const offsets: number[] = [];
  let cursor = 0;
  let gap = 0.0002; // first gap: ~1.75 h for Earth, so the head reads solid
  const growth = 1.03; // gentle growth keeps the whole ring densely populated
  for (let i = 0; i < ORBIT_DOT_COUNT && cursor < ORBIT_TAIL_SPAN; i += 1) {
    offsets.push(cursor);
    cursor += gap;
    gap *= growth;
  }
  return offsets;
}
const ORBIT_DOT_OFFSETS = buildOrbitDotOffsets();

/**
 * One component of a uniform Catmull-Rom spline: the smooth curve through p1 and
 * p2 whose tangents come from the neighbours p0 and p3, evaluated at t in [0,1].
 * Interpolating (passes through the control points) and C¹, so it hugs the true
 * orbit between table samples instead of cutting the chord.
 */
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

// A soft round dot sprite, built once and shared by every orbit's Points
// material so paths read as dotted rings rather than solid lines. It's a tiny
// 64px canvas texture — effectively a constant asset — so it's a module-level
// singleton, shared across every trail (and any engine remount) and never
// disposed; there's nothing per-engine about it.
let sharedDotTexture: THREE.CanvasTexture | null = null;
function orbitDotTexture(): THREE.CanvasTexture {
  if (sharedDotTexture) return sharedDotTexture;
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
  sharedDotTexture = texture;
  return texture;
}

export interface OrbitTrailOptions {
  color: number;
  periodMs: number;
  /**
   * Position at time t, in the trail's PARENT frame. A planet's trail is sampled
   * heliocentric; a moon's ring geocentric. The scene-graph parenting supplies
   * the frame (the trail is a child of the body's SystemGroup), so there is no
   * anchor to add back each frame — that's what a nested tree buys over the old
   * flat one. Called to (re)fill the sample table around the current sim time,
   * not once for all time, so the tail is always the body's real recent path.
   */
  sampleAt: (timeMs: number) => readonly [number, number, number];
}

/**
 * One body's dotted orbit trail, as a scene entity. The orbit is sampled once
 * into a fine equal-time table (`samples`); the drawn dots are a small buffer
 * refilled each frame at a density that crowds the body and thins into the past
 * (see refill). A fixed brightness ramp fades the tail so "where the body is now"
 * reads brightest. It goes on the bloom layer so the same glow pass that lights
 * the Sun blooms the orbits.
 */
export class OrbitTrail implements SceneEntity {
  readonly object3D: THREE.Points;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.PointsMaterial;
  private readonly samples: Float32Array;
  private readonly positions: Float32Array;
  private readonly periodMs: number;
  private readonly sampleAt: (timeMs: number) => readonly [number, number, number];
  // Sim time of table entry 0. The table spans [anchorLoMs, anchorLoMs + period].
  // NaN until the first update fills it (we don't know the sim time at construction).
  private anchorLoMs = Number.NaN;

  constructor(opts: OrbitTrailOptions) {
    this.periodMs = opts.periodMs;
    this.sampleAt = opts.sampleAt;

    const K = ORBIT_SAMPLE_COUNT;
    this.samples = new Float32Array(K * 3); // filled by rebuild() on first update

    const dots = ORBIT_DOT_OFFSETS.length;
    this.positions = new Float32Array(dots * 3); // (re)filled every frame
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    // Per-dot brightness ramp, constant across frames: full at the head (offset 0,
    // the body), fading down the older tail. vertexColors multiplies this onto the
    // material's orbit colour.
    const colors = new Float32Array(dots * 3);
    for (let i = 0; i < dots; i += 1) {
      // The tight bloom radius keeps this reading as a crisp shine rather than a
      // spreading haze.
      const fade = 0.35 + 0.65 * (1 - i / Math.max(1, dots - 1));
      colors[i * 3] = fade;
      colors[i * 3 + 1] = fade;
      colors[i * 3 + 2] = fade;
    }
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Per-dot size scale, constant across frames. Full-size along the trail, then
    // the last handful of dots shrink toward a point so the tail's oldest end
    // dwindles away rather than stopping at a hard edge. PointsMaterial has only a
    // single shared size, so this multiplier is injected into its shader below.
    const sizes = new Float32Array(dots);
    for (let i = 0; i < dots; i += 1) {
      // Only the final ORBIT_TAIL_SHRINK_COUNT dots taper; everything ahead of them
      // stays full size. t goes 0 → 1 across that tail band; scale eases from 1 down
      // to ORBIT_TAIL_SHRINK_MIN so the dwindling reads smooth, not stepped.
      const fromEnd = dots - 1 - i;
      const t = 1 - Math.min(fromEnd, ORBIT_TAIL_SHRINK_COUNT) / ORBIT_TAIL_SHRINK_COUNT;
      sizes[i] = 1 - (1 - ORBIT_TAIL_SHRINK_MIN) * (t * t);
    }
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    this.material = new THREE.PointsMaterial({
      color: opts.color,
      vertexColors: true,
      map: orbitDotTexture(),
      // Constant pixel size at any zoom, so dots stay crisp from a whole-system
      // overview down to a close pass.
      size: 2.8,
      sizeAttenuation: false,
      transparent: true,
      opacity: 1,
      // Normal (not additive) blending: over the black sky the dots still read
      // bright, but they don't stack into hot spots where the ring is dense —
      // that stacking is what made an earlier version strobe.
      depthWrite: false,
    });
    // PointsMaterial exposes one shared size; multiply gl_PointSize by the per-dot
    // aSize attribute so the tail's oldest dots shrink away (see the sizes ramp).
    this.material.onBeforeCompile = (shader) => {
      shader.vertexShader =
        'attribute float aSize;\n' +
        shader.vertexShader.replace('gl_PointSize = size;', 'gl_PointSize = size * aSize;');
    };

    this.object3D = new THREE.Points(this.geometry, this.material);
    // Bloom layer (keeping layer 0 too) so the glow pass blooms the orbits;
    // without this they'd be masked to black in the bloom pass and stay matte.
    this.object3D.layers.enable(BLOOM_LAYER);
  }

  /**
   * (Re)fill the sample table so the body's current sim time lands at head phase
   * ORBIT_HEAD_PHASE, with the table spanning the one period ending just ahead of
   * it. The samples are then the body's REAL positions over that period — a
   * genuine trailing path, not a periodic loop — so the tail never has to cross
   * the point where the orbit fails to close on itself. Costs K ephemeris calls,
   * but only runs on the first frame and whenever the head drifts out of the safe
   * band (rarely, and never at all for a paused sim).
   */
  private rebuild(simTimeMs: number): void {
    const K = ORBIT_SAMPLE_COUNT;
    this.anchorLoMs = simTimeMs - ORBIT_HEAD_PHASE * this.periodMs;
    const s = this.samples;
    for (let i = 0; i < K; i += 1) {
      const [x, y, z] = this.sampleAt(this.anchorLoMs + (this.periodMs * i) / K);
      s[i * 3] = x;
      s[i * 3 + 1] = y;
      s[i * 3 + 2] = z;
    }
  }

  /**
   * Refill the dot buffer from the sample table. The head dot sits at the body's
   * current position; every other dot steps a fixed fraction of a period into the
   * past (ORBIT_DOT_OFFSETS), gaps growing — so the dots crowd the body and spread
   * along the real path it came from.
   *
   * Positions are reconstructed with a Catmull-Rom spline through the four
   * surrounding table entries, not the straight chord between two of them. That
   * matters because the dense near-head dots are packed much finer than one table
   * segment: linear interpolation put them all on the same chord — a straight line
   * the body's true curved arc bulges away from and snaps back onto at each sample
   * — while the spline follows the real orbit, so the body rides its own trail.
   * The drawn range (head back by ORBIT_TAIL_SPAN) never reaches the table ends,
   * so the orbit's non-closure stays hidden in the gap and no wrap is needed here.
   */
  update(ctx: FrameContext): void {
    const K = ORBIT_SAMPLE_COUNT;
    // Where the body falls in the current table. Rebuild if it has drifted out of
    // the safe band (or on the very first frame, when the table is still empty).
    let head = (ctx.simTimeMs - this.anchorLoMs) / this.periodMs;
    if (!(head >= ORBIT_HEAD_MIN && head <= ORBIT_HEAD_MAX)) {
      this.rebuild(ctx.simTimeMs);
      head = ORBIT_HEAD_PHASE;
    }
    const p = this.positions;
    const s = this.samples;
    let w = 0;
    for (let d = 0; d < ORBIT_DOT_OFFSETS.length; d += 1) {
      const f = head - ORBIT_DOT_OFFSETS[d]; // stays within (0,1): no wrap
      const t = f * K;
      const i1 = Math.floor(t);
      const frac = t - i1;
      // The four control points straddling the segment. i1 sits in [~12, ~594] for
      // any drawn dot, so the neighbours are always in range — no circular index.
      const i0 = i1 - 1;
      const i2 = i1 + 1;
      const i3 = i1 + 2;
      p[w++] = catmullRom(s[i0 * 3], s[i1 * 3], s[i2 * 3], s[i3 * 3], frac);
      p[w++] = catmullRom(s[i0 * 3 + 1], s[i1 * 3 + 1], s[i2 * 3 + 1], s[i3 * 3 + 1], frac);
      p[w++] = catmullRom(s[i0 * 3 + 2], s[i1 * 3 + 2], s[i2 * 3 + 2], s[i3 * 3 + 2], frac);
    }
    (this.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
