export const TRADE_FUNNEL_STEPS = ['started', 'estimated', 'sent'] as const;
export const TRADE_OUTCOME_STEPS = [
  'executed',
  'completed',
  'cancelled',
  'rejected',
  'expired',
  'failed',
] as const;

// A trade that has not reached `sent` within this many minutes of its latest step is abandoned.
// Abandonment is derived when querying; it is never stored as a step.
export const TRADE_ABANDON_MINUTES = 10;

export type TradeFunnelStep = (typeof TRADE_FUNNEL_STEPS)[number];
export type TradeOutcomeStep = (typeof TRADE_OUTCOME_STEPS)[number];
export type TradeStep = TradeFunnelStep | 'modified' | TradeOutcomeStep;

export type TradeProduct = 'stock' | 'etf' | 'fund';
export type TradeSide = 'buy' | 'sell' | 'switch';
export type TradeOrigin = 'manual' | 'recurring' | 'other';

// Stock/ETF orders are always in shares; fund orders can be any of the three.
export type TradeQuantityType = 'shares' | 'amount' | 'units' | 'percent';

// One row per step. Never updated, only appended.
export interface TradeEvent {
  websiteId: string;
  sessionId?: string;
  // Hash of the app user's id, never the id itself.
  userHash?: string;
  tradeId: string;
  // Set from the `sent` step onward.
  orderId?: string;
  step: TradeStep;
  // The time the step happened in the app or in TradeFlow, not the time it reached Umami.
  occurredAt: Date;

  product: TradeProduct;
  side: TradeSide;
  // For a fund switch, the fund switched to.
  isin?: string;
  instrumentName?: string;
  // Market identifier code (MIC), such as XSTO. Stock/ETF only.
  market?: string;
  origin?: TradeOrigin;

  // The instrument's currency.
  tradeCurrency?: string;
  // The account's currency.
  settlementCurrency?: string;

  quantityType?: TradeQuantityType;
  quantity?: number;
  // Stock/ETF only.
  limitPrice?: number;

  // Shares filled for stock/ETF, units for funds.
  filledQuantity?: number;
  // Average fill price for stock/ETF, NAV for funds. In the trade currency.
  avgPrice?: number;
  // Total paid or received, in the settlement currency.
  settlementAmount?: number;

  // The raw TradeFlow status, such as ACTIVE, DONE_FOR_DAY or PROCESSING.
  orderStatus?: string;
}
