import Paper from '@mui/material/Paper';
import { alpha, useTheme } from '@mui/material/styles';
import { useMemo } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, MarkLineComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ComposeOption } from 'echarts/core';
import type { LineSeriesOption } from 'echarts/charts';
import type {
  GridComponentOption,
  TooltipComponentOption,
} from 'echarts/components';
import ReactEchart from '@app/components/base/ReactEchart';
import type { ClassifiedHour } from '../../../core/sky';
import { formatHourShort } from '../format';
import { SectionHeader } from './SectionHeader.tsx';

echarts.use([
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
  LineChart,
  CanvasRenderer,
]);

type SkyChartOption = ComposeOption<
  LineSeriesOption | GridComponentOption | TooltipComponentOption
>;

/**
 * Clear-sky curve over the night window, rendered with ECharts (already a project
 * dependency and the shared charting tool — see the dashboard charts). The hand-
 * rolled SVG it replaced couldn't carry real, non-distorted axes.
 *
 * Y axis is *visibility* = clear sky (100 − cloud cover): 100% at the top, so a
 * good night reads as a tall green plateau and clouds pull the curve down toward
 * the baseline. Precip hours are flagged with red vertical marks, since they hard-
 * break an integration block regardless of how clear the surrounding hours are.
 */
export interface SkyQualityCurveProps {
  hours: ClassifiedHour[];
  height?: number;
}

export function SkyQualityCurve({ hours, height = 160 }: SkyQualityCurveProps) {
  const theme = useTheme();

  const clearColor = theme.palette.verdict?.clear ?? theme.palette.primary.main;
  const precipColor = theme.palette.verdict?.precip ?? theme.palette.error.main;
  const axisColor = theme.palette.text.secondary;
  const gridColor = theme.palette.divider;

  const option = useMemo<SkyChartOption>(
    () => ({
      grid: { left: 8, right: 14, top: 12, bottom: 6, containLabel: true },
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value) => `${value}% clear`,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: hours.map((h) => formatHourShort(h.time)),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: gridColor } },
        axisLabel: { color: axisColor, fontSize: 11, hideOverlap: true },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        interval: 50,
        axisLabel: { color: axisColor, fontSize: 11, formatter: '{value}%' },
        splitLine: { lineStyle: { color: gridColor, opacity: 0.5 } },
      },
      series: [
        {
          type: 'line',
          name: 'Clear sky',
          // Visibility = 100 − cloud cover, so the curve rides high when clear.
          data: hours.map((h) => 100 - h.cloudCover),
          smooth: true,
          showSymbol: false,
          lineStyle: { color: clearColor, width: 2.5 },
          // Vertical fade from the curve down to the baseline — a plain-object
          // gradient so we don't pull in echarts' graphic helper.
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: alpha(clearColor, 0.45) },
                { offset: 1, color: alpha(clearColor, 0.02) },
              ],
            },
          },
          // Precip hours as full-height red marks — a hard break for any block.
          markLine: {
            symbol: 'none',
            silent: true,
            label: { show: false },
            lineStyle: { color: precipColor, width: 1, opacity: 0.7 },
            data: hours
              .filter((h) => h.verdict === 'precip')
              .map((h) => ({ xAxis: formatHourShort(h.time) })),
          },
        },
      ],
    }),
    [hours, clearColor, precipColor, axisColor, gridColor],
  );

  if (hours.length < 2) return null;

  return (
    <Paper>
      <SectionHeader icon="mingcute:moon-line" title="Clear-sky curve" />
      <ReactEchart echarts={echarts} option={option} style={{ height }} />
    </Paper>
  );
}
