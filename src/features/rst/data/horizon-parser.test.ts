import { describe, it, expect } from 'vitest';
import { parseTimestamp } from './horizon-parser.ts';

describe('parseTimestamp', () => {
  // The exact shape Horizons emits for "Start time" and each trajectory point.
  it('parses the "A.D. YYYY-Mon-DD HH:MM:SS.ffff TDB" format into a valid ISO date', () => {
    const iso = parseTimestamp('A.D. 2026-Aug-30 11:59:09.1830 TDB');
    expect(iso).toBe('2026-08-30T11:59:09.183Z');
    // The whole point: the result must be parseable, unlike the raw string.
    expect(Number.isNaN(new Date(iso).getTime())).toBe(false);
  });

  it('the raw Horizons string is NOT parseable by Date (the bug this guards)', () => {
    expect(Number.isNaN(new Date('A.D. 2026-Aug-30 11:59:09.1830 TDB').getTime())).toBe(true);
  });

  it('pads a short fractional second to milliseconds', () => {
    expect(parseTimestamp('2026-Sep-27 11:59:09.18 TDB')).toBe('2026-09-27T11:59:09.180Z');
  });

  it('truncates extra fractional digits to milliseconds', () => {
    expect(parseTimestamp('2026-Sep-27 11:59:09.123456 TDB')).toBe('2026-09-27T11:59:09.123Z');
  });

  it('handles a timestamp with no fractional second', () => {
    expect(parseTimestamp('2026-Dec-01 00:00:00 TDB')).toBe('2026-12-01T00:00:00Z');
  });

  it('resolves each month abbreviation', () => {
    expect(parseTimestamp('2026-Jan-15 00:00:00')).toBe('2026-01-15T00:00:00Z');
    expect(parseTimestamp('2026-Dec-15 00:00:00')).toBe('2026-12-15T00:00:00Z');
  });
});
