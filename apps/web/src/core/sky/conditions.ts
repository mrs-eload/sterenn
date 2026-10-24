/**
 * summarizeConditions — fold the three things that make or break a night into one
 * go / not-ideal / no-go verdict, plus a per-factor breakdown the card can show.
 *
 * The precedence is the observer's own: cloud cover and precipitation are HARD
 * vetoes — if the sky won't stay clear (or it rains), nothing else matters. Only
 * once both are satisfied does seeing (atmospheric steadiness) decide between a
 * great night and a merely workable one:
 *
 *   - excellent / good seeing (Antoniadi I–II) → go
 *   - average seeing          (Antoniadi III)  → not ideal (caution)
 *   - poor / very-poor        (Antoniadi IV–V) → no-go
 *
 * A short or non-existent dusk-to-dawn window is also a hard veto — clouds aren't
 * the limiter there, the night itself is (the Brittany-summer case in STATUS.md),
 * so the three factors stay honest and the headline carries the reason.
 *
 * Pure: depends only on its arguments. The weather sub-verdict (clouds + window)
 * comes from describeNight; this layers precipitation and seeing on top into the
 * single headline verdict.
 */

import type { NightSummary } from './describeNight.ts';
import type { NightAnalysis } from './analyzeNight.ts';
import type { SeeingSummary } from './seeing.ts';
import { antoniadiFor } from './seeing.ts';

/** go = shoot, caution = workable but not ideal, no-go = don't bother. */
export type ConditionStatus = 'go' | 'caution' | 'no-go' | 'unknown';

export type ConditionKey = 'cloud' | 'precip' | 'seeing';

export interface ConditionFactor {
  key: ConditionKey;
  /** Human label for the row, e.g. "Cloud cover". */
  label: string;
  status: ConditionStatus;
  /** One short line explaining this factor's status. */
  detail: string;
}

export interface ConditionsSummary {
  /** Cloud, precipitation, seeing — always in that order. */
  factors: ConditionFactor[];
  /** The combined verdict: worst contributing factor, with window as a veto. */
  overall: ConditionStatus;
  /** Which factor set `overall` (null for a window veto or when nothing weighs in). */
  deciding: ConditionKey | null;
  /** Headline for the verdict, accounting for the deciding factor. */
  headline: string;
  /** One-line explanation that matches the headline. */
  detail: string;
}

// Severity order so "worst wins". unknown = 0 so it never weighs in.
const RANK: Record<ConditionStatus, number> = {
  unknown: 0,
  go: 1,
  caution: 2,
  'no-go': 3,
};
const STATUS_BY_RANK: Record<number, ConditionStatus> = {
  0: 'unknown',
  1: 'go',
  2: 'caution',
  3: 'no-go',
};

/**
 * Cloud cover. "Good" weather means a clear block long enough to integrate (the
 * describeNight verdict). On a too-short / no-night window the clouds aren't the
 * limiter, so we report the raw sky honestly and let the window veto the verdict.
 */
function cloudFactor(
  weather: NightSummary,
  analysis: NightAnalysis | null,
): ConditionFactor {
  const base = { key: 'cloud' as const, label: 'Cloud cover' };

  if (!analysis) {
    return { ...base, status: 'unknown', detail: 'No forecast for this night.' };
  }
  if (weather.good) {
    return {
      ...base,
      status: 'go',
      detail: `${weather.blockHours}h of clear sky — enough to shoot.`,
    };
  }
  if (weather.reason === 'too-cloudy') {
    return {
      ...base,
      status: 'no-go',
      detail: weather.blockHours
        ? `Only ${weather.blockHours}h clear, short of the ${weather.minBlockHours}h needed.`
        : 'No usable clear block tonight.',
    };
  }
  // too-short / no-night: the window is the problem, not the clouds.
  return analysis.longestBlock !== null
    ? { ...base, status: 'go', detail: 'Sky stays clear — the window is the limit.' }
    : { ...base, status: 'no-go', detail: 'No clear sky inside the window.' };
}

