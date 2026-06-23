import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchForecastCached,
  adaptForecast,
  WEATHER_MODELS,
  DEFAULT_MODEL_ID,
} from '../../../data/openMeteo';
import {
  getNightWindow,
  analyzeNight,
  analyzeSeeing,
  describeNight,
  summarizeConditions,
  type NightWindow,
  type NightAnalysis,
  type AnalyzeConfig,
  type SeeingSummary,
  type HourPoint,
  type ConditionStatus,
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

export interface ObservingLocation {
  id: string;
  label: string;
  lat: number;
  lon: number;
}

/**
 * There is intentionally no default location: the app fetches nothing until the
 * user picks one. Pass `lat`/`lon` (or leave them undefined) accordingly — the
 * hook reports status 'idle' while no location is set.
 */

/**
 * How many forecast days to fetch. The day switcher offers 7 selectable nights
 * (tonight + the next six); each night begins one evening and ends at the *next*
 * morning's dawn, so the seventh night reaches into an eighth calendar day. We
 * fetch 8 days so that last night's pre-dawn hours — the prime imaging window —
 * aren't truncated. The fetch is day-independent; switching days only re-slices
 * the already-fetched week, no new network call.
 */
export const FORECAST_DAYS = 8;

/** How many nights the day switcher lets you pick (tonight + the next six). */
export const SELECTABLE_DAYS = 7;

export interface UseTonightParams {
  lat?: number;
  lon?: number;
  /** The night that *begins* this evening. Defaults to now. */
  date?: Date;
  /** Open-Meteo model slugs to fetch. Defaults to the whole registry. */
  models?: string[];
  config?: Partial<AnalyzeConfig>;
}

/** 'idle' = no location selected yet, so nothing has been (or will be) fetched. */
export type TonightStatus = 'idle' | 'loading' | 'error' | 'ready';

export interface UseTonightResult {
  status: TonightStatus;
  error: string | null;
  /** null = no dusk-to-dawn window at this date/latitude (polar midsummer). */
  nightWindow: NightWindow | null;
  /** analyzeNight output per model slug. Empty until ready. */
  byModel: Record<string, NightAnalysis>;
  /** Jet-stream seeing estimate per model slug. Empty until ready. */
  seeingByModel: Record<string, SeeingSummary>;
  /** Models that actually came back, in registry order, for the picker. */
  availableModels: { id: string; label: string }[];
  activeModelId: string;
  setActiveModelId: (id: string) => void;
  /** Convenience: the active model's analysis, or null. */
  active: NightAnalysis | null;
  /** Convenience: the active model's seeing estimate, or null. */
  activeSeeing: SeeingSummary | null;
  /**
   * The active model's overall go/no-go verdict for an arbitrary night — used to
   * colour the day switcher without re-fetching. Runs the same pure pipeline as
   * the selected night, just against a different window. 'unknown' when there's
   * no astronomical night (polar midsummer) or no forecast yet.
   */
  statusForDate: (date: Date) => ConditionStatus;
  refetch: () => void;
}

const ALL_MODEL_IDS = WEATHER_MODELS.map((m) => m.id);

export function useTonight(params: UseTonightParams = {}): UseTonightResult {
  // No default: when either coordinate is missing there's no location, and the
  // hook stays idle (fetches nothing) until the caller supplies a pair.
  const { lat, lon } = params;
  const hasLocation = lat != null && lon != null;

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

  const [status, setStatus] = useState<TonightStatus>(
    hasLocation ? 'loading' : 'idle',
  );
  const [error, setError] = useState<string | null>(null);
  // The adapted forecast for the whole fetched week, per model slug. The fetch
  // depends only on location/models, NOT the selected day — so switching days
  // re-slices this in memory rather than hitting the network again.
  const [perModelHours, setPerModelHours] = useState<
    Record<string, HourPoint[]>
  >({});
  const [activeModelId, setActiveModelId] = useState<string>(DEFAULT_MODEL_ID);
  const [nonce, setNonce] = useState(0);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  // Fetch the whole week once per location/model-set. Note dateMs is NOT a
  // dependency: the selected night is applied later, when we slice + analyze.
  useEffect(() => {
    // No location → nothing to fetch. Drop any prior week and sit idle.
    if (lat == null || lon == null) {
      setPerModelHours({});
      setError(null);
      setStatus('idle');
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    // All state writes live inside this async function (a callback), not in the
    // effect body, which is the React-recommended shape: synchronise external
    // state — the network — and setState from within the async flow.
    (async () => {
      setStatus('loading');
      setError(null);

      try {
        const res = await fetchForecastCached(
          { lat, lon, models, forecastDays: FORECAST_DAYS },
          controller.signal,
        );
        const perModel = adaptForecast(res, { requestedModels: models });

        if (cancelled) return;
        setPerModelHours(perModel);
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
  }, [lat, lon, models, nonce]);

  // The selected night's window. Pure astronomy, recomputed when the day (or
  // location) changes — no refetch. null = no civil night (polar midsummer).
  const nightWindow = useMemo(
    () =>
      lat == null || lon == null
        ? null
        : getNightWindow(new Date(dateMs), lat, lon),
    [dateMs, lat, lon],
  );

  // Analyze the fetched week against the selected night. analyzeNight and
  // analyzeSeeing both window to [start, end] internally, so feeding them the
  // full week and the chosen window yields exactly that night's verdict.
  const { byModel, seeingByModel } = useMemo(() => {
    const analyses: Record<string, NightAnalysis> = {};
    const seeing: Record<string, SeeingSummary> = {};
    if (nightWindow) {
      for (const [modelId, hours] of Object.entries(perModelHours)) {
        analyses[modelId] = analyzeNight(hours, nightWindow, config);
        // Seeing is orthogonal to the cloud verdict (clear sky can still boil),
        // so it's computed alongside, not inside, analyzeNight.
        seeing[modelId] = analyzeSeeing(hours, nightWindow);
      }
    }
    return { byModel: analyses, seeingByModel: seeing };
  }, [perModelHours, nightWindow, config]);

  // Keep the active model valid: if it isn't among the returned models, fall
  // back to the default, then to the first available. Keyed on the fetched
  // week (perModelHours), not byModel, so the picker stays populated even on a
  // day that has no night window.
  const availableModels = useMemo(
    () =>
      WEATHER_MODELS.filter((m) => m.id in perModelHours).map((m) => ({
        id: m.id,
        label: m.label,
      })),
    [perModelHours],
  );

  const resolvedActiveId = useMemo(() => {
    if (activeModelId in byModel) return activeModelId;
    if (DEFAULT_MODEL_ID in byModel) return DEFAULT_MODEL_ID;
    return availableModels[0]?.id ?? activeModelId;
  }, [activeModelId, byModel, availableModels]);

  const active = byModel[resolvedActiveId] ?? null;
  const activeSeeing = seeingByModel[resolvedActiveId] ?? null;

  // Verdict for any night, on the active model's already-fetched week. Pure and
  // cheap, so the day switcher can colour every button by re-running it per day.
  const activeHours = perModelHours[resolvedActiveId];
  const statusForDate = useCallback(
    (date: Date): ConditionStatus => {
      if (lat == null || lon == null) return 'unknown';
      const window = getNightWindow(date, lat, lon);
      if (!window || !activeHours) return 'unknown';
      const analysis = analyzeNight(activeHours, window, config);
      const seeing = analyzeSeeing(activeHours, window);
      const summary = describeNight(analysis, window);
      return summarizeConditions(summary, analysis, seeing).overall;
    },
    [activeHours, lat, lon, config],
  );

  return {
    status,
    error,
    nightWindow,
    byModel,
    seeingByModel,
    availableModels,
    activeModelId: resolvedActiveId,
    setActiveModelId,
    active,
    activeSeeing,
    statusForDate,
    refetch,
  };
}
