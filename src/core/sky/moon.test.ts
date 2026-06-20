import { describe, it, expect } from 'vitest';
import * as SunCalc from 'suncalc';
import { describeMoon, moonPhaseName } from './moon.ts';
import type { NightWindow } from './types.ts';

const H = 3_600_000;
const DAY = 86_400_000;

// Brittany, the app's default location.
const LAT = 47.2;
const LON = -3.26;

describe('moonPhaseName', () => {
  it('names the four landmark phases', () => {
    expect(moonPhaseName(0)).toBe('New moon');
    expect(moonPhaseName(0.25)).toBe('First quarter');
    expect(moonPhaseName(0.5)).toBe('Full moon');
    expect(moonPhaseName(0.75)).toBe('Last quarter');
  });

  it('names the crescent/gibbous quarters between them', () => {
    expect(moonPhaseName(0.125)).toBe('Waxing crescent');
    expect(moonPhaseName(0.375)).toBe('Waxing gibbous');
    expect(moonPhaseName(0.625)).toBe('Waning gibbous');
    expect(moonPhaseName(0.875)).toBe('Waning crescent');
  });

  it('wraps back to new at the top of the cycle', () => {
    expect(moonPhaseName(0.97)).toBe('New moon');
  });
});

describe('describeMoon', () => {
  const window: NightWindow = {
    start: Date.parse('2026-06-20T22:00:00Z'),
    end: Date.parse('2026-06-21T04:00:00Z'),
  };

  it('reports illumination/phase straight from suncalc at the window midpoint', () => {
    const m = describeMoon(window, LAT, LON);
    const mid = (window.start + window.end) / 2;
    const ref = SunCalc.getMoonIllumination(new Date(mid));
    expect(m.illumination).toBe(ref.fraction);
    expect(m.phaseName).toBe(moonPhaseName(ref.phase));
    expect(m.illumination).toBeGreaterThanOrEqual(0);
    expect(m.illumination).toBeLessThanOrEqual(1);
  });

  it('keeps altitude and up-flag self-consistent', () => {
    const m = describeMoon(window, LAT, LON);
    expect(m.peakAltitudeDeg).toBeGreaterThanOrEqual(-90);
    expect(m.peakAltitudeDeg).toBeLessThanOrEqual(90);
    expect(m.upDuringNight).toBe(m.peakAltitudeDeg > 0);
  });

  it('only reports a rise/set that actually falls inside the window', () => {
    const m = describeMoon(window, LAT, LON);
    if (m.rise !== null) {
      expect(m.rise).toBeGreaterThanOrEqual(window.start);
      expect(m.rise).toBeLessThanOrEqual(window.end);
    }
    if (m.set !== null) {
      expect(m.set).toBeGreaterThanOrEqual(window.start);
      expect(m.set).toBeLessThanOrEqual(window.end);
    }
  });

  // A real-astronomy sanity check that doesn't depend on me hardcoding a calendar
  // date: over one synodic month the moon must pass through both new (~0% lit)
  // and full (~100% lit). If illumination never gets dark or never gets bright,
  // the wiring is wrong.
  it('spans a full lunar cycle across a month of nights', () => {
    let min = 1;
    let max = 0;
    for (let d = 0; d < 30; d++) {
      const start = Date.parse('2026-06-01T22:00:00Z') + d * DAY;
      const f = describeMoon({ start, end: start + 6 * H }, LAT, LON).illumination;
      min = Math.min(min, f);
      max = Math.max(max, f);
    }
    expect(min).toBeLessThan(0.05);
    expect(max).toBeGreaterThan(0.95);
  });
});
