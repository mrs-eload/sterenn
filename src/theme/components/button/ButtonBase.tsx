import type { Theme, Components } from '@mui/material/styles';

const ButtonBase: Components<Omit<Theme, '@app/components'>>['MuiButtonBase'] = {
  defaultProps: {
    disableRipple: false,
  },
  styleOverrides: {
    root: {
      '&:hover': {
        backgroundColor: 'transparent',
      },
    },
  },
};

export default ButtonBase;
