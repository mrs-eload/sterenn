import { describe, it, expect } from 'vitest';
import { estimateHourSeeing, analyzeSeeing, antoniadiFor } from './seeing.ts';
import type { HourPoint, NightWindow } from './types.ts';

const H = 3_600_000;
const base = Date.parse('2026-06-19T22:00:00Z');
const night: NightWindow = { start: base, end: base + 8 * H };

// Minimal HourPoint with just a jet wind — cloud is required by the type but
// irrelevant to seeing, so fill it trivially.
const mk = (jets: (number | undefined)[]): HourPoint[] =>
  jets.map((w, i) => ({
    time: base + i * H,
    cloud: { total: 0, low: 0, mid: 0, high: 0 },
    jetWindMs: w,
  }));

describe('estimateHourSeeing', () => {
  it('maps a calm jet to excellent and a screaming jet to very-poor', () => {
    expect(estimateHourSeeing(5).band).toBe('excellent');
    expect(estimateHourSeeing(5).index).toBe(5);
    expect(estimateHourSeeing(60).band).toBe('very-poor');
    expect(estimateHourSeeing(60).index).toBe(1);
  });

  it('walks the default thresholds (10/20/30/45 m/s)', () => {
    expect(estimateHourSeeing(10).band).toBe('excellent'); // boundary inclusive
    expect(estimateHourSeeing(15).band).toBe('good');
    expect(estimateHourSeeing(25).band).toBe('average');
    expect(estimateHourSeeing(40).band).toBe('poor');
    expect(estimateHourSeeing(46).band).toBe('very-poor');
  });

  it('returns unknown (null index) when there is no jet data', () => {
    expect(estimateHourSeeing(undefined)).toEqual({
      band: 'unknown',
      index: null,
      jetWindMs: null,
    });
    expect(estimateHourSeeing(NaN).band).toBe('unknown');
  });

  it('respects calibrated thresholds', () => {
    const cfg = { jetThresholds: { excellent: 5, good: 8, average: 12, poor: 18 } };
    expect(estimateHourSeeing(6, cfg).band).toBe('good');
    expect(estimateHourSeeing(20, cfg).band).toBe('very-poor');
  });
});

describe('antoniadiFor', () => {
  it('maps bands to I–V (lower = better) and unknown to null', () => {
    expect(antoniadiFor('excellent')).toEqual({ value: 1, numeral: 'I' });
    expect(antoniadiFor('average')).toEqual({ value: 3, numeral: 'III' });
    expect(antoniadiFor('very-poor')).toEqual({ value: 5, numeral: 'V' });
    expect(antoniadiFor('unknown')).toBeNull();
  });
});

describe('analyzeSeeing', () => {
  it('summarises the night by the (pessimistic) lower median', () => {
    // Indices: 5,5,4,3,3  → sorted 3,3,4,5,5 → median (lower of middle) = 4.
    const r = analyzeSeeing(mk([8, 9, 15, 25, 28]), night);
    expect(r.band).toBe('good');
    expect(r.index).toBe(4);
    expect(r.hours).toHaveLength(5);
  });

  it('reports the best and worst hour around the typical median', () => {
    // Indices 5,5,4,3,3 → median 4 (good), best 5 (excellent), worst 3 (average).
    const r = analyzeSeeing(mk([8, 9, 15, 25, 28]), night);
    expect(r.band).toBe('good');
    expect(r.best).toBe('excellent');
    expect(r.worst).toBe('average');
  });

  it('rounds an even count toward the worse value', () => {
    // Indices 5,3 → lower median = 3 (average), not 4.
    const r = analyzeSeeing(mk([8, 25]), night);
    expect(r.index).toBe(3);
    expect(r.band).toBe('average');
  });

  it('ignores hours with no jet data but still summarises the rest', () => {
    const r = analyzeSeeing(mk([8, undefined, 9]), night);
    expect(r.band).toBe('excellent');
    expect(r.hours[1].estimate.band).toBe('unknown');
  });

  it('is unknown when no hour in the window has jet data', () => {
    const r = analyzeSeeing(mk([undefined, undefined]), night);
    expect(r.band).toBe('unknown');
    expect(r.index).toBeNull();
  });

  it('only considers hours inside the night window', () => {
    const hours = mk([8, 8, 8]);
    hours.unshift({
      time: base - H,
      cloud: { total: 0, low: 0, mid: 0, high: 0 },
      jetWindMs: 60, // a very-poor hour BEFORE the window — must be ignored
    });
    const r = analyzeSeeing(hours, night);
    expect(r.band).toBe('excellent');
    expect(r.hours).toHaveLength(3);
  });
});
