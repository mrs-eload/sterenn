import { describe, expect, it } from 'vitest';
import { sunEarthLagrangePoints } from './lagrange.ts';
import type { Vec3 } from '../types.ts';

const mag = (v: Vec3): number => Math.hypot(v.x, v.y, v.z);
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const dist = (a: Vec3, b: Vec3): number => mag({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

// Earth ~1 AU out, placed off the axes so a bug that only works on-axis shows.
const earth: Vec3 = { x: 0.8, y: 0.6, z: 0.0 };
const r = mag(earth); // = 1.0

describe('sunEarthLagrangePoints', () => {
  const L = sunEarthLagrangePoints(earth);

  it('puts L1 sunward and L2 anti-sunward, collinear with Earth', () => {
    // Same direction as Earth (cross product ~0 → parallel).
    for (const p of [L.L1, L.L2]) {
      const cosAngle = dot(p, earth) / (mag(p) * r);
      expect(cosAngle).toBeCloseTo(1, 6);
    }
    // L1 closer to the Sun than Earth, L2 farther.
    expect(mag(L.L1)).toBeLessThan(r);
    expect(mag(L.L2)).toBeGreaterThan(r);
    // Both about 0.01 AU (~1.5M km) off Earth, and symmetric to first order.
    expect(dist(L.L1, earth)).toBeCloseTo(0.01003, 4);
    expect(dist(L.L2, earth)).toBeCloseTo(0.01003, 4);
  });

  it('puts L3 on the far side of the Sun, just beyond Earth’s orbit', () => {
    // Opposite direction to Earth.
    const cosAngle = dot(L.L3, earth) / (mag(L.L3) * r);
    expect(cosAngle).toBeCloseTo(-1, 6);
    // Radius a hair larger than Earth's.
    expect(mag(L.L3)).toBeGreaterThan(r);
    expect(mag(L.L3)).toBeCloseTo(r, 3);
  });

  it('puts L4/L5 at 60° from Earth, equidistant from Sun and Earth', () => {
    for (const p of [L.L4, L.L5]) {
      expect(mag(p)).toBeCloseTo(r, 9); // same orbital radius as Earth
      const cosAngle = dot(p, earth) / (mag(p) * r);
      expect(cosAngle).toBeCloseTo(Math.cos(Math.PI / 3), 9); // 60°
      expect(dist(p, earth)).toBeCloseTo(r, 9); // equilateral triangle
    }
    // L4 leads (counter-clockwise about +z), L5 trails: the z of the
    // Earth→point cross product flips sign between them.
    const cross4z = earth.x * L.L4.y - earth.y * L.L4.x;
    const cross5z = earth.x * L.L5.y - earth.y * L.L5.x;
    expect(cross4z).toBeGreaterThan(0);
    expect(cross5z).toBeLessThan(0);
  });
});
