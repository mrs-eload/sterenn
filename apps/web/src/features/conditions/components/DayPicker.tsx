import type { Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import type { ConditionStatus } from '../../../core/sky';
import { SectionHeader } from './SectionHeader.tsx';

/**
 * Day selector. Dumb, like LocationSearch and ModelPicker: shows the selectable
 * nights (tonight + the next few) and reports the chosen id up. Switching one
 * re-slices the already-fetched week to that night's window — no new network
 * call. Each tile shows the weekday + date and is tinted by its night's
 * go/no-go verdict so the week reads at a glance.
 */
export interface DayOption {
  id: string;
  /** DD-MM of the evening this night begins. */
  label: string;
  /** Short weekday ("Mon") or "Tonight" for the first night. */
  weekday: string;
}

export interface DayPickerProps {
  days: DayOption[];
  value: string;
  onChange: (id: string) => void;
  /** Per-day go/no-go verdict, keyed by day id. Missing = neutral. */
  statuses?: Record<string, ConditionStatus>;
}

// Verdict → its accent colour, resolved from the theme. unknown stays neutral so
// a night with no forecast / no astronomical darkness reads as "no verdict".
function accentFor(theme: Theme, status: ConditionStatus): string {
  switch (status) {
    case 'go':
      return theme.palette.success.main;
    case 'caution':
      return theme.palette.warning.main;
    case 'no-go':
      return theme.palette.error.main;
    default:
      return theme.palette.text.disabled;
  }
}

export function DayPicker({ days, value, onChange, statuses }: DayPickerProps) {
  if (days.length === 0) return null;
  return (
    <Paper>
      <SectionHeader icon="mingcute:calendar-line" title="7 days forecast" />
      <Stack direction="row" sx={{ gap: 1.25 }}>
        {days.map((day) => {
          const selected = day.id === value;
          const status = statuses?.[day.id] ?? 'unknown';
          return (
            <ButtonBase
              key={day.id}
              focusRipple
              onClick={() => onChange(day.id)}
              sx={{
                flexDirection: 'column',
                gap: 0.5,
                // Tiles share the row equally and stretch to fill the card.
                flex: 1,
                minWidth: 0,
                px: 1.5,
                py: 1.25,
                borderRadius: 2,
                border: '1px solid',
                // Selected tile gets a solid accent border + stronger tint; the
                // rest get a faint accent wash so the verdict colour reads
                // without shouting. The top dot carries the status either way.
                borderColor: (t) =>
                  selected ? accentFor(t, status) : alpha(accentFor(t, status), 0.25),
                bgcolor: (t) =>
                  alpha(accentFor(t, status), selected ? 0.22 : 0.07),
                transition: (t) =>
                  t.transitions.create(['background-color', 'border-color', 'transform']),
                '&:hover': {
                  bgcolor: (t) => alpha(accentFor(t, status), selected ? 0.28 : 0.14),
                  borderColor: (t) => alpha(accentFor(t, status), selected ? 1 : 0.5),
                  transform: 'translateY(-1px)',
                },
              }}
            >
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  bgcolor: (t) => accentFor(t, status),
                  // Faint glow so the dot pops against the dark surface.
                  boxShadow: (t) => `0 0 6px ${alpha(accentFor(t, status), 0.7)}`,
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  lineHeight: 1.2,
                  color: selected ? 'text.primary' : 'text.secondary',
                }}
              >
                {day.weekday}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: selected ? 'text.primary' : 'text.secondary',
                  lineHeight: 1.2,
                }}
              >
                {day.label}
              </Typography>
            </ButtonBase>
          );
        })}
      </Stack>
    </Paper>
  );
}
