# Trades

This fork adds **trades** to Umami: stock, ETF and fund orders placed through SEB's TradeFlow API.
Every step of a trade is logged, from the moment the user presses Buy or Sell until TradeFlow
reports the outcome. The **Trades** page of a website shows a funnel and the traded volume.

Trades are PostgreSQL only.

## Ideas

- **Append-only log.** A trade is a series of steps, one row each. Rows are never updated. All
  state, such as abandonment and outcome, is derived when reading.
- **The app owns the trade ID.** No order ID exists before the order is posted to TradeFlow, so
  the app generates a `tradeId` (UUID) at `started`. The `sent` step carries both `tradeId` and
  TradeFlow's `orderId`. Later steps only need the `orderId`.
- **Outcomes carry the final state.** Individual fills are not stored. Outcome steps carry
  `filledQuantity`, `avgPrice` and `settlementAmount`. A `modified` step carries the full order
  state after the modification.
- **Abandonment is derived.** A trade not sent within 10 minutes (`TRADE_ABANDON_MINUTES`) of its
  latest step is abandoned. A new estimate resets the clock.
- **Volume is in SEK unless filtered.** Settlement in other currencies is rare, so volume is
  summed as `settlementAmount` in SEK. Filtering on a trade currency switches to
  `filledQuantity × avgPrice` in that currency.
- **Users are pseudonymous.** The app's user ID is hashed before it is stored.

## Steps

| Step | Who sends it | Meaning |
|---|---|---|
| `started` | App | The user pressed Buy or Sell. Instrument and side are known. |
| `estimated` | App | The user got a cost estimate. Can repeat. |
| `sent` | App | The order was posted to TradeFlow. First step with `orderId`. |
| `modified` | App or order updates | An accepted modification, with the full order state. Stock/ETF only. |
| `executed` | Order updates | Fund order executed. `completed` follows. |
| `completed` | Order updates | Done. Carries the final fill. |
| `cancelled`, `rejected`, `expired`, `failed` | Order updates | Ended. May carry a partial fill. |

Fund orders differ from stock and ETF orders: they have no modify, can only be cancelled before
cut-off, go through `executed` before `completed`, have an `origin` (`manual`, `recurring`,
`other`) and are always settled from SEK accounts. Fund switches are not in TradeFlow yet; the
model allows `side = switch`, with `isin` being the fund switched to.

The fields of each step are the `TradeEvent` type in `src/lib/trades.ts`.

## Implementation

### Storage

The `trade_event` table (`TradeEvent` in `prisma/schema.prisma`, migration `27_add_trade_event`)
has one row per step. It is indexed on `(website_id, occurred_at)`, `(website_id, order_id)` and
`trade_id`. Amounts are `DECIMAL`. `session_id` links a step to the Umami session that sent it.
It is optional and has no foreign key, because order updates have no session. Deleting a website
deletes its trade events.

Queries are in `src/queries/prisma/tradeEvent.ts`:

- `saveTradeEvent` stores a step. Without a `tradeId`, it takes the `tradeId` of the first step
  with the same `orderId`. If there is none, as for recurring fund orders the app never reported,
  it derives a stable UUID from the website ID and order ID.
- `updateTradeFromOrder(orderId, order)` is for the order listener. It finds the trade by
  `orderId` and logs the order data as a step on it, under the trade's website ID, which stays the
  same across all updates. Order updates have no session. Orders Umami has not seen are ignored.
- `getTradeEvents` returns every step of the trades with any step in the date range, so a trade
  started before the range is complete.

### Tracker: `umami.trade(step, data)`

The app logs steps with the Umami tracker (`src/tracker/index.ts`, built to `public/script.js`).
`umami.trade` posts one step to `POST /api/trades`. It adds the website ID and sends the tracker's
session token, so the step is linked to the current session. It returns the response,
`{ tradeId }`.

```js
const tradeId = crypto.randomUUID();

umami.trade('started', { tradeId, occurredAt, product: 'stock', side: 'buy', isin: 'SE0000108656' });
umami.trade('estimated', { tradeId, occurredAt, product: 'stock', side: 'buy' });
umami.trade('sent', { tradeId, orderId, occurredAt, product: 'stock', side: 'buy', quantity: 100 });
```

### Ingestion: `POST /api/trades`

The tracker sends one step per request:

