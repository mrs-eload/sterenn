import { useCallback, useState } from 'react';
import type { ObservingLocation } from './hooks/useTonight.ts';

/**
 * Recently used observing locations, persisted in localStorage so a city the
 * user already resolved is one tap away and never needs geocoding again (cities
 * don't move). This is a feature-level persistence concern: it's not the network
 * (so not data/) and it's not pure astronomy (so not core/), so it lives with
 * the feature that owns the picker.
 *
 * The merge/parse logic is kept pure and unit-tested; the localStorage read and
 * write are a thin shell around it, guarded so they're harmless in non-browser
 * environments (the test runner is node).
 */

const STORAGE_KEY = 'sterenn:recentLocations';

/** How many recent locations to keep. Oldest fall off the end. */
export const MAX_RECENTS = 10;

/**
 * Pure: put `loc` at the front of `list`, drop any earlier entry with the same
 * id (re-picking a place bumps it to most-recent rather than duplicating it),
 * and cap the result at `max`. Most-recent-first.
 */
export function addRecent(
  list: ObservingLocation[],
  loc: ObservingLocation,
  max = MAX_RECENTS,
): ObservingLocation[] {
  const withoutDuplicate = list.filter((l) => l.id !== loc.id);
  return [loc, ...withoutDuplicate].slice(0, max);
}

/** Narrow an unknown value to a usable ObservingLocation (string id/label, finite coords). */
function isObservingLocation(v: unknown): v is ObservingLocation {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.label === 'string' &&
    typeof o.lat === 'number' &&
    Number.isFinite(o.lat) &&
    typeof o.lon === 'number' &&
    Number.isFinite(o.lon)
  );
}

/**
 * Pure: parse the stored JSON string into a clean ObservingLocation[]. Missing,
 * non-array, or malformed data yields [] rather than throwing — a corrupt store
 * must never break the picker. Records that don't validate are dropped.
 */
export function parseRecents(raw: string | null): ObservingLocation[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isObservingLocation);
  } catch {
    return [];
  }
}

/** Read the stored recents. Returns [] when storage is unavailable or empty. */
export function loadRecents(): ObservingLocation[] {
  if (typeof localStorage === 'undefined') return [];
  return parseRecents(localStorage.getItem(STORAGE_KEY));
}

/** Persist the recents list. A failed write (private mode, quota) is ignored. */
export function saveRecents(list: ObservingLocation[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Recents are a convenience, not essential state; if the browser refuses
    // the write we just keep the in-memory list and move on.
  }
}

/**
 * Holds the recents list in React state (seeded from localStorage at mount) and
 * returns a `remember` callback that prepends a location and persists the
 * result. Keeping state and storage in lockstep here means the chips re-render
 * the instant a location is picked, with no reload needed.
 */
export function useRecentLocations(): {
  recents: ObservingLocation[];
  remember: (loc: ObservingLocation) => void;
} {
  const [recents, setRecents] = useState<ObservingLocation[]>(loadRecents);

  const remember = useCallback((loc: ObservingLocation) => {
    setRecents((prev) => {
      const next = addRecent(prev, loc);
      saveRecents(next);
      return next;
    });
  }, []);

  return { recents, remember };
}
