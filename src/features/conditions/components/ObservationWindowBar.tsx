import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import type { ClassifiedHour, ClearBlock } from '../../../core/sky';
import { formatClock, formatHours } from '../format.ts';
import { SectionHeader } from './SectionHeader.tsx';

/**
 * The night window as a continuous "river of the night": one rounded ribbon
 * whose colour blends smoothly hour-to-hour between verdict colours (clear /
 * cloud-bridged / precip), rather than discrete tiles. The longest usable block
 * is lifted with a glowing ring and labelled with its length, so the actual
 * shootable stretch is unmistakable — which is the whole point of the widget.
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

  const clear = theme.palette.verdict?.clear ?? theme.palette.success.main;
  const cloud = theme.palette.verdict?.cloud ?? theme.palette.warning.main;
  const precip = theme.palette.verdict?.precip ?? theme.palette.error.main;
  const white = theme.palette.common.white;

  const colorFor = (h: ClassifiedHour) =>
    h.verdict === 'clear' ? clear : h.verdict === 'precip' ? precip : cloud;

  // Each hour owns a segment of width 100/N; its colour sits at the segment
  // centre and CSS interpolates between centres for the smooth blend. The 0%
  // and 100% anchors repeat the first/last colour so the ends aren't truncated
  // mid-transition.
  const n = hours.length;
  const centreStops = hours.map(
    (h, i) => `${colorFor(h)} ${((i + 0.5) / n) * 100}%`,
  );
  const ribbon = `linear-gradient(90deg, ${colorFor(hours[0])} 0%, ${centreStops.join(
    ', ',
  )}, ${colorFor(hours[n - 1])} 100%)`;

  // The usable block as a fraction of the ribbon (segment model, so even a
  // single-hour block stays one segment wide and visible).
  const block =
    longestBlock !== null
      ? {
          left: (longestBlock.startIndex / n) * 100,
          width:
            ((longestBlock.endIndex - longestBlock.startIndex + 1) / n) * 100,
          lengthHours: longestBlock.lengthHours,
        }
      : null;

  return (
    // width:100% so the card fills its flex grid cell when laid out in a row.
    <Paper sx={{ width: '100%' }}>
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

      <Box sx={{ position: 'relative' }}>
        {/* The ribbon itself — a smooth horizontal gradient, no cell edges. */}
        <Box
          sx={{
            height: 34,
            borderRadius: 2,
            background: ribbon,
            // A touch of inner shading gives the band some depth.
            boxShadow: `inset 0 0 0 1px ${alpha(white, 0.06)}`,
          }}
        />

        {/* The shootable stretch: a raised, glowing ring over its slice of the
            ribbon, with its length centred inside. pointer-events:none so the
            hover overlay underneath still gets the mouse. */}
        {block && (
          <Box
            sx={{
              position: 'absolute',
              top: -3,
              bottom: -3,
              left: `${block.left}%`,
              width: `${block.width}%`,
              borderRadius: 2,
              border: `2px solid ${alpha(white, 0.9)}`,
              boxShadow: `0 0 14px ${alpha(white, 0.4)}, inset 0 0 12px ${alpha(white, 0.18)}`,
              display: 'grid',
              placeItems: 'center',
              pointerEvents: 'none',
            }}
          >
            {block.lengthHours >= 2 && (
              <Typography
                variant="caption"
                sx={{
                  // A dark backing pill keeps the label legible over the bright
                  // green "clear" ribbon it usually sits on — white-on-green
                  // alone fails contrast even with a text shadow.
                  color: white,
                  fontWeight: 700,
                  letterSpacing: 0.2,
                  whiteSpace: 'nowrap',
                  px: 0.75,
                  py: 0.125,
                  borderRadius: 1,
                  bgcolor: alpha(theme.palette.common.black, 0.55),
                }}
              >
                {formatHours(block.lengthHours)} clear
              </Typography>
            )}
          </Box>
        )}

        {/* Transparent per-hour cells laid over the ribbon, so hovering still
            surfaces the exact hour's reading the continuous band can't label. */}
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex' }}>
          {hours.map((h) => (
            <Tooltip
              key={h.time}
              title={`${formatClock(h.time)} · ${h.cloudCover?.total ?? '—'}% cloud · ${h.verdict}`}
              arrow
            >
              <Box sx={{ flex: 1, cursor: 'help' }} />
            </Tooltip>
          ))}
        </Box>
      </Box>

      {/* Thin hour ticks along the base, one per hour-centre. */}
      <Box sx={{ display: 'flex', mt: 0.75 }}>
        {hours.map((h) => (
          <Box key={h.time} sx={{ flex: 1, display: 'grid', placeItems: 'center' }}>
            <Box sx={{ width: '1px', height: 6, bgcolor: alpha(white, 0.2) }} />
          </Box>
        ))}
      </Box>

      <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 0.5 }}>
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
