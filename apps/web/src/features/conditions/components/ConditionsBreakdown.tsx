import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import IconifyIcon from '@app/components/base/IconifyIcon';
import type { ConditionStatus, ConditionsSummary } from '../../../core/sky';
import { cardTones } from './tones.ts';

/**
 * The per-factor breakdown of the verdict: cloud cover, precipitation and seeing,
 * each with a go / not-ideal / no-go marker, so the headline GO/NO-GO can be read
 * back to its causes at a glance. Pure renderer — the statuses are decided in
 * core/conditions (summarizeConditions); this just colours and lays them out.
 */
export interface ConditionsBreakdownProps {
  conditions: ConditionsSummary;
  /** Whether the parent card is on the GO gradient (drives the text tones). */
  isGo: boolean;
}

const STATUS_ICON: Record<ConditionStatus, string> = {
  go: 'mingcute:check-circle-fill',
  caution: 'mingcute:alert-fill',
  'no-go': 'mingcute:close-circle-fill',
  unknown: 'mingcute:question-line',
};

const STATUS_LABEL: Record<ConditionStatus, string> = {
  go: 'Go',
  caution: 'Not ideal',
  'no-go': 'No-go',
  unknown: 'No data',
};

export function ConditionsBreakdown({ conditions, isGo }: ConditionsBreakdownProps) {
  const theme = useTheme();
  const tones = cardTones(theme, isGo);

  const clear = theme.palette.verdict?.clear ?? theme.palette.success.main;
  const cloud = theme.palette.verdict?.cloud ?? theme.palette.warning.main;
  const precip = theme.palette.verdict?.precip ?? theme.palette.error.main;
  const muted = theme.palette.text.disabled;

  const colorFor = (status: ConditionStatus) =>
    status === 'go'
      ? clear
      : status === 'caution'
        ? cloud
        : status === 'no-go'
          ? precip
          : muted;

  return (
    <Stack direction="column" spacing={1.25} sx={{ position: 'relative' }}>
      <Typography
        variant="overline"
        sx={{ color: tones.secondary, letterSpacing: 1.5, lineHeight: 1 }}
      >
        Conditions
      </Typography>
      {conditions.factors.map((f) => {
        const color = colorFor(f.status);
        return (
          <Stack key={f.key} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
            <IconifyIcon
              icon={STATUS_ICON[f.status]}
              aria-hidden
              sx={{ fontSize: 18, color, mt: '1px', flexShrink: 0 }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Stack
                direction="row"
                spacing={0.75}
                sx={{ alignItems: 'baseline', flexWrap: 'wrap' }}
              >
                <Typography variant="caption" sx={{ color: tones.primary, fontWeight: 600 }}>
                  {f.label}
                </Typography>
                <Typography variant="caption" sx={{ color, fontWeight: 700 }}>
                  {STATUS_LABEL[f.status]}
                </Typography>
              </Stack>
              <Typography
                variant="caption"
                sx={{ color: tones.secondary, display: 'block', lineHeight: 1.3 }}
              >
                {f.detail}
              </Typography>
            </Box>
          </Stack>
        );
      })}
    </Stack>
  );
}
