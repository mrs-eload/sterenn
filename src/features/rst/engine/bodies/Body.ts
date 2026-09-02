import * as THREE from 'three';
import { addLabel } from '../labels';
import { pixelFloorScale, worldPerPixelAtUnitDistance } from '../sizing';
import type { PickRegistry } from '../camera/PickRegistry';
import type { FrameContext, SceneEntity } from '../SceneEntity';
import { OrbitTrail } from './orbitTrail';
import type { OrbitTrailOptions } from './orbitTrail';

// Frame-local scratch, reused to avoid per-frame allocation.
const _worldPos = new THREE.Vector3();

/**
 * The visual body — the tilt+spin object that lives under BodyPlacement. It wraps
 * the various handle shapes (a textured planet, the Earth shader, a plain sphere)
 * behind one update signature, so Body doesn't care which it holds.
 */
export interface BodyVisual {
  /** The tilt+spin object, added under BodyPlacement. */
  readonly object: THREE.Object3D;
  /** What click-to-pivot raycasts against; defaults to `object`. */
  readonly pickTarget?: THREE.Object3D;
  /** The world radius the geometry was built at, for the pixel floor. */
  readonly baseRadius: number;
  /**
   * Advance spin / shader for this frame. `worldPos` is the body's world position
   * (some visuals — the Earth shader — need it; most ignore it).
   */
  update?(ctx: FrameContext, worldPos: THREE.Vector3): void;
  dispose(): void;
}

export interface BodyOptions {
  /** Used to name the scene-graph nodes and the label. */
  name: string;
  label: string;
  labelColor: string;
  visual: BodyVisual;
  /**
   * The body's position in its PARENT's frame at time t. Heliocentric for a
   * planet (its parent, the Sun's group, sits at the origin); geocentric for a
   * moon (its parent is the planet). Returns Three world-space coords.
   */
  positionInParentFrame: (simTimeMs: number) => readonly [number, number, number];
  /** Draw a dotted orbit trail (in the parent frame). Omit for none. */
  orbitTrail?: OrbitTrailOptions;
  /** Hold the body to a minimum apparent size, in px. 0 / omitted = no floor. */
  minPixelRadius?: number;
  /** Where the body registers itself as pickable. */
  picks: PickRegistry;
  /** Bodies intrinsically tied to this one (moons). They ride its position, not spin. */
  children?: Body[];
}

/**
 * One body in the tree. Its scene-graph shape (see engine/README.md):
 *
 *   <name>SystemGroup            ← parent-frame origin
 *   ├─ OrbitTrail                ← the body's path, in the parent frame
 *   └─ BodyPlacement             ← translated to the body's position each frame
 *      ├─ BodyVisual             ← tilt + spin; gets the pixel-floor scale
 *      ├─ Label                  ← rides the position, not the spin/floor
 *      └─ child <Moon>SystemGroups
 *
 * It positions itself, updates and floors its visual, refills its trail and
 * recurses into its moons — all from update(ctx). The engine never learns what
 * kind of body it is; what a body *has* (a trail, moons) is passed in as config.
 */
export class Body implements SceneEntity {
  readonly object3D: THREE.Group; // the SystemGroup
  private readonly placement = new THREE.Group();
  private readonly visual: BodyVisual;
  private readonly positionInParentFrame: (simTimeMs: number) => readonly [number, number, number];
  private readonly orbitTrail: OrbitTrail | null;
  private readonly minPixelRadius: number;
  private readonly children: Body[];
  // Annotations tied to this body but attached after construction (e.g. the
  // Lagrange group on Earth). They live under the SystemGroup, in the parent
  // frame, and are advanced with the body.
  private readonly attachments: SceneEntity[] = [];

  constructor(options: BodyOptions) {
    this.visual = options.visual;
    this.positionInParentFrame = options.positionInParentFrame;
    this.minPixelRadius = options.minPixelRadius ?? 0;
    this.children = options.children ?? [];

    const system = new THREE.Group();
    system.name = `${options.name}SystemGroup`;
    this.object3D = system;

    this.placement.name = `${options.name}Placement`;
    system.add(this.placement);

    this.placement.add(this.visual.object);
    // The label rides BodyPlacement — the body's position — so it follows the
    // body without inheriting the visual's tilt/spin or the pixel-floor scale.
    addLabel(this.placement, options.label, options.labelColor);

    this.orbitTrail = options.orbitTrail ? new OrbitTrail(options.orbitTrail) : null;
    // The trail is in the PARENT frame, so it hangs off the SystemGroup (which
    // sits at the parent origin), not off the moving BodyPlacement.
    if (this.orbitTrail) system.add(this.orbitTrail.object3D);

    // Moons attach at BodyPlacement so they ride the body's POSITION but not its
    // spin (a child of the spinning visual would whip around once a day).
    for (const child of this.children) this.placement.add(child.object3D);

    // Pivot on the body centre (BodyPlacement); pick against the visual; the true
    // radius stops a zoom just outside the surface.
    options.picks.addBody(
      this.placement,
      this.visual.pickTarget ?? this.visual.object,
      this.visual.baseRadius,
    );
  }

  /**
   * Attach an annotation entity (e.g. a LagrangeGroup) to this body. It lives
   * under the SystemGroup — the parent frame — and is advanced and disposed with
   * the body. This is how "the decision to add Lagrange points belongs to the
   * body" is realised without the engine knowing what a Lagrange point is.
   */
  attach(entity: SceneEntity): void {
    this.object3D.add(entity.object3D);
    this.attachments.push(entity);
  }

  update(ctx: FrameContext): void {
    const [x, y, z] = this.positionInParentFrame(ctx.simTimeMs);
    this.placement.position.set(x, y, z);

    if (this.visual.update) {
      // getWorldPosition refreshes the world matrix up the parent chain, so this
      // is correct even for a moon whose parent moved earlier this same frame.
      this.placement.getWorldPosition(_worldPos);
      this.visual.update(ctx, _worldPos);
    }
    this.applyFloor(ctx);
    this.orbitTrail?.update(ctx);
    for (const attachment of this.attachments) attachment.update(ctx);
    // Children after this body is placed, so their world transform is current.
    for (const child of this.children) child.update(ctx);
  }

  /** Hold the visual to a minimum apparent size (see sizing.ts). Uniform scale. */
  private applyFloor(ctx: FrameContext): void {
    if (this.minPixelRadius <= 0) return;
    const wppd = worldPerPixelAtUnitDistance(ctx.camera.fov, ctx.viewportHeight);
    const dist = ctx.camera.position.distanceTo(this.visual.object.getWorldPosition(_worldPos));
    this.visual.object.scale.setScalar(
      pixelFloorScale(this.visual.baseRadius, dist, wppd, this.minPixelRadius),
    );
  }

  dispose(): void {
    this.visual.dispose();
    this.orbitTrail?.dispose();
    for (const attachment of this.attachments) attachment.dispose();
    for (const child of this.children) child.dispose();
  }
}
