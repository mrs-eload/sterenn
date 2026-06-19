import { describe, it, expect } from 'vitest';
import { analyzeNight } from './analyzeNight.ts';
import { describeNight } from './describeNight.ts';
import type { HourPoint, NightWindow } from './types.ts';

const H = 3_600_000;
const base = Date.parse('2026-06-19T22:00:00Z');

const mk = (clouds: number[]): HourPoint[] =>
  clouds.map((c, i) => ({
    time: base + i * H,
    cloudCover: c,
    precipProbability: 0,
  }));

describe('describeNight', () => {
  it('reports no-night when the night window is null', () => {
    const s = describeNight(null, null);
    expect(s.reason).toBe('no-night');
    expect(s.good).toBe(false);
    expect(s.windowHours).toBe(0);
  });

  it('reports good with block and window hours when the night qualifies', () => {
    const night: NightWindow = { start: base, end: base + 8 * H };
    const analysis = analyzeNight(mk([90, 90, 5, 5, 5, 90, 90, 90, 90]), night);
    const s = describeNight(analysis, night);
    expect(s.reason).toBe('good');
    expect(s.good).toBe(true);
    expect(s.blockHours).toBe(3);
    expect(s.windowHours).toBe(8);
  });

  it('distinguishes too-short (clear sky, window below min) from too-cloudy', () => {
    // ~1h window, perfectly clear. Sky is flawless but the window can't hold a
    // 3h block — the verdict must say "window too short", not "too cloudy".
    const shortNight: NightWindow = { start: base, end: base + 1 * H };
    const clearShort = analyzeNight(mk([0, 0]), shortNight);
    expect(clearShort.good).toBe(false); // window can't hold a 3h block
    const s = describeNight(clearShort, shortNight);
    expect(s.reason).toBe('too-short');
  });

  it('reports too-cloudy when the window is long enough but the sky is not clear', () => {
    const night: NightWindow = { start: base, end: base + 8 * H };
    const cloudy = analyzeNight(mk([90, 90, 90, 90, 90, 90, 90, 90, 90]), night);
    const s = describeNight(cloudy, night);
    expect(s.reason).toBe('too-cloudy');
    expect(s.blockHours).toBe(0);
  });
});
