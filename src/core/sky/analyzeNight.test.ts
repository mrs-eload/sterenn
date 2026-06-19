import { describe, it, expect } from 'vitest';
import { analyzeNight } from './analyzeNight.ts';
import type { HourPoint, DarkWindow } from './types.ts';

const H = 3_600_000;
const base = Date.parse('2026-06-19T22:00:00Z');
const dark: DarkWindow = { start: base, end: base + 8 * H };

const mk = (
  clouds: number[],
  precipAt: Record<number, number> = {},
): HourPoint[] =>
  clouds.map((c, i) => ({
    time: base + i * H,
    cloudCover: c,
    precipProbability: precipAt[i] ?? 0,
  }));

describe('analyzeNight', () => {
  it('does NOT call a night good off a single clear hour (the Ouranos bug)', () => {
    const r = analyzeNight(mk([90, 90, 5, 90, 90, 90, 90, 90, 90]), dark);
    expect(r.good).toBe(false);
    expect(r.longestBlock?.lengthHours).toBe(1);
  });

  it('calls a solid 3h clear block good', () => {
    const r = analyzeNight(mk([90, 90, 5, 5, 5, 90, 90, 90, 90]), dark);
    expect(r.good).toBe(true);
    expect(r.longestBlock?.lengthHours).toBe(3);
  });

  it('bridges one isolated cloud hour inside a 5h block (budget 1)', () => {
    const r = analyzeNight(mk([90, 5, 5, 80, 5, 5, 90, 90, 90]), dark, {
      cloudGapBudget: 1,
    });
    expect(r.good).toBe(true);
    expect(r.longestBlock?.lengthHours).toBe(5);
    expect(r.longestBlock?.bridgedHours).toBe(1);
  });

  it('breaks when two adjacent cloud hours exceed the gap budget', () => {
    const r = analyzeNight(mk([90, 5, 5, 80, 80, 5, 5, 90, 90]), dark, {
      cloudGapBudget: 1,
      minBlockHours: 3,
    });
    expect(r.good).toBe(false);
    expect(r.longestBlock?.lengthHours).toBe(2);
  });

  it('treats precipitation as a hard break even with budget to spare', () => {
    const r = analyzeNight(mk([5, 5, 5, 5, 5, 5, 5, 5, 5], { 4: 80 }), dark, {
      cloudGapBudget: 3,
    });
    expect(r.good).toBe(true);
    expect(r.longestBlock?.lengthHours).toBe(4);
  });

  it('trims a trailing bridged cloud hour off the block', () => {
    const r = analyzeNight(mk([5, 5, 80, 90, 90, 90, 90, 90, 90]), dark, {
      cloudGapBudget: 1,
    });
    expect(r.longestBlock?.lengthHours).toBe(2);
    expect(r.longestBlock?.endIndex).toBe(1);
  });

  it('returns no block when nothing is clear', () => {
    const r = analyzeNight(mk([90, 90, 90, 90, 90, 90, 90, 90, 90]), dark);
    expect(r.good).toBe(false);
    expect(r.longestBlock).toBeNull();
  });

  it('ignores clear hours outside the dark window', () => {
    const hours = mk([90, 90, 90, 90, 90, 90, 90, 90, 90]);
    hours.unshift({ time: base - H, cloudCover: 0 });
    const r = analyzeNight(hours, dark);
    expect(r.good).toBe(false);
    expect(r.hours.length).toBe(9);
  });
});
