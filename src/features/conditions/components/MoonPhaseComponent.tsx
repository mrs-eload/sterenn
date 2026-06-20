import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import type { MoonSummary } from '../../../core/sky';
import { formatClock } from '../format.ts';
import { MoonPhase } from './MoonPhase.tsx';
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
  const litColor = isGo ? theme.palette.common.white : theme.palette.grey[100];

  const timing = !moon.upDuringNight
    ? { icon: 'mingcute:moon-line', label: 'Moonlight', value: 'None tonight' }
    : moon.set !== null
      ? {
          icon: 'mingcute:arrow-down-circle-line',
          label: 'Moon sets',
          value: formatClock(moon.set),
        }
      : moon.rise !== null
        ? {
            icon: 'mingcute:arrow-up-circle-line',
            label: 'Moon rises',
            value: formatClock(moon.rise),
          }
        : {
            icon: 'mingcute:arrow-up-circle-line',
            label: 'Moon',
            value: `Up · ${Math.round(moon.peakAltitudeDeg)}° peak`,
          };

  return (
    // direction="column": the theme defaults MuiStack to "row" (see Stat/window).
    <Stack direction="column" spacing={1.75} sx={{ position: 'relative', mb: 2.5 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <MoonPhase
          phase={moon.phase}
          illumination={moon.illumination}
          size={46}
          litColor={litColor}
          ringColor={alpha(litColor, 0.28)}
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
