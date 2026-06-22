import { fontFamily } from '@app/theme/typography';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Toolbar from '@mui/material/Toolbar';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import IconifyIcon from '@app/components/base/IconifyIcon';
import Image from '@app/components/base/Image';
import LanguageSelect from './LanguageSelect';
import ProfileMenu from './ProfileMenu';
import Logo from '@app/assets/images/logo.png';

interface TopbarProps {
  isClosing: boolean;
  mobileOpen: boolean;
  setMobileOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const Topbar = ({ isClosing, mobileOpen, setMobileOpen }: TopbarProps) => {
  const handleDrawerToggle = () => {
    if (!isClosing) {
      setMobileOpen(!mobileOpen);
    }
  };

  return (
    <Stack sx={{ alignItems: 'center', justifyContent: 'space-between', mb: { xs: 0, lg: 1 } }}>
      <Stack spacing={2} sx={{ alignItems: 'center' }}>
        <Toolbar sx={{ display: 'flex' }}>
          <IconButton
            size="medium"
            edge="start"
            color="inherit"
            aria-label="menu"
            onClick={handleDrawerToggle}
          >
            <IconifyIcon icon="mingcute:menu-line" />
          </IconButton>
        </Toolbar>

        <ButtonBase
          component={Link}
          href="/"
          disableRipple
          sx={{ display: { xm: 'block', lg: 'none' } }}
        >
          <Image src={Logo} alt="logo" height={24} width={24} />
        </ButtonBase>

        <Typography
          variant="h5"
          sx={{
            fontWeight: 600,
            letterSpacing: 1,
            fontFamily: fontFamily.workSans,
            display: { xs: 'none', lg: 'block' },
          }}
        >
          Weather forecast
        </Typography>
      </Stack>

      <Stack spacing={1} sx={{ alignItems: 'center' }}>
        <LanguageSelect />

        <Tooltip title="Notifications">
          <IconButton size="large" sx={{ color: 'text.secondary' }}>
            <IconifyIcon icon="ion:notifications" />
          </IconButton>
        </Tooltip>

        <ProfileMenu />
      </Stack>
    </Stack>
  );
};

export default Topbar;
