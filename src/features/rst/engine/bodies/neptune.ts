import { createTexturedPlanet, TEXTURE_BASE } from './planetBody.ts';
import type { PlanetHandle } from './planetBody.ts';

/**
 * Neptune: deep-blue methane haze, a 28.3° tilt near Earth's and Mars's, and a
 * 16.1 h day.
 */
export function createNeptune(radius: number): PlanetHandle {
  return createTexturedPlanet(radius, {
    name: 'Neptune',
    textureUrl: `${TEXTURE_BASE}neptune/2k_neptune.jpg`,
    axialTiltDeg: 28.32,
    rotationPeriodHours: 16.11,
  });
}
