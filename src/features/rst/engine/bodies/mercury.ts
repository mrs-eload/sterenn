import { createTexturedPlanet, TEXTURE_BASE } from './planetBody.ts';
import type { PlanetHandle } from './planetBody.ts';

/**
 * Mercury: an airless, cratered rock. Effectively no axial tilt, and a very slow
 * spin — one sidereal rotation takes ~58.6 Earth days (1407.6 h).
 */
export function createMercury(radius: number): PlanetHandle {
  return createTexturedPlanet(radius, {
    name: 'Mercury',
    textureUrl: `${TEXTURE_BASE}mercury/2k_mercury.jpg`,
    axialTiltDeg: 0.034,
    rotationPeriodHours: 1407.6,
  });
}
