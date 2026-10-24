/**
 * Which observing night is "tonight" right now.
 *
 * An observing night is named by the evening it begins on, but it runs past
 * midnight into the next morning. So in the small hours we are still *inside*
 * the night that began yesterday evening — the app should keep showing it until
 * it's over, not jump to the coming night the instant the clock passes midnight.
 *
 * We split at local noon (the classic "astronomical day starts at noon"
 * convention): before noon, the current night is the one that began *yesterday*
 * evening; from noon onward, it's the one that begins this evening. Noon sits
 * safely clear of both midnight and any real dusk/dawn, so it never cuts a night
 * in half. Between dawn and noon this still points at the just-finished night
 * rather than the coming one — deliberately, so a pre-dawn glance and a
 * mid-morning glance agree, and the coming night is only ever one tap away.
 *
 * Returns a Date pinned to noon of that evening's calendar day: a stable anchor
 * (clear of midnight/DST edges) that the night list and getNightWindow build on.
 */
export function currentObservingNightDate(now: Date): Date {
  const base = new Date(now);
  base.setHours(12, 0, 0, 0);
  if (now.getHours() < 12) {
    base.setDate(base.getDate() - 1);
  }
  return base;
}
