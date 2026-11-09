'use client';
import { Button, Column, Row } from '@umami/react-zen';
import { useMemo, useState } from 'react';
import { WebsiteControls } from '@/app/(main)/websites/[websiteId]/WebsiteControls';
import { LoadingPanel } from '@/components/common/LoadingPanel';
import { useDateRange, useTimezone, useTradeEventsQuery } from '@/components/hooks';
import { filterTradeEvents, type VolumeDimension, type VolumeFilters } from '@/lib/trades-volume';
import { DIMENSION_LABELS, useFormatDimension } from './dimensions';
import { TradesFunnel } from './TradesFunnel';
import { TradesVolume } from './TradesVolume';

export function TradesPage({ websiteId }: { websiteId: string }) {
  const { timezone } = useTimezone();
  const {
    dateRange: { startDate, endDate, unit },
  } = useDateRange({ timezone });
  const [filters, setFilters] = useState<VolumeFilters>({});

  const { data, isLoading, isFetching, error } = useTradeEventsQuery(websiteId);
  const events = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(() => filterTradeEvents(events, filters), [events, filters]);
  const formatDimension = useFormatDimension(events);

  const addFilter = (dimension: VolumeDimension, value: string) => {
    if (value) setFilters({ ...filters, [dimension]: value });
  };

  const removeFilter = (dimension: VolumeDimension) => {
    const { [dimension]: _, ...rest } = filters;
    setFilters(rest);
  };

  return (
    <Column gap>
      <WebsiteControls websiteId={websiteId} />
      {Object.keys(filters).length > 0 && (
        <Row gap wrap="wrap" alignItems="center">
          {(Object.entries(filters) as [VolumeDimension, string][]).map(([dimension, value]) => (
            <Button key={dimension} variant="outline" onPress={() => removeFilter(dimension)}>
              {DIMENSION_LABELS[dimension]}: {formatDimension(dimension, value)} ✕
            </Button>
          ))}
          <Button variant="quiet" onPress={() => setFilters({})}>
            Clear filters
          </Button>
        </Row>
      )}
      <LoadingPanel data={data} isLoading={isLoading} isFetching={isFetching} error={error}>
        <Column gap>
          <TradesFunnel events={filtered} />
          <TradesVolume
            events={filtered}
            filters={filters}
            onAddFilter={addFilter}
            formatDimension={formatDimension}
            startDate={startDate}
            endDate={endDate}
            unit={unit}
          />
        </Column>
      </LoadingPanel>
    </Column>
  );
}
