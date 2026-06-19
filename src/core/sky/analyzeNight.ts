/**
 * analyzeNight — find the longest *usable* clear block inside the night window.
 *
 * The point Ouranos misses: a night isn't "good" because one hour is clear.
 * Astrophotography needs a contiguous run of clear sky long enough to integrate.
 * So we measure run-length, not existence.
 *
 * Rules:
 *  - Only hours inside the night window count.
 *  - Clouds are tolerant: isolated bad-cloud hours can be bridged via a gap budget.
 *  - Precipitation is a HARD break: it severs the run regardless of remaining budget.
 *  - A night is "good" only if the longest usable block >= minBlockHours.
 *
 * Pure. No fetch, no dates-from-the-network. Feed it parsed data, unit-test it freely.
 */

import type { HourPoint, NightWindow } from './types.ts';
export type { HourPoint, NightWindow };

export interface AnalyzeConfig {
  /** Cloud cover at or below this is "clear". Default 20(%). */
  cloudThreshold: number;
  /**
   * How many isolated bad-CLOUD hours may be bridged inside one block.
   * 0 = strict (any bad hour breaks the run). Default 1.
   * Precip ignores this entirely.
   */
  cloudGapBudget: number;
  /** Minimum usable block length to call the night "good", in hours. Default 3. */
  minBlockHours: number;
  /** precipProbability at or above this counts as precip. Default 30(%). */
  precipProbThreshold: number;
  /** precipMm above this counts as precip. Default 0 (any forecast rain). */
  precipMmThreshold: number;
}

export const DEFAULT_CONFIG: AnalyzeConfig = {
  cloudThreshold: 20,
  cloudGapBudget: 1,
  minBlockHours: 3,
  precipProbThreshold: 30,
  precipMmThreshold: 0,
};

export type HourVerdict = 'clear' | 'cloud' | 'precip';

export interface ClassifiedHour {
  time: number;
  cloudCover: number;
  verdict: HourVerdict;
}

export interface ClearBlock {
  /** Index range into the classified-hours array, inclusive. */
  startIndex: number;
  endIndex: number;
  startTime: number;
  endTime: number;
  /** Number of hour-slots spanned (endIndex - startIndex + 1). */
  lengthHours: number;
  /** How many bridged (cloud-gap) hours sit inside this block. */
  bridgedHours: number;
}

export interface NightAnalysis {
  good: boolean;
  /** The longest usable block, or null if nothing qualifies. */
  longestBlock: ClearBlock | null;
  /** Every block found (already filtered to >= minBlockHours? no — all of them). */
  allBlocks: ClearBlock[];
  /** Per-hour breakdown, so the UI can show WHY. */
  hours: ClassifiedHour[];
  config: AnalyzeConfig;
}

function classifyHour(h: HourPoint, cfg: AnalyzeConfig): HourVerdict {
  const hasPrecip =
    (h.precipMm !== undefined && h.precipMm > cfg.precipMmThreshold) ||
    (h.precipProbability !== undefined &&
      h.precipProbability >= cfg.precipProbThreshold);
  if (hasPrecip) return 'precip';
  return h.cloudCover <= cfg.cloudThreshold ? 'clear' : 'cloud';
}

/**
 * Walk the classified hours and grow blocks.
 * - 'clear' extends the current block.
 * - 'cloud' consumes gap budget; if budget remains, the block survives and bridges it.
 *   If budget is exhausted, the block ends just before this cloud hour.
 * - 'precip' ends the block immediately, no bridging.
 *
 * Trailing bridged hours are trimmed: a block shouldn't end on a bridged cloud hour,
 * because that hour isn't actually usable — the block ends at its last clear hour.
 */
function findBlocks(hours: ClassifiedHour[], cfg: AnalyzeConfig): ClearBlock[] {
  const blocks: ClearBlock[] = [];

  let start = -1;
  let lastClear = -1;
  let budget = cfg.cloudGapBudget;

  const flush = () => {
    if (start === -1 || lastClear === -1) return;
    // Count bridged hours that actually fall inside [start, lastClear].
    let bridgedInside = 0;
    for (let k = start; k <= lastClear; k++) {
      if (hours[k].verdict === 'cloud') bridgedInside++;
    }
    blocks.push({
      startIndex: start,
      endIndex: lastClear,
      startTime: hours[start].time,
      endTime: hours[lastClear].time,
      lengthHours: lastClear - start + 1,
      bridgedHours: bridgedInside,
    });
  };

  const reset = () => {
    start = -1;
    lastClear = -1;
    budget = cfg.cloudGapBudget;
  };

  for (let i = 0; i < hours.length; i++) {
    const v = hours[i].verdict;

    if (v === 'precip') {
      flush();
      reset();
      continue;
    }

    if (v === 'clear') {
      if (start === -1) start = i;
      lastClear = i;
      continue;
    }

    // v === 'cloud'
    if (start === -1) {
      // Cloud before any clear hour — nothing open, ignore.
      continue;
    }
    if (budget > 0) {
      budget--;
      // stays open, but lastClear does NOT advance — trailing trim is automatic
      continue;
    }
    // Budget gone — close the block at the last clear hour.
    flush();
    reset();
  }
  flush();

  return blocks;
}

export function analyzeNight(
  hourly: HourPoint[],
  night: NightWindow,
  config: Partial<AnalyzeConfig> = {},
): NightAnalysis {
  const cfg: AnalyzeConfig = { ...DEFAULT_CONFIG, ...config };

  // Keep only hours strictly inside the night window, sorted by time.
  const windowHours = hourly
    .filter((h) => h.time >= night.start && h.time <= night.end)
    .sort((a, b) => a.time - b.time);

  const hours: ClassifiedHour[] = windowHours.map((h) => ({
    time: h.time,
    cloudCover: h.cloudCover,
    verdict: classifyHour(h, cfg),
  }));

  const allBlocks = findBlocks(hours, cfg);

  let longestBlock: ClearBlock | null = null;
  for (const b of allBlocks) {
    if (!longestBlock || b.lengthHours > longestBlock.lengthHours) {
      longestBlock = b;
    }
  }

  const good =
    longestBlock !== null && longestBlock.lengthHours >= cfg.minBlockHours;

  return { good, longestBlock, allBlocks, hours, config: cfg };
}
