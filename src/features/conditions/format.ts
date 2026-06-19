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
});

/** "23:45" in local time from epoch ms. */
export function formatClock(ms: number): string {
  return hm.format(new Date(ms));
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
