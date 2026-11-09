'use client';
import { Column } from '@umami/react-zen';
import { WebsiteControls } from '@/app/(main)/websites/[websiteId]/WebsiteControls';
import { useDateRange, useTimezone } from '@/components/hooks';
import { TradesVolume } from './TradesVolume';

export function TradesPage({ websiteId }: { websiteId: string }) {
  const { timezone } = useTimezone();
  const {
    dateRange: { startDate, endDate, unit },
  } = useDateRange({ timezone });

  return (
    <Column gap>
      <WebsiteControls websiteId={websiteId} />
      <TradesVolume websiteId={websiteId} startDate={startDate} endDate={endDate} unit={unit} />
    </Column>
  );
}
