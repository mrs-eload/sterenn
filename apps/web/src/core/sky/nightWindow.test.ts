import { describe, it, expect } from 'vitest';
import * as SunCalc from 'suncalc';
import { getNightWindow } from './nightWindow.ts';

const H = 3_600_000;

// Brittany, midsummer — the latitude/season the whole choice of civil twilight
// is for. Astronomical night here is ~2h or nonexistent; civil dusk→dawn must
// still give a usable window.
const LAT = 47.2;
const LON = -3.26;
const JUNE = new Date('2026-06-20T12:00:00Z');

describe('getNightWindow', () => {
  it('returns a multi-hour civil window for Brittany in June', () => {
    const w = getNightWindow(JUNE, LAT, LON);
    expect(w).not.toBeNull();
    const hours = (w!.end - w!.start) / H;
    // Astronomical (-18°) would be ~2h or null here; civil (-6°) is ~6-7h.
    expect(hours).toBeGreaterThan(4);
    expect(hours).toBeLessThan(9);
  });

  it('uses civil dusk/dawn (-6°), not astronomical night (-18°)', () => {
    const w = getNightWindow(JUNE, LAT, LON)!;
    const tonight = SunCalc.getTimes(JUNE, LAT, LON);
    const tomorrow = new Date(JUNE);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const next = SunCalc.getTimes(tomorrow, LAT, LON);
    // Start is this evening's civil dusk; end is tomorrow morning's civil dawn.
    expect(w.start).toBe(tonight.dusk!.getTime());
    expect(w.end).toBe(next.dawn!.getTime());
    // And it is genuinely the civil window, not the (narrower) astronomical one.
    expect(w.start).toBeLessThan(tonight.night!.getTime());
  });

  it('returns null when civil twilight never ends (polar midsummer)', () => {
    // Svalbard in June: the sun stays above -6° all night → no civil dusk/dawn.
    expect(getNightWindow(JUNE, 78, 15)).toBeNull();
  });
});
