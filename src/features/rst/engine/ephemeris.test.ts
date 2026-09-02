import { describe, it, expect } from 'vitest';
import { Body } from 'astronomy-engine';
import { planetPosition, computeOrbitPath } from './ephemeris';

const distance = (p: { x: number; y: number; z: number }) => Math.hypot(p.x, p.y, p.z);

// A fixed reference epoch so the expectations are deterministic.
const DATE = new Date('2026-08-30T12:00:00Z');

describe('planetPosition', () => {
  it('places Earth ~1 AU from the Sun', () => {
    const d = distance(planetPosition(Body.Earth, DATE));
    // Earth's heliocentric distance ranges 0.983–1.017 AU over the year.
    expect(d).toBeGreaterThan(0.98);
    expect(d).toBeLessThan(1.02);
  });

  it('places each planet within its known heliocentric distance range', () => {
    const ranges: Array<[Body, number, number]> = [
      [Body.Mercury, 0.30, 0.47],
      [Body.Venus, 0.71, 0.73],
      [Body.Mars, 1.38, 1.67],
      [Body.Jupiter, 4.95, 5.46],
      [Body.Saturn, 9.0, 10.1],
      [Body.Uranus, 18.3, 20.1],
      [Body.Neptune, 29.8, 30.4],
    ];
    for (const [body, min, max] of ranges) {
      const d = distance(planetPosition(body, DATE));
      expect(d, `${body} = ${d.toFixed(3)} AU`).toBeGreaterThan(min);
      expect(d, `${body} = ${d.toFixed(3)} AU`).toBeLessThan(max);
    }
  });

  it('keeps planets near the ecliptic plane (small z)', () => {
    // Ecliptic latitude is a few degrees at most, so |z| << distance.
    const p = planetPosition(Body.Earth, DATE);
    expect(Math.abs(p.z)).toBeLessThan(0.01);
  });
});

describe('computeOrbitPath', () => {
  it('returns the requested number of points', () => {
    expect(computeOrbitPath(Body.Earth, DATE, 365.256, 60)).toHaveLength(60);
  });

  it('closes the loop — first and last point of a full period nearly coincide', () => {
    const pts = computeOrbitPath(Body.Earth, DATE, 365.256, 360);
    const first = pts[0];
    const last = pts[pts.length - 1];
    // Last point is one step short of a full period, so it's close but not
    // identical to the first; well within a fraction of the orbit.
    expect(Math.hypot(first.x - last.x, first.y - last.y, first.z - last.z)).toBeLessThan(0.05);
  });
});
