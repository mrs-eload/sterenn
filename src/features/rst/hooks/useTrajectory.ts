import { useEffect, useState } from 'react';
import { parseHorizonsCompletely } from '@app/features/rst/data/horizon-parser.ts';
import type { FullHorizonsPayload } from '@app/features/rst/data/horizon-parser.ts';

/**
 * Load and parse one JPL Horizons trajectory file (RST, JWST, …). Returns the
 * parsed payload once ready, or an error string. This is the single place that
 * fetches a trajectory — the component just renders the result — so the request
 * lifecycle (abort on unmount) lives here, not in a view.
 *
 * The files are geocentric Horizons vector tables (ecliptic of J2000, km): their
 * points are offsets from Earth — an L2 halo. The engine parents the craft under
 * Earth from this, so the one geocentric file per craft is all that's needed.
 *
 * The fetch is aborted on cleanup so React StrictMode's double-invoked mount can't
 * leave an in-flight request behind, and the consumer sees one state transition to
 * the parsed payload. Pass a stable `url` — changing it reloads.
 */
export function useTrajectory(url: string): {
  trajectory: FullHorizonsPayload | null;
  error: string | null;
} {
  const [trajectory, setTrajectory] = useState<FullHorizonsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    // A new URL starts a fresh load, so clear any prior result/error.
    setTrajectory(null);
    setError(null);

    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        }
        return response.text();
      })
      .then((rawText) => setTrajectory(parseHorizonsCompletely(rawText)))
      .catch((err: unknown) => {
        // The abort is expected on unmount/re-run, not a real failure.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error loading trajectory ${url}:`, err);
        setError(message);
      });

    return () => controller.abort();
  }, [url]);

  return { trajectory, error };
}
