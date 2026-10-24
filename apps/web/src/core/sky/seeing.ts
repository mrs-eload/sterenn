/**
 * seeing — a *proxy* astronomical-seeing estimate from jet-stream wind.
 *
 * Seeing is atmospheric turbulence blur (the FWHM a star is smeared to, in
 * arcseconds). A true seeing forecast integrates a turbulence (Cₙ²) profile
 * through the whole atmosphere — meteoblue's paid product. We don't have that.
 *
 * What we DO have from Open-Meteo is wind at the jet-stream level (~250 hPa,
 * ≈10 km), and high-altitude wind is the single biggest *forecastable* driver
 * of seeing: a fast jet overhead means strong high-altitude turbulence and soft,
 * boiling stars; when the jet is displaced and upper winds drop, seeing sharpens.
 *
 * So this maps 250 hPa wind speed to a 5-band index. It is an ESTIMATE, not a
 * calibrated arcsecond value, and it models only the jet-stream term — NOT
 * ground-layer / boundary-layer turbulence (local thermals, which also matter).
 * Treat it as "jet-stream seeing", and label it that way in the UI. Thresholds
 * are deliberately a config object so they can be calibrated against observed
 * nights, exactly like AnalyzeConfig.
 *
 * Pure. No fetch, no React. Wind is metres/second (the adapter normalises units).
 */

import type { HourPoint, NightWindow } from './types.ts';

export type SeeingBand =
  | 'excellent'
  | 'good'
  | 'average'
  | 'poor'
  | 'very-poor'
  | 'unknown';

export interface SeeingConfig {
  /**
   * 250 hPa wind speed (m/s) at or below which seeing falls into each band.
   * Ascending. Above `veryPoor` is the worst band. Jet streams commonly run
   * 30–60 m/s; good-seeing nights need the jet displaced (upper winds < ~20).
   * Ballpark amateur thresholds — calibrate against real nights before trusting.
   */
  jetThresholds: {
    /** ≤ this → excellent (index 5). */
    excellent: number;
    /** ≤ this → good (4). */
    good: number;
    /** ≤ this → average (3). */
    average: number;
    /** ≤ this → poor (2); above → very-poor (1). */
    poor: number;
  };
}

export const DEFAULT_SEEING_CONFIG: SeeingConfig = {
  jetThresholds: { excellent: 10, good: 20, average: 30, poor: 45 },
};

export interface SeeingEstimate {
  band: SeeingBand;
  /** 5 (excellent) … 1 (very-poor), or null when no jet data is available. */
  index: number | null;
  /** The 250 hPa wind speed used, m/s, or null. */
  jetWindMs: number | null;
}

const BAND_BY_INDEX: Record<number, SeeingBand> = {
  5: 'excellent',
  4: 'good',
  3: 'average',
  2: 'poor',
  1: 'very-poor',
};

/**
 * The Antoniadi scale — the classic visual seeing scale, I (perfect) … V
 * (terrible). LOWER is better, the opposite direction from our internal quality
 * index, so we map explicitly rather than arithmetically to keep it obvious.
 * `unknown` has no Antoniadi value.
 */
export const ANTONIADI: Record<
  Exclude<SeeingBand, 'unknown'>,
  { value: number; numeral: string }
> = {
  excellent: { value: 1, numeral: 'I' },
  good: { value: 2, numeral: 'II' },
  average: { value: 3, numeral: 'III' },
  poor: { value: 4, numeral: 'IV' },
  'very-poor': { value: 5, numeral: 'V' },
};

/** Antoniadi numeral/value for a band, or null for `unknown`. */
export function antoniadiFor(
  band: SeeingBand,
): { value: number; numeral: string } | null {
  return band === 'unknown' ? null : ANTONIADI[band];
}

/** Map one hour's jet-stream wind (m/s) to a seeing band. */
export function estimateHourSeeing(
  jetWindMs: number | null | undefined,
  config: Partial<SeeingConfig> = {},
): SeeingEstimate {
  const t = { ...DEFAULT_SEEING_CONFIG.jetThresholds, ...config.jetThresholds };

  if (typeof jetWindMs !== 'number' || !Number.isFinite(jetWindMs)) {
    return { band: 'unknown', index: null, jetWindMs: null };
  }

  let index: number;
  if (jetWindMs <= t.excellent) index = 5;
  else if (jetWindMs <= t.good) index = 4;
  else if (jetWindMs <= t.average) index = 3;
  else if (jetWindMs <= t.poor) index = 2;
  else index = 1;

  return { band: BAND_BY_INDEX[index], index, jetWindMs };
}

export interface SeeingSummary extends SeeingEstimate {
  /**
   * The summary `band`/`index` is the night's TYPICAL (median) seeing. These two
   * bound how much it swings: `best` is the calmest hour, `worst` the roughest.
   * Both 'unknown' when no hour had jet data.
   */
  best: SeeingBand;
  worst: SeeingBand;
  /** Per-hour estimates across the night window, in time order. */
  hours: { time: number; estimate: SeeingEstimate }[];
}

/**
 * Estimate seeing across the night window.
 *
 * The summary index is the *lower median* of the hours that have data — median
 * so a single anomalous hour doesn't dominate, lower-of-the-two on an even count
 * so we round toward the worse night (the app's standing pessimism; a night
 * called worse-than-real costs you nothing, the reverse wastes a clear sky).
 * Returns an 'unknown' summary when no hour has jet data (e.g. the model didn't
 * return 250 hPa wind).
 */
export function analyzeSeeing(
  hourly: HourPoint[],
  night: NightWindow,
  config: Partial<SeeingConfig> = {},
): SeeingSummary {
  const windowHours = hourly
    .filter((h) => h.time >= night.start && h.time <= night.end)
    .sort((a, b) => a.time - b.time);

  const hours = windowHours.map((h) => ({
    time: h.time,
    estimate: estimateHourSeeing(h.jetWindMs, config),
  }));

  const indices = hours
    .map((h) => h.estimate.index)
    .filter((i): i is number => i !== null)
    .sort((a, b) => a - b);

  if (indices.length === 0) {
    return {
      band: 'unknown',
      index: null,
      jetWindMs: null,
      best: 'unknown',
      worst: 'unknown',
      hours,
    };
  }

  // Lower median: for an even count take the lower-middle (worse) value.
  const medianIndex = indices[Math.floor((indices.length - 1) / 2)];
  // indices is sorted ascending; higher index = better seeing.
  const best = BAND_BY_INDEX[indices[indices.length - 1]];
  const worst = BAND_BY_INDEX[indices[0]];

  // Surface a representative jet wind: the median of the available winds, so the
  // number shown matches roughly the band shown.
  const winds = hours
    .map((h) => h.estimate.jetWindMs)
    .filter((w): w is number => w !== null)
    .sort((a, b) => a - b);
  const medianWind = winds[Math.floor((winds.length - 1) / 2)];

  return {
    band: BAND_BY_INDEX[medianIndex],
    index: medianIndex,
    jetWindMs: medianWind,
    best,
    worst,
    hours,
  };
}
