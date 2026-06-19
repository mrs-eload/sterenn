import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import type { ClassifiedHour, HourVerdict } from '../../../core/sky';
import { formatClock } from '../format.ts';

/**
 * Per-hour breakdown — the "show why, not just a checkmark" table. Each row is
 * already classified by core/; this only renders time, cloud %, and a coloured
 * verdict dot.
 */
export interface HourlyTableProps {
  hours: ClassifiedHour[];
}

const VERDICT_LABEL: Record<HourVerdict, string> = {
  clear: 'Clear',
  cloud: 'Cloudy',
  precip: 'Precip',
};

export function HourlyTable({ hours }: HourlyTableProps) {
  const theme = useTheme();
  if (hours.length === 0) return null;

  const colorFor = (v: HourVerdict) =>
    v === 'clear'
      ? theme.palette.verdict.clear
      : v === 'precip'
        ? theme.palette.verdict.precip
        : theme.palette.verdict.cloud;

  return (
    <Box>
      <Typography variant="overline" color="text.secondary">
        Hour by hour
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Time</TableCell>
            <TableCell align="right">Cloud</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {hours.map((h) => (
            <TableRow key={h.time}>
              <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatClock(h.time)}
              </TableCell>
              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {h.cloudCover}%
              </TableCell>
              <TableCell>
                <Box
                  component="span"
                  sx={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: colorFor(h.verdict),
                    mr: 1,
                    verticalAlign: 'middle',
                  }}
                />
                {VERDICT_LABEL[h.verdict]}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
