import { Body } from 'astronomy-engine';
import { KM_PER_AU } from '../frames.ts';
import type { PlanetConfig } from '../types.ts';
import { createMercury } from './mercury.ts';
import { createVenus } from './venus.ts';
import { createMars } from './mars.ts';
import { createJupiter } from './jupiter.ts';
import { createSaturn } from './saturn.ts';
import { createUranus } from './uranus.ts';
import { createNeptune } from './neptune.ts';

/** Convert a mean equatorial radius in km to AU (the engine's length unit). */
const auFromKm = (km: number): number => km / KM_PER_AU;

/**
 * The eight planets, heliocentric, with their TRUE mean radii (mean equatorial,
 * in km → AU). These real radii are the input the engine compresses into a drawn
 * size (see EngineOptions.sizeCompression); the honest ordering is preserved but
 * the huge dynamic range is squeezed so small bodies stay visible. Periods are
 * sidereal, in days.
 */
export const PLANETS: PlanetConfig[] = [
  { body: Body.Mercury, label: 'Mercury', color: 0x9c8f7a, radiusAu: auFromKm(2439.7), orbitalPeriodDays: 87.969, create: createMercury },
  { body: Body.Venus, label: 'Venus', color: 0xd8b878, radiusAu: auFromKm(6051.8), orbitalPeriodDays: 224.701, create: createVenus },
  { body: Body.Earth, label: 'Earth', color: 0x2b7cff, radiusAu: auFromKm(6371.0), orbitalPeriodDays: 365.256 },
  { body: Body.Mars, label: 'Mars', color: 0xd1603f, radiusAu: auFromKm(3389.5), orbitalPeriodDays: 686.980, create: createMars },
  { body: Body.Jupiter, label: 'Jupiter', color: 0xd9a066, radiusAu: auFromKm(69911), orbitalPeriodDays: 4332.589, create: createJupiter },
  { body: Body.Saturn, label: 'Saturn', color: 0xe3d9a6, radiusAu: auFromKm(58232), orbitalPeriodDays: 10759.22, create: createSaturn },
  { body: Body.Uranus, label: 'Uranus', color: 0x9fd8e0, radiusAu: auFromKm(25362), orbitalPeriodDays: 30685.4, create: createUranus },
  { body: Body.Neptune, label: 'Neptune', color: 0x5b7bd6, radiusAu: auFromKm(24622), orbitalPeriodDays: 60189.0, create: createNeptune },
];
