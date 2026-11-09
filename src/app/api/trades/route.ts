import { z } from 'zod';
import { fetchWebsite } from '@/lib/load';
import { parseRequest } from '@/lib/request';
import { badRequest, json, unauthorized } from '@/lib/response';
import { TRADE_FUNNEL_STEPS, TRADE_OUTCOME_STEPS } from '@/lib/trades';
import { getTradeUserId, hashTradeUserId } from '@/lib/trades-auth';
import { saveTradeEvent } from '@/queries/prisma';

const amount = z.number().finite().optional();

const schema = z
  .object({
    websiteId: z.uuid(),
    sessionId: z.uuid().optional(),
    tradeId: z.uuid().optional(),
    orderId: z.string().max(100).optional(),
    step: z.enum([...TRADE_FUNNEL_STEPS, 'modified', ...TRADE_OUTCOME_STEPS]),
    occurredAt: z.coerce.date(),
    product: z.enum(['stock', 'etf', 'fund']),
    side: z.enum(['buy', 'sell', 'switch']),
    isin: z.string().max(12).optional(),
    instrumentName: z.string().max(200).optional(),
    market: z.string().max(10).optional(),
    origin: z.enum(['manual', 'recurring', 'other']).optional(),
    tradeCurrency: z.string().length(3).optional(),
    settlementCurrency: z.string().length(3).optional(),
    quantityType: z.enum(['shares', 'amount', 'units', 'percent']).optional(),
    quantity: amount,
    limitPrice: amount,
    filledQuantity: amount,
    avgPrice: amount,
    settlementAmount: amount,
    orderStatus: z.string().max(30).optional(),
  })
  .refine(data => data.tradeId || data.orderId, {
    message: 'tradeId or orderId is required',
  });

export async function POST(request: Request) {
  const userId = getTradeUserId(request);

  if (!userId) {
    return unauthorized();
  }

  const { body, error } = await parseRequest(request, schema, { skipAuth: true });

  if (error) {
    return error();
  }

  const website = await fetchWebsite(body.websiteId);

  if (!website) {
    return badRequest({ message: 'Website not found.' });
  }

  const { tradeId } = await saveTradeEvent({ ...body, userHash: hashTradeUserId(userId) });

  return json({ tradeId });
}
