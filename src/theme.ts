import { createTheme } from '@mui/material/styles';

/**
 * Dark theme — this is an app you stare at in the dark before/while observing,
 * so the palette is deliberately low-glare. The verdict colours (clear/cloud/
 * precip) are defined once here as custom palette entries so every component
 * (hourly table, window bar, sky curve) reads from the same source of truth and
 * can't drift apart.
 *
 * We don't ship the Roboto font package; the stack falls back to system fonts.
 */
declare module '@mui/material/styles' {
  interface Palette {
    verdict: { clear: string; cloud: string; precip: string };
  }
  interface PaletteOptions {
    verdict?: { clear: string; cloud: string; precip: string };
  }
}

export const theme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: '#0b0e14', paper: '#141925' },
    primary: { main: '#6ea8fe' },
    // clear = usable green, cloud = bridged/iffy amber, precip = hard-stop red.
    verdict: { clear: '#3fb950', cloud: '#d29922', precip: '#f85149' },
  },
  typography: {
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  shape: { borderRadius: 10 },
});
