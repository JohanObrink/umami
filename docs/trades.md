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
`trade_id`. Amounts are `DECIMAL`. `session_id` is optional and has no foreign key, because app
steps are not part of a browser session. Deleting a website deletes its trade events.

Queries are in `src/queries/prisma/tradeEvent.ts`:

- `saveTradeEvent` stores a step. Without a `tradeId`, it takes the `tradeId` of the first step
  with the same `orderId`. If there is none, as for recurring fund orders the app never reported,
  it derives a stable UUID from the website ID and order ID.
- `getTradeEvents` returns every step of the trades with any step in the date range, so a trade
  started before the range is complete.

### Ingestion: `POST /api/trades`

The app sends one step per request:

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

`tradeId` or `orderId` is required. The response is `{ "tradeId": "…" }`.

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

- `src/lib/trades-fake.ts` generates realistic fake steps for testing and demos.
- Tests are in `src/lib/trades-*.test.ts`.
- To try ingestion with curl, build an unsigned JWT such as
  `base64url('{"alg":"none"}').base64url('{"sub":"<user id>"}').x`.

## TODO

- **Order updates from Pub/Sub.** Listen to the TradeFlow order update topic, map each order
  snapshot to a step (`modified` or an outcome) and save it with `saveTradeEvent`, by `orderId`.
  This path has no user JWT. The message format, topic, subscription and credentials are still
  unknown.
- **Confirm the JWT header and claim** that the WAF/IAP produces. Defaults are
  `Authorization: Bearer` and `sub`.
- **App integration.** The app must generate the `tradeId` and send `started`, `estimated` and
  `sent`, with `orderId` on `sent`.
- **Fund switch,** once TradeFlow supports it.
- **Server-side aggregation,** if returning raw events gets too slow for large date ranges.
