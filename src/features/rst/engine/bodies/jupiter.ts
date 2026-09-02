import { createTexturedPlanet, TEXTURE_BASE } from './planetBody.ts';
import type { PlanetHandle } from './planetBody.ts';

/**
 * Jupiter: banded cloud tops with the Great Red Spot baked into the map. A small
 * 3.1° tilt and the fastest spin in the solar system — under 10 h (9.925 h),
 * which is why the bands are so pronounced.
 */
export function createJupiter(radius: number): PlanetHandle {
  return createTexturedPlanet(radius, {
    name: 'Jupiter',
    textureUrl: `${TEXTURE_BASE}jupiter/2k_jupiter.jpg`,
    axialTiltDeg: 3.13,
    rotationPeriodHours: 9.925,
    // Warm tan haze over the cloud tops.
    atmosphere: { color: 0xe8c79a, scale: 1.03 },
  });
}
