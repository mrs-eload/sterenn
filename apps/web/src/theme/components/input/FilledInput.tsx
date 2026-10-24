import type { Theme, Components } from '@mui/material/styles';

const FilledInput: Components<Omit<Theme, '@app/components'>>['MuiFilledInput'] = {
  styleOverrides: {
    root: {},
    input: {
      padding: 0,
    },
    sizeSmall: ({ theme }) => ({
      paddingLeft: theme.spacing(1.25),
    }),
  },
};

export default FilledInput;
