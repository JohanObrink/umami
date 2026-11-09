import { beforeEach, describe, expect, test, vi } from 'vitest';
import { updateTradeFromOrder } from './tradeEvent';

const { findFirst, create } = vi.hoisted(() => ({ findFirst: vi.fn(), create: vi.fn() }));

vi.mock('@/lib/prisma', () => ({
  default: { client: { tradeEvent: { findFirst, create } } },
}));

const WEBSITE = 'b7b1dc66-0825-4dce-9ad5-28428e94a6c6';
const TRADE = '8c437bfd-8736-4c63-bc7d-c152b0f2cb5d';

const order = {
  step: 'completed' as const,
  occurredAt: new Date('2026-11-09T10:00:00Z'),
  product: 'stock' as const,
  side: 'buy' as const,
  filledQuantity: 100,
};

describe('updateTradeFromOrder', () => {
  beforeEach(() => {
    findFirst.mockReset();
    create.mockReset().mockImplementation(async ({ data }) => data);
  });

  test('logs the order on the trade found by order id, under its website, without a session', async () => {
    findFirst.mockResolvedValue({ tradeId: TRADE, websiteId: WEBSITE });

    const saved = await updateTradeFromOrder('ORD-1', order);

    expect(findFirst.mock.calls[0][0].where).toEqual({ orderId: 'ORD-1' });
    expect(saved).toMatchObject({ ...order, orderId: 'ORD-1', tradeId: TRADE, websiteId: WEBSITE });
    expect(saved).not.toHaveProperty('sessionId');
  });

  test('ignores an order Umami has not seen', async () => {
    findFirst.mockResolvedValue(null);

    expect(await updateTradeFromOrder('ORD-X', order)).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
});
