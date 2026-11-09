import { TRADE_OUTCOME_STEPS, type TradeEvent } from './trades';

export const VOLUME_DIMENSIONS = [
  'tradeCurrency',
  'market',
  'isin',
  'side',
  'product',
  'origin',
] as const;

export type VolumeDimension = (typeof VOLUME_DIMENSIONS)[number];
export type VolumeFilters = Partial<Record<VolumeDimension, string>>;

export interface VolumeRow {
  label: string;
  trades: number;
  quantity: number;
  amount: number;
}

export interface VolumeResult {
  // The trade currency when one is filtered on, otherwise the settlement currency.
  currency: string;
  trades: number;
  amount: number;
  series: { side: string; date: Date; amount: number }[];
  breakdown: VolumeRow[];
}

const OUTCOMES = new Set<string>(TRADE_OUTCOME_STEPS);

// The last outcome of each trade that filled anything. A fund's `completed` replaces its
// `executed`, so each trade is counted once.
export function getFilledTrades(events: TradeEvent[]) {
  const latest = new Map<string, TradeEvent>();

  for (const event of events) {
    if (!OUTCOMES.has(event.step)) continue;
    const current = latest.get(event.tradeId);
    if (!current || event.occurredAt > current.occurredAt) {
      latest.set(event.tradeId, event);
    }
  }

  return [...latest.values()].filter(e => (e.filledQuantity ?? 0) > 0);
}

export function getVolume(
  events: TradeEvent[],
  filters: VolumeFilters,
  groupBy: VolumeDimension,
  bucket: (date: Date) => Date,
  settlementCurrency = 'SEK',
): VolumeResult {
  const byTradeCurrency = !!filters.tradeCurrency;
  const currency = filters.tradeCurrency ?? settlementCurrency;

  const trades = getFilledTrades(events).filter(
    e =>
      Object.entries(filters).every(([key, value]) => e[key as VolumeDimension] === value) &&
      (byTradeCurrency || e.settlementCurrency === settlementCurrency),
  );

  const amountOf = (e: TradeEvent) =>
    byTradeCurrency ? (e.filledQuantity ?? 0) * (e.avgPrice ?? 0) : (e.settlementAmount ?? 0);

  const series = new Map<string, { side: string; date: Date; amount: number }>();
  const groups = new Map<string, VolumeRow>();
  let amount = 0;

  for (const e of trades) {
    const value = amountOf(e);
    amount += value;

    const date = bucket(e.occurredAt);
    const seriesKey = `${e.side}|${date.getTime()}`;
    const point = series.get(seriesKey) ?? { side: e.side, date, amount: 0 };
    point.amount += value;
    series.set(seriesKey, point);

    const label = e[groupBy] ?? '';
    const row = groups.get(label) ?? { label, trades: 0, quantity: 0, amount: 0 };
    row.trades += 1;
    row.quantity += e.filledQuantity ?? 0;
    row.amount += value;
    groups.set(label, row);
  }

  return {
    currency,
    trades: trades.length,
    amount,
    series: [...series.values()],
    breakdown: [...groups.values()].sort((a, b) => b.amount - a.amount),
  };
}
