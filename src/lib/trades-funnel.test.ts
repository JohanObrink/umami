import { describe, expect, test } from 'vitest';
import type { TradeEvent, TradeStep } from './trades';
import { getTradeFunnel } from './trades-funnel';

const NOW = new Date(Date.UTC(2026, 10, 9, 12, 0));
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

function step(
  tradeId: string,
  s: TradeStep,
  minutes: number,
  extra: Partial<TradeEvent> = {},
): TradeEvent {
  return {
    websiteId: 'w',
    tradeId,
    step: s,
    occurredAt: minutesAgo(minutes),
    product: 'stock',
    side: 'buy',
    ...extra,
  };
}

describe('getTradeFunnel', () => {
  const events = [
    // Filled after two estimates.
    step('a', 'started', 60),
    step('a', 'estimated', 58),
    step('a', 'estimated', 55),
    step('a', 'sent', 54),
    step('a', 'completed', 50, { filledQuantity: 10 }),
    // Abandoned after estimating.
    step('b', 'started', 60),
    step('b', 'estimated', 59),
    // Still estimating, inside the 10 minute window.
    step('c', 'started', 8),
    step('c', 'estimated', 5),
    // Sent and still open.
    step('d', 'started', 30),
    step('d', 'estimated', 28),
    step('d', 'sent', 26),
    // Cancelled after a partial fill.
    step('e', 'started', 40),
    step('e', 'estimated', 39),
    step('e', 'sent', 38),
    step('e', 'cancelled', 20, { filledQuantity: 4 }),
    // Recurring fund order: never started, so outside the funnel.
    step('f', 'sent', 30, { product: 'fund', origin: 'recurring' }),
    step('f', 'executed', 10, { product: 'fund', filledQuantity: 3 }),
  ];

  const result = getTradeFunnel(events, NOW);

  test('counts trades reaching each stage and splits drop-offs', () => {
    expect(result.stages).toEqual([
      { stage: 'started', trades: 5, dropped: 0, waiting: 0 },
      { stage: 'estimated', trades: 5, dropped: 0, waiting: 0 },
      { stage: 'sent', trades: 3, dropped: 2, waiting: 1 },
      { stage: 'filled', trades: 2, dropped: 1, waiting: 1 },
    ]);
  });

  test('categorizes outcomes of sent trades', () => {
    expect(result.outcomes).toEqual(
      expect.arrayContaining([
        { outcome: 'filled', trades: 1 },
        { outcome: 'partiallyFilled', trades: 1 },
        { outcome: 'open', trades: 1 },
      ]),
    );
  });

  test('measures time to send and estimates per sent trade', () => {
    expect(result.medianMinutesToSend).toBe(4);
    expect(result.estimatesPerSentTrade).toBeCloseTo(4 / 3);
  });

  test('a trade sent without an estimate still counts as past the estimate stage', () => {
    const funnel = getTradeFunnel([step('x', 'started', 30), step('x', 'sent', 29)], NOW);

    expect(funnel.stages.map(s => s.trades)).toEqual([1, 1, 1, 0]);
  });
});