/** Precipitation — any forecast rain in the window is a hard stop for imaging. */
function precipFactor(analysis: NightAnalysis | null): ConditionFactor {
  const base = { key: 'precip' as const, label: 'Precipitation' };
  if (!analysis) {
    return { ...base, status: 'unknown', detail: 'No forecast for this night.' };
  }
  const precipHours = analysis.hours.filter((h) => h.verdict === 'precip').length;
  return precipHours > 0
    ? {
        ...base,
        status: 'no-go',
        detail: `Rain likely (${precipHours}h) — a hard stop for imaging.`,
      }
    : { ...base, status: 'go', detail: 'Dry through the window.' };
}

/**
 * Seeing on the Antoniadi scale (lower numeral = steadier air). I–II shoot, III
 * is workable but soft, IV–V boil the stars. unknown when the model returned no
 * jet-stream wind — then seeing simply doesn't weigh in.
 */
function seeingFactor(seeing: SeeingSummary | null): ConditionFactor {
  const base = { key: 'seeing' as const, label: 'Seeing' };
  const antoniadi = antoniadiFor(seeing?.band ?? 'unknown');
  if (!seeing || seeing.index === null || !antoniadi) {
    return {
      ...base,
      status: 'unknown',
      detail: 'No jet-stream data to estimate seeing.',
    };
  }
  const n = antoniadi.numeral;
  // index: 5 excellent, 4 good, 3 average, 2 poor, 1 very-poor.
  if (seeing.index >= 4) {
    return { ...base, status: 'go', detail: `Steady air (${n}) — sharp frames.` };
  }
  if (seeing.index === 3) {
    return {
      ...base,
      status: 'caution',
      detail: `Average seeing (${n}) — workable but soft.`,
    };
  }
  return {
    ...base,
    status: 'no-go',
    detail: `Turbulent air (${n}) — stars will boil.`,
  };
}

export function summarizeConditions(
  weather: NightSummary,
  analysis: NightAnalysis | null,
  seeing: SeeingSummary | null,
): ConditionsSummary {
  const cloud = cloudFactor(weather, analysis);
  const precip = precipFactor(analysis);
  const see = seeingFactor(seeing);
  const factors = [cloud, precip, see];

  // Worst contributing factor wins. Ties resolve precip → cloud → seeing:
  // precipitation outranks cloud so a rainy night reads as rain, not "too
  // cloudy" — rain almost always comes with heavy cloud, and without this
  // tie-break the (equally no-go) cloud factor would mask it. The loop keeps
  // the first highest rank, so iterate in that precedence order, not the
  // display order (which stays cloud → precip → seeing for the breakdown).
  let bestRank = 0;
  let deciding: ConditionKey | null = null;
  for (const f of [precip, cloud, see]) {
    if (RANK[f.status] > bestRank) {
      bestRank = RANK[f.status];
      deciding = f.key;
    }
  }
  let overall = STATUS_BY_RANK[bestRank];

  // The window itself can veto everything, independent of the three factors.
  const windowVeto =
    weather.reason === 'no-night' || weather.reason === 'too-short';
  if (windowVeto) {
    overall = 'no-go';
    deciding = null;
  }

  let headline: string;
  let detail: string;
  if (windowVeto) {
    headline = weather.headline;
    detail = weather.detail;
  } else if (overall === 'go') {
    headline = 'Good night to shoot';
    detail = weather.detail;
  } else if (deciding === 'seeing') {
    headline = see.status === 'caution' ? 'Good, but soft seeing' : 'Poor seeing';
    detail = see.detail;
  } else if (deciding === 'precip') {
    headline = 'Rain likely';
    detail = precip.detail;
  } else {
    // cloud-driven (or nothing weighs in) — defer to the weather verdict.
    headline = weather.headline;
    detail = weather.detail;
  }

  return { factors, overall, deciding, headline, detail };
}
