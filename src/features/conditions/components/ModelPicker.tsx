import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import { SectionHeader } from './SectionHeader.tsx';

/**
 * Weather-model selector. Dumb: it shows the models the hook says are available
 * and reports the chosen id back up. It does not know what a model *is*. Uses the
 * themed Button (contained = active, outlined = the rest) instead of a toggle
 * group so it matches the dashboard's button language.
 */
export interface ModelPickerProps {
  models: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}

export function ModelPicker({ models, value, onChange }: ModelPickerProps) {
  if (models.length === 0) return null;
  return (
    <Paper>
      <SectionHeader icon="mingcute:cloud-line" title="Weather model" />
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
        {models.map((m) => {
          const active = m.id === value;
          return (
            <Button
              key={m.id}
              size="small"
              variant={active ? 'contained' : 'outlined'}
              color={active ? 'primary' : 'secondary'}
              onClick={() => onChange(m.id)}
            >
              {m.label}
            </Button>
          );
        })}
      </Stack>
    </Paper>
  );
}
