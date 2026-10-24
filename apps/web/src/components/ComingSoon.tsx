import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconifyIcon from '@app/components/base/IconifyIcon';

interface ComingSoonProps {
  /** Section name, shown as the heading. */
  title: string;
  /** Iconify icon for the section (same one the nav uses). */
  icon: string;
  /** One line on what this section will hold. */
  blurb: string;
}

/**
 * Placeholder for a section that's navigable but not built yet. Keeps the
 * redesigned nav fully functional today — every link lands somewhere real —
 * so each section can be filled in later without touching the chrome.
 */
const ComingSoon = ({ title, icon, blurb }: ComingSoonProps) => {
  return (
    <Paper sx={{ flexGrow: 1 }}>
      <Stack
        direction="column"
        spacing={2}
        sx={{ alignItems: 'center', justifyContent: 'center', py: 12, px: 3, textAlign: 'center' }}
      >
        <IconifyIcon icon={icon} sx={{ fontSize: 48, color: 'text.secondary' }} />
        <Typography variant="h4">{title}</Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 440 }}>
          {blurb}
        </Typography>
        <Typography variant="caption" color="text.disabled" sx={{ letterSpacing: 1 }}>
          COMING SOON
        </Typography>
      </Stack>
    </Paper>
  );
};

export default ComingSoon;
