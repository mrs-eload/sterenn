import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

/**
 * Weather-model selector. Dumb: it shows the models the hook says are available
 * and reports the chosen id back up. It does not know what a model *is*.
 */
export interface ModelPickerProps {
  models: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}

export function ModelPicker({ models, value, onChange }: ModelPickerProps) {
  if (models.length === 0) return null;
  return (
    <Box>
      <Typography variant="overline" color="text.secondary">
        Weather model
      </Typography>
      <ToggleButtonGroup
        value={value}
        exclusive
        size="small"
        onChange={(_, next) => {
          // null when the active button is clicked again — keep the selection.
          if (next !== null) onChange(next);
        }}
        sx={{ flexWrap: 'wrap', gap: 1, '& .MuiToggleButton-root': { border: 1 } }}
      >
        {models.map((m) => (
          <ToggleButton key={m.id} value={m.id} sx={{ textTransform: 'none' }}>
            {m.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
}
