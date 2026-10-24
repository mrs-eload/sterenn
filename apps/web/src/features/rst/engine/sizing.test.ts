import { describe, expect, it } from 'vitest';
import {
  drawnRadius,
  pixelFloorScale,
  worldPerPixelAtUnitDistance,
} from './sizing';

describe('drawnRadius', () => {
  it('returns the true radius untouched in true-scale mode', () => {
    const r = drawnRadius(0.0042, { trueScale: true, sizeScale: 4, sizeCompression: 0.5 });
    expect(r).toBe(0.0042);
  });

  it('applies the power-law compression when not true-scale', () => {
    // sizeScale·radius^compression = 4 · 4^0.5 = 4 · 2 = 8
    const r = drawnRadius(4, { trueScale: false, sizeScale: 4, sizeCompression: 0.5 });
    expect(r).toBeCloseTo(8);
  });

  it('keeps the Sun larger than a planet under compression (monotonic)', () => {
    const model = { trueScale: false, sizeScale: 4, sizeCompression: 0.5 };
    expect(drawnRadius(0.005, model)).toBeGreaterThan(drawnRadius(0.00002, model));
  });
});

describe('pixelFloorScale', () => {
  const wppd = 0.001; // world-per-pixel at unit distance (arbitrary for the test)

  it('does not scale a body already above the floor', () => {
    // floorRadius = 2px · 0.001 · 100 = 0.2; base 1 is well above it.
    expect(pixelFloorScale(1, 100, wppd, 2)).toBe(1);
  });

  it('scales a sub-floor body up to exactly the floor size', () => {
    // floorRadius = 3px · 0.001 · 1000 = 3; base 0.5 → scale 3 / 0.5 = 6.
    expect(pixelFloorScale(0.5, 1000, wppd, 3)).toBeCloseTo(6);
  });

  it('returns 1 for a zero or negative base radius', () => {
    expect(pixelFloorScale(0, 1000, wppd, 3)).toBe(1);
    expect(pixelFloorScale(-1, 1000, wppd, 3)).toBe(1);
  });
});

describe('worldPerPixelAtUnitDistance', () => {
  it('grows with field of view', () => {
    const narrow = worldPerPixelAtUnitDistance(30, 1000);
    const wide = worldPerPixelAtUnitDistance(60, 1000);
    expect(wide).toBeGreaterThan(narrow);
  });

  it('shrinks as the viewport gets taller', () => {
    const short = worldPerPixelAtUnitDistance(50, 500);
    const tall = worldPerPixelAtUnitDistance(50, 1000);
    expect(tall).toBeCloseTo(short / 2);
  });
});
