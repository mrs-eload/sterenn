import { describe, it, expect, vi } from 'vitest';
import {
  fetchForecastCached,
  forecastCacheKey,
  DEFAULT_TTL_MS,
  type CacheStorage,
  type ForecastCacheDeps,
} from './cache.ts';
import type { FetchForecastParams, OpenMeteoResponse } from './client.ts';

/** An in-memory CacheStorage standing in for localStorage. */
function memStorage(): CacheStorage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

const params: FetchForecastParams = {
  lat: 47.2,
  lon: -3.26,
  models: ['best_match', 'icon_eu'],
  forecastDays: 2,
};

const res = (tag: number): OpenMeteoResponse => ({
  latitude: 47.2,
  longitude: -3.26,
  utc_offset_seconds: 0,
  timezone: 'GMT',
  hourly: { time: [tag] },
});

/** A fetcher that counts calls and returns a distinguishable response each time. */
function countingFetcher() {
  let calls = 0;
  const fetcher: NonNullable<ForecastCacheDeps['fetcher']> = async () => {
    calls += 1;
    return res(calls);
  };
  return { fetcher, calls: () => calls };
}

describe('forecastCacheKey', () => {
  it('is order-independent in models (same response, one entry)', () => {
    const a = forecastCacheKey({ ...params, models: ['best_match', 'icon_eu'] });
    const b = forecastCacheKey({ ...params, models: ['icon_eu', 'best_match'] });
    expect(a).toBe(b);
  });

  it('rounds coordinates to ~0.01° so near-identical points share an entry', () => {
    const a = forecastCacheKey({ ...params, lat: 47.2, lon: -3.26 });
    const b = forecastCacheKey({ ...params, lat: 47.201, lon: -3.264 });
    expect(a).toBe(b);
  });

  it('separates genuinely different locations and model sets', () => {
    expect(forecastCacheKey({ ...params, lat: 48.5 })).not.toBe(
      forecastCacheKey(params),
    );
    expect(forecastCacheKey({ ...params, models: ['ecmwf_ifs025'] })).not.toBe(
      forecastCacheKey(params),
    );
  });
});

describe('fetchForecastCached', () => {
  it('fetches once, then serves a fresh entry from cache', async () => {
    const storage = memStorage();
    const { fetcher, calls } = countingFetcher();
    let now = 1_000_000;

    const first = await fetchForecastCached(params, undefined, {
      storage,
      now: () => now,
      fetcher,
    });
    now += DEFAULT_TTL_MS - 1; // still inside the TTL
    const second = await fetchForecastCached(params, undefined, {
      storage,
      now: () => now,
      fetcher,
    });

    expect(calls()).toBe(1);
    expect(second).toEqual(first); // same cached payload
  });

  it('refetches once the entry is older than the TTL', async () => {
    const storage = memStorage();
    const { fetcher, calls } = countingFetcher();
    let now = 1_000_000;

    await fetchForecastCached(params, undefined, { storage, now: () => now, fetcher });
    now += DEFAULT_TTL_MS; // boundary: no longer "younger than ttl"
    await fetchForecastCached(params, undefined, { storage, now: () => now, fetcher });

    expect(calls()).toBe(2);
  });

  it('caches per key — different locations fetch independently', async () => {
    const storage = memStorage();
    const { fetcher, calls } = countingFetcher();
    const now = () => 1_000_000;

    await fetchForecastCached(params, undefined, { storage, now, fetcher });
    await fetchForecastCached({ ...params, lat: 48.5 }, undefined, {
      storage,
      now,
      fetcher,
    });

    expect(calls()).toBe(2);
  });

  it('falls back to the network when the stored entry is corrupt', async () => {
    const storage = memStorage();
    storage.setItem(forecastCacheKey(params), 'not json');
    const { fetcher, calls } = countingFetcher();

    const out = await fetchForecastCached(params, undefined, {
      storage,
      now: () => 1_000_000,
      fetcher,
    });

    expect(calls()).toBe(1);
    expect(out.hourly.time).toEqual([1]);
  });

  it('still returns the fetched response when storage writes throw (quota)', async () => {
    const throwing: CacheStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
      removeItem: () => {},
    };
    const { fetcher } = countingFetcher();

    await expect(
      fetchForecastCached(params, undefined, {
        storage: throwing,
        now: () => 1_000_000,
        fetcher,
      }),
    ).resolves.toMatchObject({ latitude: 47.2 });
  });

  it('passes the abort signal through to the fetcher', async () => {
    const storage = memStorage();
    const fetcher = vi.fn(async () => res(1));
    const controller = new AbortController();

    await fetchForecastCached(params, controller.signal, { storage, fetcher });

    expect(fetcher).toHaveBeenCalledWith(params, controller.signal);
  });
});
