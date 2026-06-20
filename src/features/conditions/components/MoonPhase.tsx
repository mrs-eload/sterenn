import Box from '@mui/material/Box';

/**
 * A small moon-phase disc. The lit region is bounded by the disc's limb on the
 * sunward side and the *terminator* — a half-ellipse whose horizontal radius
 * shrinks to zero at the quarters (straight line) and grows to a full semicircle
 * at new/full. We draw the waxing case (lit on the right) and mirror it for
 * waning, which is the only thing `phase` is needed for here.
 *
 * Pure presentation: it takes numbers, not a suncalc handle.
 */
export interface MoonPhaseProps {
  /** suncalc cycle position 0–1; > 0.5 = waning (mirror to light the left limb). */
  phase: number;
  /** Illuminated fraction 0–1. */
  illumination: number;
  size?: number;
  litColor?: string;
  darkColor?: string;
  ringColor?: string;
}

// Internal unit radius; the SVG scales to `size` via the viewBox.
const R = 50;

/** Closed path for the lit region, lit on the right (waxing). */
function litPath(fraction: number): string {
  const f = Math.max(0, Math.min(1, fraction));
  // Terminator half-width: full semicircle at new/full, flat at the quarters.
  const rx = R * Math.abs(1 - 2 * f);
  // Crescent (<0.5): terminator bulges toward the lit (right) limb, so the two
  // arcs enclose only a thin sliver — at f=0 they coincide and lit area is 0.
  // Gibbous (>0.5): it bulges the other way, enclosing most of the disc — at
  // f=1 the terminator is the left limb and the whole disc is lit. Sweep flips
  // at the quarter to switch the bulge direction.
  const sweep = f < 0.5 ? 0 : 1;
  return `M 0 ${-R} A ${R} ${R} 0 0 1 0 ${R} A ${rx} ${R} 0 0 ${sweep} 0 ${-R} Z`;
}

export function MoonPhase({
  phase,
  illumination,
  size = 46,
  litColor = '#E7ECF3',
  darkColor = '#11162B',
  ringColor = 'rgba(231,236,243,0.28)',
}: MoonPhaseProps) {
  const waning = phase > 0.5;
  return (
    <Box
      component="svg"
      role="img"
      aria-label="Moon phase"
      width={size}
      height={size}
      viewBox={`${-R} ${-R} ${2 * R} ${2 * R}`}
      sx={{ display: 'block', flexShrink: 0 }}
    >
      {/* Dark disc, then the lit cap on top, then a ring so even a new moon
          still reads as a circle. */}
      <circle cx={0} cy={0} r={R} fill={darkColor} />
      <path
        d={litPath(illumination)}
        fill={litColor}
        transform={waning ? 'scale(-1,1)' : undefined}
      />
      <circle cx={0} cy={0} r={R} fill="none" stroke={ringColor} strokeWidth={2} />
    </Box>
  );
}
