import { describe, expect, it } from 'vitest';
import { earthOrientationBasis } from './earthOrientation.ts';

type V = [number, number, number];

const dot = (a: V, b: V): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V): number => Math.sqrt(dot(a, a));
const cross = (a: V, b: V): V => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const angleDeg = (a: V, b: V): number =>
  (Math.acos(Math.min(1, Math.max(-1, dot(a, b) / (len(a) * len(b))))) * 180) / Math.PI;

describe('earthOrientationBasis', () => {
  const basis = earthOrientationBasis(new Date('2026-09-01T12:00:00Z'));

  it('is an orthonormal, right-handed basis', () => {
    expect(len(basis.x)).toBeCloseTo(1, 6);
    expect(len(basis.y)).toBeCloseTo(1, 6);
    expect(len(basis.z)).toBeCloseTo(1, 6);
    expect(dot(basis.x, basis.y)).toBeCloseTo(0, 6);
    expect(dot(basis.y, basis.z)).toBeCloseTo(0, 6);
    expect(dot(basis.z, basis.x)).toBeCloseTo(0, 6);
    // Right-handed: x × y === z (a mirror-flipped globe would fail this).
    const xy = cross(basis.x, basis.y);
    expect(dot(xy, basis.z)).toBeCloseTo(1, 6);
  });

  it('tilts the polar axis by Earth\'s obliquity from ecliptic north', () => {
    // World +Y is ecliptic north (eclipticToWorld maps ecliptic +Z → world +Y).
    // The spin axis (the north-pole basis vector) sits one obliquity off it.
    expect(angleDeg(basis.y, [0, 1, 0])).toBeCloseTo(23.44, 1);
  });

  it('turns the Greenwich meridian with sidereal time', () => {
    // Half a sidereal day later, Greenwich faces the opposite inertial direction.
    const halfSidereal = new Date('2026-09-01T12:00:00Z');
    halfSidereal.setUTCMilliseconds(halfSidereal.getUTCMilliseconds() + 86_164_090 / 2);
    const later = earthOrientationBasis(halfSidereal);
    expect(angleDeg(basis.x, later.x)).toBeGreaterThan(170);

    // The polar axis barely moves over half a day (precession/nutation only).
    expect(angleDeg(basis.y, later.y)).toBeLessThan(0.1);
  });
});
