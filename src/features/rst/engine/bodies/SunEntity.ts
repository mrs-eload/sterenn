import * as THREE from 'three';
import { createSun } from './sun.ts';
import type { SunHandle } from './sun.ts';
import { addLabel } from '../labels';
import { BLOOM_LAYER } from '../render/BloomPipeline';
import { drawnRadius } from '../sizing';
import type { SizeModel } from '../sizing';
import { KM_PER_AU } from '../frames';
import type { PickRegistry } from '../camera/PickRegistry';
import type { FrameContext, SceneEntity } from '../SceneEntity';

// The Sun's true radius (695,700 km) in AU, so it's to scale like the planets.
const SUN_RADIUS_AU = 695_700 / KM_PER_AU;

/**
 * The Sun as a scene entity: an animated fBm-noise disc with a fresnel corona
 * (see sun.ts), sitting at the world origin — the centre of the heliocentric
 * frame. It's the one deliberately non-recursive body (see engine/README.md): it
 * never orbits, has no orbit trail, and is not pixel-floored (it keeps its true
 * drawn size). It registers itself as pickable so you can click/zoom to it, and
 * goes on the bloom layer so it (and only it, plus the orbit dots) glows.
 */
export class SunEntity implements SceneEntity {
  private readonly handle: SunHandle;
  readonly object3D: THREE.Object3D;

  constructor(sizeModel: SizeModel, picks: PickRegistry) {
    const radius = drawnRadius(SUN_RADIUS_AU, sizeModel);
    this.handle = createSun(radius);
    this.object3D = this.handle.group;
    // The group is the pick/pivot root, so the label selects the Sun on click.
    addLabel(this.handle.group, 'Sun', '#ffcc66', this.handle.group);
    // Put the disc and its corona on the bloom layer so they glow. enable() keeps
    // layer 0 on, so they still render in the final scene.
    this.handle.group.traverse((o) => o.layers.enable(BLOOM_LAYER));
    // Pick against the lit disc (not the translucent corona); pivot on the group,
    // and the radius stops a zoom just outside the surface.
    picks.addBody(this.handle.group, this.handle.core, radius);
  }

  update(ctx: FrameContext): void {
    // Surface churn runs on real elapsed time, independent of the sim clock.
    this.handle.update(ctx.dt);
  }

  dispose(): void {
    this.handle.dispose();
  }
}
