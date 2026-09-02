import * as THREE from 'three';
import { BLOOM_LAYER } from '../render/BloomPipeline';
import type { FrameContext, SceneEntity } from '../SceneEntity';

// Orbit trails are drawn as dotted comet-tails, dense at the body's live position
// and spreading out along the path it has already travelled. Each orbit is
// precomputed once as this many equal-time position samples over one period;
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
  /** Reference epoch the samples are generated at; the phase head is measured from it. */
  t0Ms: number;
  /**
   * Position at time t, in the trail's PARENT frame. A planet's trail is sampled
   * heliocentric; a moon's ring geocentric. The scene-graph parenting supplies
   * the frame (the trail is a child of the body's SystemGroup), so there is no
   * anchor to add back each frame — that's what a nested tree buys over the old
   * flat one.
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
  private readonly t0Ms: number;

  constructor(opts: OrbitTrailOptions) {
    this.periodMs = opts.periodMs;
    this.t0Ms = opts.t0Ms;

    const K = ORBIT_SAMPLE_COUNT;
    this.samples = new Float32Array(K * 3);
    for (let i = 0; i < K; i += 1) {
      const [x, y, z] = opts.sampleAt(opts.t0Ms + (opts.periodMs * i) / K);
      this.samples[i * 3] = x;
      this.samples[i * 3 + 1] = y;
      this.samples[i * 3 + 2] = z;
    }

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

    this.object3D = new THREE.Points(this.geometry, this.material);
    // Bloom layer (keeping layer 0 too) so the glow pass blooms the orbits;
    // without this they'd be masked to black in the bloom pass and stay matte.
    this.object3D.layers.enable(BLOOM_LAYER);
  }

  /**
   * Refill the dot buffer from the precomputed table. The head dot sits at the
   * body's current orbital phase; every other dot steps a fixed fraction of a
   * period into the past (ORBIT_DOT_OFFSETS), gaps growing — so the dots crowd
   * the body and spread along the trail it came from. Positions are interpolated
   * between table entries and the table is read circularly, so the tail wraps
   * smoothly. Cheap: only table lookups per frame.
   */
  update(ctx: FrameContext): void {
    const K = ORBIT_SAMPLE_COUNT;
    const phase = (ctx.simTimeMs - this.t0Ms) / this.periodMs;
    const head = phase - Math.floor(phase); // body's current phase, [0,1)
    const p = this.positions;
    const s = this.samples;
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
      p[w++] = s[a] + (s[b] - s[a]) * frac;
      p[w++] = s[a + 1] + (s[b + 1] - s[a + 1]) * frac;
      p[w++] = s[a + 2] + (s[b + 2] - s[a + 2]) * frac;
    }
    (this.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
