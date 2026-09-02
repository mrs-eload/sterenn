import * as THREE from 'three';
import { addLabel } from '../labels';
import { eclipticToWorld } from '../frames';
import type { FrameContext, SceneEntity } from '../SceneEntity';
import type { PickRegistry } from '../camera/PickRegistry';
import type { TrajectoryObjectConfig } from '../types';

// Frame-local scratch for the nose-alignment maths, reused every frame.
const _dir = new THREE.Vector3();
const _origin = new THREE.Vector3(0, 0, 0);
const _worldUp = new THREE.Vector3(0, 1, 0); // ecliptic north in world space
const _lookMatrix = new THREE.Matrix4();
const _alignQuat = new THREE.Quaternion();

interface WorldPoint {
  t: number;
  pos: [number, number, number];
}

/**
 * A custom object placed by an explicit trajectory (a spacecraft, comet, …), as
 * a body-tree entity. Its scene-graph shape mirrors a Body:
 *
 *   <id>SystemGroup            ← heliocentric frame (at the origin)
 *   ├─ TrajectoryPath          ← the full open path, drawn once
 *   └─ BodyPlacement           ← translated to the interpolated position each frame
 *      ├─ marker (BodyVisual)  ← the model, its nose aimed down the trajectory
 *      └─ Label
 *
 * Unlike a planet it isn't an ephemeris body: its position is interpolated from
 * an explicit table (a JPL Horizons vector table), and its path is an open
 * polyline rather than the periodic dotted OrbitTrail. BodyPlacement carries only
 * translation, so the world-space nose orientation applies directly to the marker.
 */
export class TrajectoryEntity implements SceneEntity {
  readonly object3D = new THREE.Group();
  private readonly placement = new THREE.Group();
  private readonly marker: THREE.Object3D;
  private readonly points: WorldPoint[];
  /** Aim the marker's +Z nose down the trajectory tangent each frame. */
  private readonly orient: boolean;
  /** The marker's own rotation at add-time, kept as a calibration offset. */
  private readonly baseQuat: THREE.Quaternion;
  private readonly disposables: Array<{ dispose: () => void }> = [];

  constructor(config: TrajectoryObjectConfig, picks: PickRegistry) {
    this.object3D.name = `${config.id}SystemGroup`;
    this.placement.name = `${config.id}Placement`;
    this.object3D.add(this.placement);

    this.points = config.points.map((p) => ({
      t: p.timeMs,
      pos: eclipticToWorld(p.position),
    }));

    // The full path, drawn once in the heliocentric frame (the SystemGroup origin).
    const pathPoints = this.points.map((p) => new THREE.Vector3(...p.pos));
    const pathGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
    const pathMaterial = new THREE.LineBasicMaterial({ color: config.pathColor ?? config.color });
    this.disposables.push(pathGeometry, pathMaterial);
    const path = new THREE.Line(pathGeometry, pathMaterial);
    path.name = `${config.id}Path`;
    this.object3D.add(path);

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
      addLabel(this.placement, config.label, cssColor);
    }

    // A sphere marker has no meaningful heading; only orient a custom object.
    this.orient = Boolean(config.orientToTrajectory && config.object);
    this.baseQuat = this.marker.quaternion.clone();
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
  }

  /**
   * Aim the marker's nose down the trajectory. The chord of the current segment
   * (from → to, world AU) is the direction of travel; build a rotation whose +Z
   * axis points along it, using ecliptic north (+Y) as up so the model doesn't
   * roll unpredictably. The marker's base rotation is composed back in, so a
   * caller-set nose/roll trim survives. BodyPlacement adds no rotation, so this
   * world-space orientation is the marker's local quaternion directly.
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
    for (const r of this.disposables) r.dispose();
  }
}
