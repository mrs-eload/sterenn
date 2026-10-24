/**
 * Feature-local formatting helpers. Kept here (not in a shared lib/) because no
 * second feature needs them yet — promote on second use, per CLAUDE.md.
 *
 * Times are epoch ms (the app-internal unit). We render in the viewer's local
 * timezone, which is the right call for a "tonight, where I am" tool.
 */

const hm = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  // Force 24-hour clock regardless of locale — never inherit AM/PM.
  hourCycle: 'h23',
});

/** "23:45" in local time from epoch ms. */
export function formatClock(ms: number): string {
  return hm.format(new Date(ms));
}

/**
 * "23h", "01h" — zero-padded 24-hour hour-of-day in local time. Compact enough
 * for axis ticks, and explicitly 24h so we never inherit a locale's AM/PM.
 */
export function formatHourShort(ms: number): string {
  return `${String(new Date(ms).getHours()).padStart(2, '0')}h`;
}

/** "21:30 → 04:15" from a start/end pair of epoch ms. */
export function formatRange(startMs: number, endMs: number): string {
  return `${formatClock(startMs)} → ${formatClock(endMs)}`;
}

/** "3h", "3.5h" — hours with at most one decimal, trailing .0 trimmed. */
export function formatHours(hours: number): string {
  const r = Math.round(hours * 10) / 10;
  return `${Number.isInteger(r) ? r : r.toFixed(1)}h`;
}
