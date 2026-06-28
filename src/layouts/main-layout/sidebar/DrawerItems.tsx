import { NavLink, Link as RouterLink } from 'react-router';
import Stack from '@mui/material/Stack';
import List from '@mui/material/List';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText, { listItemTextClasses } from '@mui/material/ListItemText';
import IconifyIcon from '@app/components/base/IconifyIcon';
import { Logo5 as Logo } from '@app/theme/icons/Logo5';
import { fontFamily } from '@app/theme/typography';
import navItems from '@app/routes/sitemap';

interface DrawerItemsProps {
  /** Called after any nav choice, so the drawer closes itself on selection. */
  onNavigate?: () => void;
}

/**
 * Contents of the mobile navigation drawer: the brand, then the same section
 * list the desktop top bar shows — just stacked vertically. Same `navItems`
 * source and the same NavLink `.active` styling, so the two stay in lockstep.
 */
const DrawerItems = ({ onNavigate }: DrawerItemsProps) => {
  return (
    <Stack direction="column" sx={{ height: 1 }}>
      <Stack direction="row" sx={{ alignItems: 'center', px: 3, py: 3 }}>
        <ButtonBase
          component={RouterLink}
          to="/"
          onClick={onNavigate}
          disableRipple
          aria-label="Sterenn — home"
          sx={{ alignItems: 'center', gap: 1 }}
        >
          <Logo
            sx={{ fontSize: 30, color: 'text.primary' }}
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
      </Stack>

      <List component="nav" sx={{ px: 2 }}>
        {navItems.map((item) => (
          <ListItemButton
            key={item.id}
            component={NavLink}
            to={item.path}
            end={item.end}
            onClick={onNavigate}
            sx={{
              mb: 0.5,
              borderRadius: 2,
              color: 'text.secondary',
              '& .MuiListItemIcon-root': { color: 'inherit' },
              [`& .${listItemTextClasses.primary}`]: { color: 'inherit' },
              '&.active': { color: 'primary.main', bgcolor: 'info.dark' },
            }}
          >
            <ListItemIcon>
              <IconifyIcon icon={item.icon} />
            </ListItemIcon>
            <ListItemText primary={item.title} />
          </ListItemButton>
        ))}
      </List>
    </Stack>
  );
};

export default DrawerItems;
