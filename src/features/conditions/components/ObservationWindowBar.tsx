import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import type { ClassifiedHour, ClearBlock } from '../../../core/sky';
import { formatClock } from '../format.ts';

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

  const colorFor = (h: ClassifiedHour) =>
    h.verdict === 'clear'
      ? theme.palette.verdict.clear
      : h.verdict === 'precip'
        ? theme.palette.verdict.precip
        : theme.palette.verdict.cloud;

  return (
    <Box>
      <Typography variant="overline" color="text.secondary">
        Observation window
      </Typography>
      <Stack direction="row" spacing={0.5} sx={{ height: 36 }}>
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
                  opacity: h.verdict === 'cloud' && inBlock ? 0.55 : 1,
                  outline: inBlock
                    ? `2px solid ${theme.palette.common.white}`
                    : 'none',
                  outlineOffset: -2,
                }}
              />
            </Tooltip>
          );
        })}
      </Stack>
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', mt: 0.5 }}
      >
        <Typography variant="caption" color="text.secondary">
          {formatClock(hours[0].time)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatClock(hours[hours.length - 1].time)}
        </Typography>
      </Stack>
    </Box>
  );
}
