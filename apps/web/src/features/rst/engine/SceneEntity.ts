import * as THREE from 'three';

/**
 * Per-frame inputs handed to every entity's update(). Bundled into one object so
 * the entity contract stays stable as new needs appear (a body's pixel floor
 * needs the camera + viewport; ambient animation needs real dt; deterministic
 * position/spin needs sim time).
 */
export interface FrameContext {
  /** Current simulation instant (epoch ms). Deterministic position/spin uses this. */
  simTimeMs: number;
  /** Real seconds since the previous frame. Ambient animation (Sun churn) uses this. */
  dt: number;
  /** The camera, for anything that reacts to viewpoint (e.g. the pixel floor). */
  camera: THREE.PerspectiveCamera;
  /** Viewport height in CSS px, for the pixel floor. */
  viewportHeight: number;
}

/**
 * Anything the engine adds to the scene and advances each frame. The engine holds
 * a flat list of these and does nothing body-specific with them: it parents each
 * entity's `object3D` under the solar-system group and calls `update(ctx)` once a
 * frame. What a given entity *is* — a body, its orbit trail, an annotation — is
 * entirely its own business, so adding a new kind of thing never edits the engine
 * (see bodies/ for the implementations).
 */
export interface SceneEntity {
  /** The root object to parent into the scene (or into a parent entity's group). */
  readonly object3D: THREE.Object3D;
  /** Advance to the frame described by `ctx`. */
  update(ctx: FrameContext): void;
  /** Release every GPU resource this entity created. */
  dispose(): void;
}
