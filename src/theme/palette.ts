import type { PaletteColorOptions, PaletteOptions } from '@mui/material/styles';
import {
  grey, red, green, blue, cyan, amber,
  transparentRed, transparentGreen, transparentYellow,
} from './colors';
declare module '@mui/material/styles' {
  interface PaletteOptions {
    verdict?: { clear: string; cloud: string; precip: string };
    neutral?: PaletteColorOptions;
    transparent?: { success: PaletteColorOptions; warning: PaletteColorOptions; error: PaletteColorOptions };
    gradients?: { primary: PaletteColorOptions };
  }
  interface SimplePaletteColorOptions { lighter?: string; darker?: string; state?: string; }
  interface Palette {
    verdict?: { clear: string; cloud: string; precip: string };
    neutral: PaletteColor;
    gradients: { primary: PaletteColor };
    transparent: { success: PaletteColor; warning: PaletteColor; error: PaletteColor };
  }
  interface PaletteColor { lighter: string; darker: string; state: string; }
}

// Sterenn v4 theme — near-black navy canvas. One warm amber accent for
// brand/primary + hero stats, cyan for secondary/reference lines, signal
// red-orange for danger only, green for Go/success only.
const palette: PaletteOptions = {
  verdict: { clear: green[500], cloud: amber[500], precip: red[500] },
  neutral: { lighter: grey[100], light: grey[200], main: grey[300], dark: grey[400], darker: grey[600] },
  primary: { main: amber[500], light: amber[400], dark: amber[600] },
  secondary: { lighter: cyan[200], light: cyan[400], main: cyan[500], dark: cyan[600], darker: cyan[700] },
  info: {
    main: blue[600],
    dark: blue[700],
    darker: blue[800],
  },
  success: { main: green[500] },
  warning: { main: amber[500] },
  error: { main: red[500] },
  background: { default: blue[700], paper: blue[600] },
  text: { primary: grey[50], secondary: grey[300], disabled: grey[500] },
  gradients: { primary: { main: amber[500], state: amber[400] } },
  transparent: {
    success: { main: transparentGreen[500] },
    warning: { main: transparentYellow[500] },
    error: { main: transparentRed[500] },
  },
};

export default palette;