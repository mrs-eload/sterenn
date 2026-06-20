import type { Theme, Components } from '@mui/material/styles';

const Chip: Components<Omit<Theme, '@app/components'>>['MuiChip'] = {
  styleOverrides: {
    root: ({ theme }) => ({
      margin: 0,
      border: 1,
      borderStyle: 'solid',
      borderRadius: Number(theme.shape.borderRadius) / 2,
    }),
    sizeSmall: ({ theme }) => ({
      height: 20,
      fontSize: theme.typography.caption.fontSize,
    }),
    sizeMedium: ({ theme }) => ({
      height: 28,
      fontSize: theme.typography.body1.fontSize,
    }),
    label: {
      paddingLeft: 2,
      paddingRight: 2
    }
  },
};

export default Chip;
