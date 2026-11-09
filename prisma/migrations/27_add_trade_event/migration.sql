-- CreateTable
CREATE TABLE "trade_event" (
    "trade_event_id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "session_id" UUID,
    "user_hash" VARCHAR(128),
    "trade_id" UUID NOT NULL,
    "order_id" VARCHAR(100),
    "step" VARCHAR(20) NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "product" VARCHAR(10) NOT NULL,
    "side" VARCHAR(10) NOT NULL,
    "isin" VARCHAR(12),
    "instrument_name" VARCHAR(200),
    "market" VARCHAR(10),
    "origin" VARCHAR(20),
    "trade_currency" VARCHAR(3),
    "settlement_currency" VARCHAR(3),
    "quantity_type" VARCHAR(10),
    "quantity" DECIMAL(24,8),
    "limit_price" DECIMAL(24,8),
    "filled_quantity" DECIMAL(24,8),
    "avg_price" DECIMAL(24,8),
    "settlement_amount" DECIMAL(24,4),
    "order_status" VARCHAR(30),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trade_event_pkey" PRIMARY KEY ("trade_event_id")
);

-- CreateIndex
CREATE INDEX "trade_event_website_id_occurred_at_idx" ON "trade_event"("website_id", "occurred_at");

-- CreateIndex
CREATE INDEX "trade_event_website_id_order_id_idx" ON "trade_event"("website_id", "order_id");

-- CreateIndex
CREATE INDEX "trade_event_trade_id_idx" ON "trade_event"("trade_id");

