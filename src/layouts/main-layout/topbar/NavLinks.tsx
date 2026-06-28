import { NavLink } from 'react-router';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import navItems from '@app/routes/sitemap';

/**
 * The horizontal section nav for the desktop top bar. Each link is a
 * react-router NavLink, which stamps an `.active` class on the matching route's
 * element — so the active styling is pure CSS (`&.active`), no `useLocation`
 * bookkeeping. `end` keeps the index ('/') link from matching every path.
 */
const NavLinks = () => {
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
      {navItems.map((item) => (
        <Box
          key={item.id}
          component={NavLink}
          to={item.path}
          end={item.end}
          sx={{
            px: 1.75,
            py: 0.875,
            borderRadius: 2,
            fontSize: '0.9375rem',
            fontWeight: 500,
            lineHeight: 1.5,
            color: 'text.secondary',
            textDecoration: 'none',
            transition: 'color 0.2s ease, background-color 0.2s ease',
            '&:hover': { color: 'text.primary', bgcolor: 'info.dark' },
            '&.active': { color: 'primary.main', bgcolor: 'info.dark' },
          }}
        >
          {item.title}
        </Box>
      ))}
    </Stack>
  );
};

export default NavLinks;
