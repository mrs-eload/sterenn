import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import DataGridFooter from '@app/components/common/DataGridFooter';
import IconifyIcon from '@app/components/base/IconifyIcon';
import type { ClassifiedHour, HourVerdict } from '../../../core/sky';
import { formatClock } from '../format.ts';
import { SectionHeader } from './SectionHeader.tsx';

/**
 * Per-hour breakdown — the "show why, not just a checkmark" table. Each row is
 * already classified by core/; this only renders time, cloud %, and a coloured
 * verdict dot. Built on the theme's DataGrid so it matches the dashboard's other
 * tables (transparent rows, themed footer pagination).
 */
export interface HourlyTableProps {
  hours: ClassifiedHour[];
}

const VERDICT_LABEL: Record<HourVerdict, string> = {
  clear: 'Clear',
  cloud: 'Cloudy',
  precip: 'Precip',
};

const VERDICT_ICON: Record<HourVerdict, string> = {
  clear: 'mingcute:check-circle-fill',
  cloud: 'mingcute:cloud-fill',
  precip: 'mingcute:umbrella-fill',
};

const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 40;
const FOOTER_HEIGHT = 72;

export function HourlyTable({ hours }: HourlyTableProps) {
  const theme = useTheme();
  if (hours.length === 0) return null;

  // Each verdict gets a tinted pill: the theme's translucent signal colour as the
  // background, the solid verdict colour for text + icon.
  const chipStyle = (v: HourVerdict) => {
    const fg =
      v === 'clear'
        ? theme.palette.verdict?.clear
        : v === 'precip'
          ? theme.palette.verdict?.precip
          : theme.palette.verdict?.cloud;
    const bg =
      v === 'clear'
        ? theme.palette.transparent.success.main
        : v === 'precip'
          ? theme.palette.transparent.error.main
          : theme.palette.transparent.warning.main;
    return { fg, bg };
  };

  const columns: GridColDef<ClassifiedHour>[] = [
    {
      field: 'time',
      headerName: 'Time',
      flex: 1,
      minWidth: 80,
      sortable: false,
      resizable: false,
      valueGetter: (_value, row) => formatClock(row.time),
    },
    {
      field: 'cloudCover',
      headerName: 'Cloud',
      flex: 1,
      minWidth: 80,
      align: 'right',
      headerAlign: 'right',
      sortable: false,
      resizable: false,
      valueGetter: (_value, row) =>
        row.cloudCover?.total != null ? `${row.cloudCover.total}%` : '—',
    },
    {
      field: 'verdict',
      headerName: 'Status',
      flex: 1.4,
      minWidth: 110,
      sortable: false,
      resizable: false,
      renderCell: (params) => {
        const v = params.row.verdict;
        const { fg, bg } = chipStyle(v);
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: 1 }}>
            <Chip
              size="small"
              sx={{ bgcolor: bg, color: fg, fontWeight: 600 }}
              label={
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                  <IconifyIcon icon={VERDICT_ICON[v]} sx={{ fontSize: 13 }} />
                  <span>{VERDICT_LABEL[v]}</span>
                </Stack>
              }
            />
          </Box>
        );
      },
    },
  ];

  // No autoHeight in MUI X v9 — size the container to fit every hour on one page
  // so the grid never scrolls and the themed footer just reports the count.
  const height = HEADER_HEIGHT + hours.length * ROW_HEIGHT + FOOTER_HEIGHT;

  return (
    <Paper>
      <SectionHeader icon="mingcute:list-check-line" title="Hour by hour" />
      <Box sx={{ height, width: 1 }}>
        <DataGrid
          rows={hours}
          columns={columns}
          getRowId={(row) => row.time}
          rowHeight={ROW_HEIGHT}
          columnHeaderHeight={HEADER_HEIGHT}
          disableColumnMenu
          disableRowSelectionOnClick
          hideFooterSelectedRowCount
          initialState={{
            pagination: { paginationModel: { pageSize: hours.length } },
          }}
          pageSizeOptions={[hours.length]}
          slots={{ pagination: DataGridFooter }}
        />
      </Box>
    </Paper>
  );
}
