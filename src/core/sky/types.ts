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

/** Astronomical dark window: sun below -18°. */
export interface DarkWindow {
  /** Astronomical dusk (epoch ms). */
  start: number;
  /** Astronomical dawn (epoch ms). */
  end: number;
}
