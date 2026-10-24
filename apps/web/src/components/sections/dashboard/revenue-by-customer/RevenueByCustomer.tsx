import { useRef } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import RateChip from '@app/components/common/RateChip';
import DateSelect from '@app/components/common/DateSelect';
import EChartsReactCore from 'echarts-for-react/lib/core';
import RevenueChartLegends from './RevenueChartLegends';
import RevenueChart from './RevenueChart';
import { revenueByCustomerData } from '@app/data/revenueData';

const RevenueByCustomer = () => {
  const chartRef = useRef<EChartsReactCore>(null);

  return (
    <Paper sx={{ height: { xs: 540, md: 500 } }}>
      <Typography variant="subtitle1" color="text.secondary">
        Revenue by customer type
      </Typography>

      <Stack
        sx={{
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          mt: 1,
        }}
      >
        <Stack sx={{ flexWrap: 'wrap', alignItems: 'center', gap: 0.875 }}>
          <Typography variant="h3" sx={{ fontWeight: 600, letterSpacing: 1 }}>
            $240.8K
          </Typography>
          <RateChip rate={'14.8%'} isUp={true} />
        </Stack>

        <Stack spacing={2} sx={{ alignItems: 'center' }}>
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <RevenueChartLegends chartRef={chartRef} isSm={false} />
          </Box>
          <DateSelect />
        </Stack>
      </Stack>

      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        <RevenueChartLegends chartRef={chartRef} isSm={true} />
      </Box>

      <RevenueChart
        chartRef={chartRef}
        data={revenueByCustomerData}
        sx={{ height: { xs: '380px !important', sm: '400px !important' } }}
      />
    </Paper>
  );
};

export default RevenueByCustomer;
