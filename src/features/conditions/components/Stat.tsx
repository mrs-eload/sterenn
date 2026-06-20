import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconifyIcon from '@app/components/base/IconifyIcon';

/**
 * Small presentational primitives shared by the verdict card's section
 * components (WindowComponent, MoonPhaseComponent). Tone colours are passed in
 * so the same row reads correctly on both the dark surface and the GO gradient.
 */
export interface StatProps {
  icon: string;
  label: string;
  value: string;
  tonePrimary: string;
  toneSecondary: string;
}

/** Icon + label on the left, value on the right — reads well down a column. */
export function Stat({ icon, label, value, tonePrimary, toneSecondary }: StatProps) {
  return (
    <Stack
      direction="row"
      spacing={2}
      sx={{ justifyContent: 'space-between', alignItems: 'center' }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <IconifyIcon icon={icon} sx={{ fontSize: 16, color: toneSecondary }} />
        <Typography variant="caption" sx={{ color: toneSecondary }}>
          {label}
        </Typography>
      </Stack>
      <Typography
        variant="body1"
        sx={{ color: tonePrimary, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

/** Slim horizontal progress bar — fraction of a column-width track. */
export function MiniBar({ pct, fill, track }: { pct: number; fill: string; track: string }) {
  return (
    <Box sx={{ mt: 1, height: 6, borderRadius: 3, overflow: 'hidden', bgcolor: track }}>
      <Box
        sx={{
          width: `${Math.max(0, Math.min(100, pct))}%`,
          height: 1,
          borderRadius: 3,
          bgcolor: fill,
        }}
      />
    </Box>
  );
}
