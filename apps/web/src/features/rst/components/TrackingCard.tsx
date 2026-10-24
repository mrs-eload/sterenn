import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { RstTelemetry } from '../types.ts';

interface TrackingCardProps {
  state: RstTelemetry;
}

/**
 * Dumb renderer for a tracking fix: it displays what it's given and computes
 * nothing. Provisional layout — once the telemetry fields are mapped in
 * data/adapter, this shows them properly instead of the raw payload dump.
 */
export function TrackingCard({ state }: TrackingCardProps) {
  return (
    <Paper sx={{ flexGrow: 1 }}>
      <Stack direction="column" spacing={1.5} sx={{ p: 3 }}>
        <Typography variant="h6">Roman Space Telescope — latest fix</Typography>
        <Typography color="text.secondary" variant="body2">
          {state.timestamp > 0
            ? new Date(state.timestamp).toUTCString()
            : 'Timestamp not mapped yet.'}
        </Typography>
        <Typography
          component="pre"
          variant="caption"
          sx={{ overflowX: 'auto', color: 'text.secondary', m: 0 }}
        >
          {JSON.stringify(state.raw, null, 2)}
        </Typography>
      </Stack>
    </Paper>
  );
}
