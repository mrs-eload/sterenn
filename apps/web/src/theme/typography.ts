import type { TypographyVariantsOptions } from '@mui/material/styles';

export const fontFamily = {
  // Region Bretagne is registered via @font-face in src/index.css; the trailing
  // sans-serif is the load fallback. It's the app's single typeface.
  bretagne: ['Region Bretagne', 'sans-serif'].join(','),
};

const typography: TypographyVariantsOptions = {
  fontFamily: fontFamily.bretagne,
  h1: {
    fontSize: '3rem',
    fontWeight: 700,
  },
  h2: {
    fontSize: '2.25rem',
    fontWeight: 700,
  },
  h3: {
    fontSize: '1.75rem',
    fontWeight: 700,
  },
  h4: {
    fontSize: '1.5rem',
    fontWeight: 700,
  },
  h5: {
    fontSize: '1.25rem',
    fontWeight: 700,
  },
  h6: {
    fontSize: '1.125rem',
    fontWeight: 700,
  },
  subtitle1: {
    fontSize: '1rem',
    fontWeight: 400,
  },
  subtitle2: {
    fontSize: '0.875rem',
    fontWeight: 500,
  },
  body1: {
    fontSize: '1rem',
    fontWeight: 400,
  },
  body2: {
    fontSize: '0.875rem',
    fontWeight: 400,
  },
  caption: {
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  button: {
    fontSize: '1rem',
    fontWeight: 500,
  },
};

export default typography;
