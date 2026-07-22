import { describe, it, expect } from 'vitest';
import { currentObservingNightDate } from './observingNight.ts';

/**
 * The bug this guards against: once local time passes midnight, "tonight" used
 * to flip to the *coming* night, hiding the night still in progress. The current
 * night must stay selected through the small hours (until local noon).
 */
describe('currentObservingNightDate', () => {
  it('after midnight, still points at the night that began yesterday evening', () => {
    // 01:30 on the 24th — we're mid-night. The night began the evening of the
    // 23rd, so the anchor is noon of the 23rd.
    const now = new Date(2026, 6, 24, 1, 30);
    expect(currentObservingNightDate(now)).toEqual(new Date(2026, 6, 23, 12, 0, 0, 0));
  });

  it('just before dawn is still the previous evening', () => {
    const now = new Date(2026, 6, 24, 5, 45);
    expect(currentObservingNightDate(now)).toEqual(new Date(2026, 6, 23, 12, 0, 0, 0));
  });

  it('in the evening, points at tonight (the night beginning today)', () => {
    const now = new Date(2026, 6, 23, 22, 10);
    expect(currentObservingNightDate(now)).toEqual(new Date(2026, 6, 23, 12, 0, 0, 0));
  });

  it('exactly at noon flips to tonight', () => {
    const now = new Date(2026, 6, 23, 12, 0, 0, 0);
    expect(currentObservingNightDate(now)).toEqual(new Date(2026, 6, 23, 12, 0, 0, 0));
  });

  it('just before noon is still the previous night', () => {
    const now = new Date(2026, 6, 23, 11, 59);
    expect(currentObservingNightDate(now)).toEqual(new Date(2026, 6, 22, 12, 0, 0, 0));
  });

  it('rolls the month back correctly across a month boundary', () => {
    // 02:00 on the 1st → the night began on the last evening of the prior month.
    const now = new Date(2026, 7, 1, 2, 0);
    expect(currentObservingNightDate(now)).toEqual(new Date(2026, 6, 31, 12, 0, 0, 0));
  });

  it('always pins the result to noon regardless of the input clock', () => {
    const anchor = currentObservingNightDate(new Date(2026, 6, 23, 3, 17, 42, 500));
    expect(anchor.getHours()).toBe(12);
    expect(anchor.getMinutes()).toBe(0);
    expect(anchor.getSeconds()).toBe(0);
    expect(anchor.getMilliseconds()).toBe(0);
  });
});
