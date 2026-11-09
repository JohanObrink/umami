import { colord } from 'colord';
import { format } from 'date-fns';
import { useCallback, useMemo } from 'react';
import { BarChart } from '@/components/charts/BarChart';
import { useLocale, useMessages } from '@/components/hooks';
import { renderDateLabels } from '@/lib/charts';
import { CHART_COLORS } from '@/lib/constants';
import { generateTimeSeries } from '@/lib/date';
import type { VolumeResult } from '@/lib/trades-volume';

export interface TradesVolumeChartProps {
  series: VolumeResult['series'];
  currency: string;
  unit: string;
  minDate: Date;
  maxDate: Date;
}

export function TradesVolumeChart({
  series,
  currency,
  unit,
  minDate,
  maxDate,
}: TradesVolumeChartProps) {
  const { locale, dateLocale } = useLocale();
  const { t, labels } = useMessages();

  const chartData: any = useMemo(() => {
    const sides = ['buy', 'sell'];

    return {
      datasets: sides.map((side, index) => {
        const color = colord(CHART_COLORS[index]);
        const points = series
          .filter(p => p.side === side)
          .map(p => ({ x: format(p.date, "yyyy-MM-dd'T'HH:mm:ss"), y: p.amount }));

        return {
          label: t(side === 'buy' ? labels.buy : labels.sell),
          data: generateTimeSeries(points, minDate, maxDate, unit, dateLocale),
          backgroundColor: color.alpha(0.6).toRgbString(),
          borderColor: color.alpha(0.7).toRgbString(),
          borderWidth: 1,
        };
      }),
    };
  }, [series, minDate, maxDate, unit, dateLocale, t, labels]);

  const renderXLabel = useCallback(renderDateLabels(unit, locale), [unit, locale]);

  return (
    <BarChart
      chartData={chartData}
      unit={unit}
      minDate={minDate}
      maxDate={maxDate}
      currency={currency}
      stacked
      renderXLabel={renderXLabel}
      height="400px"
    />
  );
}
