import {
  fetchForecast,
  type FetchForecastParams,
  type OpenMeteoResponse,
} from './client.ts';

/**
 * A small TTL cache in front of fetchForecast.
 *
 * Open-Meteo gives us NO refresh signal: the JSON has no "next update" field and
 * the HTTP response carries no Cache-Control / Expires / Last-Modified headers
 * (verified live 2026-06-22). So we can't refetch exactly when a new model run
 * lands — we just cache for a fixed TTL. One hour is well inside every model's
 * update cadence (AROME hourly, ICON 3h, ECMWF/UKMO 6h) yet cuts calls hard:
 * a clear/cloudy verdict and the night window don't move within an hour. This
 * keeps us comfortably under the free tier's daily call limit.
 *
 * localStorage-backed so the cache survives reloads (the common case — opening
 * the app twice in an evening shouldn't cost two API calls). Falls back to an
 * in-memory Map when localStorage is unavailable (tests, private mode, SSR).
 *
 * Clock and storage are injectable so this is unit-testable with zero mocking,
 * the same as the rest of data/.
 */

/** One hour. See the cadence reasoning above. */
export const DEFAULT_TTL_MS = 60 * 60 * 1000;

const KEY_PREFIX = 'sterenn:openMeteo:';

interface CacheEntry {
  /** Epoch ms when this response was fetched. */
  storedAt: number;
  response: OpenMeteoResponse;
}

/** The slice of the Storage API we use — lets tests pass a plain object. */
export interface CacheStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ForecastCacheDeps {
  /** Defaults to localStorage, then an in-memory Map. */
  storage?: CacheStorage;
  /** Defaults to Date.now. */
  now?: () => number;
  /** Defaults to DEFAULT_TTL_MS. */
  ttlMs?: number;
  /** Defaults to the real network fetchForecast. Injected in tests. */
  fetcher?: (
    p: FetchForecastParams,
    signal?: AbortSignal,
  ) => Promise<OpenMeteoResponse>;
}

/**
 * Build a stable cache key from the params that change the response. Models are
 * sorted so ['a','b'] and ['b','a'] share one entry (the response is the same).
 * Coordinates are rounded to ~0.01° (~1km) so trivially different lat/lon — and
 * Open-Meteo snaps to its grid cell anyway — don't fragment the cache.
 */
export function forecastCacheKey(p: FetchForecastParams): string {
  const lat = p.lat.toFixed(2);
  const lon = p.lon.toFixed(2);
  const models = [...p.models].sort().join(',');
  const days = p.forecastDays ?? 2;
  return `${KEY_PREFIX}${lat},${lon}|${models}|${days}`;
}

/** localStorage if usable, else a process-lifetime Map. Resolved once. */
const memoryStore = new Map<string, string>();
function defaultStorage(): CacheStorage {
  try {
    if (typeof localStorage !== 'undefined') {
      // Probe: some environments expose localStorage but throw on access.
      const probe = '__sterenn_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return localStorage;
    }
  } catch {
    // fall through to in-memory
  }
  return {
    getItem: (k) => memoryStore.get(k) ?? null,
    setItem: (k, v) => void memoryStore.set(k, v),
    removeItem: (k) => void memoryStore.delete(k),
  };
}

/**
 * fetchForecast with a TTL cache. A fresh entry (younger than ttlMs) is returned
 * without a network call; otherwise we fetch, store, and return. Cache failures
 * (quota, corrupt JSON) never break the fetch — they just fall back to network.
 */
export async function fetchForecastCached(
  p: FetchForecastParams,
  signal?: AbortSignal,
  deps: ForecastCacheDeps = {},
): Promise<OpenMeteoResponse> {
  const storage = deps.storage ?? defaultStorage();
  const now = deps.now ?? Date.now;
  const ttlMs = deps.ttlMs ?? DEFAULT_TTL_MS;
  const fetcher = deps.fetcher ?? fetchForecast;
  const key = forecastCacheKey(p);

  const cached = readEntry(storage, key);
  if (cached && now() - cached.storedAt < ttlMs) {
    return cached.response;
  }

  const response = await fetcher(p, signal);
  writeEntry(storage, key, { storedAt: now(), response });
  return response;
}

function readEntry(storage: CacheStorage, key: string): CacheEntry | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (typeof parsed?.storedAt !== 'number' || !parsed.response) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeEntry(storage: CacheStorage, key: string, entry: CacheEntry): void {
  try {
    storage.setItem(key, JSON.stringify(entry));
  } catch {
    // Quota exceeded or storage unavailable — caching is best-effort.
  }
}
