import type { Theme, Components } from '@mui/material/styles';
import simplebar from '../../styles/simplebar';
import scrollbar from '../../styles/scrollbar';
import echart from '../../styles/echart';

const CssBaseline: Components<Omit<Theme, '@app/components'>>['MuiCssBaseline'] = {
  defaultProps: {},
  styleOverrides: (theme) => ({
    '*, *::before, *::after': {
      margin: 0,
      padding: 0,
    },
    html: {
      scrollBehavior: 'smooth',
    },
    body: {
      fontVariantLigatures: 'none',
      backgroundColor: theme.palette.info.darker,
      // The design's --bg-app-gradient: a faint navy glow from the top left so
      // panels sit on a lit canvas instead of flat black. Fixed so it frames
      // the viewport rather than stretching down long pages.
      backgroundImage: 'radial-gradient(120% 140% at 18% -10%, #101c2c 0%, #070c14 55%)',
      backgroundAttachment: 'fixed',
      ...scrollbar(theme),
    },
    ...simplebar(theme),
    ...echart(),
  }),
};

export default CssBaseline;
