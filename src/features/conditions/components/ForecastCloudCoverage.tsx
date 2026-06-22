import { useTheme } from '@mui/material/styles';
import { useMemo } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ComposeOption } from 'echarts/core';
import type { LineSeriesOption } from 'echarts/charts';
import type {
  GridComponentOption,
  TooltipComponentOption,
  LegendComponentOption,
} from 'echarts/components';
import ReactEchart from '@app/components/base/ReactEchart';
import type { ClassifiedHour } from '../../../core/sky';
import { formatHourShort } from '../format';
import { ExpandableChartCard } from './ExpandableChartCard.tsx';

echarts.use([
  GridComponent,
  TooltipComponent,
  LegendComponent,
  LineChart,
  CanvasRenderer,
]);

type CloudChartOption = ComposeOption<
  | LineSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
>;

/**
 * Forecast Cloud Coverage — the three altitude layers Open-Meteo reports
 * (`cloud_cover_low|mid|high`) plotted across the night window, so the observer
 * can see *what kind* of cloud is forecast, not just the lumped total the
 * sky-quality curve runs on. High cirrus reads very differently from a low
 * deck even at the same total cover.
 *
 * Unlike SkyQualityCurve this plots cloud cover directly (higher = cloudier),
 * because that's the natural reading for "how much of each layer".
 */
export interface ForecastCloudCoverageProps {
  hours: ClassifiedHour[];
  height?: number;
}

export function ForecastCloudCoverage({
  hours,
  height = 160,
}: ForecastCloudCoverageProps) {
  const theme = useTheme();

  const axisColor = theme.palette.text.secondary;
  const gridColor = theme.palette.divider;

  // Distinct, roughly altitude-ordered colours: low = yellow (warning) — blue
  // was too dark to read against the dark surface; mid = cyan (secondary);
  // high = purple (primary).
  const layers = useMemo(
    () =>
      [
        { key: 'low' as const, name: 'Low', color: theme.palette.warning.main },
        { key: 'mid' as const, name: 'Mid', color: theme.palette.secondary.main },
        { key: 'high' as const, name: 'High', color: theme.palette.primary.main },
      ],
    [theme],
  );

  const option = useMemo<CloudChartOption>(
    () => ({
      grid: { left: 8, right: 14, top: 28, bottom: 6, containLabel: true },
      legend: {
        top: 0,
        right: 0,
        icon: 'roundRect',
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: axisColor, fontSize: 11 },
      },
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value) =>
          value == null ? '—' : `${value}% cloud`,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: hours.map((h) => formatHourShort(h.time)),
        axisTick: { show: false },
        // A bit brighter than the faint divider so the baseline actually reads.
        axisLine: { lineStyle: { color: axisColor, opacity: 0.5 } },
        axisLabel: { color: axisColor, fontSize: 11, hideOverlap: true },
        // One vertical guide per hour, so the eye can pin a curve point to a time.
        splitLine: { show: true, lineStyle: { color: gridColor, opacity: 0.35 } },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        interval: 50,
        axisLabel: { color: axisColor, fontSize: 11, formatter: '{value}%' },
        splitLine: { lineStyle: { color: gridColor, opacity: 0.5 } },
      },
      series: layers.map((layer) => ({
        type: 'line',
        name: layer.name,
        // null (not 0) when a layer is absent, so the line gaps instead of
        // dropping to a misleading "0% cloud".
        data: hours.map((h) => h.cloudCover?.[layer.key] ?? null),
        smooth: true,
        showSymbol: false,
        lineStyle: { color: layer.color, width: 2 },
        itemStyle: { color: layer.color },
      })),
    }),
    [hours, layers, axisColor, gridColor],
  );

  if (hours.length < 2) return null;

  return (
    <ExpandableChartCard
      icon="mingcute:cloud-line"
      title="Forecast Cloud Coverage"
      height={height}
    >
      {(h) => <ReactEchart echarts={echarts} option={option} style={{ height: h }} />}
    </ExpandableChartCard>
  );
}
