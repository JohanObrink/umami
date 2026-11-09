import { Button, Column, Grid, Heading, ListItem, Select } from '@umami/react-zen';
import { useMemo, useState } from 'react';
import { Panel } from '@/components/common/Panel';
import { useMessages } from '@/components/hooks';
import { ListTable } from '@/components/metrics/ListTable';
import { MetricCard } from '@/components/metrics/MetricCard';
import { MetricsBar } from '@/components/metrics/MetricsBar';
import { DATE_FUNCTIONS } from '@/lib/date';
import { formatLongCurrency, formatLongNumber } from '@/lib/format';
import type { TradeEvent } from '@/lib/trades';
import {
  getVolume,
  VOLUME_DIMENSIONS,
  type VolumeDimension,
  type VolumeFilters,
} from '@/lib/trades-volume';
import { DIMENSION_LABELS, type FormatDimension } from './dimensions';
import { TradesVolumeChart } from './TradesVolumeChart';

export interface TradesVolumeProps {
  events: TradeEvent[];
  filters: VolumeFilters;
  onAddFilter: (dimension: VolumeDimension, value: string) => void;
  formatDimension: FormatDimension;
  startDate: Date;
  endDate: Date;
  unit: string;
}

export function TradesVolume({
  events,
  filters,
  onAddFilter,
  formatDimension,
  startDate,
  endDate,
  unit,
}: TradesVolumeProps) {
  const { t, labels } = useMessages();
  const [groupBy, setGroupBy] = useState<VolumeDimension>('tradeCurrency');
  const groupOptions = VOLUME_DIMENSIONS.filter(d => !filters[d]);
  const activeGroupBy = groupOptions.includes(groupBy) ? groupBy : (groupOptions[0] ?? groupBy);

  const volume = useMemo(
    () => getVolume(events, filters, activeGroupBy, DATE_FUNCTIONS[unit].start),
    [events, filters, activeGroupBy, unit],
  );

  const formatAmount = (n: number) => formatLongCurrency(n, volume.currency);
  const volumeLabel = t(labels.volumeIn, { currency: volume.currency });

  return (
    <Column gap>
      <Heading size="2xl">{t(labels.volume)}</Heading>
      <MetricsBar>
        <MetricCard
          label={t(labels.filledTrades)}
          value={volume.trades}
          formatValue={formatLongNumber}
        />
        <MetricCard label={volumeLabel} value={volume.amount} formatValue={formatAmount} />
        <MetricCard
          label={t(labels.averageTrade)}
          value={volume.trades ? volume.amount / volume.trades : 0}
          formatValue={formatAmount}
        />
      </MetricsBar>
      <Panel>
        <TradesVolumeChart
          series={volume.series}
          currency={volume.currency}
          unit={unit}
          minDate={startDate}
          maxDate={endDate}
        />
      </Panel>
      <Panel>
        <Grid columns="1fr 220px" alignItems="center" gap>
          <Heading size="2xl">{t(labels.breakdown)}</Heading>
          <Select value={activeGroupBy} onChange={value => setGroupBy(value as VolumeDimension)}>
            {groupOptions.map(d => (
              <ListItem key={d} id={d}>
                {t(DIMENSION_LABELS[d])}
              </ListItem>
            ))}
          </Select>
        </Grid>
        {groupOptions.length > 0 && (
          <ListTable
            title={t(DIMENSION_LABELS[activeGroupBy])}
            metric={volumeLabel}
            formatCount={formatAmount}
            data={volume.breakdown.map(row => ({
              label: row.label,
              count: row.amount,
              percent: volume.amount ? (row.amount / volume.amount) * 100 : 0,
            }))}
            renderLabel={row => (
              <Button variant="quiet" onPress={() => onAddFilter(activeGroupBy, row.label)}>
                {formatDimension(activeGroupBy, row.label)}
              </Button>
            )}
          />
        )}
      </Panel>
    </Column>
  );
}
