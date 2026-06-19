import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchForecast,
  adaptForecast,
  WEATHER_MODELS,
  DEFAULT_MODEL_ID,
} from '../../../data/openMeteo';
import {
  getNightWindow,
  analyzeNight,
  type NightWindow,
  type NightAnalysis,
  type AnalyzeConfig,
} from '../../../core/sky';

/**
 * useTonight — the only place the conditions pipeline is wired together.
 *
 *   getNightWindow (core)  ──┐
 *   fetchForecast  (data)  ──┼─→ adaptForecast (data) ─→ analyzeNight (core)
 *                            ┘                            (once per model)
 *
 * Everything computational already lives in core/ and data/ and is unit-tested;
 * this hook only orchestrates and holds React state. Components below it render
 * what it returns and compute nothing.
 *
 * Note the two distinct "empty" outcomes the UI must tell apart (see STATUS.md):
 *   - nightWindow === null  → no dusk-to-dawn window at all (polar midsummer).
 *   - nightWindow present but every model's analysis is good:false → too cloudy,
 *     OR the window is shorter than minBlockHours (a clear-but-too-short night).
 */

/** Default observing location — Brittany. Override via params when a picker exists. */
export const DEFAULT_LOCATION = { lat: 47.2, lon: -3.26, label: 'Brittany' };

export interface UseTonightParams {
  lat?: number;
  lon?: number;
  /** The night that *begins* this evening. Defaults to now. */
  date?: Date;
  /** Open-Meteo model slugs to fetch. Defaults to the whole registry. */
  models?: string[];
  config?: Partial<AnalyzeConfig>;
}

export type TonightStatus = 'loading' | 'error' | 'ready';

export interface UseTonightResult {
  status: TonightStatus;
  error: string | null;
  /** null = no dusk-to-dawn window at this date/latitude (polar midsummer). */
  nightWindow: NightWindow | null;
  /** analyzeNight output per model slug. Empty until ready. */
  byModel: Record<string, NightAnalysis>;
  /** Models that actually came back, in registry order, for the picker. */
  availableModels: { id: string; label: string }[];
  activeModelId: string;
  setActiveModelId: (id: string) => void;
  /** Convenience: the active model's analysis, or null. */
  active: NightAnalysis | null;
  refetch: () => void;
}

const ALL_MODEL_IDS = WEATHER_MODELS.map((m) => m.id);

export function useTonight(params: UseTonightParams = {}): UseTonightResult {
  const lat = params.lat ?? DEFAULT_LOCATION.lat;
  const lon = params.lon ?? DEFAULT_LOCATION.lon;

  // Freeze "now" once at mount when the caller doesn't pin a date. Computing
  // `new Date()` inline on every render would give a new dateMs each render,
  // and since dateMs is an effect dependency that re-fires the fetch — an
  // infinite request loop. If the caller passes a date, track it (they own
  // its stability).
  const [defaultNow] = useState(() => Date.now());
  const dateMs = params.date?.getTime() ?? defaultNow;

  const models = useMemo(
    () => params.models ?? ALL_MODEL_IDS,
    [params.models],
  );

  // Stabilise config by value, not reference: an inline `{ ... }` from a caller
  // is a fresh object every render and would loop the fetch effect the same way
  // an inline date would. Keying on its JSON makes a same-valued config a no-op.
  const configKey = JSON.stringify(params.config ?? null);
  const config = useMemo<Partial<AnalyzeConfig> | undefined>(
    () =>
      configKey === 'null'
        ? undefined
        : (JSON.parse(configKey) as Partial<AnalyzeConfig>),
    [configKey],
  );

  const [status, setStatus] = useState<TonightStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [nightWindow, setNightWindow] = useState<NightWindow | null>(null);
  const [byModel, setByModel] = useState<Record<string, NightAnalysis>>({});
  const [activeModelId, setActiveModelId] = useState<string>(DEFAULT_MODEL_ID);
  const [nonce, setNonce] = useState(0);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    // All state writes live inside this async function (a callback), not in the
    // effect body, which is the React-recommended shape: synchronise external
    // state — the network — and setState from within the async flow.
    (async () => {
      setStatus('loading');
      setError(null);

      const night = getNightWindow(new Date(dateMs), lat, lon);

      // No dusk-to-dawn window — nothing to fetch or analyze. A valid outcome,
      // not an error (polar midsummer). Surface it as ready + null window.
      if (night === null) {
        if (cancelled) return;
        setNightWindow(null);
        setByModel({});
        setStatus('ready');
        return;
      }

      try {
        const res = await fetchForecast(
          { lat, lon, models, forecastDays: 2 },
          controller.signal,
        );
        const perModel = adaptForecast(res, { requestedModels: models });

        const analyses: Record<string, NightAnalysis> = {};
        for (const [modelId, hours] of Object.entries(perModel)) {
          analyses[modelId] = analyzeNight(hours, night, config);
        }

        if (cancelled) return;
        setNightWindow(night);
        setByModel(analyses);
        setStatus('ready');
      } catch (err) {
        if (cancelled || controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [lat, lon, dateMs, models, config, nonce]);

  // Keep the active model valid: if it isn't among the returned models, fall
  // back to the default, then to the first available.
  const availableModels = useMemo(
    () =>
      WEATHER_MODELS.filter((m) => m.id in byModel).map((m) => ({
        id: m.id,
        label: m.label,
      })),
    [byModel],
  );

  const resolvedActiveId = useMemo(() => {
    if (activeModelId in byModel) return activeModelId;
    if (DEFAULT_MODEL_ID in byModel) return DEFAULT_MODEL_ID;
    return availableModels[0]?.id ?? activeModelId;
  }, [activeModelId, byModel, availableModels]);

  const active = byModel[resolvedActiveId] ?? null;

  return {
    status,
    error,
    nightWindow,
    byModel,
    availableModels,
    activeModelId: resolvedActiveId,
    setActiveModelId,
    active,
    refetch,
  };
}
