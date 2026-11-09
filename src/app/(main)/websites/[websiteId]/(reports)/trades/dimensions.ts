import { useMemo } from 'react';
import type { TradeEvent } from '@/lib/trades';
import type { VolumeDimension } from '@/lib/trades-volume';

export const DIMENSION_LABELS: Record<VolumeDimension, string> = {
  tradeCurrency: 'Trade currency',
  market: 'Market',
  isin: 'Instrument',
  side: 'Side',
  product: 'Product',
  origin: 'Origin',
};

export type FormatDimension = (dimension: VolumeDimension, value: string) => string;

export function useFormatDimension(events: TradeEvent[]): FormatDimension {
  const names = useMemo(() => new Map(events.map(e => [e.isin, e.instrumentName])), [events]);

  return (dimension, value) => {
    if (!value) return '(none)';
    if (dimension !== 'isin') return value;
    const name = names.get(value);
    return name ? `${name} (${value})` : value;
  };
}
