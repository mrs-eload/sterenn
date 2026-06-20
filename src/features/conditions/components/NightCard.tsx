import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import type { NightSummary, NightWindow } from '../../../core/sky';
import { formatHours, formatRange } from '../format.ts';

/**
 * The headline verdict card. Renders a NightSummary (computed in core/) — it
 * does no astronomy itself, just maps the reason to a colour and lays out stats.
 */
export interface NightCardProps {
  summary: NightSummary;
  window: NightWindow | null;
}

export function NightCard({ summary, window }: NightCardProps) {
  const theme = useTheme();

  // Reason → chip colour. "good" is green; cloudy is the bridge-amber; the two
  // "can't win" reasons (too short / no night) are neutral, not alarming red —
  // they're the sky's fault, not bad weather.
  const chipColor =
    summary.reason === 'good'
      ? theme.palette.verdict?.clear
      : summary.reason === 'too-cloudy'
        ? theme.palette.verdict?.cloud
        : theme.palette.text.disabled;

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack
          direction="row"
          spacing={2}
          sx={{
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
          }}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Chip
              label={summary.good ? 'GO' : 'NO-GO'}
              sx={{
                bgcolor: chipColor,
                color: '#0b0e14',
                fontWeight: 700,
                letterSpacing: 0.5,
              }}
            />
            <Typography variant="h5" component="h2">
              {summary.headline}
            </Typography>
          </Stack>

          {window && (
            <Stack direction="row" spacing={3}>
              <Stat label="Dusk → dawn" value={formatRange(window.start, window.end)} />
              <Stat label="Night length" value={formatHours(summary.windowHours)} />
              <Stat
                label="Longest clear"
                value={summary.blockHours ? formatHours(summary.blockHours) : '—'}
              />
            </Stack>
          )}
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          {summary.detail}
        </Typography>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={0}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Stack>
  );
}
