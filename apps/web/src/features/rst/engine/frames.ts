import type { Vec3 } from './types';

/** Kilometres per astronomical unit (IAU 2012 definition). */
export const KM_PER_AU = 149_597_870.7;

/** Convert a position expressed in km to astronomical units. */
export function kmToAu(v: Vec3): Vec3 {
  return { x: v.x / KM_PER_AU, y: v.y / KM_PER_AU, z: v.z / KM_PER_AU };
}

/**
 * Map a heliocentric ecliptic-of-J2000 position (AU) into Three.js world space.
 *
 * The engine works in one frame throughout: heliocentric, ecliptic of J2000.
 * In that frame the ecliptic is the XY plane and +Z points to ecliptic north.
 * Three.js is Y-up, so we lay the ecliptic flat on the XZ ground plane and send
 * ecliptic north to +Y: (x, y, z)_ecl → (x, z, -y)_world. The -y keeps the
 * mapping a proper (right-handed, non-mirroring) rotation, so orbital motion
 * keeps its real sense.
 */
export function eclipticToWorld(v: Vec3): [number, number, number] {
  return [v.x, v.z, -v.y];
}
