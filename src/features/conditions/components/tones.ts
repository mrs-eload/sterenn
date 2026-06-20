import type { Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';

/**
 * Text/decoration tones for the verdict card. They flip depending on whether the
 * card is on the bright GO gradient (white-on-colour) or the calm dark surface,
 * so the card and its section components stay legible either way. Kept as one
 * pure helper so that flip lives in a single place.
 */
export interface CardTones {
  primary: string;
  secondary: string;
  /** Track colour behind the mini progress bars. */
  track: string;
}

export function cardTones(theme: Theme, isGo: boolean): CardTones {
  const white = theme.palette.common.white;
  return {
    primary: isGo ? white : theme.palette.text.primary,
    secondary: isGo ? alpha(white, 0.72) : theme.palette.text.secondary,
    track: isGo ? alpha(white, 0.22) : alpha(theme.palette.text.primary, 0.08),
  };
}
