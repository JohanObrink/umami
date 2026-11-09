import { uuid } from '@/lib/crypto';
import prisma from '@/lib/prisma';
import type { TradeEvent } from '@/lib/trades';

export type NewTradeEvent = Omit<TradeEvent, 'tradeId'> & { tradeId?: string };

const INHERITED_FIELDS = [
  'sessionId',
  'userHash',
  'product',
  'side',
  'isin',
  'instrumentName',
  'market',
  'origin',
  'tradeCurrency',
  'settlementCurrency',
  'quantityType',
] as const;

const DECIMAL_FIELDS = [
  'quantity',
  'limitPrice',
  'filledQuantity',
  'avgPrice',
  'settlementAmount',
] as const;

// A step without a trade id belongs to the trade that sent the order. Orders the app never
// reported (such as recurring fund orders) get a trade id derived from the order id, so all
// their updates land on the same trade.
export async function resolveTradeId(websiteId: string, orderId?: string) {
  if (!orderId) return null;

  const sent = await prisma.client.tradeEvent.findFirst({
    where: { websiteId, orderId },
    orderBy: { occurredAt: 'asc' },
    select: { tradeId: true },
  });

  return sent?.tradeId ?? uuid(websiteId, orderId);
}

export async function saveTradeEvent(event: NewTradeEvent) {
  const tradeId = event.tradeId ?? (await resolveTradeId(event.websiteId, event.orderId));

  if (!tradeId) {
    throw new Error('A trade event needs a tradeId or an orderId.');
  }

  return prisma.client.tradeEvent.create({
    data: { ...event, id: uuid(), tradeId },
  });
}

export type OrderUpdate = Partial<Omit<TradeEvent, 'websiteId' | 'orderId' | 'tradeId'>> &
  Pick<TradeEvent, 'step' | 'occurredAt'>;

// For the order listener. Logs a step for the trade that sent the order. Fields the update leaves
// out, such as product, side and instrument, are copied from the trade's latest step.
export async function updateTradeFromOrder(
  websiteId: string,
  orderId: string,
  update: OrderUpdate,
) {
  const latest = await prisma.client.tradeEvent.findFirst({
    where: { websiteId, orderId },
    orderBy: { occurredAt: 'desc' },
  });

  const inherited = latest
    ? (Object.fromEntries(
        INHERITED_FIELDS.filter(key => latest[key] != null).map(key => [key, latest[key]]),
      ) as Partial<TradeEvent>)
    : {};
  const event = { ...inherited, ...update, websiteId, orderId } as NewTradeEvent;

  if (!event.product || !event.side) {
    throw new Error(`Unknown order ${orderId}: product and side are required.`);
  }

  return saveTradeEvent({ ...event, tradeId: latest?.tradeId });
}

// Includes earlier steps of trades with any step in the range, so a trade started just before
// the range and finished inside it is complete.
export async function getTradeEvents(
  websiteId: string,
  startDate: Date,
  endDate: Date,
): Promise<TradeEvent[]> {
  const inRange = await prisma.client.tradeEvent.findMany({
    where: { websiteId, occurredAt: { gte: startDate, lte: endDate } },
    distinct: ['tradeId'],
    select: { tradeId: true },
  });

  const rows = await prisma.client.tradeEvent.findMany({
    where: { websiteId, tradeId: { in: inRange.map(r => r.tradeId) } },
    orderBy: { occurredAt: 'asc' },
  });

  return rows.map(({ id: _id, createdAt: _createdAt, ...row }) => {
    const event: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row)) {
      if (value === null) continue;
      event[key] = (DECIMAL_FIELDS as readonly string[]).includes(key) ? Number(value) : value;
    }

    return event as unknown as TradeEvent;
  });
}
