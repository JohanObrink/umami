'use client';
import { Button, Column, Row, Text } from '@umami/react-zen';
import { useMemo, useState } from 'react';
import { WebsiteControls } from '@/app/(main)/websites/[websiteId]/WebsiteControls';
import { useDateRange, useTimezone } from '@/components/hooks';
import { generateFakeTradeEvents } from '@/lib/trades-fake';
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

  const events = useMemo(
    () => generateFakeTradeEvents({ websiteId, startDate, endDate }),
    [websiteId, startDate, endDate],
  );
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
      <Text color="muted">Prototype using generated data.</Text>
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
  );
}
