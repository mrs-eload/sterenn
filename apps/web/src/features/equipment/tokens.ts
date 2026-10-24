// Design tokens of the Sterenn design system (Claude Design project,
// tokens/colors.css + spacing.css) used by the equipment screens. The MUI
// theme already follows the same palette; these are the finer surface and
// border steps it has no slot for.

export const ink = {
  950: '#070c14',
  900: '#0b111c',
  850: '#101826',
  800: '#16202f',
  750: '#1c2839',
  700: '#253347',
  600: '#384860',
  500: '#566b83',
  400: '#8a97a8',
  300: '#aeb9c7',
  50: '#f6f8fa',
};

export const tone = {
  amber600: '#b8791f',
  amber500: '#e0982e',
  amber400: '#edb457',
  cyan300: '#9adcf0',
  signal500: '#d1573a',
  signal400: '#e2795f',
  green500: '#2fa27d',
};

export const surface = {
  panel: ink[900],
  card: ink[850],
  cardAlt: ink[800],
  hover: ink[750],
  inset: 'rgba(7, 12, 20, 0.6)',
  selected: 'rgba(224, 152, 46, 0.10)',
  selectedBorder: 'rgba(224, 152, 46, 0.55)',
  warningBg: 'rgba(224, 152, 46, 0.16)',
  successBg: 'rgba(47, 162, 125, 0.16)',
  dangerBg: 'rgba(209, 87, 58, 0.18)',
};

export const border = {
  subtle: 'rgba(174, 185, 199, 0.12)',
  default: 'rgba(174, 185, 199, 0.2)',
  strong: ink[600],
};

export const text = {
  primary: ink[50],
  secondary: ink[300],
  muted: ink[400],
};

export const radius = { sm: '8px', md: '12px', lg: '16px', xl: '20px' };

export const fontMono = "'IBM Plex Mono', ui-monospace, 'SF Mono', monospace";

// One step above the design's --text-* scale: the design sets body text in
// Public Sans, the app sets everything in Region Bretagne, whose small x-height
// makes the same pixel size read about two sizes smaller.
export const size = { xs: 14, sm: 15, base: 17, md: 19, lg: 22, xl: 26, xxl: 34 };

export const trackingWide = '0.06em';
