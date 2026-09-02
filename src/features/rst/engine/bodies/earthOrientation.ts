import { MakeTime, RotateVector, Rotation_EQD_ECL, SiderealTime, Vector } from 'astronomy-engine';
import { eclipticToWorld } from '../frames.ts';

/**
 * Earth's true orientation as a local→world basis for the globe mesh.
 *
 * The scene's world frame is heliocentric ecliptic-of-J2000 with the Sun at the
 * origin (see frames.ts), and the day/night terminator already falls correctly
 * in that frame because it's driven by the real Sun direction. What was missing
 * is the globe's *rotational phase* — which geographic longitude actually faces
 * the Sun right now. A fake "spin = time / sidereal-day" turns the globe to an
 * arbitrary longitude, so continents land on the wrong side of the terminator.
 *
 * Here we place three geographic reference points into world space via the real
 * Earth rotation (Greenwich Apparent Sidereal Time) and the equator-of-date →
 * ecliptic rotation, then hand back the basis they define. Applied to the mesh,
 * geography lines up with reality: night in Europe puts Europe on the dark side.
 *
 * The basis matches THREE.SphereGeometry's default equirectangular UV layout:
 *   +X ← geographic (0°N, 0°E)   — Greenwich on the equator (texture u = 0.5)
 *   +Y ← the north pole                                     (texture v = 1)
 *   +Z ← geographic (0°N, 90°W)  — 90° west on the equator  (texture u = 0.25)
 */
export interface EarthBasis {
  x: [number, number, number];
  y: [number, number, number];
  z: [number, number, number];
}

const DEG2RAD = Math.PI / 180;

/** World basis for the Earth mesh at `date`. */
export function earthOrientationBasis(date: Date): EarthBasis {
  const time = MakeTime(date);
  // Greenwich Apparent Sidereal Time: the right ascension of the Greenwich
  // meridian. A point at geographic longitude λ has RA = GAST + λ.
  const gastDeg = SiderealTime(time) * 15;
  const eqdToEcl = Rotation_EQD_ECL(time);

  const geoToWorld = (latDeg: number, lonDeg: number): [number, number, number] => {
    const dec = latDeg * DEG2RAD;
    const ra = (gastDeg + lonDeg) * DEG2RAD;
    // Unit vector in the true equator of date (x → equinox, z → celestial pole).
    const eqd = new Vector(
      Math.cos(dec) * Math.cos(ra),
      Math.cos(dec) * Math.sin(ra),
      Math.sin(dec),
      time,
    );
    const ecl = RotateVector(eqdToEcl, eqd);
    return eclipticToWorld({ x: ecl.x, y: ecl.y, z: ecl.z });
  };

  return {
    x: geoToWorld(0, 0),
    y: geoToWorld(90, 0),
    z: geoToWorld(0, -90),
  };
}
