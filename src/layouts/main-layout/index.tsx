import { useState, PropsWithChildren } from 'react';
import Stack from '@mui/material/Stack';
import Sidebar from './sidebar';
import Topbar from './topbar';
import Footer from './Footer';

const MainLayout = ({ children }: PropsWithChildren) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  return (
    <Stack direction="column" sx={{ width: 1, minHeight: '100vh' }}>
      {/* Full-width top bar holds the brand + section nav across the whole app. */}
      <Topbar isClosing={isClosing} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      {/* Mounts the mobile nav drawer (a portal); invisible until opened. */}
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} setIsClosing={setIsClosing} />

      <Stack
        component="main"
        direction="column"
        sx={{
          p: { xs: 2, sm: 3, lg: 5 },
          gap: { xs: 2.5, sm: 3, lg: 3.75 }, // 'spacing' maps to 'gap' inside 'sx'
          width: 1,
          flexGrow: 1,
        }}
      >
        {children}
        <Footer />
      </Stack>
    </Stack>
  );
};

export default MainLayout;
