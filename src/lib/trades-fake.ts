import type {
  TradeEvent,
  TradeOrigin,
  TradeOutcomeStep,
  TradeProduct,
  TradeSide,
  TradeStep,
} from './trades';

interface FakeInstrument {
  isin: string;
  name: string;
  product: TradeProduct;
  currency: string;
  market?: string;
  price: number;
}

// Names are only for the prototype UI; TradeEvent has no instrument name.
export const FAKE_INSTRUMENTS: FakeInstrument[] = [
  {
    isin: 'SE0000667925',
    name: 'Telia',
    product: 'stock',
    currency: 'SEK',
    market: 'XSTO',
    price: 31,
  },
  {
    isin: 'FI0009801310',
    name: 'Telia (Helsinki)',
    product: 'stock',
    currency: 'EUR',
    market: 'XHEL',
    price: 2.7,
  },
  {
    isin: 'SE0000108656',
    name: 'Ericsson B',
    product: 'stock',
    currency: 'SEK',
    market: 'XSTO',
    price: 82,
  },
  {
    isin: 'SE0000148884',
    name: 'SEB A',
    product: 'stock',
    currency: 'SEK',
    market: 'XSTO',
    price: 165,
  },
  {
    isin: 'FI0009000681',
    name: 'Nokia',
    product: 'stock',
    currency: 'EUR',
    market: 'XHEL',
    price: 3.9,
  },
  {
    isin: 'DK0062498333',
    name: 'Novo Nordisk B',
    product: 'stock',
    currency: 'DKK',
    market: 'XCSE',
    price: 480,
  },
  {
    isin: 'US0378331005',
    name: 'Apple',
    product: 'stock',
    currency: 'USD',
    market: 'XNAS',
    price: 230,
  },
  {
    isin: 'US67066G1040',
    name: 'Nvidia',
    product: 'stock',
    currency: 'USD',
    market: 'XNAS',
    price: 140,
  },
  {
    isin: 'SE0010296582',
    name: 'XACT OMXS30',
    product: 'etf',
    currency: 'SEK',
    market: 'XSTO',
    price: 290,
  },
  {
    isin: 'IE00B5BMR087',
    name: 'iShares Core S&P 500',
    product: 'etf',
    currency: 'USD',
    market: 'XLON',
    price: 590,
  },
  {
    isin: 'IE00B4L5Y983',
    name: 'iShares Core MSCI World',
    product: 'etf',
    currency: 'EUR',
    market: 'XETR',
    price: 105,
  },
  { isin: 'LU0208853274', name: 'SEB Sverigefond', product: 'fund', currency: 'SEK', price: 640 },
  {
    isin: 'SE0000984155',
    name: 'SEB Hållbarhetsfond Global',
    product: 'fund',
    currency: 'SEK',
    price: 38,
  },
  {
    isin: 'LU0957649758',
    name: 'SEB Global Equal Opportunity',
    product: 'fund',
    currency: 'EUR',
    price: 14,
  },
];

const FX_TO_SEK: Record<string, number> = { SEK: 1, EUR: 11.5, USD: 10.6, DKK: 1.54 };
const MINUTE = 60_000;

// Deterministic PRNG so reloading the same date range shows the same data.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function pickWeighted<T>(rand: () => number, items: [T, number][]): T {
  const total = items.reduce((sum, [, w]) => sum + w, 0);
  let r = rand() * total;
  for (const [item, weight] of items) {
    r -= weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1][0];
}

export interface FakeTradeOptions {
  websiteId: string;
  startDate: Date;
  endDate: Date;
  tradesPerDay?: number;
}

export function generateFakeTradeEvents({
  websiteId,
  startDate,
  endDate,
  tradesPerDay = 60,
}: FakeTradeOptions): TradeEvent[] {
  const end = Math.min(endDate.getTime(), Date.now());
  const start = startDate.getTime();
  if (end <= start) return [];

  const days = (end - start) / (24 * 60 * MINUTE);
  const count = Math.min(Math.round(days * tradesPerDay), 20_000);
  const events: TradeEvent[] = [];
  const rand = mulberry32(hash(`${websiteId}:${start}:${end - (end % (60 * MINUTE))}`));

  for (let i = 0; i < count; i++) {
    const startedAt = start + rand() * (end - start);
    events.push(...generateTrade(rand, websiteId, new Date(startedAt), end));
  }

  return events;
}

