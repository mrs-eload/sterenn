import * as SunCalc from 'suncalc';
import type { NightWindow } from './types.ts';

/**
 * Compute the night observing window (civil dusk → civil dawn, sun below -6°)
 * for the night that *begins* on the evening of `date` at the given location.
 *
 * suncalc's getTimes returns, among others:
 *   - `dusk` : evening civil twilight, sun reaches -6° going down -> window START
 *   - `dawn` : morning civil twilight, sun reaches -6° coming up  -> window END
 *
 * The catch: getTimes(date) keys all phases to that calendar date. The window
 * spans midnight, so the START comes from this evening's `dusk` and the END
 * comes from *tomorrow's* `dawn`. We fetch both and stitch them.
 *
 * Why civil (-6°) and not astronomical (-18°): at Brittany's latitude in summer
 * the sun never reaches -18°, so an astronomical window is null or a few minutes
 * — useless for planning. Civil dusk→dawn always exists outside the polar
 * regions and is wide enough for the observer to decide if a night is worth it.
 * See ADR 0003.
 *
 * Edge case (high latitude / midsummer): even civil twilight may not end — the
 * sun stays above -6° all "night" (e.g. Svalbard in June). suncalc returns
 * Invalid Dates; we surface that as null rather than inventing a window.
 */
export function getNightWindow(
  date: Date,
  lat: number,
  lon: number,
): NightWindow | null {
  const tonight = SunCalc.getTimes(date, lat, lon);

  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const next = SunCalc.getTimes(tomorrow, lat, lon);

  const start = tonight.dusk?.getTime();
  const end = next.dawn?.getTime();

  if (
    start === undefined ||
    end === undefined ||
    Number.isNaN(start) ||
    Number.isNaN(end) ||
    end <= start
  ) {
    return null; // no civil night (or degenerate) at this date/latitude
  }

  return { start, end };
}
