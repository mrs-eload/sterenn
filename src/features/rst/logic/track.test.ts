import { describe, expect, it } from 'vitest';
import { isStale, STALE_AFTER_MS } from './track.ts';
import type { RstTelemetry } from '../types.ts';

const fixAt = (timestamp: number): RstTelemetry => ({ timestamp, raw: null });

describe('isStale', () => {
  it('is fresh when the fix is within the staleness budget', () => {
    const now = 1_000_000;
    expect(isStale(fixAt(now - STALE_AFTER_MS + 1), now)).toBe(false);
  });

  it('is stale once the fix is older than the budget', () => {
    const now = 1_000_000;
    expect(isStale(fixAt(now - STALE_AFTER_MS - 1), now)).toBe(true);
  });

  it('treats an unmapped fix (timestamp 0) as stale', () => {
    expect(isStale(fixAt(0), Date.now())).toBe(true);
  });
});
