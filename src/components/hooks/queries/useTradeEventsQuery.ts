import { keepPreviousData } from '@tanstack/react-query';
import { useDateParameters } from '@/components/hooks/useDateParameters';
import type { TradeEvent } from '@/lib/trades';
import { useApi } from '../useApi';

export function useTradeEventsQuery(websiteId: string) {
  const { get, useQuery } = useApi();
  const { startAt, endAt } = useDateParameters();

  return useQuery<TradeEvent[]>({
    queryKey: ['websites:trades', { websiteId, startAt, endAt }],
    queryFn: async () => {
      const { events } = await get(`/websites/${websiteId}/trades`, { startAt, endAt });

      return events.map((event: TradeEvent) => ({
        ...event,
        occurredAt: new Date(event.occurredAt),
      }));
    },
    enabled: !!websiteId,
    placeholderData: keepPreviousData,
  });
}
