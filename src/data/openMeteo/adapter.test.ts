import { describe, it, expect } from 'vitest';
import { adaptForecast } from './adapter.ts';
import type { OpenMeteoResponse } from './client.ts';

// Partial so a test can deliberately omit `time` (the missing-time throw case);
// cast back to the full shape for the adapter, which validates `time` at runtime.
const baseRes = (
  hourly: Partial<OpenMeteoResponse['hourly']>,
): OpenMeteoResponse => ({
  latitude: 47.78,
  longitude: -3.35,
  utc_offset_seconds: 0,
  timezone: 'GMT',
  hourly: hourly as OpenMeteoResponse['hourly'],
});

describe('adaptForecast', () => {
  it('maps a single bare-keyed response under the requested model id', () => {
    const res = baseRes({
      time: [1000, 4600],
      cloud_cover: [10, 80],
      cloud_cover_low: [5, 40],
      cloud_cover_mid: [3, 30],
      cloud_cover_high: [2, 10],
      precipitation: [0, 1.2],
      precipitation_probability: [5, 60],
    });
    const out = adaptForecast(res, { requestedModels: ['best_match'] });
    expect(Object.keys(out)).toEqual(['best_match']);
    expect(out.best_match[0]).toEqual({
      time: 1_000_000, // seconds -> ms
      cloud: { total: 10, low: 5, mid: 3, high: 2 },
      precipMm: 0,
      precipProbability: 5,
    });
    expect(out.best_match[1].cloud.total).toBe(80);
  });

  it('splits a multi-model (suffixed) response into per-model arrays', () => {
    const res = baseRes({
      time: [1000, 4600],
      cloud_cover_ecmwf_ifs025: [10, 20],
      precipitation_ecmwf_ifs025: [0, 0],
      precipitation_probability_ecmwf_ifs025: [5, 5],
      cloud_cover_meteofrance_arome_france: [90, 95],
      precipitation_meteofrance_arome_france: [2, 3],
      precipitation_probability_meteofrance_arome_france: [70, 80],
    });
    const out = adaptForecast(res, {
      requestedModels: ['ecmwf_ifs025', 'meteofrance_arome_france'],
    });
    expect(Object.keys(out).sort()).toEqual([
      'ecmwf_ifs025',
      'meteofrance_arome_france',
    ]);
    expect(out.ecmwf_ifs025[0].cloud.total).toBe(10);
    expect(out.meteofrance_arome_france[0].cloud.total).toBe(90);
    expect(out.meteofrance_arome_france[1].precipMm).toBe(3);
  });

  it('keeps cloud layers separate from the total in a suffixed response', () => {
    // The collision the BASE_VARS ordering guards against: `cloud_cover_low_<model>`
    // must not be read as base `cloud_cover` + suffix `low_<model>` (a phantom
    // model). Exactly one model should come back, with the layers populated.
    const res = baseRes({
      time: [1000],
      cloud_cover_icon_eu: [60],
      cloud_cover_low_icon_eu: [50],
      cloud_cover_mid_icon_eu: [20],
      cloud_cover_high_icon_eu: [5],
      precipitation_icon_eu: [0],
      precipitation_probability_icon_eu: [0],
    });
    const out = adaptForecast(res, { requestedModels: ['icon_eu'] });
    expect(Object.keys(out)).toEqual(['icon_eu']);
    expect(out.icon_eu[0].cloud).toEqual({
      total: 60,
      low: 50,
      mid: 20,
      high: 5,
    });
  });

  it('treats missing/null cloud data as overcast (pessimistic)', () => {
    const res = baseRes({
      time: [1000],
      cloud_cover: [null],
      precipitation: [null],
      precipitation_probability: [null],
    });
    const out = adaptForecast(res, { requestedModels: ['m'] });
    // total + every layer default to overcast when absent.
    expect(out.m[0].cloud).toEqual({ total: 100, low: 100, mid: 100, high: 100 });
    expect(out.m[0].precipMm).toBe(0);
    expect(out.m[0].precipProbability).toBe(0);
  });

  it('throws if hourly.time is missing', () => {
    const res = baseRes({ cloud_cover: [10] });
    expect(() => adaptForecast(res, { requestedModels: ['m'] })).toThrow();
  });
});
