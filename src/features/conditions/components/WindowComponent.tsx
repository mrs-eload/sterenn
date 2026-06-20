import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import IconifyIcon from '@app/components/base/IconifyIcon';
import type { NightWindow } from '../../../core/sky';
import { formatClock, formatHours } from '../format.ts';
import { MiniBar } from './Stat.tsx';
import { cardTones } from './tones.ts';

/**
 * The dark-window facts of the verdict card, drawn as a dusk→dawn timeline rather
 * than a stack of label/value rows: the two ends carry the times, the connector
 * carries the night's length, and a bar underneath shows how much of that night
 * the longest contiguous clear block fills. Pure renderer — numbers come from
 * upstream.
 */
export interface WindowComponentProps {
  window: NightWindow;
  windowHours: number;
  blockHours: number;
  /** Whether the parent card is on the GO gradient (drives the tones). */
  isGo: boolean;
}

export function WindowComponent({
  window,
  windowHours,
  blockHours,
  isGo,
}: WindowComponentProps) {
  const theme = useTheme();
  const tones = cardTones(theme, isGo);

  // Longest clear stretch as a fraction of the whole dark window — a quick read
  // on how much of the night is actually usable.
  const blockPct =
    windowHours > 0 ? Math.min(100, (blockHours / windowHours) * 100) : 0;
  const clearFill = isGo
    ? theme.palette.common.white
    : (theme.palette.verdict?.clear ?? theme.palette.success.main);

  return (
    // direction="column" is required: the theme overrides MuiStack's default
    // direction to "row", so an unset Stack lays its children out inline.
    <Stack direction="column" spacing={2.5} sx={{ position: 'relative', mb: 2.5 }}>
      {/* Dusk → dawn timeline. */}
      <Box>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Endpoint
            icon="mingcute:sunset-line"
            label="Dusk"
            time={formatClock(window.start)}
            tones={tones}
          />
          <Endpoint
            icon="mingcute:sunrise-line"
            label="Dawn"
            time={formatClock(window.end)}
            align="right"
            tones={tones}
          />
        </Stack>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1 }}>
          <Box sx={{ flex: 1, height: 2, borderRadius: 1, bgcolor: tones.track }} />
          <Stack
            direction="row"
            spacing={0.5}
            sx={{
              alignItems: 'center',
              px: 1,
              py: 0.375,
              borderRadius: 1,
              bgcolor: tones.track,
            }}
          >
            <IconifyIcon icon="mingcute:moon-line" sx={{ fontSize: 13, color: tones.secondary }} />
            <Typography
              variant="caption"
              sx={{ color: tones.primary, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
            >
              {formatHours(windowHours)} of night
            </Typography>
          </Stack>
          <Box sx={{ flex: 1, height: 2, borderRadius: 1, bgcolor: tones.track }} />
        </Stack>
      </Box>

      {/* Longest contiguous clear block, as a share of the night — label, then
          value, then bar, all stacked down the column. */}
      <Box>
        <Typography variant="caption" sx={{ color: tones.secondary, display: 'block' }}>
          Longest clear block
        </Typography>
        <Typography
          variant="h6"
          sx={{
            color: tones.primary,
            fontWeight: 600,
            lineHeight: 1.2,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {blockHours ? formatHours(blockHours) : '—'}
        </Typography>
        <MiniBar pct={blockPct} track={tones.track} fill={clearFill} />
      </Box>
    </Stack>
  );
}

interface EndpointProps {
  icon: string;
  label: string;
  time: string;
  align?: 'left' | 'right';
  tones: { primary: string; secondary: string };
}

/** One end of the timeline: small labelled icon over a prominent time. */
function Endpoint({ icon, label, time, align = 'left', tones }: EndpointProps) {
  return (
    <Stack
      direction="column"
      spacing={0.25}
      sx={{ alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}
    >
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
        <IconifyIcon icon={icon} sx={{ fontSize: 15, color: tones.secondary }} />
        <Typography variant="caption" sx={{ color: tones.secondary }}>
          {label}
        </Typography>
      </Stack>
      <Typography
        variant="h6"
        sx={{ color: tones.primary, fontWeight: 600, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}
      >
        {time}
      </Typography>
    </Stack>
  );
}
