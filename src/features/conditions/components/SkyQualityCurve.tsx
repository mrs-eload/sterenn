import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import type { ClassifiedHour } from '../../../core/sky';

/**
 * A lightweight clear-sky curve over the night window. Plotted as a hand-rolled
 * SVG rather than pulling in a charting library — it's one polyline, the app has
 * no other chart yet, and ADR/CLAUDE both push against premature dependencies.
 *
 * Y axis is *clear sky* (100 − cloud cover): higher = better, so a good night
 * reads as a tall green plateau. Precip hours are marked underneath in red,
 * since they hard-break a block regardless of how clear the surrounding hours are.
 */
export interface SkyQualityCurveProps {
  hours: ClassifiedHour[];
  height?: number;
}

export function SkyQualityCurve({ hours, height = 96 }: SkyQualityCurveProps) {
  const theme = useTheme();
  if (hours.length < 2) return null;

  const n = hours.length;
  const x = (i: number) => (i / (n - 1)) * 100;
  // Clear sky % = 100 − cloud. SVG y grows downward, so y = cloudCover puts
  // clear (low cloud) near the top.
  const y = (h: ClassifiedHour) => h.cloudCover;

  const linePoints = hours.map((h, i) => `${x(i)},${y(h)}`).join(' ');
  // Area between the curve and the top edge = the clear-sky region.
  const areaPath = `M 0,${y(hours[0])} L ${linePoints
    .split(' ')
    .join(' L ')} L 100,0 L 0,0 Z`;

  return (
    <Box>
      <Typography variant="overline" color="text.secondary">
        Clear-sky curve
      </Typography>
      <Box sx={{ position: 'relative' }}>
        <svg
          width="100%"
          height={height}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ display: 'block' }}
        >
          <path d={areaPath} fill={theme.palette.verdict.clear} opacity={0.18} />
          <polyline
            points={linePoints}
            fill="none"
            stroke={theme.palette.verdict.clear}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
          {/* Precip ticks along the baseline. */}
          {hours.map((h, i) =>
            h.verdict === 'precip' ? (
              <rect
                key={h.time}
                x={x(i) - 0.6}
                y={94}
                width={1.2}
                height={6}
                fill={theme.palette.verdict.precip}
              />
            ) : null,
          )}
        </svg>
      </Box>
    </Box>
  );
}
