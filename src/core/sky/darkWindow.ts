import * as SunCalc from 'suncalc';
import type { DarkWindow } from './types.ts';

/**
 * Compute the astronomical dark window (sun below -18°) for the night that
 * *begins* on the evening of `date` at the given location.
 *
 * suncalc's getTimes returns, among others:
 *   - `night`     : dusk, sun reaches -18° going down  -> dark window START
 *   - `nightEnd`  : dawn, sun reaches -18° coming up   -> dark window END
 *
 * The catch: getTimes(date) keys all phases to that calendar date. The dark
 * window spans midnight, so the START comes from this evening's `night` and the
 * END comes from *tomorrow's* `nightEnd`. We fetch both and stitch them.
 *
 * Edge cases (high latitude / summer): astronomical night may not occur at all,
 * in which case suncalc returns Invalid Dates. We surface that as null rather
 * than pretending there's a window. Brittany in June flirts with this.
 */
export function getDarkWindow(
  date: Date,
  lat: number,
  lon: number,
): DarkWindow | null {
  const tonight = SunCalc.getTimes(date, lat, lon);

  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const next = SunCalc.getTimes(tomorrow, lat, lon);

  const start = tonight.night?.getTime();
  const end = next.nightEnd?.getTime();

  if (
    start === undefined ||
    end === undefined ||
    Number.isNaN(start) ||
    Number.isNaN(end) ||
    end <= start
  ) {
    return null; // no astronomical night (or degenerate) at this date/latitude
  }

  return { start, end };
}
