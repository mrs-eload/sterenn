import { useMemo } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { describeNight, describeMoon } from '../../core/sky';
import { useTonight, DEFAULT_LOCATION } from './hooks/useTonight.ts';
import { ModelPicker } from './components/ModelPicker.tsx';
import { NightCard } from './components/NightCard.tsx';
import { ObservationWindowBar } from './components/ObservationWindowBar.tsx';
import { SkyQualityCurve } from './components/SkyQualityCurve.tsx';
import { HourlyTable } from './components/HourlyTable.tsx';

// Matches the dashboard's own grid rhythm (see pages/Dashboard, MainLayout).
const GUTTER = { xs: 2.5, sm: 3, lg: 3.75 };

/**
 * Tonight's-conditions screen. The only stateful piece — it owns the hook and
 * threads its output to dumb widgets. No astronomy or fetching here.
 *
 * Layout is two sections: the verdict (NightCard) is the whole right-hand
 * column; everything else stacks on the left, weather-model buttons on top.
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

  // Moon is pure astronomy (core/, tested) and depends only on the window +
  // location, not on weather — so it's independent of the active model.
  const moon = useMemo(
    () =>
      nightWindow
        ? describeMoon(nightWindow, DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon)
        : null,
    [nightWindow],
  );

  if (status === 'loading') {
    return (
      <Paper>
        <Stack
          direction="row"
          spacing={2}
          sx={{ alignItems: 'center', justifyContent: 'center', py: 6 }}
        >
          <CircularProgress size={24} />
          <Typography color="text.secondary">Fetching forecast…</Typography>
        </Stack>
      </Paper>
    );
  }

  if (status === 'error') {
    return (
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
    );
  }

  // No dusk-to-dawn window (polar midsummer) or no model data → there's nothing
  // hourly to show, so the verdict stands alone.
  if (!nightWindow || !active) {
    return (
      <Grid container spacing={GUTTER} sx={{ flexGrow: 1, alignItems: 'stretch' }}>
        <Grid size={{ xs: 12, md: 3.5 }} sx={{ display: 'flex' }}>
          <NightCard
            summary={summary}
            window={nightWindow}
            location={DEFAULT_LOCATION.label}
            moon={moon}
          />
        </Grid>
        {nightWindow && !active && (
          <Grid size={{ xs: 12, md: 8.5 }}>
            <Alert severity="warning">
              No forecast data came back for any weather model.
            </Alert>
          </Grid>
        )}
      </Grid>
    );
  }

  // flexGrow:1 lets the grid claim the full height of the layout's main column
  // (down to the footer) instead of sizing to its content; alignItems:stretch
  // then makes both columns — and the NightCard inside section 1 — full height.
  return (
    <Grid container spacing={GUTTER} sx={{ flexGrow: 1, alignItems: 'stretch' }}>
      {/* Section 1 — the verdict, the whole left-hand column. display:flex so
          the NightCard Paper fills the full row height, not just its content. */}
      <Grid size={{ xs: 12, md: 2 }} sx={{ display: 'flex' }}>
        <NightCard
          summary={summary}
          window={nightWindow}
          location={DEFAULT_LOCATION.label}
          moon={moon}
        />
      </Grid>

      {/* Section 2 — everything else, stacked in a column on the right.
          direction="column" is required: the theme overrides Stack's default
          direction to "row", so without this the widgets sit side by side. */}
      <Grid size={{ xs: 12, md: 10 }}>
        <Stack direction="column" spacing={GUTTER}>
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
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block' }}
          >
            Weather: Open-Meteo. Twilight: suncalc.
          </Typography>
        </Stack>
      </Grid>
    </Grid>
  );
}
