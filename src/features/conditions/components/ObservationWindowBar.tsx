import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import type { ClassifiedHour, ClearBlock } from '../../../core/sky';
import { formatClock, formatHourShort } from '../format.ts';
import { SectionHeader } from './SectionHeader.tsx';

/**
 * A horizontal strip across the night window — one cell per hour, coloured by
 * verdict (clear / cloud-bridged / precip). The longest usable block is ringed
 * so the eye lands on the actual shootable stretch, which is the whole point.
 */
export interface ObservationWindowBarProps {
  hours: ClassifiedHour[];
  longestBlock: ClearBlock | null;
}

export function ObservationWindowBar({
  hours,
  longestBlock,
}: ObservationWindowBarProps) {
  const theme = useTheme();
  if (hours.length === 0) return null;

  const clear = theme.palette.verdict?.clear;
  const cloud = theme.palette.verdict?.cloud;
  const precip = theme.palette.verdict?.precip;

  const colorFor = (h: ClassifiedHour) =>
    h.verdict === 'clear' ? clear : h.verdict === 'precip' ? precip : cloud;

  return (
    <Paper>
      <SectionHeader
        icon="mingcute:eye-2-line"
        title="Observation window"
        action={
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
            <LegendDot color={clear} label="Clear" />
            <LegendDot color={cloud} label="Cloud" />
            <LegendDot color={precip} label="Precip" />
          </Stack>
        }
      />
      <Stack direction="row" spacing={0.5} sx={{ height: 40 }}>
        {hours.map((h, i) => {
          const inBlock =
            longestBlock !== null &&
            i >= longestBlock.startIndex &&
            i <= longestBlock.endIndex;
          return (
            <Tooltip
              key={h.time}
              title={`${formatClock(h.time)} · ${h.cloudCover}% cloud · ${h.verdict}`}
              arrow
            >
              <Box
                sx={{
                  flex: 1,
                  borderRadius: 1,
                  bgcolor: colorFor(h),
                  // Bridged cloud hours sit inside a block but aren't clear —
                  // dim them so the block reads as "mostly clear, one soft gap".
                  opacity: h.verdict === 'cloud' && inBlock ? 0.5 : 1,
                  // Ring the longest usable block, and lift it with a soft glow so
                  // the shootable stretch is unmistakable.
                  outline: inBlock ? `2px solid ${theme.palette.common.white}` : 'none',
                  outlineOffset: -2,
                  boxShadow: inBlock ? `0 0 12px ${theme.palette.common.white}55` : 'none',
                  transition: 'opacity .15s',
                }}
              />
            </Tooltip>
          );
        })}
      </Stack>
      <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {formatClock(hours[0].time)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatClock(hours[hours.length - 1].time)}
        </Typography>
      </Stack>
    </Paper>
  );
}

function LegendDot({ color, label }: { color?: string; label: string }) {
  return (
    <Stack direction="row" spacing={0.625} sx={{ alignItems: 'center' }}>
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
}
