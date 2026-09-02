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

  /**
   * Register a body: `root` is its pivot centre (what we orbit and zoom to),
   * `pickTarget` is the geometry the ray actually hits (often a child of `root`),
   * and `radiusAu` its true radius so the zoom stops just outside its surface.
   */
  addBody(root: THREE.Object3D, pickTarget: THREE.Object3D, radiusAu: number): void {
    this.radii.set(root, radiusAu);
    this._pickables.push(pickTarget);
  }

  /**
   * Register a pickable with no known radius — an annotation (a Lagrange marker)
   * or a spacecraft. Zoom-to it stops at the global floor (radius 0).
   */
  addPickable(object: THREE.Object3D): void {
    this._pickables.push(object);
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
   * Resolve a raw raycast hit to the object we should pivot on: the nearest
   * ancestor we know a centre/size for (a planet, the Sun), else the nearest
   * ancestor we actually registered as pickable (a Lagrange marker, a spacecraft
   * model group). So clicking any part of any added object focuses that object,
   * not an arbitrary child mesh — which is what lets future spacecraft work with
   * no per-object wiring.
   */
  resolvePivotRoot(hit: THREE.Object3D | null): THREE.Object3D | null {
    if (!hit) return null;
    for (let o: THREE.Object3D | null = hit; o; o = o.parent) {
      if (this.radii.has(o)) return o;
    }
    for (let o: THREE.Object3D | null = hit; o; o = o.parent) {
      if (this._pickables.includes(o)) return o;
    }
    return hit;
  }
}
