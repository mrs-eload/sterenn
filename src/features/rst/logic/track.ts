import type { RstTelemetry } from '../types.ts';

// LOGIC seam — pure functions over our own domain type. No React, no fetch, no
// baked-in clock (callers pass `now`), so this is unit-testable with zero
// mocking, exactly like core/ is in the main app. Lives inside the feature (not
// core/) to keep the subject deletable as one folder.

/** How old a fix may be before we treat it as stale, in milliseconds. */
export const STALE_AFTER_MS = 5 * 60_000;

/**
 * Whether a fix is too old to trust, relative to a caller-supplied `now`.
 * A fix that hasn't been mapped yet (timestamp 0) reads as stale.
 */
export function isStale(state: RstTelemetry, now: number): boolean {
  return now - state.timestamp > STALE_AFTER_MS;
}
