import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import TextField, { type TextFieldProps } from '@mui/material/TextField';
import type { SxProps, Theme } from '@mui/material/styles';
import type { EquipmentType } from '@sterenn/shared';
import IconifyIcon from '@app/components/base/IconifyIcon';
import { TYPE_ICON } from '../format';
import { border, radius, size, surface, text, tone, trackingWide } from '../tokens';

// The design system's Card, Badge, Chip and type badge, rebuilt on MUI Box so
// the equipment screens match the Claude Design kit.

export function Panel({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Box
      sx={[
        {
          bgcolor: surface.card,
          border: `1px solid ${border.subtle}`,
          borderRadius: radius.lg,
          p: 3,
          boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset, 0 12px 32px rgba(0,0,0,0.35)',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
}

export function SectionLabel({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Box
      sx={[
        {
          color: text.muted,
          fontSize: size.xs,
          fontWeight: 700,
          letterSpacing: trackingWide,
          textTransform: 'uppercase',
          mb: 1.25,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
}

// The design system's Input / Select: a static uppercase label above a box.
// MUI's floating label is not used: the app theme moves border and padding
// onto InputBase (see theme/components/input), which leaves a floating label
// off-centre. So the label is rendered here and the field always fills its cell.
export function Field({ label, sx, slotProps, ...props }: Omit<TextFieldProps, 'label' | 'size'> & { label?: ReactNode }) {
  return (
    <Box component="label" sx={[{ display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {label && (
        <Box component="span" sx={{ fontSize: size.xs, color: text.muted, letterSpacing: trackingWide, textTransform: 'uppercase' }}>
          {label}
        </Box>
      )}
      <TextField
        {...props}
        // displayEmpty: otherwise MUI renders an empty value ('' = "None",
        // "Choose a mount") as a blank box instead of its menu item's text.
        slotProps={{ ...slotProps, select: { displayEmpty: true, ...(slotProps?.select as object | undefined) } }}
        fullWidth
        sx={{
          boxShadow: 'none',
          '& .MuiInputBase-root': {
            bgcolor: `${surface.cardAlt} !important`,
            border: `1px solid ${border.default}`,
            borderRadius: radius.md,
            px: '14px',
            py: '10px',
            fontSize: size.base,
            color: text.primary,
            transition: 'border-color 120ms',
          },
          '& .MuiInputBase-root.Mui-focused': { borderColor: tone.cyan300 },
          '& .MuiInputBase-input': { p: 0, lineHeight: 1.5, height: 'auto' },
          '& .MuiSelect-select': { pr: '28px !important', minHeight: 0 },
          '& .MuiSelect-icon': { right: 10, color: text.muted },
          '& fieldset': { display: 'none' },
        }}
      />
    </Box>
  );
}

export function Rule({ my = 2 }: { my?: number }) {
  return <Box sx={{ borderTop: `1px solid ${border.subtle}`, my }} />;
}

export function TypeIcon({ type, size: icon_size = 20 }: { type: EquipmentType; size?: number }) {
  return <IconifyIcon icon={TYPE_ICON[type]} sx={{ fontSize: icon_size, flexShrink: 0 }} />;
}

export function TypeBadge({ type, active = false, size: badge_size = 34 }: { type: EquipmentType; active?: boolean; size?: number }) {
  return (
    <Box
      component="span"
      sx={{
        width: badge_size,
        height: badge_size,
        flexShrink: 0,
        borderRadius: radius.md,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: active ? surface.warningBg : surface.cardAlt,
        color: active ? tone.amber400 : tone.cyan300,
        border: `1px solid ${border.subtle}`,
      }}
    >
      <TypeIcon type={type} size={badge_size > 40 ? 28 : 20} />
    </Box>
  );
}

const BADGE_TONES = {
  neutral: { color: text.secondary, bg: surface.cardAlt },
  success: { color: tone.green500, bg: surface.successBg },
  warning: { color: tone.amber400, bg: surface.warningBg },
  danger: { color: tone.signal400, bg: surface.dangerBg },
};

export function Badge({ tone: badge_tone, children }: { tone: keyof typeof BADGE_TONES; children: ReactNode }) {
  const colors = BADGE_TONES[badge_tone];
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1.25,
        py: 0.375,
        borderRadius: '999px',
        fontSize: size.xs,
        fontWeight: 700,
        color: colors.color,
        bgcolor: colors.bg,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </Box>
  );
}

export function FilterChip({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.75,
        height: 34,
        flexShrink: 0,
        borderRadius: '999px',
        fontSize: size.sm,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        color: active ? tone.amber400 : text.secondary,
        bgcolor: active ? surface.warningBg : 'transparent',
        border: `1px solid ${active ? surface.selectedBorder : border.default}`,
        transition: 'background-color 120ms, color 120ms',
        '&:hover': { bgcolor: active ? surface.warningBg : surface.cardAlt },
      }}
    >
      {icon}
      {children}
    </ButtonBase>
  );
}

// Small amber/cyan/... dot used next to rig names.
export function Dot({ color, size: dot_size = 8 }: { color: string; size?: number }) {
  return <Box component="span" sx={{ width: dot_size, height: dot_size, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />;
}

export function PageTitle({ children }: { children: ReactNode }) {
  return <Box sx={{ color: text.primary, fontWeight: 900, fontSize: size.xxl, lineHeight: 1.05 }}>{children}</Box>;
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <Box sx={{ color: text.primary, fontWeight: 900, fontSize: size.xl, lineHeight: 1.1 }}>{children}</Box>;
}

export function EmptyText({ children }: { children: ReactNode }) {
  return <Box sx={{ color: text.muted, fontSize: size.sm }}>{children}</Box>;
}
