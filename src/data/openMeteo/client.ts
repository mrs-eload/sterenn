import { HOURLY_VARS, type HourlyVar } from './models.ts';
import { day1 } from "@app/data/openMeteo/examples/day1.ts";
/**
 * Open-Meteo /v1/forecast response (the slice we use).
 *
 * Single-model: hourly = { time: number[], cloud_cover: number[], ... }
 * Multi-model:  each variable is suffixed with the model slug, e.g.
 *               cloud_cover_ecmwf_ifs025, cloud_cover_meteofrance_arome_france.
 *               `time` is shared (one array). We treat hourly as an open record
 *               so the adapter can discover suffixed keys at runtime rather than
 *               us hardcoding slugs we haven't verified against the live API.
 *
 * Timestamps are unixtime SECONDS, GMT (we request &timezone=GMT).
 */
export interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  utc_offset_seconds: number;
  timezone: string;
  hourly: OpenMeteoHourly;
  hourly_units?: Record<string, string>;
}

export interface OpenMeteoHourly {
  /** unixtime seconds, GMT. Shared across all models in a multi-model call. */
  time: number[];
  /** All other keys are variable arrays, possibly model-suffixed. */
  [key: string]: number[] | (number | null)[];
}

export interface FetchForecastParams {
  lat: number;
  lon: number;
  /** Open-Meteo model slugs. One or many. */
  models: string[];
  /** Defaults to 2 — tonight + a margin for the night window crossing midnight. */
  forecastDays?: number;
  /** Override base URL for testing. */
  baseUrl?: string;
}

const BASE = 'https://api.open-meteo.com/v1/forecast';

export function buildForecastUrl(p: FetchForecastParams): string {
  const url = new URL(p.baseUrl ?? BASE);
  url.searchParams.set('latitude', String(p.lat));
  url.searchParams.set('longitude', String(p.lon));
  url.searchParams.set('hourly', HOURLY_VARS.join(','));
  url.searchParams.set('models', p.models.join(','));
  url.searchParams.set('forecast_days', String(p.forecastDays ?? 2));
  // unixtime + GMT keeps the adapter free of timezone parsing.
  url.searchParams.set('timeformat', 'unixtime');
  url.searchParams.set('timezone', 'GMT');
  return url.toString();
}

export async function fetchForecast(
  p: FetchForecastParams,
  signal?: AbortSignal,
): Promise<OpenMeteoResponse> {

  //TEST DATA
  return day1;

  const res = await fetch(buildForecastUrl(p), { signal });
  if (!res.ok) {
    if(res.status === 429){
    }
    throw new Error(`Open-Meteo ${res.status}: ${res.statusText}`);
  }
  return (await res.json()) as OpenMeteoResponse;
}

export type { HourlyVar };
