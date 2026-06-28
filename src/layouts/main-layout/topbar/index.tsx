import { Link as RouterLink } from 'react-router';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import IconifyIcon from '@app/components/base/IconifyIcon';
import { fontFamily } from '@app/theme/typography';
import { Logo5 as Logo } from '@app/theme/icons/Logo5';
import NavLinks from './NavLinks';

interface TopbarProps {
  isClosing: boolean;
  mobileOpen: boolean;
  setMobileOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * The app's only persistent chrome: a full-width top bar holding the brand and,
 * on desktop, the section nav. Below `lg` the links collapse into the mobile
 * drawer (see ../sidebar), reached via the menu button here. Sticky so the nav
 * stays put as the dashboard scrolls.
 */
const Topbar = ({ isClosing, mobileOpen, setMobileOpen }: TopbarProps) => {
  const handleDrawerToggle = () => {
    // Guard against toggling open again mid-close, which would flicker the drawer.
    if (!isClosing) {
      setMobileOpen(!mobileOpen);
    }
  };

  return (
    <Box
      component="header"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        bgcolor: 'info.darker',
        borderBottom: 1,
        borderColor: 'info.main',
      }}
    >
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          px: { xs: 2, sm: 3, lg: 5 },
          py: { xs: 1.5, lg: 2 },
        }}
      >
        {/* Brand, then the desktop section nav right beside it. */}
        <Stack direction="row" spacing={{ xs: 0, lg: 4 }} sx={{ alignItems: 'center', minWidth: 0 }}>
          <ButtonBase
            component={RouterLink}
            to="/"
            disableRipple
            aria-label="Sterenn — home"
            sx={{ alignItems: 'center', gap: 1 }}
          >
            <Logo
              sx={{ fontSize: 32, color: 'text.primary' }}
              letterColor="currentColor"
              ringColor="currentColor"
            />
            <Typography
              variant="h5"
              sx={{
                fontWeight: 600,
                letterSpacing: 1,
                fontFamily: fontFamily.workSans,
                color: 'text.primary',
              }}
            >
              Sterenn
            </Typography>
          </ButtonBase>

          <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
            <NavLinks />
          </Box>
        </Stack>

        {/* Mobile-only: opens the section drawer. */}
        <IconButton
          aria-label="open navigation"
          onClick={handleDrawerToggle}
          sx={{ display: { xs: 'inline-flex', lg: 'none' }, color: 'text.secondary' }}
        >
          <IconifyIcon icon="mingcute:menu-line" />
        </IconButton>
      </Stack>
    </Box>
  );
};

export default Topbar;
