import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { MoonPhase } from '@app/features/conditions/components/MoonPhase';
import { moonPhaseName } from '@app/core/sky';

/**
 * TEMPORARY visual check for the moon-phase glyph — not part of the app. Renders
 * the full synodic cycle with dummy data so the terminator/limb can be eyeballed.
 * Delete this file and its `/moon-demo` route once verified.
 *
 * Illumination is derived from phase the way suncalc does it,
 * f = (1 − cos(2π·phase)) / 2, so each tile is internally consistent.
 */
const STEPS = 17;

export default function MoonPhaseDemo() {
  const tiles = Array.from({ length: STEPS }, (_, i) => {
    const phase = i / (STEPS - 1);
    const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2;
    return { phase, illumination };
  });

  return (
    <Paper>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Moon phase glyph — dummy data
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Waxing (phase &lt; 0.5) should light the <strong>right</strong> limb and grow
        to full; waning (&gt; 0.5) lights the <strong>left</strong> limb and shrinks.
        Northern-hemisphere convention.
      </Typography>
      <Grid container spacing={2}>
        {tiles.map(({ phase, illumination }) => (
          <Grid key={phase} size={{ xs: 4, sm: 3, md: 2 }}>
            <Stack spacing={1} sx={{ alignItems: 'center' }}>
              <MoonPhase phase={phase} illumination={illumination} size={72} />
              <Stack spacing={0} sx={{ alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: 'text.primary' }}>
                  {moonPhaseName(phase)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  phase {phase.toFixed(2)} · {Math.round(illumination * 100)}%
                </Typography>
              </Stack>
            </Stack>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
}
