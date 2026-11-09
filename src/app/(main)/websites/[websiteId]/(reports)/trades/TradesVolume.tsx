import { Button, Column, Grid, Heading, ListItem, Row, Select, Text } from '@umami/react-zen';
import { useMemo, useState } from 'react';
import { Panel } from '@/components/common/Panel';
import { ListTable } from '@/components/metrics/ListTable';
import { MetricCard } from '@/components/metrics/MetricCard';
import { MetricsBar } from '@/components/metrics/MetricsBar';
import { DATE_FUNCTIONS } from '@/lib/date';
import { formatLongCurrency, formatLongNumber } from '@/lib/format';
import { generateFakeTradeEvents } from '@/lib/trades-fake';
import {
  getVolume,
  VOLUME_DIMENSIONS,
  type VolumeDimension,
  type VolumeFilters,
} from '@/lib/trades-volume';
import { TradesVolumeChart } from './TradesVolumeChart';

const DIMENSION_LABELS: Record<VolumeDimension, string> = {
  tradeCurrency: 'Trade currency',
  market: 'Market',
  isin: 'Instrument',
  side: 'Side',
  product: 'Product',
  origin: 'Origin',
};

export interface TradesVolumeProps {
  websiteId: string;
  startDate: Date;
  endDate: Date;
  unit: string;
}

export function TradesVolume({ websiteId, startDate, endDate, unit }: TradesVolumeProps) {
  const [filters, setFilters] = useState<VolumeFilters>({});
  const [groupBy, setGroupBy] = useState<VolumeDimension>('tradeCurrency');

  const events = useMemo(
    () => generateFakeTradeEvents({ websiteId, startDate, endDate }),
    [websiteId, startDate, endDate],
  );

  const instrumentNames = useMemo(
    () => new Map(events.map(e => [e.isin, e.instrumentName])),
    [events],
  );

  const formatValue = (dimension: VolumeDimension, value: string) => {
    if (!value) return '(none)';
    if (dimension !== 'isin') return value;
    const name = instrumentNames.get(value);
    return name ? `${name} (${value})` : value;
  };

  const groupOptions = VOLUME_DIMENSIONS.filter(d => !filters[d]);
  const activeGroupBy = groupOptions.includes(groupBy) ? groupBy : (groupOptions[0] ?? groupBy);

  const volume = useMemo(
    () => getVolume(events, filters, activeGroupBy, DATE_FUNCTIONS[unit].start),
    [events, filters, activeGroupBy, unit],
  );

  const formatAmount = (n: number) => formatLongCurrency(n, volume.currency);

  const addFilter = (dimension: VolumeDimension, value: string) => {
    if (!value) return;
    setFilters({ ...filters, [dimension]: value });
  };

  const removeFilter = (dimension: VolumeDimension) => {
    const { [dimension]: _, ...rest } = filters;
    setFilters(rest);
  };

  return (
    <Column gap>
      <Text color="muted">Prototype using generated data.</Text>
      <Row gap wrap="wrap" alignItems="center">
        {Object.entries(filters).map(([dimension, value]) => (
          <Button
            key={dimension}
            variant="outline"
            onPress={() => removeFilter(dimension as VolumeDimension)}
          >
            {DIMENSION_LABELS[dimension as VolumeDimension]}:{' '}
            {formatValue(dimension as VolumeDimension, value)} ✕
          </Button>
        ))}
        {Object.keys(filters).length > 0 && (
          <Button variant="quiet" onPress={() => setFilters({})}>
            Clear filters
          </Button>
        )}
      </Row>
      <MetricsBar>
        <MetricCard label="Trades" value={volume.trades} formatValue={formatLongNumber} />
        <MetricCard
          label={`Volume (${volume.currency})`}
          value={volume.amount}
          formatValue={formatAmount}
        />
        <MetricCard
          label="Average trade"
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
          <Heading size="2xl">Breakdown</Heading>
          <Select value={activeGroupBy} onChange={value => setGroupBy(value as VolumeDimension)}>
            {groupOptions.map(d => (
              <ListItem key={d} id={d}>
                {DIMENSION_LABELS[d]}
              </ListItem>
            ))}
          </Select>
        </Grid>
        {groupOptions.length > 0 && (
          <ListTable
            title={DIMENSION_LABELS[activeGroupBy]}
            metric={`Volume (${volume.currency})`}
            formatCount={formatAmount}
            data={volume.breakdown.map(row => ({
              label: row.label,
              count: row.amount,
              percent: volume.amount ? (row.amount / volume.amount) * 100 : 0,
            }))}
            renderLabel={row => (
              <Button variant="quiet" onPress={() => addFilter(activeGroupBy, row.label)}>
                {formatValue(activeGroupBy, row.label)}
              </Button>
            )}
          />
        )}
      </Panel>
    </Column>
  );
}
