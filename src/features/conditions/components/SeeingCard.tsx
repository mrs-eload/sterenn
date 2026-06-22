import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { useMemo } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ComposeOption } from 'echarts/core';
import type { LineSeriesOption } from 'echarts/charts';
import type {
  GridComponentOption,
  TooltipComponentOption,
} from 'echarts/components';
import ReactEchart from '@app/components/base/ReactEchart';
import { antoniadiFor, type SeeingBand, type SeeingSummary } from '../../../core/sky';
import { formatHourShort } from '../format';
import { SectionHeader } from './SectionHeader.tsx';

echarts.use([GridComponent, TooltipComponent, LineChart, CanvasRenderer]);

type SeeingChartOption = ComposeOption<
  LineSeriesOption | GridComponentOption | TooltipComponentOption
>;

/**
 * Seeing — atmospheric steadiness on the Antoniadi scale (I = perfect … V =
 * terrible; lower is better), estimated from jet-stream (250 hPa) wind.
 *
 * This is a PROXY (see core/seeing): the single most forecastable driver of
 * seeing, but not a calibrated value and blind to ground-layer turbulence. The
 * card says so, so nobody mistakes it for a meteoblue seeing index.
 *
 * The curve plots the Antoniadi grade per hour with the axis ordered so I sits
 * at the TOP — best seeing rides high, matching the sky-quality curve's reading.
 */
export interface SeeingCardProps {
  seeing: SeeingSummary | null;
}

const BAND_LABEL: Record<SeeingBand, string> = {
  excellent: 'Excellent',
  good: 'Good',
  average: 'Average',
  poor: 'Poor',
  'very-poor': 'Very poor',
  unknown: 'Not available',
};

// y-axis: 1..5 = I..V. Built once for the axis label formatter.
const NUMERAL_BY_VALUE: Record<number, string> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
};

const EXPLAINER =
  'Antoniadi scale, I (perfect) to V (terrible) — lower is better. Estimated ' +
  'from jet-stream wind at 250 hPa, the biggest forecastable driver of seeing, ' +
  'but a proxy: not calibrated, and ground-level turbulence is not included.';

export function SeeingCard({ seeing }: SeeingCardProps) {
  const theme = useTheme();

  const clear = theme.palette.verdict?.clear ?? theme.palette.success.main;
  const cloud = theme.palette.verdict?.cloud ?? theme.palette.warning.main;
  const precip = theme.palette.verdict?.precip ?? theme.palette.error.main;
  const muted = theme.palette.text.secondary;
  const gridColor = theme.palette.divider;

  const band: SeeingBand = seeing?.band ?? 'unknown';
  const antoniadi = antoniadiFor(band);

  const colorForBand = (b: SeeingBand) =>
    b === 'excellent' || b === 'good'
      ? clear
      : b === 'average'
        ? cloud
        : b === 'unknown'
          ? muted
          : precip;
  const color = colorForBand(band);

  // How much seeing swings over the night. Only worth showing once we have a
  // grade, and only when best/worst actually differ (otherwise it's steady).
  const best = antoniadiFor(seeing?.best ?? 'unknown');
  const worst = antoniadiFor(seeing?.worst ?? 'unknown');
  const rangeText =
    band === 'unknown'
      ? null
      : best && worst && best.numeral !== worst.numeral
        ? `ranges ${best.numeral}–${worst.numeral} through the night`
        : 'steady through the night';

  // Hours that carry a known grade (need a jet wind). Need ≥2 to draw a line.
  const curveHours = useMemo(
    () => (seeing?.hours ?? []).filter((h) => h.estimate.band !== 'unknown'),
    [seeing],
  );

  const option = useMemo<SeeingChartOption>(
    () => ({
      grid: { left: 8, right: 14, top: 10, bottom: 6, containLabel: true },
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const p = Array.isArray(params) ? params[0] : params;
          const h = curveHours[p.dataIndex as number];
          const a = antoniadiFor(h.estimate.band);
          const wind =
            h.estimate.jetWindMs !== null
              ? ` · ${Math.round(h.estimate.jetWindMs)} m/s`
              : '';
          return `${formatHourShort(h.time)}<br/>${a?.numeral ?? '—'} · ${
            BAND_LABEL[h.estimate.band]
          }${wind}`;
        },
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: curveHours.map((h) => formatHourShort(h.time)),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: alpha(muted, 0.5) } },
        axisLabel: { color: muted, fontSize: 11, hideOverlap: true },
        splitLine: { show: true, lineStyle: { color: gridColor, opacity: 0.35 } },
      },
      yAxis: {
        // 1..5 = I..V, inverse so I (best) is at the top — "up is better".
        type: 'value',
        inverse: true,
        min: 1,
        max: 5,
        interval: 1,
        axisLabel: {
          color: muted,
          fontSize: 11,
          formatter: (v: number) => NUMERAL_BY_VALUE[v] ?? '',
        },
        splitLine: { lineStyle: { color: gridColor, opacity: 0.5 } },
      },
      series: [
        {
          type: 'line',
          name: 'Seeing',
          data: curveHours.map((h) => antoniadiFor(h.estimate.band)?.value ?? null),
          // Step line: the grade is ordinal, so don't imply smooth values between.
          step: 'middle',
          showSymbol: false,
          lineStyle: { color, width: 2.5 },
          itemStyle: { color },
        },
      ],
    }),
    [curveHours, color, muted, gridColor],
  );

  return (
    // width:100% so the card fills its flex grid cell when laid out in a row.
    <Paper sx={{ width: '100%' }}>
      <SectionHeader
        icon="mingcute:star-line"
        title="Seeing"
        action={
          <Tooltip title={EXPLAINER} arrow>
            <Typography variant="caption" color="text.secondary" sx={{ cursor: 'help' }}>
              Antoniadi · jet-stream estimate
            </Typography>
          </Tooltip>
        }
      />

      {/* "Typical tonight" so the headline grade reads as the night's median,
          not a mystery score or the current instant. */}
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ display: 'block', lineHeight: 1.4 }}
      >
        Typical tonight
      </Typography>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'baseline' }}>
        <Typography sx={{ color, fontWeight: 700, fontSize: 34, lineHeight: 1 }}>
          {antoniadi?.numeral ?? '—'}
        </Typography>
        <Typography variant="h6" sx={{ color, fontWeight: 500 }}>
          {BAND_LABEL[band]}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          {seeing && seeing.jetWindMs !== null
            ? `${Math.round(seeing.jetWindMs)} m/s @ 250 hPa`
            : 'no upper-level wind'}
        </Typography>
      </Stack>
      {rangeText && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
          {rangeText}
        </Typography>
      )}

      {curveHours.length >= 2 ? (
        <ReactEchart
          echarts={echarts}
          option={option}
          style={{ height: 120, marginTop: 8 }}
        />
      ) : (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 1.5 }}
        >
          This model didn't return 250 hPa wind, so seeing can't be estimated.
        </Typography>
      )}
    </Paper>
  );
}
