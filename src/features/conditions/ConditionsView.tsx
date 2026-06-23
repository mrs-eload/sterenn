import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { describeNight, describeMoon, summarizeConditions } from '../../core/sky';
import { parseCoordinates } from '../../data/openMeteo';
import {
  useTonight,
  SELECTABLE_DAYS,
  type ObservingLocation,
} from './hooks/useTonight.ts';
import { useRecentLocations } from './recentLocations.ts';
import { LocationSearch } from './components/LocationSearch.tsx';
import { DayPicker } from './components/DayPicker.tsx';
import { ModelPicker } from './components/ModelPicker.tsx';
import { NightCard } from './components/NightCard.tsx';
import { ObservationWindowBar } from './components/ObservationWindowBar.tsx';
import { SeeingCard } from './components/SeeingCard.tsx';
import { SkyQualityCurve } from './components/SkyQualityCurve.tsx';
import { ForecastCloudCoverage } from './components/ForecastCloudCoverage.tsx';
import { HourlyTable } from './components/HourlyTable.tsx';

// Matches the dashboard's own grid rhythm (see pages/Dashboard, MainLayout).
const GUTTER = { xs: 2.5, sm: 3, lg: 3.75 };

/**
 * Build a location from the URL's ?lat=&lon= query, so a coordinate URL is a
 * direct link to that site's forecast. Returns null when either is missing or
 * out of range. The label is the coordinates themselves — a fresh visit has no
 * place name, only the numbers the URL carries.
 */
function locationFromParams(params: URLSearchParams): ObservingLocation | null {
  const lat = params.get('lat');
  const lon = params.get('lon');
  if (lat == null || lon == null) return null;
  const parsed = parseCoordinates(`${lat}, ${lon}`);
  if (!parsed) return null;
  return {
    id: `coords:${parsed.lat},${parsed.lon}`,
    label: `${parsed.lat}, ${parsed.lon}`,
    lat: parsed.lat,
    lon: parsed.lon,
  };
}

/**
 * Tonight's-conditions screen. The only stateful piece — it owns the hook and
 * threads its output to dumb widgets. No astronomy or fetching here.
 *
 * Layout is two sections: the verdict (NightCard) is the whole right-hand
 * column; everything else stacks on the left, weather-model buttons on top.
 */
