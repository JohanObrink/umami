/**
 * Posts fake trade steps to a running Umami through POST /api/trades.
 *
 * Usage:
 *   pnpm db:seed-trades <websiteId> [--days 30] [--url http://localhost:3001]
 */
import { generateFakeTradeEvents } from '../src/lib/trades-fake';

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};

const websiteId = args[0]?.startsWith('--') ? undefined : args[0];
const days = Number(option('days', '30'));
const url = option('url', 'http://localhost:3001');

if (!websiteId) {
  console.error('Usage: pnpm db:seed-trades <websiteId> [--days 30] [--url http://localhost:3001]');
  process.exit(1);
}

const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const users = Array.from({ length: 20 }, () => crypto.randomUUID());
const tradeIds = new Map<string, string>();

const endDate = new Date();
const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
const events = generateFakeTradeEvents({ websiteId, startDate, endDate });

let saved = 0;
let failed = 0;

for (const { sessionId: _sessionId, ...event } of events) {
  if (!tradeIds.has(event.tradeId)) tradeIds.set(event.tradeId, crypto.randomUUID());
  const tradeId = tradeIds.get(event.tradeId);
  const userId = users[tradeId.charCodeAt(0) % users.length];
  const jwt = `${base64url({ alg: 'none' })}.${base64url({ sub: userId })}.x`;

  const response = await fetch(`${url}/api/trades`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ ...event, tradeId }),
  });

  if (response.ok) {
    saved++;
  } else if (++failed <= 3) {
    console.error(response.status, await response.text());
  }
}

console.log(`Saved ${saved} of ${events.length} trade steps (${failed} failed).`);
