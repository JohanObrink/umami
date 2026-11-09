import { useMemo } from 'react';
import { useMessages } from '@/components/hooks';
import { labels } from '@/components/messages';
import type { TradeEvent } from '@/lib/trades';
import type { VolumeDimension } from '@/lib/trades-volume';

export const DIMENSION_LABELS: Record<VolumeDimension, string> = {
  tradeCurrency: labels.tradeCurrency,
  market: labels.market,
  isin: labels.instrument,
  side: labels.side,
  product: labels.product,
  origin: labels.origin,
};

export type FormatDimension = (dimension: VolumeDimension, value: string) => string;

export function useFormatDimension(events: TradeEvent[]): FormatDimension {
  const { t } = useMessages();
  const names = useMemo(() => new Map(events.map(e => [e.isin, e.instrumentName])), [events]);

  return (dimension, value) => {
    if (!value) return `(${t(labels.none)})`;
    if (dimension !== 'isin') return value;
    const name = names.get(value);
    return name ? `${name} (${value})` : value;
  };
}
