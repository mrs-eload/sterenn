/**
 * Maps a phase name from `moonPhaseName()` to its meteocons glyph. We use the
 * `-fill` variants: the lit portion is a blue gradient and the rest of the disc
 * is a dashed outline, so the icon reads as a phase at a glance.
 *
 * Keyed off the phase *name* (not the raw 0–1 number) so the bucket boundaries
 * live in exactly one place — `moonPhaseName()` in core/sky/moon.ts. The eight
 * keys here are its full output set; add nothing it can't return.
 *
 * NB: meteocons hard-code their house colours (no `currentColor`), so these
 * glyphs deliberately do not follow the card's tone theming.
 */
const ICON_BY_PHASE_NAME: Record<string, string> = {
  'New moon': 'meteocons:moon-new-fill',
  'Waxing crescent': 'meteocons:moon-waxing-crescent-fill',
  'First quarter': 'meteocons:moon-first-quarter-fill',
  'Waxing gibbous': 'meteocons:moon-waxing-gibbous-fill',
  'Full moon': 'meteocons:moon-full-fill',
  'Waning gibbous': 'meteocons:moon-waning-gibbous-fill',
  'Last quarter': 'meteocons:moon-last-quarter-fill',
  'Waning crescent': 'meteocons:moon-waning-crescent-fill',
};

/** meteocons icon name for a phase; falls back to the full moon if unknown. */
export function moonPhaseIcon(phaseName: string): string {
  return ICON_BY_PHASE_NAME[phaseName] ?? 'meteocons:moon-full-fill';
}
