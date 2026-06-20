import type { Theme, Components } from '@mui/material/styles';

const Toolbar: Components<Omit<Theme, '@app/components'>>['MuiToolbar'] = {
  styleOverrides: {
    root: {
      padding: '0 !important',
    },
  },
};

export default Toolbar;
