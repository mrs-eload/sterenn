import { createTexturedPlanet, TEXTURE_BASE } from './planetBody.ts';
import type { PlanetHandle } from './planetBody.ts';

/**
 * Uranus: the near-featureless pale-cyan haze. Its 97.8° tilt lays the planet on
 * its side, and its rotation is retrograde — encoded as a negative period so the
 * shared spin runs the other way (17.24 h).
 */
export function createUranus(radius: number): PlanetHandle {
  return createTexturedPlanet(radius, {
    name: 'Uranus',
    textureUrl: `${TEXTURE_BASE}uranus/2k_uranus.jpg`,
    axialTiltDeg: 97.77,
    rotationPeriodHours: -17.24,
    // Pale cyan methane haze.
    atmosphere: { color: 0xb5ecef, scale: 1.04 },
  });
}
