import { useState } from 'react';
import Stack from '@mui/material/Stack';
import EChartsReactCore from 'echarts-for-react/lib/core';
import RevenueChartLegend from './RevenueChartLegend';
import { revenueByCustomerData } from '@app/data/revenueData';
import { revenueChartLegendsData } from '@app/data/legendsData';

interface LegendsProps {
  chartRef: React.RefObject<EChartsReactCore | null>;
  isSm?: boolean;
}

// Loose shape for the echarts option we read/mutate here; the live chart
// option is too broadly typed by echarts to narrow usefully.
interface BarSeries {
  name?: string;
  type?: string;
  data?: number[];
}

const RevenueChartLegends = ({ chartRef, isSm }: LegendsProps) => {
  const [toggleColor, setToggleColor] = useState({
    currentClients: true,
    subscribers: true,
    newCustomers: true,
  });

  const handleLegendToggle = (seriesName: string) => {
    const echartsInstance = chartRef.current?.getEchartsInstance();
    if (!echartsInstance) return;

    if (seriesName === 'Current clients') {
      setToggleColor({ ...toggleColor, currentClients: !toggleColor.currentClients });
    } else if (seriesName === 'Subscribers') {
      setToggleColor({ ...toggleColor, subscribers: !toggleColor.subscribers });
    } else if (seriesName === 'New customers') {
      setToggleColor({ ...toggleColor, newCustomers: !toggleColor.newCustomers });
    }

    const option = echartsInstance.getOption() as unknown as { series?: BarSeries[] };

    if (Array.isArray(option.series)) {
      const series = option.series.map((s) => {
        if (s.name === seriesName && s.type === 'bar') {
          const data = s.data ?? [];
          const isBarVisible = data.some((value) => value !== 0);
          return {
            ...s,
            data: isBarVisible
              ? data.map(() => 0)
              : revenueByCustomerData.series.find((d) => d.name === seriesName)?.data || [],
          };
        }
        return s;
      });
      echartsInstance.setOption({ series });
    }
  };

  return (
    <Stack
      spacing={{ xs: 1, sm: 2 }}
      sx={{
        alignItems: 'center',
        justifyContent: isSm ? 'center' : 'flex-start',
        pt: isSm ? 3 : 0,
        width: isSm ? 1 : 'auto',
      }}
    >
      {revenueChartLegendsData.map((item) => (
        <RevenueChartLegend
          key={item.id}
          data={item}
          toggleColor={toggleColor}
          handleLegendToggle={handleLegendToggle}
        />
      ))}
    </Stack>
  );
};

export default RevenueChartLegends;
