import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import type { MoonSummary } from '../../../core/sky';
import IconifyIcon from '@app/components/base/IconifyIcon';
import { formatClock } from '../format.ts';
import { moonPhaseIcon } from './moonPhaseIcon.ts';
import { Stat } from './Stat.tsx';
import { cardTones } from './tones.ts';

/**
 * The moon section of the verdict card: the phase glyph + name/illumination, and
 * a single timing line for when the moon stops mattering tonight. No moon above
 * the horizon is the best case for deep-sky, so it's called out plainly.
 */
export interface MoonPhaseComponentProps {
  moon: MoonSummary;
  /** Whether the parent card is on the GO gradient (drives the tones). */
  isGo: boolean;
}

export function MoonPhaseComponent({ moon, isGo }: MoonPhaseComponentProps) {
  const theme = useTheme();
  const tones = cardTones(theme, isGo);

  const timing = !moon.upDuringNight
    ? { icon: 'meteocons:moon-new-fill', label: 'Moonlight', value: 'None tonight' }
    : moon.set !== null
      ? {
          icon: 'meteocons:moonset-fill',
          label: 'Moon sets',
          value: formatClock(moon.set),
        }
      : moon.rise !== null
        ? {
            icon: 'meteocons:moonrise-fill',
            label: 'Moon rises',
            value: formatClock(moon.rise),
          }
        : {
            icon: 'meteocons:moonrise-fill',
            label: 'Moon',
            value: `Up · ${Math.round(moon.peakAltitudeDeg)}° peak`,
          };

  return (
    // direction="column": the theme defaults MuiStack to "row" (see Stat/window).
    <Stack direction="column" spacing={1.75} sx={{ position: 'relative', mb: 2.5 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <IconifyIcon
          icon={moonPhaseIcon(moon.phaseName)}
          aria-label={moon.phaseName}
          sx={{ fontSize: 56, flexShrink: 0 }}
        />
        <Box>
          <Typography
            variant="body1"
            sx={{ color: tones.primary, fontWeight: 600, lineHeight: 1.2 }}
          >
            {moon.phaseName}
          </Typography>
          <Typography variant="caption" sx={{ color: tones.secondary }}>
            {Math.round(moon.illumination * 100)}% illuminated
          </Typography>
        </Box>
      </Stack>
      <Stat
        icon={timing.icon}
        label={timing.label}
        value={timing.value}
        tonePrimary={tones.primary}
        toneSecondary={tones.secondary}
      />
    </Stack>
  );
}