```json
{
  "websiteId": "…",
  "tradeId": "…",
  "step": "started",
  "occurredAt": "2026-11-09T10:00:00Z",
  "product": "stock",
  "side": "buy",
  "isin": "SE0000108656",
  "instrumentName": "Ericsson B",
  "market": "XSTO",
  "tradeCurrency": "SEK"
}
```

`tradeId` or `orderId` is required. The response is `{ "tradeId": "…" }`. A valid tracker
session token in the `x-umami-cache` header sets the step's session.

Authentication is specific to this fork. The app sends an access token, and a WAF/IAP in front of
Umami validates it and replaces it with a user JWT. Umami does not verify the JWT. It splits it on
`.`, base64url-decodes the payload and reads the user ID (`src/lib/trades-auth.ts`). Without a
user ID the request is rejected with 401 and nothing is stored. The user ID is stored as
`user_hash`, a SHA-512 hash keyed with the app secret.

| Environment variable | Default | Meaning |
|---|---|---|
| `TRADES_JWT_HEADER` | `authorization` | Header carrying the JWT. A `Bearer ` prefix is removed. |
| `TRADES_USER_CLAIM` | `sub` | JWT claim holding the user ID. |

### Reading: `GET /api/websites/{websiteId}/trades`

This takes a date range (`startAt`/`endAt`) and returns `{ events }` for logged-in users who can
view the website. The page loads it with `useTradeEventsQuery`, and the browser computes the
funnel and volume.

### Trades page

The page is in `src/app/(main)/websites/[websiteId]/(reports)/trades/`. Filters on trade currency,
market, instrument, side, product and origin apply to both views. A trade matches on the latest
known value of each field across its steps.

**Funnel** (`src/lib/trades-funnel.ts`):

- The stages are started → estimated → sent → filled. Only trades with a `started` step count;
  recurring orders begin at `sent` and are left out.
- A trade sent without an estimate counts as estimated.
- Filled means `filledQuantity > 0` on the latest outcome.
- Drop-off at each stage is split into abandoned (or not filled) and still waiting. Waiting means
  activity within 10 minutes before `sent`, or no outcome yet after it.
- Also shown: the median time from start to send, estimates per sent trade, and the outcomes of
  sent trades.

**Volume** (`src/lib/trades-volume.ts`) uses the latest outcome of each filled trade, so a fund's
`completed` replaces its `executed`. It shows totals, a buy/sell chart over time, and a breakdown
by any dimension. Clicking a row in the breakdown adds it as a filter.

Labels are in English only (`public/intl/messages/en-US.json`). Other languages show the message
key, such as `label.trades`, as for other untranslated Umami labels.

### Development

Local setup:

```sh
docker run -d --name umami-trades-pg -p 5433:5432 \
  -e POSTGRES_USER=umami -e POSTGRES_PASSWORD=umami -e POSTGRES_DB=umami postgres:15
# .env (not committed)
#   DATABASE_URL=postgresql://umami:umami@localhost:5433/umami
#   APP_SECRET=<any random string>
pnpm install
pnpm build:db && pnpm check:db   # generate the Prisma client, apply migrations
PORT=3001 pnpm dev               # log in as admin / umami and add a website
pnpm db:seed-trades <websiteId>  # post 30 days of fake trade steps to the running server
```

- `scripts/seed-trades.ts` posts steps from `src/lib/trades-fake.ts` through `POST /api/trades`,
  with fake unsigned JWTs. Options: `--days`, `--url`.
- Tests are in `src/lib/trades-*.test.ts`.
- To try ingestion with curl, build an unsigned JWT such as
  `base64url('{"alg":"none"}').base64url('{"sub":"<user id>"}').x`.
- The TradeFlow API spec, which the steps and fields are based on, is
  `packages/schema/schemas/tradeflow-api.yaml` in the `tradeflow-monorepo` repository.

## TODO

- **Order updates from Pub/Sub.** Listen to the TradeFlow order update topic, map each order
  snapshot to a step (`modified` or an outcome) and call `updateTradeFromOrder`. This path has no
  user JWT. The message format, topic, subscription and credentials are still unknown.
- **Confirm the JWT header and claim** that the WAF/IAP produces. Defaults are
  `Authorization: Bearer` and `sub`.
- **React Native app.** Run the tracker in the app, wire it into React Navigation, and call
  `umami.trade` for `started`, `estimated` and `sent`, with `orderId` on `sent`.
- **Fund switch,** once TradeFlow supports it.
- **Server-side aggregation,** if returning raw events gets too slow for large date ranges.
