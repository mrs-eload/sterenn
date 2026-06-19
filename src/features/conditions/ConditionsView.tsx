import { useMemo } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { describeNight } from '../../core/sky';
import { useTonight, DEFAULT_LOCATION } from './hooks/useTonight.ts';
import { ModelPicker } from './components/ModelPicker.tsx';
import { NightCard } from './components/NightCard.tsx';
import { ObservationWindowBar } from './components/ObservationWindowBar.tsx';
import { SkyQualityCurve } from './components/SkyQualityCurve.tsx';
import { HourlyTable } from './components/HourlyTable.tsx';

/**
 * Tonight's-conditions screen. This is the only stateful piece — it owns the
 * hook and threads its output to dumb components. No astronomy or fetching here.
 */
export function ConditionsView() {
  const {
    status,
    error,
    nightWindow,
    availableModels,
    activeModelId,
    setActiveModelId,
    active,
    refetch,
  } = useTonight();

  // Verdict + reason is domain logic; describeNight lives in core/ and is tested.
  const summary = useMemo(
    () => describeNight(active, nightWindow),
    [active, nightWindow],
  );

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={1} sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1">
          Tonight's conditions
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {DEFAULT_LOCATION.label} · longest contiguous clear block from dusk to
          dawn.
        </Typography>
      </Stack>

      {status === 'loading' && (
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', py: 6 }}>
          <CircularProgress size={24} />
          <Typography color="text.secondary">Fetching forecast…</Typography>
        </Stack>
      )}

      {status === 'error' && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={refetch}>
              Retry
            </Button>
          }
        >
          Couldn't load the forecast: {error}
        </Alert>
      )}

      {status === 'ready' && (
        <Stack spacing={3}>
          <NightCard summary={summary} window={nightWindow} />

          {/* nightWindow === null → no dusk-to-dawn window; the card already says
              so and there's nothing hourly to show. */}
          {nightWindow && active && (
            <>
              <ModelPicker
                models={availableModels}
                value={activeModelId}
                onChange={setActiveModelId}
              />
              <ObservationWindowBar
                hours={active.hours}
                longestBlock={active.longestBlock}
              />
              <SkyQualityCurve hours={active.hours} />
              <HourlyTable hours={active.hours} />
            </>
          )}

          {nightWindow && !active && (
            <Alert severity="warning">
              No forecast data came back for any weather model.
            </Alert>
          )}
        </Stack>
      )}

      <Box sx={{ mt: 4 }}>
        <Typography variant="caption" color="text.secondary">
          Weather: Open-Meteo. Twilight: suncalc.
        </Typography>
      </Box>
    </Container>
  );
}
