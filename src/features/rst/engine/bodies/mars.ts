import { createTexturedPlanet, TEXTURE_BASE } from './planetBody.ts';
import type { PlanetHandle } from './planetBody.ts';

/**
 * Mars: the rusty surface map, an Earth-like day (24.62 h sidereal) and a 25.2°
 * tilt very close to Earth's — hence its comparable seasons.
 */
export function createMars(radius: number): PlanetHandle {
  return createTexturedPlanet(radius, {
    name: 'Mars',
    textureUrl: `${TEXTURE_BASE}mars/2k_mars.jpg`,
    axialTiltDeg: 25.19,
    rotationPeriodHours: 24.62,
  });
}
