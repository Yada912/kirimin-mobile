-- Payment gateway transaction ledger (Mock Sandbox / Midtrans / Xendit compatible).
-- Stores idempotency keys, gateway references, payment instructions (QRIS/VA/deep-link),
-- SHA-512 webhook verification signatures, expiry timestamps, and raw webhook audit logs.

CREATE TABLE payment_transactions (
  id                   TEXT PRIMARY KEY,
  order_id             TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key      TEXT UNIQUE,
  gateway              TEXT NOT NULL DEFAULT 'mock_gateway',
  gateway_ref          TEXT NOT NULL UNIQUE,
  method               TEXT NOT NULL,
  channel              TEXT NOT NULL,
  amount               INTEGER NOT NULL,
  status               TEXT NOT NULL DEFAULT 'pending',
  instructions_json    TEXT NOT NULL DEFAULT '{}',
  signature_key        TEXT,
  webhook_payload_json TEXT,
  expires_at           TEXT NOT NULL,
  paid_at              TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);
CREATE INDEX payment_tx_order ON payment_transactions (order_id, created_at);
CREATE INDEX payment_tx_ref ON payment_transactions (gateway_ref);
CREATE INDEX payment_tx_status ON payment_transactions (status, expires_at);
