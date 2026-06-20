import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import IconifyIcon from '@app/components/base/IconifyIcon';
import type {
  MoonSummary,
  NightReason,
  NightSummary,
  NightWindow,
} from '../../../core/sky';
import { cardTones } from './tones.ts';
import { WindowComponent } from './WindowComponent.tsx';
import { MoonPhaseComponent } from './MoonPhaseComponent.tsx';

/**
 * The headline verdict widget — the whole left-hand column. Owns the layout and
 * the GO/NO-GO presentation; the per-section facts live in WindowComponent and
 * MoonPhaseComponent. It does no astronomy itself, just maps the reason to an
 * icon/colour.
 *
 * A "good" night is celebrated with the theme's translucent green→violet wash;
 * every other verdict stays on the calm dark surface so the card doesn't cry wolf
 * for a sky that's simply too short or too bright to shoot (not bad weather).
 */
export interface NightCardProps {
  summary: NightSummary;
  window: NightWindow | null;
  location?: string;
  /** Moon context for the night, or null when there's no window to describe. */
  moon?: MoonSummary | null;
}

const REASON_ICON: Record<NightReason, string> = {
  good: 'mingcute:moon-stars-fill',
  'too-cloudy': 'mingcute:cloud-fill',
  'too-short': 'mingcute:time-fill',
  'no-night': 'mingcute:sun-fill',
};

export function NightCard({ summary, window, location, moon }: NightCardProps) {
  const theme = useTheme();
  const isGo = summary.good;
  const icon = REASON_ICON[summary.reason];
  const tones = cardTones(theme, isGo);
  const white = theme.palette.common.white;

  // Reason → accent. "good" green, cloudy amber; the two "can't win" reasons
  // (too short / no night) are neutral, not alarming red — the sky's fault.
  const accent =
    summary.reason === 'good'
      ? (theme.palette.verdict?.clear ?? theme.palette.success.main)
      : summary.reason === 'too-cloudy'
        ? (theme.palette.verdict?.cloud ?? theme.palette.warning.main)
        : theme.palette.text.disabled;

  const badgeBg = isGo ? alpha(white, 0.18) : alpha(accent, 0.16);
  const badgeColor = isGo ? white : accent;

  // Translucent green→violet wash. Applied as backgroundImage (not `background`)
  // so it layers over the Paper's dark surface instead of replacing it, keeping
  // the card dark enough for white text and the GO chip to read.
  const heroBg = isGo ? 'linear-gradient(135deg, #3cff9359, #7f25fb47)' : undefined;

  // A quiet hairline: info.darker is genuinely darker than the card surface
  // (info.main) and in the same blue family, so it reads as a clean dark rule
  // rather than the off-hue, near-invisible grey it was before.
  const dividerColor = theme.palette.info.darker;

  return (
    <Paper
      sx={{
        position: 'relative',
        overflow: 'hidden',
        width: 1,
        height: 1,
        display: 'flex',
        flexDirection: 'column',
        ...(heroBg ? { backgroundImage: heroBg } : null),
      }}
    >
      {/* Oversized glyph bleeding off the corner — pure decoration. */}
      <Box
        component="span"
        aria-hidden
        sx={{
          position: 'absolute',
          top: -28,
          right: -24,
          lineHeight: 0,
          pointerEvents: 'none',
          color: isGo ? alpha(white, 0.16) : alpha(accent, 0.1),
        }}
      >
        <IconifyIcon icon={icon} sx={{ fontSize: 176 }} />
      </Box>

      <Typography
        variant="overline"
        sx={{ position: 'relative', color: tones.secondary, letterSpacing: 1.5 }}
      >
        Tonight's conditions
      </Typography>
      {location && (
        <Typography variant="body2" sx={{ position: 'relative', color: tones.secondary }}>
          {location} · dusk to dawn
        </Typography>
      )}

      <Stack
        direction="row"
        spacing={1.75}
        sx={{ position: 'relative', alignItems: 'center', mt: 2.5 }}
      >
        <Box
          sx={{
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            width: 48,
            height: 48,
            borderRadius: 2,
            bgcolor: badgeBg,
            color: badgeColor,
          }}
        >
          <IconifyIcon icon={icon} sx={{ fontSize: 28 }} />
        </Box>
        <Stack direction="column" spacing={0.75} sx={{ alignItems: 'flex-start' }}>
          <Chip
            label={isGo ? 'GO' : 'NO-GO'}
            size="small"
            sx={{
              // Solid green pill, dark text — high internal contrast and not as
              // glaring as a white chip against the translucent wash.
              bgcolor: isGo ? accent : alpha(accent, 0.16),
              color: isGo ? theme.palette.grey[900] : accent,
              fontWeight: 700,
              letterSpacing: 0.5,
              px: 0.75,
            }}
          />
          <Typography variant="h5" sx={{ color: tones.primary, lineHeight: 1.2 }}>
            {summary.headline}
          </Typography>
        </Stack>
      </Stack>

      <Divider
        sx={{ position: 'relative', my: 2.5, borderColor: dividerColor, bgcolor: dividerColor }}
      />

      {window && (
        <WindowComponent
          window={window}
          windowHours={summary.windowHours}
          blockHours={summary.blockHours}
          isGo={isGo}
        />
      )}

      {moon && (
        <>
          <Divider
            sx={{ position: 'relative', mb: 2.5, borderColor: dividerColor, bgcolor: dividerColor }}
          />
          <MoonPhaseComponent moon={moon} isGo={isGo} />
        </>
      )}

      {/* mt:auto pins the explanation to the bottom of the full-height column. */}
      <Typography
        variant="body2"
        sx={{ position: 'relative', mt: 'auto', color: tones.secondary }}
      >
        {summary.detail}
      </Typography>
    </Paper>
  );
}
