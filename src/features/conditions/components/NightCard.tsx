import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import IconifyIcon from '@app/components/base/IconifyIcon';
import type {
  ConditionsSummary,
  MoonSummary,
  NightSummary,
  NightWindow,
} from '../../../core/sky';
import { cardTones } from './tones.ts';
import { WindowComponent } from './WindowComponent.tsx';
import { MoonPhaseComponent } from './MoonPhaseComponent.tsx';
import { ConditionsBreakdown } from './ConditionsBreakdown.tsx';

/**
 * The headline verdict widget — the whole left-hand column. Owns the layout and
 * the GO/NO-GO presentation; the per-section facts live in WindowComponent and
 * MoonPhaseComponent. It does no astronomy itself, just maps the reason to an
 * icon/colour.
 *
 * A "good" night is celebrated with the theme's translucent green→violet wash;
 * every other verdict stays on the calm dark surface. A NO-GO is accented in the
 * same red as precipitation in the observation window, a "not ideal" (soft
 * seeing) in amber, so the headline colour matches the breakdown beneath it.
 */
export interface NightCardProps {
  summary: NightSummary;
  /** The combined go / not-ideal / no-go verdict + per-factor breakdown. */
  conditions: ConditionsSummary;
  window: NightWindow | null;
  location?: string;
  /**
   * The evening the night begins — drives the kicker label. The forecast date is
   * selectable, so the kicker names the night ("Monday, June 25th") rather than
   * always claiming "tonight".
   */
  date?: Date;
  /** Moon context for the night, or null when there's no window to describe. */
  moon?: MoonSummary | null;
}

/** "st" / "nd" / "rd" / "th" for a day-of-month, English ordinal rules. */
function ordinalSuffix(day: number): string {
  // 11th–13th are the exceptions: they take "th" despite ending in 1/2/3.
  const teens = day % 100;
  if (teens >= 11 && teens <= 13) return 'th';
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

/** Formats the night's evening date as e.g. "Monday, June 25th". */
function formatNightDate(date: Date): string {
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const day = date.getDate();
  return `${weekday}, ${month} ${day}${ordinalSuffix(day)}`;
}

export function NightCard({ summary, conditions, window, location, date, moon }: NightCardProps) {
  const theme = useTheme();
  const { overall } = conditions;
  const isGo = overall === 'go';
  const tones = cardTones(theme, isGo);
  const white = theme.palette.common.white;

  // Verdict → accent, mirroring the verdict palette used across the feature:
  // GO green, "not ideal" amber, NO-GO the same red as precipitation.
  const accent =
    overall === 'go'
      ? (theme.palette.verdict?.clear ?? theme.palette.success.main)
      : overall === 'caution'
        ? (theme.palette.verdict?.cloud ?? theme.palette.warning.main)
        : overall === 'no-go'
          ? (theme.palette.verdict?.precip ?? theme.palette.error.main)
          : theme.palette.text.disabled;

  // Icon: the winning verdict for GO, otherwise the factor that drove the
  // verdict — a rainy cloud for precip, a stricken (closed) eye for soft/poor
  // seeing, a plain cloud for cloud cover — with the window cases (too-short /
  // no-night) carried by the weather reason. `deciding` already ranks precip
  // above cloud, so a rainy-and-cloudy night shows rain, not a bare cloud.
  const icon = isGo
    ? 'mingcute:moon-stars-fill'
    : summary.reason === 'no-night'
      ? 'mingcute:sun-fill'
      : summary.reason === 'too-short'
        ? 'mingcute:time-fill'
        : conditions.deciding === 'precip'
          ? 'mingcute:heavy-rain-fill'
          : conditions.deciding === 'seeing'
            ? 'mingcute:eye-close-fill'
            : 'mingcute:cloud-fill';

  const chipLabel =
    overall === 'go'
      ? 'GO'
      : overall === 'caution'
        ? 'NOT IDEAL'
        : 'NO-GO';

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

      {/* Location leads as the prominent heading; the night's date drops to the
          quiet kicker beneath it (swapped 2026-06-22 so the place you're
          observing from is the first thing read). The date is selectable, so the
          kicker names the actual night rather than always claiming "tonight". */}
      {location && (
        <Typography
          variant="h6"
          sx={{ position: 'relative', color: tones.primary, fontWeight: 600, lineHeight: 1.2 }}
        >
          {location}
        </Typography>
      )}
      <Typography
        variant="overline"
        sx={{ position: 'relative', color: tones.secondary, letterSpacing: 1.5 }}
      >
        {date ? formatNightDate(date) : "Tonight's conditions"}
        {location ? ' · dusk to dawn' : ''}
      </Typography>

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
            label={chipLabel}
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
            {conditions.headline}
          </Typography>
        </Stack>
      </Stack>

      <Divider
        sx={{ position: 'relative', my: 2.5, borderColor: dividerColor, bgcolor: dividerColor }}
      />

      {/* The factor breakdown — only worth showing once at least one factor has
          real data (a window with a forecast); on a no-night/no-data card every
          factor is "unknown" and the headline already carries the reason. */}
      {conditions.factors.some((f) => f.status !== 'unknown') && (
        <>
          <ConditionsBreakdown conditions={conditions} isGo={isGo} />
          <Divider
            sx={{ position: 'relative', my: 2.5, borderColor: dividerColor, bgcolor: dividerColor }}
          />
        </>
      )}

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
        {conditions.detail}
      </Typography>
    </Paper>
  );
}
