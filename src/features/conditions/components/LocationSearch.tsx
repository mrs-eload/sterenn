import { useEffect, useMemo, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import IconifyIcon from '@app/components/base/IconifyIcon';
import { geocode, parseCoordinates } from '../../../data/openMeteo';
import type { ObservingLocation } from '../hooks/useTonight.ts';
import { SectionHeader } from './SectionHeader.tsx';

/**
 * Location input: type a city to geocode it, or type a coordinate pair to use
 * it directly. Recently used locations show as chips below for one-tap reuse —
 * picking one needs no geocoding round-trip (its coordinates are remembered).
 *
 * Dumb-ish, like the other pickers — it owns only the transient search state
 * (input text + suggestion list) and reports the *chosen* location up via
 * onChange. All resolving (name → coords) is done by data/openMeteo; this
 * component never does astronomy or forecasting, only turns a selection into an
 * ObservingLocation.
 */
export interface LocationSearchProps {
  /** Recently used locations, most-recent-first, shown as one-tap chips. */
  recents: ObservingLocation[];
  /** The currently active location (drives the chip highlight). */
  value: ObservingLocation;
  onChange: (location: ObservingLocation) => void;
}

/** Debounce window for the geocoding request as the user types. */
const DEBOUNCE_MS = 300;

export function LocationSearch({ recents, value, onChange }: LocationSearchProps) {
  const [input, setInput] = useState('');
  const [options, setOptions] = useState<ObservingLocation[]>([]);
  const [loading, setLoading] = useState(false);

  // If the text is a coordinate pair, offer it as a synthetic first option so
  // the user can pick "47.8, -3.2" without a network round-trip. Pure + sync.
  const coordOption = useMemo<ObservingLocation | null>(() => {
    const parsed = parseCoordinates(input);
    if (!parsed) return null;
    return {
      id: `coords:${parsed.lat},${parsed.lon}`,
      label: `${parsed.lat}, ${parsed.lon} (coordinates)`,
      lat: parsed.lat,
      lon: parsed.lon,
    };
  }, [input]);

  // Debounced geocoding. A coordinate pair skips the request entirely. The
  // AbortController + cancelled flag drop stale responses so a slow earlier
  // query can't overwrite a newer one.
  useEffect(() => {
    const query = input.trim();
    const controller = new AbortController();
    let cancelled = false;

    // Every state write happens inside this async callback (never synchronously
    // in the effect body), so a keystroke doesn't trigger a cascading render —
    // it just schedules a debounced sync with the geocoding network.
    const run = async () => {
      if (coordOption || query.length < 2) {
        setOptions([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const places = await geocode(query, controller.signal);
        if (cancelled) return;
        setOptions(
          places.map((p) => ({
            id: `geo:${p.id}`,
            label: p.label,
            lat: p.lat,
            lon: p.lon,
          })),
        );
      } catch {
        // A failed lookup just yields no suggestions; the forecast pipeline is
        // unaffected and the user can retry by typing.
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const timer = setTimeout(run, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [input, coordOption]);

  const suggestions = coordOption ? [coordOption] : options;

  return (
    <Paper sx={{ width: 1, height: 1 }}>
      <SectionHeader icon="healthicons:geo-location" title="Location" />
      <Autocomplete<ObservingLocation>
        options={suggestions}
        // The list is already server-side (or a single coord option); don't let
        // MUI re-filter it against the input text.
        filterOptions={(x) => x}
        getOptionLabel={(o) => o.label}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        loading={loading}
        // Free-solo input: text can name a place we haven't geocoded yet, so we
        // drive the input value ourselves rather than pinning it to `value`.
        inputValue={input}
        onInputChange={(_, v, reason) => {
          if (reason !== 'reset') setInput(v);
        }}
        value={null}
        onChange={(_, selected) => {
          if (!selected) return;
          onChange(selected);
          setInput('');
          setOptions([]);
        }}
        noOptionsText={
          input.trim().length < 2 ? 'Type a city or lat, lon' : 'No matches'
        }
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Search a city or type 47.8, -3.2"
            size="small"
            slotProps={{
              ...params.slotProps,
              input: {
                ...params.slotProps.input,
                endAdornment: (
                  <>
                    {loading ? <CircularProgress size={16} /> : null}
                    {params.slotProps.input.endAdornment}
                  </>
                ),
              },
            }}
          />
        )}
      />
      {recents.length > 0 ? (
        <Box sx={{ mt: 2.5 }}>
          <Typography
            sx={{
              display: 'block',
              mb: 1,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              color: 'text.disabled',
            }}
          >
            Recent
          </Typography>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
            {recents.map((loc) => {
              const active = loc.id === value.id;
              return (
                <Chip
                  key={loc.id}
                  label={loc.label}
                  onClick={() => onChange(loc)}
                  icon={<IconifyIcon icon="mdi:map-marker" sx={{ fontSize: 14 }} />}
                  // Pill chips that read as one family with the card's icon tile:
                  // a translucent cyan rest state that lifts and brightens on
                  // hover, and a cyan→purple gradient with a soft glow for the
                  // active location so the current site is unmistakable.
                  sx={{
                    height: 28,
                    px: 0.5,
                    borderRadius: 999,
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: '1px solid',
                    transition: (t) =>
                      t.transitions.create(
                        ['background-color', 'border-color', 'box-shadow', 'transform', 'color'],
                        { duration: 150 },
                      ),
                    '& .MuiChip-label': { px: 0.75 },
                    '& .MuiChip-icon': { ml: 0.5, mr: -0.25, color: 'inherit' },
                    ...(active
                      ? {
                          color: 'common.white',
                          borderColor: 'transparent',
                          background: (t) =>
                            `linear-gradient(135deg, ${t.palette.secondary.main}, ${t.palette.primary.main})`,
                          boxShadow: (t) =>
                            `0 4px 14px ${alpha(t.palette.secondary.main, 0.45)}`,
                          '&:hover': {
                            boxShadow: (t) =>
                              `0 6px 18px ${alpha(t.palette.secondary.main, 0.55)}`,
                          },
                        }
                      : {
                          color: 'text.secondary',
                          borderColor: (t) => alpha(t.palette.secondary.main, 0.22),
                          bgcolor: (t) => alpha(t.palette.secondary.main, 0.08),
                          '&:hover': {
                            color: 'text.primary',
                            borderColor: (t) => alpha(t.palette.secondary.main, 0.5),
                            bgcolor: (t) => alpha(t.palette.secondary.main, 0.16),
                            transform: 'translateY(-1px)',
                            boxShadow: (t) =>
                              `0 4px 12px ${alpha(t.palette.common.black, 0.3)}`,
                          },
                        }),
                  }}
                />
              );
            })}
          </Stack>
        </Box>
      ) : (
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ alignItems: 'center', color: 'text.disabled', mt: 2.5 }}
        >
          <IconifyIcon icon="mdi:map-marker-plus-outline" sx={{ fontSize: 16 }} />
          <Typography variant="caption">
            Locations you search appear here for one-tap reuse.
          </Typography>
        </Stack>
      )}
    </Paper>
  );
}
