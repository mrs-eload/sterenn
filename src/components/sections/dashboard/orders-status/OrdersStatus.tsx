import { fontFamily } from '@app/theme/typography';
import { useState, ChangeEvent } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconifyIcon from '@app/components/base/IconifyIcon';
import OrdersStatusTable from './OrdersStatusTable';

const OrdersStatus = () => {
  const [searchText, setSearchText] = useState('');

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  return (
    <Paper sx={{ px: 0 }}>
      <Stack
        spacing={1.5}
        sx={{ px: 3.5, alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Typography variant="h6" sx={{ fontWeight: 400, fontFamily: fontFamily.workSans }}>
          Orders Status
        </Typography>
        <Stack spacing={2} sx={{ alignItems: 'center' }}>
          <TextField
            variant="filled"
            size="small"
            placeholder="Search for..."
            value={searchText}
            onChange={handleInputChange}
            sx={{ width: 220, display: { xs: 'none', sm: 'flex' } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <IconifyIcon icon="mingcute:search-line" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Button variant="contained" size="small">
            Create order
          </Button>
        </Stack>
      </Stack>

      <Stack sx={{ my: 2, px: 3.5, width: 1, justifyContent: 'center' }}>
        <TextField
          variant="filled"
          size="small"
          placeholder="Search for..."
          value={searchText}
          onChange={handleInputChange}
          sx={{ width: 1, display: { xs: 'flex', sm: 'none' } }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <IconifyIcon icon={'mingcute:search-line'} />
                </InputAdornment>
              ),
            },
          }}
        />
      </Stack>

      <Box sx={{ mt: 1.5, height: 594, width: 1, flexShrink: 0 }}>
        <OrdersStatusTable searchText={searchText} />
      </Box>
    </Paper>
  );
};

export default OrdersStatus;
