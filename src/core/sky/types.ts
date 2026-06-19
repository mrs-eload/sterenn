/** One hour of forecast, normalized — source-agnostic. */
export interface HourPoint {
  /** Epoch ms. */
  time: number;
  /** Total cloud cover, 0–100. */
  cloudCover: number;
  /** Precipitation probability, 0–100. */
  precipProbability?: number;
  /** Precipitation amount, mm. */
  precipMm?: number;
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
