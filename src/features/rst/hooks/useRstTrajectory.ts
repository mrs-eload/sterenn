import { useEffect, useState } from 'react';
import { parseHorizonsCompletely } from '@app/features/rst/data/horizon-parser.ts';
import type { FullHorizonsPayload } from '@app/features/rst/data/horizon-parser.ts';

// RST's trajectory is a JPL Horizons vector table centred on Earth (the body it
// orbits), in the engine's native frame (ecliptic of J2000, km): its points are
// offsets from Earth — the L2 halo. The engine parents the craft under Earth from
// this, so we only need the one geocentric file.
const TRAJECTORY_URL = 'horizons/rst/RST_EPH_PRED_2026243_2026271_02_GEO.txt';

/**
 * Load and parse RST's trajectory file. Returns the parsed payload once ready, or
 * an error string. This is the single place that fetches the trajectory — the
 * component just renders the result — so the request lifecycle (abort on unmount)
 * lives here, not in a view.
 *
 * The fetch is aborted on cleanup so React StrictMode's double-invoked mount can't
 * leave an in-flight request behind, and the consumer sees one state transition to
 * the parsed payload.
 */
export function useRstTrajectory(): { trajectory: FullHorizonsPayload | null; error: string | null } {
  const [trajectory, setTrajectory] = useState<FullHorizonsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch(TRAJECTORY_URL, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch ${TRAJECTORY_URL}: ${response.statusText}`);
        }
        return response.text();
      })
      .then((rawText) => setTrajectory(parseHorizonsCompletely(rawText)))
      .catch((err: unknown) => {
        // The abort is expected on unmount/re-run, not a real failure.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const message = err instanceof Error ? err.message : String(err);
        console.error('Error loading RST trajectory:', err);
        setError(message);
      });

    return () => controller.abort();
  }, []);

  return { trajectory, error };
}
