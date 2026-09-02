import { Ecliptic, GeoMoon, HelioVector } from 'astronomy-engine';
import type { Body } from 'astronomy-engine';
import type { Vec3 } from './types';

const DAY_MS = 86_400_000;

/**
 * Heliocentric position of a body in the ecliptic-of-J2000 frame, in AU.
 *
 * astronomy-engine's HelioVector returns equatorial-J2000 coordinates; Ecliptic
 * rotates them into the ecliptic frame the whole engine uses (see frames.ts).
 */
export function planetPosition(body: Body, date: Date): Vec3 {
  const { vec } = Ecliptic(HelioVector(body, date));
  return { x: vec.x, y: vec.y, z: vec.z };
}

/**
 * GEOcentric position of the Moon in the ecliptic-of-J2000 frame, in AU — an
 * offset FROM Earth, not from the Sun. The Moon orbits Earth, so its orbit reads
 * correctly only as a ring centred on Earth; this offset is added to Earth's live
 * position each frame (see the engine). GeoMoon gives an equatorial-J2000 vector;
 * Ecliptic rotates it into the engine's frame, exactly like planetPosition.
 */
export function geoMoonPosition(date: Date): Vec3 {
  const { vec } = Ecliptic(GeoMoon(date));
  return { x: vec.x, y: vec.y, z: vec.z };
}

/**
 * Compute one full orbit as a sequence of heliocentric ecliptic positions (AU),
 * walking the body forward over a whole period from `around`. Drawn as a closed
 * loop, this traces the orbit path. Orbits precess only slowly, so computing the
 * path around any nearby epoch is fine for display.
 */
export function computeOrbitPath(
  body: Body,
  around: Date,
  periodDays: number,
  steps = 180,
): Vec3[] {
  const t0 = around.getTime();
  const points: Vec3[] = [];
  for (let i = 0; i < steps; i += 1) {
    const date = new Date(t0 + (periodDays * DAY_MS * i) / steps);
    points.push(planetPosition(body, date));
  }
  return points;
}
