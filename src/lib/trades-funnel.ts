import {
  TRADE_ABANDON_MINUTES,
  TRADE_OUTCOME_STEPS,
  type TradeEvent,
  type TradeOutcomeStep,
} from './trades';

export const TRADE_FUNNEL_STAGES = ['started', 'estimated', 'sent', 'filled'] as const;
export type TradeFunnelStage = (typeof TRADE_FUNNEL_STAGES)[number];

export type TradeOutcomeCategory =
  | 'filled'
  | 'partiallyFilled'
  | 'cancelled'
  | 'expired'
  | 'rejected'
  | 'failed'
  | 'open';

export interface FunnelStage {
  stage: TradeFunnelStage;
  trades: number;
  // Trades that reached the previous stage but not this one.
  dropped: number;
  // The part of `dropped` that can still move on: in progress before `sent`, open orders after.
  waiting: number;
}

export interface FunnelResult {
  stages: FunnelStage[];
  outcomes: { outcome: TradeOutcomeCategory; trades: number }[];
  medianMinutesToSend: number | null;
  estimatesPerSentTrade: number | null;
}

interface TradeSummary {
  started: boolean;
  estimates: number;
  startedAt?: Date;
  sentAt?: Date;
  lastAt: Date;
  outcome?: TradeOutcomeStep;
  filledQuantity: number;
}

const OUTCOMES = new Set<string>(TRADE_OUTCOME_STEPS);

function summarize(events: TradeEvent[]) {
  const trades = new Map<string, TradeSummary>();

  for (const e of [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())) {
    const t = trades.get(e.tradeId) ?? {
      started: false,
      estimates: 0,
      lastAt: e.occurredAt,
      filledQuantity: 0,
    };
    t.lastAt = e.occurredAt;

    if (e.step === 'started') {
      t.started = true;
      t.startedAt ??= e.occurredAt;
    } else if (e.step === 'estimated') {
      t.estimates += 1;
    } else if (e.step === 'sent') {
      t.sentAt ??= e.occurredAt;
    } else if (OUTCOMES.has(e.step)) {
      t.outcome = e.step as TradeOutcomeStep;
      t.filledQuantity = e.filledQuantity ?? 0;
    }

    trades.set(e.tradeId, t);
  }

  return [...trades.values()];
}

function categorize(t: TradeSummary): TradeOutcomeCategory {
  if (!t.outcome) return 'open';
  if (t.outcome === 'completed' || t.outcome === 'executed') return 'filled';
  if (t.filledQuantity > 0) return 'partiallyFilled';
  return t.outcome;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Only trades with a `started` step are in the funnel. Recurring fund orders and orders placed
// without the app start at `sent` and are left out.
export function getTradeFunnel(events: TradeEvent[], now = new Date()): FunnelResult {
  const trades = summarize(events).filter(t => t.started);
  const abandonBefore = now.getTime() - TRADE_ABANDON_MINUTES * 60_000;

  const reached: Record<TradeFunnelStage, (t: TradeSummary) => boolean> = {
    started: () => true,
    estimated: t => t.estimates > 0 || !!t.sentAt,
    sent: t => !!t.sentAt,
    filled: t => t.filledQuantity > 0,
  };

  const waiting: Record<TradeFunnelStage, (t: TradeSummary) => boolean> = {
    started: () => false,
    estimated: t => t.lastAt.getTime() > abandonBefore,
    sent: t => t.lastAt.getTime() > abandonBefore,
    filled: t => !t.outcome,
  };

  const stages = TRADE_FUNNEL_STAGES.map((stage, index) => {
    const previous = index ? TRADE_FUNNEL_STAGES[index - 1] : null;
    const inPrevious = previous ? trades.filter(reached[previous]) : trades;
    const droppedTrades = inPrevious.filter(t => !reached[stage](t));

    return {
      stage,
      trades: inPrevious.length - droppedTrades.length,
      dropped: previous ? droppedTrades.length : 0,
      waiting: droppedTrades.filter(waiting[stage]).length,
    };
  });

  const sent = trades.filter(reached.sent);
  const minutesToSend = sent.flatMap(t =>
    t.sentAt && t.startedAt ? [(t.sentAt.getTime() - t.startedAt.getTime()) / 60_000] : [],
  );
  const counts = new Map<TradeOutcomeCategory, number>();
  for (const t of sent) {
    const outcome = categorize(t);
    counts.set(outcome, (counts.get(outcome) ?? 0) + 1);
  }

  return {
    stages,
    outcomes: [...counts.entries()]
      .map(([outcome, count]) => ({ outcome, trades: count }))
      .sort((a, b) => b.trades - a.trades),
    medianMinutesToSend: median(minutesToSend),
    estimatesPerSentTrade: sent.length
      ? sent.reduce((sum, t) => sum + t.estimates, 0) / sent.length
      : null,
  };
}
