import { useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import { errorMessages } from '@app/data/sterennApi';
import { border, radius, size, surface, text, tone } from '../tokens';

export function ConfirmDialog({
  title,
  confirm_label,
  children,
  onCancel,
  onConfirm,
}: {
  title: string;
  confirm_label: string;
  children: ReactNode;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [is_busy, setIsBusy] = useState(false);
  const confirm = async () => {
    setIsBusy(true);
    try {
      await onConfirm();
    } catch (confirm_error) {
      setError(errorMessages(confirm_error).join('. '));
      setIsBusy(false);
    }
  };
  return (
    <Dialog
      open
      onClose={onCancel}
      slotProps={{ paper: { sx: { width: 460, maxWidth: '100%', bgcolor: surface.panel, border: `1px solid ${border.default}`, borderRadius: radius.xl, backgroundImage: 'none' } } }}
    >
      <Box sx={{ px: 3, pt: 2.5, color: text.primary, fontWeight: 700, fontSize: size.md }}>{title}</Box>
      <Box sx={{ px: 3, py: 2, color: text.secondary, fontSize: size.sm, lineHeight: 1.5 }}>
        {children}
        {error && <Box sx={{ color: tone.signal400, mt: 1.5 }}>{error}</Box>}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.25, px: 3, pb: 2.5 }}>
        <Button variant="text" color="inherit" onClick={onCancel}>Cancel</Button>
        <Button variant="contained" color="error" onClick={confirm} disabled={is_busy}>{confirm_label}</Button>
      </Box>
    </Dialog>
  );
}
