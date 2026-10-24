import * as SunCalc from 'suncalc';
import type { NightWindow } from './types.ts';

/**
 * Moon summary for a night — the second-biggest driver of a deep-sky night after
 * cloud. A bright moon above the horizon washes out faint targets even under a
 * perfectly clear sky, so the verdict card needs to say *how lit* the moon is and
 * *whether it's up* during the dark window.
 *
 * Pure, like the rest of core/: it takes the window + location and asks suncalc.
 * No `Date.now()`, no fetch — fully testable. Times are epoch ms, matching the
 * rest of the codebase.
 */
export interface MoonSummary {
  /** Illuminated fraction of the disc, 0–1 (0 = new, 1 = full). */
  illumination: number;
  /**
   * suncalc's cycle position, 0–1: 0 new → 0.25 first quarter → 0.5 full →
   * 0.75 last quarter. < 0.5 is waxing, > 0.5 waning — which a phase glyph needs
   * to know which limb to light.
   */
  phase: number;
  /** Human phase name, e.g. "Waxing gibbous". */
  phaseName: string;
  /** Moonrise inside the window (epoch ms), or null if it doesn't rise then. */
  rise: number | null;
  /** Moonset inside the window (epoch ms), or null if it doesn't set then. */
  set: number | null;
  /** True if the moon is above the horizon for any part of the window. */
  upDuringNight: boolean;
  /** Highest altitude (degrees) the moon reaches across the window. */
  peakAltitudeDeg: number;
}

/**
 * suncalc's `phase` runs 0→1: 0 new, 0.25 first quarter, 0.5 full, 0.75 last
 * quarter, wrapping back to new at 1. Buckets are centred on those landmarks,
 * each a 1/8 turn wide.
 */
export function moonPhaseName(phase: number): string {
  if (phase < 0.0625 || phase >= 0.9375) return 'New moon';
  if (phase < 0.1875) return 'Waxing crescent';
  if (phase < 0.3125) return 'First quarter';
  if (phase < 0.4375) return 'Waxing gibbous';
  if (phase < 0.5625) return 'Full moon';
  if (phase < 0.6875) return 'Waning gibbous';
  if (phase < 0.8125) return 'Last quarter';
  return 'Waning crescent';
}

/** rise/set are typed Date but suncalc omits them (undefined) on days the moon
 *  never crosses the horizon — guard before reading. */
function eventMs(d: Date | undefined): number | undefined {
  if (!d) return undefined;
  const t = d.getTime();
  return Number.isNaN(t) ? undefined : t;
}

export function describeMoon(
  window: NightWindow,
  lat: number,
  lon: number,
): MoonSummary {
  // Illumination barely moves across one night; sample it at the window midpoint
  // as the representative value.
  const mid = (window.start + window.end) / 2;
  const illum = SunCalc.getMoonIllumination(new Date(mid));

  // Walk the window to find the peak altitude (and hence whether it's ever up).
  // 24 samples ≈ one every few minutes for a typical night — plenty to catch a
  // rise/set crossing for the "is it up" question.
  //
  // NB: this suncalc build returns altitude (and angles) in DEGREES, not the
  // radians the upstream docs describe — verified against the installed package,
  // so we use the value as-is. Don't "fix" it with a 180/π conversion.
  const SAMPLES = 24;
  let peakAltitudeDeg = -90;
  for (let i = 0; i <= SAMPLES; i++) {
    const t = window.start + ((window.end - window.start) * i) / SAMPLES;
    const altDeg = SunCalc.getMoonPosition(new Date(t), lat, lon).altitude;
    if (altDeg > peakAltitudeDeg) peakAltitudeDeg = altDeg;
  }

  // The night spans midnight, so a rise/set can land on either calendar day.
  // Collect both days' events and keep the first of each that falls inside the
  // window — that's the moment the observer actually cares about.
  const nextDay = new Date(window.start);
  nextDay.setDate(nextDay.getDate() + 1);
  const days = [
    SunCalc.getMoonTimes(new Date(window.start), lat, lon),
    SunCalc.getMoonTimes(nextDay, lat, lon),
  ];

  let rise: number | null = null;
  let set: number | null = null;
  for (const d of days) {
    const r = eventMs(d.rise);
    const s = eventMs(d.set);
    if (r !== undefined && r >= window.start && r <= window.end) {
      rise = rise === null ? r : Math.min(rise, r);
    }
    if (s !== undefined && s >= window.start && s <= window.end) {
      set = set === null ? s : Math.min(set, s);
    }
  }

  return {
    illumination: illum.fraction,
    phase: illum.phase,
    phaseName: moonPhaseName(illum.phase),
    rise,
    set,
    upDuringNight: peakAltitudeDeg > 0,
    peakAltitudeDeg,
  };
}
