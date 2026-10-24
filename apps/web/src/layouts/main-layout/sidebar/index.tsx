import type { Dispatch, SetStateAction } from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import DrawerItems from './DrawerItems';

interface SidebarProps {
  mobileOpen: boolean;
  setMobileOpen: Dispatch<SetStateAction<boolean>>;
  setIsClosing: Dispatch<SetStateAction<boolean>>;
}

/**
 * The sidebar exists only on mobile: a temporary drawer holding the section
 * nav, opened from the top bar's menu button. On desktop the nav lives in the
 * top bar instead, so there's nothing persistent to render here.
 */
const Sidebar = ({ mobileOpen, setMobileOpen, setIsClosing }: SidebarProps) => {
  const handleDrawerClose = () => {
    setIsClosing(true);
    setMobileOpen(false);
  };

  const handleDrawerTransitionEnd = () => {
    setIsClosing(false);
  };

  return (
    <Box component="nav" sx={{ display: { lg: 'none' } }}>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onTransitionEnd={handleDrawerTransitionEnd}
        onClose={handleDrawerClose}
        ModalProps={{ keepMounted: true }}
      >
        <DrawerItems onNavigate={handleDrawerClose} />
      </Drawer>
    </Box>
  );
};

export default Sidebar;
