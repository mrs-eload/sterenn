import { describe, it, expect } from 'vitest';
import { analyzeNight } from './analyzeNight.ts';
import { analyzeSeeing } from './seeing.ts';
import { describeNight } from './describeNight.ts';
import { summarizeConditions } from './conditions.ts';
import type { HourPoint, NightWindow } from './types.ts';

const H = 3_600_000;
const base = Date.parse('2026-06-19T22:00:00Z');
// A long-enough window: 9 hourly slots, well over the 3h minimum block.
const night: NightWindow = { start: base, end: base + 8 * H };

// Build a night from per-hour cloud %, optional precip prob, optional jet wind.
const mk = (
  clouds: number[],
  opts: { precipAt?: number[]; jet?: number } = {},
): HourPoint[] =>
  clouds.map((c, i) => ({
    time: base + i * H,
    cloud: { total: c, low: c, mid: c, high: c },
    precipProbability: opts.precipAt?.includes(i) ? 80 : 0,
    jetWindMs: opts.jet,
  }));

const summarize = (hours: HourPoint[]) => {
  const analysis = analyzeNight(hours, night);
  const seeing = analyzeSeeing(hours, night);
  const weather = describeNight(analysis, night);
  return summarizeConditions(weather, analysis, seeing);
};

const factor = (c: ReturnType<typeof summarize>, key: string) =>
  c.factors.find((f) => f.key === key)!;

describe('summarizeConditions', () => {
  it('is GO when sky is clear and seeing is good (jet calm)', () => {
    // All clear, calm jet (8 m/s → excellent/good, Antoniadi I–II).
    const c = summarize(mk([0, 0, 0, 0, 0, 0, 0, 0, 0], { jet: 8 }));
    expect(c.overall).toBe('go');
    expect(factor(c, 'cloud').status).toBe('go');
    expect(factor(c, 'precip').status).toBe('go');
    expect(factor(c, 'seeing').status).toBe('go');
    expect(c.headline).toBe('Good night to shoot');
  });

  it('demotes a clear night to "not ideal" on average (III) seeing', () => {
    // 25 m/s → average (index 3, Antoniadi III).
    const c = summarize(mk([0, 0, 0, 0, 0, 0, 0, 0, 0], { jet: 25 }));
    expect(c.overall).toBe('caution');
    expect(c.deciding).toBe('seeing');
    expect(factor(c, 'seeing').status).toBe('caution');
    expect(c.headline).toBe('Good, but soft seeing');
  });

  it('makes a clear night NO-GO on poor/very-poor (IV–V) seeing', () => {
    // 60 m/s → very-poor (index 1, Antoniadi V).
    const c = summarize(mk([0, 0, 0, 0, 0, 0, 0, 0, 0], { jet: 60 }));
    expect(c.overall).toBe('no-go');
    expect(c.deciding).toBe('seeing');
    expect(factor(c, 'seeing').status).toBe('no-go');
    expect(c.headline).toBe('Poor seeing');
  });

  it('treats precipitation as a hard veto, regardless of calm seeing', () => {
    // Clear and calm jet, but rain partway through severs the night.
    const c = summarize(
      mk([0, 0, 0, 0, 0, 0, 0, 0, 0], { jet: 8, precipAt: [4] }),
    );
    expect(c.overall).toBe('no-go');
    expect(c.deciding).toBe('precip');
    expect(factor(c, 'precip').status).toBe('no-go');
    expect(c.headline).toBe('Rain likely');
  });

  it('lets precip outrank cloud when the night is both rainy and overcast', () => {
    // Overcast all night AND rain partway through: both factors are no-go, but
    // precipitation must win the tie so the verdict reads as rain, not cloud.
    const c = summarize(
      mk([90, 90, 90, 90, 90, 90, 90, 90, 90], { jet: 8, precipAt: [3, 4] }),
    );
    expect(c.overall).toBe('no-go');
    expect(c.deciding).toBe('precip');
    expect(factor(c, 'cloud').status).toBe('no-go');
    expect(factor(c, 'precip').status).toBe('no-go');
    expect(c.headline).toBe('Rain likely');
  });

  it('is NO-GO and cloud-decided when the sky never clears', () => {
    const c = summarize(mk([90, 90, 90, 90, 90, 90, 90, 90, 90], { jet: 8 }));
    expect(c.overall).toBe('no-go');
    expect(c.deciding).toBe('cloud');
    expect(factor(c, 'cloud').status).toBe('no-go');
  });

  it('lets the short-window veto win while reporting the sky honestly', () => {
    // ~1h window, flawless clear sky, calm jet: cloud + seeing read fine, but
    // the window itself is below the 3h minimum, so the verdict is NO-GO.
    const shortNight: NightWindow = { start: base, end: base + 1 * H };
    const hours = mk([0, 0], { jet: 8 });
    const analysis = analyzeNight(hours, shortNight);
    const seeing = analyzeSeeing(hours, shortNight);
    const weather = describeNight(analysis, shortNight);
    const c = summarizeConditions(weather, analysis, seeing);
    expect(c.overall).toBe('no-go');
    expect(c.deciding).toBeNull();
    expect(c.factors.find((f) => f.key === 'cloud')!.status).toBe('go');
    expect(c.headline).toBe('Window too short');
  });

  it('ignores seeing entirely when no jet data is available', () => {
    // Clear sky, no jet wind → seeing unknown and must not block a GO.
    const c = summarize(mk([0, 0, 0, 0, 0, 0, 0, 0, 0]));
    expect(factor(c, 'seeing').status).toBe('unknown');
    expect(c.overall).toBe('go');
  });

  it('reports all factors unknown when there is no analysis', () => {
    const weather = describeNight(null, null);
    const c = summarizeConditions(weather, null, null);
    expect(c.overall).toBe('no-go'); // no-night is a window veto
    expect(c.factors.every((f) => f.status === 'unknown')).toBe(true);
  });
});
