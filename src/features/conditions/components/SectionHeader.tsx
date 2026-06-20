import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import IconifyIcon from '@app/components/base/IconifyIcon';

/**
 * Shared header for the conditions widgets: a tinted icon tile + title, with an
 * optional right-aligned action/legend slot. Lives in the feature (used by four
 * widgets here) rather than a global shared/ — promote on a second feature, per
 * CLAUDE.md.
 */
export interface SectionHeaderProps {
  icon: string;
  title: string;
  action?: ReactNode;
}

export function SectionHeader({ icon, title, action }: SectionHeaderProps) {
  return (
    <Stack
      direction="row"
      sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
        <Box
          sx={{
            display: 'grid',
            placeItems: 'center',
            width: 30,
            height: 30,
            borderRadius: 1.5,
            color: 'primary.main',
            bgcolor: (t) => alpha(t.palette.primary.main, 0.14),
          }}
        >
          <IconifyIcon icon={icon} sx={{ fontSize: 18 }} />
        </Box>
        <Typography variant="subtitle1" sx={{ color: 'text.secondary', fontWeight: 500 }}>
          {title}
        </Typography>
      </Stack>
      {action}
    </Stack>
  );
}
