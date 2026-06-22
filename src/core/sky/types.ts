/**
 * Cloud cover, split by altitude layer plus an overall total — all 0–100.
 *
 * `total` is Open-Meteo's `cloud_cover` (the "cloud" key): the overall sky
 * cover the model reports, NOT the sum of the three layers. It's what the
 * sky-quality verdict and curve run on. `low`/`mid`/`high` are the per-altitude
 * breakdown, surfaced separately in the Forecast Cloud Coverage chart.
 */
export interface CloudCover {
  /** Open-Meteo `cloud_cover` — overall cover. Drives the verdict + sky curve. */
  total?: number;
  low: number;
  mid: number;
  high: number;
}

/** One hour of forecast, normalized — source-agnostic. */
export interface HourPoint {
  /** Epoch ms. */
  time: number;
  /** Cloud cover: overall total plus the low/mid/high layer breakdown. */
  cloud: CloudCover;
  /** Precipitation probability, 0–100. */
  precipProbability?: number;
  /** Precipitation amount, mm. */
  precipMm?: number;
  /**
   * Jet-stream (250 hPa) wind speed, m/s. Drives the seeing estimate.
   * undefined = the model didn't return it (seeing is then "unknown").
   */
  jetWindMs?: number;
}

/**
 * The night observing window: civil dusk → civil dawn (sun below -6°).
 *
 * Civil, not astronomical (-18°), on purpose: at mid-latitudes in summer the
 * sun never reaches -18°, so a true-dark window is often null or minutes long.
 * Dusk→dawn always gives a usable span so the observer can judge a marginal
 * night themselves rather than being told "no night". See ADR 0003.
 */
export interface NightWindow {
  /** Civil dusk, evening (epoch ms). */
  start: number;
  /** Civil dawn, next morning (epoch ms). */
  end: number;
}
