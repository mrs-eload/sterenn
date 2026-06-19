/**
 * describeNight — turn a NightAnalysis into a human verdict + reason.
 *
 * Why this is in core/ and not a component: a night being `good: false` has more
 * than one cause, and the user must be able to tell them apart:
 *
 *   - "too cloudy"      — the window was long enough, the sky just wasn't clear
 *                         long enough.
 *   - "short window"    — the dusk→dawn window is itself shorter than the minimum
 *                         integration block, so even a flawless clear sky can't
 *                         make it a good night.
 *   - "no night"        — the sun never even reaches civil dusk (-6°); the polar
 *                         midsummer case. No window at all.
 *
 * That distinction is domain math, not presentation, so it lives here and is
 * unit-tested. The card component just renders what this returns.
 *
 * Pure: depends only on its arguments.
 */

import type { NightWindow } from './types.ts';
import type { NightAnalysis } from './analyzeNight.ts';

const MS_PER_HOUR = 3_600_000;

export type NightReason = 'good' | 'too-cloudy' | 'too-short' | 'no-night';

export interface NightSummary {
  good: boolean;
  reason: NightReason;
  /** Night-window (dusk→dawn) length in hours (0 when there's no window). */
  windowHours: number;
  /** Longest usable contiguous clear block in hours (0 when none). */
  blockHours: number;
  /** The minimum block length the verdict was judged against. */
  minBlockHours: number;
  /** Short headline for the card. */
  headline: string;
  /** One-line explanation of the reason. */
  detail: string;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function describeNight(
  analysis: NightAnalysis | null,
  nightWindow: NightWindow | null,
): NightSummary {
  // No window at all: the sun never reaches civil dusk (polar midsummer).
  if (nightWindow === null) {
    return {
      good: false,
      reason: 'no-night',
      windowHours: 0,
      blockHours: 0,
      minBlockHours: 0,
      headline: 'No night',
      detail:
        'The sun never drops below −6° tonight, so there is no dusk-to-dawn ' +
        'window. Only happens at high latitudes around midsummer.',
    };
  }

  const minBlockHours = analysis?.config.minBlockHours ?? 0;
  const windowHours = round1(
    (nightWindow.end - nightWindow.start) / MS_PER_HOUR,
  );
  const blockHours = analysis?.longestBlock?.lengthHours ?? 0;

  if (analysis?.good) {
    return {
      good: true,
      reason: 'good',
      windowHours,
      blockHours,
      minBlockHours,
      headline: 'Good night to shoot',
      detail: `${blockHours}h of contiguous clear sky inside a ${windowHours}h dusk-to-dawn window.`,
    };
  }

  // Not good. Is it because the window itself is too short to ever qualify?
  if (windowHours < minBlockHours) {
    return {
      good: false,
      reason: 'too-short',
      windowHours,
      blockHours,
      minBlockHours,
      headline: 'Window too short',
      detail: `Only ${windowHours}h from dusk to dawn — below the ${minBlockHours}h minimum integration block, even under a perfectly clear sky.`,
    };
  }

  // Window was long enough; the sky let us down.
  return {
    good: false,
    reason: 'too-cloudy',
    windowHours,
    blockHours,
    minBlockHours,
    headline: 'Too cloudy',
    detail: blockHours
      ? `Longest clear block is only ${blockHours}h, short of the ${minBlockHours}h needed.`
      : `No clear block of usable length inside the ${windowHours}h dusk-to-dawn window.`,
  };
}
