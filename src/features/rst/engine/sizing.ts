import * as THREE from 'three';

/** How a body's true radius (AU) is turned into a drawn radius. See EngineOptions. */
export interface SizeModel {
  trueScale: boolean;
  sizeScale: number;
  sizeCompression: number;
}

/**
 * The world radius a body is built at. In true-scale mode this is the real
 * radius, untouched (the pixel floor then keeps it visible when far); otherwise
 * it's the compressed power-law size — one monotonic rule for the Sun and all
 * planets, so the Sun is always largest and the giants largest among the
 * planets, while the smallest bodies stay visible.
 */
export function drawnRadius(radiusAu: number, model: SizeModel): number {
  if (model.trueScale) return radiusAu;
  return model.sizeScale * radiusAu ** model.sizeCompression;
}

/**
 * World-per-pixel at unit distance for a perspective camera: `2·tan(fov/2) /
 * viewportHeight`. Multiply by a body's camera distance to get the world size
 * one screen pixel spans at that body.
 */
export function worldPerPixelAtUnitDistance(fovDeg: number, viewportHeight: number): number {
  return (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2)) / Math.max(1, viewportHeight);
}

/**
 * Uniform scale factor that holds a body to a minimum apparent size. A body of
 * world radius `baseRadius` at `distance` from the camera spans
 * `baseRadius / (distance · worldPerPixelPerDist)` pixels; invert that to find
 * the world radius needed for `minPixelRadius` pixels — it grows with distance,
 * so a body scales *up* as you retreat and never drops below the floor, then
 * relaxes to its true size (scale 1) the moment it's close enough to clear the
 * floor on its own. That crossover is the point: far away, a guaranteed dot; up
 * close, honest proportions. The scale is uniform, so textures, tilt and shells
 * keep their shape. Returns 1 (no scaling) for a zero/negative base radius.
 */
export function pixelFloorScale(
  baseRadius: number,
  distance: number,
  worldPerPixelPerDist: number,
  minPixelRadius: number,
): number {
  if (baseRadius <= 0) return 1;
  const floorRadius = minPixelRadius * worldPerPixelPerDist * distance;
  return Math.max(baseRadius, floorRadius) / baseRadius;
}
