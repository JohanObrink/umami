import { describe, expect, test } from 'vitest';
import type { TradeEvent } from './trades';
import { filterTradeEvents, getFilledTrades, getVolume } from './trades-volume';

const day = (d: number) => new Date(Date.UTC(2026, 10, d));
const bucket = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

function event(overrides: Partial<TradeEvent>): TradeEvent {
  return {
    websiteId: 'w',
    tradeId: 't1',
    step: 'completed',
    occurredAt: day(1),
    product: 'stock',
    side: 'buy',
    isin: 'FI0009801310',
    market: 'XHEL',
    tradeCurrency: 'EUR',
    settlementCurrency: 'SEK',
    filledQuantity: 100,
    avgPrice: 2,
    settlementAmount: 2300,
    ...overrides,
  };
}

describe('getFilledTrades', () => {
  test('counts a fund once when executed is followed by completed', () => {
    const events = [
      event({ step: 'executed', product: 'fund', occurredAt: day(1) }),
      event({ step: 'completed', product: 'fund', occurredAt: day(3) }),
    ];

    expect(getFilledTrades(events)).toHaveLength(1);
    expect(getFilledTrades(events)[0].step).toBe('completed');
  });

  test('ignores funnel steps and outcomes with nothing filled', () => {
    const events = [
      event({ tradeId: 'a', step: 'sent' }),
      event({ tradeId: 'b', step: 'rejected', filledQuantity: 0 }),
      event({ tradeId: 'c', step: 'cancelled', filledQuantity: 40 }),
    ];

    expect(getFilledTrades(events).map(e => e.tradeId)).toEqual(['c']);
  });
});

describe('filterTradeEvents', () => {
  test('keeps all steps of a matching trade, even steps without the field', () => {
    const events = [
      event({ tradeId: 'a', step: 'started', market: undefined }),
      event({ tradeId: 'a', step: 'sent', market: 'XHEL' }),
      event({ tradeId: 'b', step: 'started', market: undefined }),
      event({ tradeId: 'b', step: 'sent', market: 'XSTO' }),
    ];

    expect(
      filterTradeEvents(events, { market: 'XHEL' }).map(e => `${e.tradeId}:${e.step}`),
    ).toEqual(['a:started', 'a:sent']);
  });
});

describe('getVolume', () => {
  const events = [
    event({ tradeId: 'a' }),
    event({ tradeId: 'b', side: 'sell', occurredAt: day(2) }),
    event({
      tradeId: 'c',
      isin: 'SE0000667925',
      market: 'XSTO',
      tradeCurrency: 'SEK',
      filledQuantity: 10,
      avgPrice: 30,
      settlementAmount: 300,
    }),
  ];

  test('sums settlement amounts when no trade currency is filtered', () => {
    const result = getVolume(events, {}, 'tradeCurrency', bucket);

    expect(result.currency).toBe('SEK');
    expect(result.trades).toBe(3);
    expect(result.amount).toBe(4900);
    expect(result.breakdown).toEqual([
      { label: 'EUR', trades: 2, quantity: 200, amount: 4600 },
      { label: 'SEK', trades: 1, quantity: 10, amount: 300 },
    ]);
  });

  test('uses the trade currency amount when filtered on a trade currency', () => {
    const result = getVolume(events, { tradeCurrency: 'EUR' }, 'side', bucket);

    expect(result.currency).toBe('EUR');
    expect(result.amount).toBe(400);
    expect(result.breakdown.map(r => r.label)).toEqual(['buy', 'sell']);
  });

  test('splits the series by side and time bucket', () => {
    const result = getVolume(events, { market: 'XHEL' }, 'isin', bucket);

    expect(result.series).toEqual([
      { side: 'buy', date: day(1), amount: 2300 },
      { side: 'sell', date: day(2), amount: 2300 },
    ]);
  });
});
