import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ordersStatusData } from '@app/data/ordersStatusData';
import { SelectChangeEvent } from '@mui/material';
import Stack from '@mui/material/Stack';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import StatusChip from '@app/components/common/StatusChip';
import IconifyIcon from '@app/components/base/IconifyIcon';
import DataGridFooter from '@app/components/common/DataGridFooter';
import {
  GridRowModesModel,
  GridRowModes,
  DataGrid,
  GridColDef,
  GridActionsCellItem,
  GridRenderEditCellParams,
  GridEventListener,
  GridRowId,
  GridRowModel,
  GridRowEditStopReasons,
  useGridApiRef,
} from '@mui/x-data-grid';

interface OrdersStatusTableProps {
  searchText: string;
}

const OrdersStatusTable = ({ searchText }: OrdersStatusTableProps) => {
  const apiRef = useGridApiRef();
  const [rows, setRows] = useState(ordersStatusData);
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({});

  useEffect(() => {
    apiRef.current?.setQuickFilterValues(searchText.split(/\b\W+\b/).filter((word) => word !== ''));
  }, [searchText, apiRef]);

  const handleRowEditStop: GridEventListener<'rowEditStop'> = (params, event) => {
    if (params.reason === GridRowEditStopReasons.rowFocusOut) {
      event.defaultMuiPrevented = true;
    }
  };

  const handleEditClick = (id: GridRowId) => () => {
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.Edit } });
  };

  const handleSaveClick = (id: GridRowId) => () => {
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.View } });
  };

  const handleDeleteClick = (id: GridRowId) => () => {
    setRows(rows.filter((row) => row.id !== id));
  };

  const handleCancelClick = (id: GridRowId) => () => {
    setRowModesModel({
      ...rowModesModel,
      [id]: { mode: GridRowModes.View, ignoreModifications: true },
    });

    const editedRow = rows.find((row) => row.id === id);
    if (editedRow!.isNew) {
      setRows(rows.filter((row) => row.id !== id));
    }
  };

  const processRowUpdate = (newRow: GridRowModel) => {
    const updatedRow = { ...newRow, isNew: false };
    setRows(rows.map((row) => (row.id === newRow.id ? updatedRow : row)));
    return updatedRow;
  };

  const handleRowModesModelChange = (newRowModesModel: GridRowModesModel) => {
    setRowModesModel(newRowModesModel);
  };

  const columns: GridColDef[] = [
    {
      field: 'id',
      headerName: 'Order',
      minWidth: 80,
      flex: 1,
      resizable: false,
    },
    {
      field: 'client',
      headerName: 'Client',
      flex: 2,
      minWidth: 180,
      resizable: false,
      renderHeader: () => (
        <Stack sx={{ alignItems: 'center', gap: 0.75 }}>
          <IconifyIcon
            icon="mingcute:user-2-fill"
            sx={{ color: 'neutral.main', fontSize: 'body2.fontSize' }}
          />
          <Typography variant="caption" sx={{ mt: 0.25, letterSpacing: 0.5 }}>
            Client
          </Typography>
        </Stack>
      ),
      valueGetter: (params: { name: string; email: string }) => {
        return `${params.name} ${params.email}`;
      },
      renderCell: (params) => {
        return (
          <Stack direction="column" sx={{ alignSelf: 'center', justifyContent: 'center', height: 1 }}>
            <Typography variant="subtitle1" sx={{ fontSize: 'caption.fontSize' }}>
              {params.row.client.name}
            </Typography>
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{ fontSize: 'caption.fontSize' }}
            >
              {params.row.client.email}
            </Typography>
          </Stack>
        );
      },
      sortComparator: (v1, v2) => v1.localeCompare(v2),
    },
    {
      field: 'date',
      type: 'date',
      headerName: 'Date',
      editable: true,
      minWidth: 100,
      flex: 1,
      resizable: false,
      renderHeader: () => (
        <Stack sx={{ alignItems: 'center', gap: 0.75 }}>
          <IconifyIcon icon="mdi:calendar" sx={{ color: 'neutral.main', fontSize: 'body1.fontSize' }} />
          <Typography variant="caption" sx={{ mt: 0.175, letterSpacing: 0.5 }}>
            Date
          </Typography>
        </Stack>
      ),
      renderCell: (params) => format(new Date(params.value), 'MMM dd, yyyy'),
    },
    {
      field: 'status',
      headerName: 'Status',
      sortable: false,
      minWidth: 120,
      flex: 1,
      resizable: false,
      renderHeader: () => (
        <Stack sx={{ alignItems: 'center', gap: 0.875 }}>
          <IconifyIcon
            icon="carbon:checkbox-checked-filled"
            sx={{ color: 'neutral.main', fontSize: 'body1.fontSize' }}
          />
          <Typography variant="caption" sx={{ mt: 0.175, letterSpacing: 0.5 }}>
            Status
          </Typography>
        </Stack>
      ),
      renderCell: (params) => {
        return (
          <Stack direction="column" sx={{ alignSelf: 'center', justifyContent: 'center', height: 1 }}>
            <StatusChip status={params.value} />
          </Stack>
        );
      },
      renderEditCell: (params: GridRenderEditCellParams) => {
        const handleChange = (event: SelectChangeEvent<string>) => {
          params.api.setEditCellValue({
            id: params.id,
            field: params.field,
            value: event.target.value,
          });
        };
        return (
          <Select value={params.value} onChange={handleChange} fullWidth>
            <MenuItem value="delivered">Delivered</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="canceled">Canceled</MenuItem>
          </Select>
        );
      },
      editable: true,
    },
    {
      field: 'country',
      headerName: 'Country',
      sortable: false,
      flex: 1,
      minWidth: 120,
      resizable: false,
      editable: true,
      renderHeader: () => (
        <Stack sx={{ alignItems: 'center', gap: 0.75 }}>
          <IconifyIcon
            icon="healthicons:geo-location"
            sx={{ color: 'neutral.main', fontSize: 'h5.fontSize' }}
          />
          <Typography variant="caption" sx={{ mt: 0.175, letterSpacing: 0.5 }}>
            Country
          </Typography>
        </Stack>
      ),
    },
    {
      field: 'total',
      headerName: 'Total',
      headerAlign: 'right',
      align: 'right',
      sortable: false,
      minWidth: 120,
      flex: 1,
      resizable: false,
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: '',
      minWidth: 120,
      flex: 1,
      cellClassName: 'actions',
      resizable: false,
      getActions: ({ id }) => {
        const isInEditMode = rowModesModel[id]?.mode === GridRowModes.Edit;

        if (isInEditMode) {
          return [
            <GridActionsCellItem
              icon={
                <IconifyIcon
                  icon="mdi:content-save"
                  sx={{ color: 'primary.main', fontSize: 'body1.fontSize', pointerEvents: 'none' }}
                />
              }
              label="Save"
              onClick={handleSaveClick(id)}
              size="small"
            />,
            <GridActionsCellItem
              icon={
                <IconifyIcon
                  icon="iconamoon:sign-times-duotone"
                  sx={{ color: 'text.secondary', fontSize: 'body1.fontSize', pointerEvents: 'none' }}
                />
              }
              label="Cancel"
              onClick={handleCancelClick(id)}
              size="small"
            />,
          ];
        }

        return [
          <GridActionsCellItem
            icon={
              <IconifyIcon
                icon="fluent:edit-32-filled"
                sx={{ color: 'text.secondary', fontSize: 'body1.fontSize', pointerEvents: 'none' }}
              />
            }
            label="Edit"
            onClick={handleEditClick(id)}
            size="small"
          />,
          <GridActionsCellItem
            icon={
              <IconifyIcon
                icon="mingcute:delete-3-fill"
                sx={{ color: 'text.secondary', fontSize: 'body1.fontSize', pointerEvents: 'none' }}
              />
            }
            label="Delete"
            onClick={handleDeleteClick(id)}
            size="small"
          />,
        ];
      },
    },
  ];

  return (
    <DataGrid
      apiRef={apiRef}
      rows={rows}
      columns={columns}
      rowHeight={80}
      editMode="row"
      initialState={{
        pagination: {
          paginationModel: {
            pageSize: 6,
          },
        },
      }}
      checkboxSelection
      pageSizeOptions={[6]}
      disableColumnMenu
      disableVirtualization
      disableRowSelectionOnClick
      rowModesModel={rowModesModel}
      onRowModesModelChange={handleRowModesModelChange}
      onRowEditStop={handleRowEditStop}
      processRowUpdate={processRowUpdate}
      slots={{
        pagination: DataGridFooter,
      }}
    />
  );
};

export default OrdersStatusTable;
