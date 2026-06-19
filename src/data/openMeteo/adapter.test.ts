import { describe, it, expect } from 'vitest';
import { adaptForecast } from './adapter.ts';
import type { OpenMeteoResponse } from './client.ts';

const baseRes = (hourly: any): OpenMeteoResponse => ({
  latitude: 47.78,
  longitude: -3.35,
  utc_offset_seconds: 0,
  timezone: 'GMT',
  hourly,
});

describe('adaptForecast', () => {
  it('maps a single bare-keyed response under the requested model id', () => {
    const res = baseRes({
      time: [1000, 4600],
      cloud_cover: [10, 80],
      precipitation: [0, 1.2],
      precipitation_probability: [5, 60],
    });
    const out = adaptForecast(res, { requestedModels: ['best_match'] });
    expect(Object.keys(out)).toEqual(['best_match']);
    expect(out.best_match[0]).toEqual({
      time: 1_000_000, // seconds -> ms
      cloudCover: 10,
      precipMm: 0,
      precipProbability: 5,
    });
    expect(out.best_match[1].cloudCover).toBe(80);
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
    expect(out.ecmwf_ifs025[0].cloudCover).toBe(10);
    expect(out.meteofrance_arome_france[0].cloudCover).toBe(90);
    expect(out.meteofrance_arome_france[1].precipMm).toBe(3);
  });

  it('treats missing/null cloud data as overcast (pessimistic)', () => {
    const res = baseRes({
      time: [1000],
      cloud_cover: [null],
      precipitation: [null],
      precipitation_probability: [null],
    });
    const out = adaptForecast(res, { requestedModels: ['m'] });
    expect(out.m[0].cloudCover).toBe(100); // overcast
    expect(out.m[0].precipMm).toBe(0);
    expect(out.m[0].precipProbability).toBe(0);
  });

  it('throws if hourly.time is missing', () => {
    const res = baseRes({ cloud_cover: [10] });
    expect(() => adaptForecast(res, { requestedModels: ['m'] })).toThrow();
  });
});