export function ConditionsView() {
  // The URL's ?lat=&lon= is the source of truth for which site we're forecasting,
  // so a coordinate link opens straight onto that forecast. State seeds from the
  // URL once at mount; there's no default, so a bare "/" starts with no location.
  const [searchParams, setSearchParams] = useSearchParams();

  // A full location object, not just an id: it can be a recent pick, a geocoded
  // city, or a typed coordinate pair, so there's no fixed list to look it up in.
  const [location, setLocation] = useState<ObservingLocation | null>(() =>
    locationFromParams(searchParams),
  );

  // Recently used locations, persisted in localStorage. Selecting one — whether
  // from the search results or a recent chip — both activates it and bumps it to
  // most-recent, so the chips double as a no-refetch history.
  const { recents, remember } = useRecentLocations();
  const chooseLocation = useCallback(
    (loc: ObservingLocation) => {
      setLocation(loc);
      remember(loc);
      // Reflect the chosen site in the URL so it's shareable/bookmarkable. We
      // keep the rich label in state for this session, but the URL carries only
      // the coordinates the forecast actually needs.
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('lat', String(loc.lat));
          next.set('lon', String(loc.lon));
          return next;
        },
        { replace: true },
      );
    },
    [remember, setSearchParams],
  );

  // The selectable nights: tonight + the next few, frozen once at mount so the
  // list (and its DD-MM labels) doesn't drift across renders. Each id is the
  // day offset from today; the label is the evening the night begins.
  const days = useMemo(() => {
    const base = new Date();
    base.setHours(12, 0, 0, 0); // noon — clear of any midnight/DST edge.
    return Array.from({ length: SELECTABLE_DAYS }, (_, offset) => {
      const date = new Date(base);
      date.setDate(base.getDate() + offset);
      const dd = String(date.getDate()).padStart(2, '0');
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      // Tonight gets a name, not a weekday — it's the default and reads clearer.
      const weekday =
        offset === 0
          ? 'Tonight'
          : date.toLocaleDateString('en-US', { weekday: 'short' });
      return { id: String(offset), label: `${dd}-${mm}`, weekday, date };
    });
  }, []);
  const [dayId, setDayId] = useState(days[0].id);
  const selectedDay = days.find((d) => d.id === dayId) ?? days[0];

  const {
    status,
    error,
    nightWindow,
    availableModels,
    activeModelId,
    setActiveModelId,
    active,
    activeSeeing,
    statusForDate,
    refetch,
  } = useTonight({
    lat: location?.lat,
    lon: location?.lon,
    date: selectedDay.date,
  });

  // Verdict + reason is domain logic; describeNight lives in core/ and is tested.
  const summary = useMemo(
    () => describeNight(active, nightWindow),
    [active, nightWindow],
  );

  // The headline GO / NOT-IDEAL / NO-GO and its per-factor breakdown: clouds and
  // precip are hard vetoes, then seeing decides. Also pure core/, also tested.
  const conditions = useMemo(
    () => summarizeConditions(summary, active, activeSeeing),
    [summary, active, activeSeeing],
  );

  // Moon is pure astronomy (core/, tested) and depends only on the window +
  // location, not on weather — so it's independent of the active model.
  const moon = useMemo(
    () =>
      nightWindow && location
        ? describeMoon(nightWindow, location.lat, location.lon)
        : null,
    [nightWindow, location],
  );

  // Go/no-go verdict for each selectable night, for the day-switcher buttons.
  // statusForDate re-runs the pure pipeline on the active model's already-fetched
  // week, so this costs no network and updates with the location/model.
  const dayStatuses = useMemo(
    () => Object.fromEntries(days.map((d) => [d.id, statusForDate(d.date)])),
    [days, statusForDate],
  );

  // No location chosen yet: there's nothing to fetch or compute, so the screen
  // is just the picker and a prompt. Selecting a location flips us out of idle.
  if (status === 'idle') {
    return (
      <Grid container spacing={GUTTER} sx={{ justifyContent: 'center' }}>
        <Grid size={{ xs: 12, sm: 9, md: 6, lg: 5 }}>
          <Stack direction="column" spacing={GUTTER} sx={{ alignItems: 'center' }}>
            <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
              Choose a location to see tonight's observing conditions.
            </Typography>
            <Box sx={{ width: 1 }}>
              <LocationSearch
                recents={recents}
                value={location}
                onChange={chooseLocation}
              />
            </Box>
          </Stack>
        </Grid>
      </Grid>
    );
  }

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
            conditions={conditions}
            window={nightWindow}
            location={location?.label ?? ''}
            date={selectedDay.date}
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
          conditions={conditions}
          window={nightWindow}
          location={location?.label ?? ''}
          date={selectedDay.date}
          moon={moon}
        />
      </Grid>

      {/* Section 2 — everything else, stacked in a column on the right.
          direction="column" is required: the theme overrides Stack's default
          direction to "row", so without this the widgets sit side by side. */}
      <Grid size={{ xs: 12, md: 10 }}>
        <Stack direction="column" spacing={GUTTER}>
          {/* Location and weather model sit side by side; they stack on narrow
              screens. display:flex makes the two Papers match height. */}
          <Grid container spacing={GUTTER}>
            <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex' }}>
              <LocationSearch
                recents={recents}
                value={location}
                onChange={chooseLocation}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex' }}>
              <ModelPicker
                models={availableModels}
                value={activeModelId}
                onChange={setActiveModelId}
              />
            </Grid>
          </Grid>
          <DayPicker
            days={days}
            value={dayId}
            onChange={setDayId}
            statuses={dayStatuses}
          />
          {/* Observation window and seeing share a row; they stack on narrow
              screens. display:flex makes the two Papers match height. */}
          <Grid container spacing={GUTTER}>
            <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex' }}>
              <ObservationWindowBar
                hours={active.hours}
                longestBlock={active.longestBlock}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex' }}>
              <SeeingCard seeing={activeSeeing} />
            </Grid>
          </Grid>
          {/* The two night curves sit side by side; they stack on narrow screens. */}
          <Grid container spacing={GUTTER}>
            <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex' }}>
              <SkyQualityCurve hours={active.hours} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex' }}>
              <ForecastCloudCoverage hours={active.hours} />
            </Grid>
          </Grid>
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
