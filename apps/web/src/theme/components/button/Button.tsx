import type { Theme, Components } from '@mui/material/styles';

const Button: Components<Omit<Theme, '@app/components'>>['MuiButton'] = {
  defaultProps: {
    disableElevation: true,
  },
  styleOverrides: {
    root: ({ theme }) => ({
      color: theme.palette.text.primary,
      borderRadius: theme.shape.borderRadius,
      textTransform: 'initial',
      letterSpacing: 0.5,
      // Bold, as in the design's Button: at 500 the dark text on amber is too thin to read.
      fontWeight: 700,
    }),
    // root sets light text for outlined/text buttons on the dark canvas; a
    // filled button takes its palette's contrastText instead.
    contained: ({ theme, ownerState }) => ({
      ...(ownerState.color &&
        ownerState.color !== 'inherit' && {
          color: theme.palette[ownerState.color].contrastText,
          // ButtonBase clears every hover background to transparent; a filled
          // button must keep its fill, lightened as in the design.
          '&:hover': { backgroundColor: theme.palette[ownerState.color].light },
        }),
      '&.Mui-disabled': {
        color: theme.palette.text.secondary,
        background: theme.palette.text.disabled,
      },
    }),
    outlined: ({ theme }) => ({
      '&.Mui-disabled': {
        color: theme.palette.text.disabled,
        borderColor: theme.palette.text.disabled,
      },
    }),
    text: ({ theme }) => ({
      '&.Mui-disabled': {
        color: theme.palette.text.disabled,
      },
    }),
    sizeLarge: ({ theme }) => ({
      padding: theme.spacing(1.25, 2.25),
      fontSize: theme.typography.button.fontSize,
    }),
    sizeMedium: ({ theme }) => ({
      padding: theme.spacing(1, 1.5),
      fontSize: theme.typography.subtitle2.fontSize,
    }),
    sizeSmall: ({ theme }) => ({
      padding: theme.spacing(0.875, 1.15),
      fontSize: theme.typography.caption.fontSize,
    }),
  },
};

export default Button;
