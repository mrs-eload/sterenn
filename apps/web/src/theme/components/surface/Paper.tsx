import type { Theme, Components } from '@mui/material/styles';
import { alpha, menuClasses } from '@mui/material';

const Paper: Components<Omit<Theme, '@app/components'>>['MuiPaper'] = {
  styleOverrides: {
    root: ({ theme }) => ({
      padding: theme.spacing(3.5),
      backgroundColor: theme.palette.info.main,
      boxShadow: theme.customShadows[0],
      borderRadius: Number(theme.shape.borderRadius) * 3,
      // A very dim hairline so cards have a defined edge against the background
      // without competing with their content.
      border: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,

      [`&.${menuClasses.paper}`]: {
        padding: theme.spacing(0),
      },
    }),
  },
};

export default Paper;
