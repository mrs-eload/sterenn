/**
 * Weather model registry for the picker.
 *
 * `id` is the Open-Meteo `models=` slug. `label` is what the UI shows.
 * The Ouranos screenshot used UKMO, ICON, ECMWF IFS, AROME, ECMWF IFS HRES —
 * these are the Open-Meteo equivalents. "best_match" is Open-Meteo's auto pick.
 *
 * NOTE: slugs are per Open-Meteo docs. If a call 404s or returns no data for a
 * model, verify the slug against https://open-meteo.com/en/docs (Weather models
 * dropdown) — Open-Meteo occasionally renames them.
 */
export interface WeatherModel {
  id: string;
  label: string;
  /** Rough note for the UI tooltip. */
  note?: string;
}

export const WEATHER_MODELS: WeatherModel[] = [
  { id: 'best_match', label: 'Best match', note: 'Open-Meteo auto-selects the best model for the location' },
  { id: 'ecmwf_ifs025', label: 'ECMWF IFS 0.25°', note: 'Global, 0.25°' },
  // Was 'ecmwf_ifs04' (0.4° HRES) — Open-Meteo retired it; the slug now returns
  // all-null cloud_cover. Replaced with ECMWF's AIFS 0.25° (the *_single level
  // variant, since cloud_cover/precip are single-level vars). Verified live 2026-06-20.
  { id: 'ecmwf_aifs025_single', label: 'ECMWF AIFS 0.25°', note: 'Global AI model, 0.25°' },
  { id: 'meteofrance_arome_france', label: 'Météo-France AROME', note: 'Regional, high-res for France' },
  { id: 'icon_global', label: 'ICON Global', note: 'DWD global' },
  { id: 'icon_eu', label: 'ICON EU', note: 'DWD Europe, higher-res' },
  { id: 'ukmo_global_deterministic_10km', label: 'UKMO Global 10km', note: 'UK Met Office' },
];

export const DEFAULT_MODEL_ID = 'best_match';

/**
 * The Open-Meteo hourly variables this module requests.
 *
 * `cloud_cover` is the overall total that drives the verdict and sky-quality
 * curve; `cloud_cover_low|mid|high` are the per-altitude layers shown in the
 * Forecast Cloud Coverage chart. `wind_speed_250hPa` is the jet-stream wind
 * that feeds the seeing estimate (requested in m/s — see `wind_speed_unit`).
 */
export const HOURLY_VARS = [
  'cloud_cover',
  'cloud_cover_low',
  'cloud_cover_mid',
  'cloud_cover_high',
  'precipitation',
  'precipitation_probability',
  'wind_speed_250hPa',
] as const;

export type HourlyVar = (typeof HOURLY_VARS)[number];
