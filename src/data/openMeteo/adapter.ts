import type { HourPoint } from '../../core/sky/types';
import type { OpenMeteoResponse } from './client.ts';

/**
 * Map an Open-Meteo response into per-model HourPoint[] arrays.
 *
 * The multi-model challenge: Open-Meteo suffixes each variable with the model
 * slug when multiple models are requested (cloud_cover_ecmwf_ifs025, etc.), but
 * returns bare keys (cloud_cover) for a single model. This adapter handles both
 * by *discovering* which models are present from the hourly keys, rather than
 * trusting a hardcoded slug list. So it survives Open-Meteo renaming a slug.
 *
 * Times are unixtime SECONDS (we request timeformat=unixtime); HourPoint wants
 * epoch MILLIseconds, so we multiply by 1000.
 *
 * Returns: { [modelId]: HourPoint[] }. For a single bare-keyed response the
 * model key is whatever `requestedModels[0]` was (caller passes it so the bare
 * case still gets a sensible label instead of "default").
 */

const BASE_VARS = ['cloud_cover', 'precipitation', 'precipitation_probability'] as const;

// Longest first, so `precipitation_probability` is matched before `precipitation`.
// Otherwise the key `precipitation_probability` would be read as base
// `precipitation` + suffix `probability`, inventing a phantom model.
const BASE_VARS_BY_LENGTH = [...BASE_VARS].sort((a, b) => b.length - a.length);

export interface AdaptOptions {
  /**
   * The models the caller requested, in order. Used to label a single-model
   * (bare-keyed) response. Ignored when the response is already suffixed.
   */
  requestedModels: string[];
}

export function adaptForecast(
  res: OpenMeteoResponse,
  opts: AdaptOptions,
): Record<string, HourPoint[]> {
  const hourly = res.hourly;
  const times = hourly.time;
  if (!Array.isArray(times)) {
    throw new Error('Open-Meteo response missing hourly.time');
  }

  // Discover model suffixes from the keys. For each base var, any key shaped
  // `${base}_${suffix}` reveals a model. A bare `${base}` means single-model.
  const suffixes = new Set<string>();
  let hasBare = false;

  for (const key of Object.keys(hourly)) {
    if (key === 'time') continue;
    const base = BASE_VARS_BY_LENGTH.find(
      (b) => key === b || key.startsWith(b + '_'),
    );
    if (!base) continue;
    if (key === base) {
      hasBare = true;
    } else {
      suffixes.add(key.slice(base.length + 1));
    }
  }

  const out: Record<string, HourPoint[]> = {};

  const buildFor = (modelKey: string, keyFor: (base: string) => string) => {
    const cloud = hourly[keyFor('cloud_cover')] as (number | null)[] | undefined;
    const precip = hourly[keyFor('precipitation')] as (number | null)[] | undefined;
    const precipProb = hourly[keyFor('precipitation_probability')] as
      | (number | null)[]
      | undefined;

    const points: HourPoint[] = times.map((t, i) => ({
      time: t * 1000,
      cloudCover: numOr(cloud?.[i], 100), // missing cloud data -> treat as overcast (pessimistic)
      precipMm: numOr(precip?.[i], 0),
      precipProbability: numOr(precipProb?.[i], 0),
    }));

    out[modelKey] = points;
  };

  if (suffixes.size > 0) {
    for (const sfx of suffixes) {
      buildFor(sfx, (base) => `${base}_${sfx}`);
    }
  } else if (hasBare) {
    const label = opts.requestedModels[0] ?? 'default';
    buildFor(label, (base) => base);
  }

  return out;
}

function numOr(v: number | null | undefined, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
