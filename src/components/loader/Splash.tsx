import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';

const Splash = () => {
  return (
    <Stack sx={{ alignItems: 'center', justifyContent: 'center', width: 1, height: '100vh' }}>
      <CircularProgress />
    </Stack>
  );
};

export default Splash;
