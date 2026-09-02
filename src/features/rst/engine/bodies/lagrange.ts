import type { Vec3 } from '../types.ts';

/**
 * Sun–Earth mass parameter μ = m_earth / (m_sun + m_earth). Computed from Earth
 * alone (not the Earth–Moon barycentre); that's good to ~1% for where the
 * collinear points sit, which is well inside marker size at this display scale.
 */
const SUN_EARTH_MU = 3.0034e-6;

/** Distance of L1/L2 from Earth as a fraction of the Sun–Earth distance. */
const HILL_FRACTION = Math.cbrt(SUN_EARTH_MU / 3); // ≈ 0.01003

export type LagrangeName = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

export const LAGRANGE_NAMES: LagrangeName[] = ['L1', 'L2', 'L3', 'L4', 'L5'];

function scale(v: Vec3, k: number): Vec3 {
  return { x: v.x * k, y: v.y * k, z: v.z * k };
}

/**
 * The five Sun–Earth Lagrange points, in the heliocentric ecliptic-of-J2000
 * frame (AU), derived from Earth's current position.
 *
 * These are fixed only in the *rotating* Sun–Earth frame — in this inertial
 * frame they sweep around with Earth over a year — so recompute them whenever
 * Earth moves, don't cache a single position.
 *
 * - L1/L2/L3 are collinear with the Sun–Earth line, at the classic first-order
 *   distances: L1 sunward of Earth and L2 anti-sunward, each ~0.01 AU (~1.5M km)
 *   off Earth; L3 just beyond Earth's orbit on the far side of the Sun. (L2 is
 *   where Roman/RST, JWST and Gaia sit.)
 * - L4/L5 are Earth's position rotated ±60° about the ecliptic normal (+Z),
 *   forming equilateral triangles with the Sun and Earth. L4 leads Earth's
 *   motion (counter-clockwise seen from ecliptic north), L5 trails.
 */
export function sunEarthLagrangePoints(earth: Vec3): Record<LagrangeName, Vec3> {
  // Collinear points: pure radial scalings of Earth's position vector.
  const l1 = scale(earth, 1 - HILL_FRACTION);
  const l2 = scale(earth, 1 + HILL_FRACTION);
  // L3 sits on the opposite side of the Sun, a hair outside Earth's orbit.
  const l3 = scale(earth, -(1 + (5 * SUN_EARTH_MU) / 12));

  // Triangular points: rotate Earth ±60° about the ecliptic normal (z axis).
  const cos60 = 0.5;
  const sin60 = Math.sqrt(3) / 2;
  const l4: Vec3 = {
    x: earth.x * cos60 - earth.y * sin60,
    y: earth.x * sin60 + earth.y * cos60,
    z: earth.z,
  };
  const l5: Vec3 = {
    x: earth.x * cos60 + earth.y * sin60,
    y: -earth.x * sin60 + earth.y * cos60,
    z: earth.z,
  };

  return { L1: l1, L2: l2, L3: l3, L4: l4, L5: l5 };
}