function generateTrade(rand: () => number, websiteId: string, startedAt: Date, now: number) {
  const instrument = pickWeighted(
    rand,
    FAKE_INSTRUMENTS.map(i => [i, i.product === 'stock' ? 3 : i.product === 'etf' ? 2 : 2]),
  );
  const isFund = instrument.product === 'fund';
  const side: TradeSide = rand() < 0.6 ? 'buy' : 'sell';
  const origin: TradeOrigin = isFund && rand() < 0.4 ? 'recurring' : 'manual';
  const tradeId = `t-${hash(`${websiteId}${startedAt.getTime()}${rand()}`).toString(36)}`;
  const orderId = `o-${hash(tradeId).toString(36)}`;
  const price = instrument.price * (0.9 + rand() * 0.2);

  const base = {
    websiteId,
    sessionId: origin === 'manual' ? `s-${tradeId}` : undefined,
    tradeId,
    product: instrument.product,
    side,
    isin: instrument.isin,
    market: instrument.market,
    origin,
    tradeCurrency: instrument.currency,
    settlementCurrency: 'SEK',
  };

  const events: TradeEvent[] = [];
  let t = startedAt.getTime();
  const push = (step: TradeStep, extra: Partial<TradeEvent> = {}) => {
    if (t > now) return false;
    events.push({ ...base, step, occurredAt: new Date(t), ...extra });
    return true;
  };

  const quantityType = isFund ? (rand() < 0.8 ? 'amount' : 'units') : 'shares';
  let quantity =
    quantityType === 'amount'
      ? Math.round((500 + rand() * 30_000) / 100) * 100
      : quantityType === 'units'
        ? Math.round(rand() * 200 * 100) / 100
        : Math.max(
            1,
            Math.round((2_000 + rand() * 80_000) / (price * FX_TO_SEK[instrument.currency])),
          );
  let limitPrice = isFund
    ? undefined
    : Math.round(price * (side === 'buy' ? 1.002 : 0.998) * 100) / 100;
  const order = () => ({ quantityType, quantity, limitPrice }) as Partial<TradeEvent>;

  if (origin === 'manual') {
    if (!push('started')) return events;
    if (rand() < 0.25) return events;

    const estimates = 1 + Math.floor(rand() * rand() * 4);
    for (let e = 0; e < estimates; e++) {
      t += (0.5 + rand() * 6) * MINUTE;
      if (!push('estimated', order())) return events;
    }
    if (rand() < 0.3) return events;
    t += (0.2 + rand() * 3) * MINUTE;
  }

  if (!push('sent', { ...order(), orderId })) return events;

  if (!isFund && rand() < 0.15) {
    t += (5 + rand() * 120) * MINUTE;
    quantity = Math.max(1, Math.round(quantity * (0.5 + rand() * 0.5)));
    limitPrice = Math.round((limitPrice ?? price) * (side === 'buy' ? 1.01 : 0.99) * 100) / 100;
    if (!push('modified', { ...order(), orderId, orderStatus: 'ACTIVE' })) return events;
  }

  const outcome: TradeOutcomeStep = isFund
    ? pickWeighted(rand, [
        ['executed', 92],
        ['cancelled', 5],
        ['failed', 3],
      ])
    : pickWeighted(rand, [
        ['completed', 72],
        ['cancelled', 11],
        ['expired', 7],
        ['rejected', 10],
      ]);

  const filledQuantity =
    outcome === 'completed'
      ? quantity
      : outcome === 'executed'
        ? quantityType === 'amount'
          ? Math.round((quantity / price) * 10_000) / 10_000
          : quantity
        : (outcome === 'cancelled' || outcome === 'expired') && rand() < 0.4
          ? Math.max(1, Math.floor(quantity * rand()))
          : 0;
  const avgPrice = filledQuantity
    ? Math.round(price * (0.995 + rand() * 0.01) * 100) / 100
    : undefined;
  const settlementAmount = avgPrice
    ? Math.round(filledQuantity * avgPrice * FX_TO_SEK[instrument.currency] * 100) / 100
    : undefined;
  const result = { ...order(), orderId, filledQuantity, avgPrice, settlementAmount };

  t += (isFund ? 12 * 60 + rand() * 12 * 60 : 1 + rand() * 300) * MINUTE;
  if (!push(outcome, { ...result, orderStatus: outcome.toUpperCase() })) return events;

  if (outcome === 'executed') {
    t += 2 * 24 * 60 * MINUTE;
    push('completed', { ...result, orderStatus: 'COMPLETED' });
  }

  return events;
}
