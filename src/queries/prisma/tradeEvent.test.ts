import { beforeEach, describe, expect, test, vi } from 'vitest';
import { updateTradeFromOrder } from './tradeEvent';

const { findFirst, create } = vi.hoisted(() => ({ findFirst: vi.fn(), create: vi.fn() }));

vi.mock('@/lib/prisma', () => ({
  default: { client: { tradeEvent: { findFirst, create } } },
}));

const WEBSITE = 'b7b1dc66-0825-4dce-9ad5-28428e94a6c6';
const TRADE = '8c437bfd-8736-4c63-bc7d-c152b0f2cb5d';
const occurredAt = new Date('2026-11-09T10:00:00Z');

describe('updateTradeFromOrder', () => {
  beforeEach(() => {
    findFirst.mockReset();
    create.mockReset().mockImplementation(async ({ data }) => data);
  });

  test('logs the step on the trade that sent the order, keeping its fields', async () => {
    findFirst.mockResolvedValue({
      tradeId: TRADE,
      sessionId: null,
      userHash: 'abc',
      product: 'stock',
      side: 'buy',
      isin: 'SE0000108656',
      market: 'XSTO',
      quantity: 100,
    });

    const saved = await updateTradeFromOrder(WEBSITE, 'ORD-1', {
      step: 'completed',
      occurredAt,
      filledQuantity: 100,
      avgPrice: 61.42,
    });

    expect(saved).toMatchObject({
      websiteId: WEBSITE,
      orderId: 'ORD-1',
      tradeId: TRADE,
      step: 'completed',
      userHash: 'abc',
      product: 'stock',
      side: 'buy',
      isin: 'SE0000108656',
      market: 'XSTO',
      filledQuantity: 100,
    });
    expect(saved).not.toHaveProperty('sessionId');
    expect(saved).not.toHaveProperty('quantity');
  });

  test('starts a trade for an unknown order when product and side are given', async () => {
    findFirst.mockResolvedValue(null);

    const saved = await updateTradeFromOrder(WEBSITE, 'FUND-9', {
      step: 'sent',
      occurredAt,
      product: 'fund',
      side: 'buy',
      origin: 'recurring',
    });

    expect(saved.tradeId).toMatch(/^[0-9a-f-]{36}$/);
    expect(saved).toMatchObject({ orderId: 'FUND-9', origin: 'recurring' });
  });

  test('rejects an unknown order without product and side', async () => {
    findFirst.mockResolvedValue(null);

    await expect(
      updateTradeFromOrder(WEBSITE, 'ORD-X', { step: 'cancelled', occurredAt }),
    ).rejects.toThrow('ORD-X');
  });
});
