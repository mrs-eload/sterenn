import * as THREE from 'three';

/**
 * The shared seam between the bodies and the camera. Bodies register what can be
 * clicked and how big it is; the camera raycasts against that to choose a
 * rotation pivot and a zoom target. Holds two things about the scene:
 *
 *  - `pickables` — the objects a ray is tested against.
 *  - a map from each body's pivot root to its true radius (AU), so a raycast hit
 *    (often a child mesh) resolves to the body's centre and size — that's what
 *    lets the camera orbit a planet's centre and stop the zoom just outside its
 *    real surface.
 *
 * Keeping it here means the camera never reaches into body internals, and bodies
 * never know how picking is done.
 */
export class PickRegistry {
  private readonly _pickables: THREE.Object3D[] = [];
  private readonly radii = new Map<THREE.Object3D, number>();
  // Each registered pickable → the object a hit on it should resolve to (its pivot
  // root). For a body that's its centre node; for a bare pickable it's itself. This
  // is what lets a pickable nested *inside* a body (a spacecraft riding Earth)
  // resolve to the spacecraft, not to the body it happens to hang under.
  private readonly pivotRoots = new Map<THREE.Object3D, THREE.Object3D>();

  /**
   * Register a body: `root` is its pivot centre (what we orbit and zoom to),
   * `pickTarget` is the geometry the ray actually hits (often a child of `root`),
   * and `radiusAu` its true radius so the zoom stops just outside its surface.
   */
  addBody(root: THREE.Object3D, pickTarget: THREE.Object3D, radiusAu: number): void {
    this.radii.set(root, radiusAu);
    this._pickables.push(pickTarget);
    this.pivotRoots.set(pickTarget, root);
  }

  /**
   * Register a pickable with no known radius — an annotation (a Lagrange marker)
   * or a spacecraft. Zoom-to it stops at the global floor (radius 0). It's its own
   * pivot root, so it resolves to itself even when it rides a body (see below).
   */
  addPickable(object: THREE.Object3D): void {
    this._pickables.push(object);
    this.pivotRoots.set(object, object);
  }

  /**
   * Unregister a radius-less pickable. Used when a spacecraft entity is rebuilt or
   * disposed, so its marker doesn't accumulate stale entries the raycaster would
   * keep testing. Bodies are never removed.
   */
  removePickable(object: THREE.Object3D): void {
    const i = this._pickables.indexOf(object);
    if (i >= 0) this._pickables.splice(i, 1);
    this.pivotRoots.delete(object);
  }

  /** The objects to raycast against. */
  get pickables(): THREE.Object3D[] {
    return this._pickables;
  }

  /** A registered body's true radius (AU), or undefined for a radius-less pickable. */
  radiusOf(object: THREE.Object3D): number | undefined {
    return this.radii.get(object);
  }

  /** Whether `object` is a registered body pivot root (i.e. has a radius). */
  isBody(object: THREE.Object3D): boolean {
    return this.radii.has(object);
  }

  /**
   * Resolve a raw raycast hit to the object we should pivot on: walk up from the
   * hit and take the FIRST registered pickable's pivot root. A single nearest-wins
   * walk (not "any body first, then any pickable") is what makes a spacecraft that
   * rides Earth resolve to the spacecraft — its marker is a nearer ancestor than
   * Earth's own pick root, which sits further up the same chain. A body's own hit
   * still resolves to the body (its pick target maps to its centre). So clicking
   * any part of any added object focuses that object, with no per-object wiring.
   */
  resolvePivotRoot(hit: THREE.Object3D | null): THREE.Object3D | null {
    if (!hit) return null;
    for (let o: THREE.Object3D | null = hit; o; o = o.parent) {
      const root = this.pivotRoots.get(o);
      if (root) return root;
    }
    return hit;
  }
}
