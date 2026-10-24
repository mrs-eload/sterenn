import * as THREE from 'three';
import { Body as AstroBody } from 'astronomy-engine';
import { addLabel } from '../labels';
import { eclipticToWorld } from '../frames';
import { planetPosition } from '../ephemeris';
import { LAGRANGE_NAMES, sunEarthLagrangePoints } from './lagrange.ts';
import type { LagrangeName } from './lagrange.ts';
import type { FrameContext, SceneEntity } from '../SceneEntity';
import type { PickRegistry } from '../camera/PickRegistry';

export interface LagrangeConfig {
  /** Which of the five points to show. Defaults to all. */
  names?: LagrangeName[];
  color?: number;
  radius?: number;
  labels?: boolean;
}

/**
 * The Sun–Earth Lagrange points as a child annotation of the Earth body. They
 * look like fixed dots but are recomputed from Earth's live position every frame,
 * since the points co-rotate with Earth over a year (see lagrange.ts). The group
 * hangs off Earth's SystemGroup (at the world origin, the Sun), so the absolute
 * heliocentric positions the maths returns render directly.
 *
 * The maths is the same for any primary/secondary pair; only the Sun–Earth case
 * is wired today, but the shape is ready to attach an equivalent group to any
 * body whose config asks for it.
 */
export class LagrangeGroup implements SceneEntity {
  readonly object3D = new THREE.Group();
  private readonly markers: Array<{ name: LagrangeName; mesh: THREE.Mesh }> = [];
  private readonly disposables: Array<{ dispose: () => void }> = [];

  constructor(config: LagrangeConfig, picks: PickRegistry) {
    this.object3D.name = 'LagrangeGroup';
    const names = config.names ?? LAGRANGE_NAMES;
    const radius = config.radius ?? 0.005;
    const color = config.color ?? 0xff5599;
    const cssColor = '#' + color.toString(16).padStart(6, '0');
    for (const name of names) {
      const geometry = new THREE.SphereGeometry(radius, 12, 12);
      // Unlit so a marker reads as an annotation, not a lit body.
      const material = new THREE.MeshBasicMaterial({ color });
      this.disposables.push(geometry, material);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.set(0.01, 0.01, 0.01);
      mesh.name = name;
      this.object3D.add(mesh);
      picks.addPickable(mesh);
      this.markers.push({ name, mesh });
      // The mesh is the pick/pivot root, so its label selects it on click.
      if (config.labels) addLabel(mesh, name, cssColor, mesh);
    }
  }

  update(ctx: FrameContext): void {
    if (this.markers.length === 0) return;
    const earth = planetPosition(AstroBody.Earth, new Date(ctx.simTimeMs));
    const points = sunEarthLagrangePoints(earth);
    for (const { name, mesh } of this.markers) {
      const [x, y, z] = eclipticToWorld(points[name]);
      mesh.position.set(x, y, z);
    }
  }

  dispose(): void {
    for (const r of this.disposables) r.dispose();
  }
}
