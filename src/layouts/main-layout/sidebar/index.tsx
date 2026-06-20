import type { Dispatch, SetStateAction } from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import ProfileMenu from "@app/layouts/main-layout/topbar/ProfileMenu.tsx";
interface SidebarProps {
  mobileOpen: boolean;
  setMobileOpen: Dispatch<SetStateAction<boolean>>;
  setIsClosing: Dispatch<SetStateAction<boolean>>;
}

const Sidebar = ({ mobileOpen, setMobileOpen, setIsClosing }: SidebarProps) => {
  const handleDrawerClose = () => {
    setIsClosing(true);
    setMobileOpen(false);
  };

  const handleDrawerTransitionEnd = () => {
    setIsClosing(false);
  };

  return (
    <Box component="nav">
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onTransitionEnd={handleDrawerTransitionEnd}
        onClose={handleDrawerClose}
        ModalProps={{ keepMounted: true }}
      >
        <ProfileMenu />
      </Drawer>
    </Box>
  );
};

export default Sidebar;
