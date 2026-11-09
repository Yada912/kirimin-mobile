-- MVP round 2: settings, sessions, verification, recurring trips, push,
-- saved places, problem reports and the driver wallet.
-- Keep one statement per block; the migrator splits on semicolons at line ends.

-- Sessions: bumping token_version signs out every device (password change, "keluar dari semua perangkat").
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN settings_json TEXT NOT NULL DEFAULT '{}';
-- X4: none | pending | verified | rejected. `verified` stays as the flag the rest of the code reads.
ALTER TABLE users ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE users ADD COLUMN ktp_photo_url TEXT;
ALTER TABLE users ADD COLUMN selfie_photo_url TEXT;
ALTER TABLE users ADD COLUMN verification_note TEXT;
-- Deleted accounts are anonymised, not removed, so the other side's order history stays intact.
ALTER TABLE users ADD COLUMN deleted_at TEXT;
UPDATE users SET verification_status = 'verified' WHERE verified = 1;

-- Recurring routes: every occurrence of a weekly schedule shares one series_id.
ALTER TABLE trips ADD COLUMN series_id TEXT;
UPDATE trips SET series_id = id WHERE series_id IS NULL;
CREATE UNIQUE INDEX trips_series_depart ON trips (series_id, depart_at);

-- Expo push tokens, one row per device.
CREATE TABLE push_tokens (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform   TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX push_tokens_user ON push_tokens (user_id);

-- "Alamat tersimpan" for the pickup/drop-off pickers.
CREATE TABLE saved_places (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL DEFAULT 'other',
  label      TEXT NOT NULL,
  address    TEXT,
  lat        REAL NOT NULL,
  lng        REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX saved_places_user ON saved_places (user_id);

-- S9 / D10 "Laporkan masalah".
CREATE TABLE reports (
  id          TEXT PRIMARY KEY,
  order_id    TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category    TEXT NOT NULL,
  description TEXT NOT NULL,
  photo_url   TEXT,
  status      TEXT NOT NULL DEFAULT 'open',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX reports_order ON reports (order_id);
CREATE INDEX reports_reporter ON reports (reporter_id, created_at);

-- Driver wallet ledger (P10-P12). amount is signed Rupiah; the balance is a SUM, never stored.
-- type: earning (non-cash order, counts to balance) | cash_earning (collected in cash, informational)
--       | compensation (late cancel) | withdrawal (negative)
CREATE TABLE wallet_entries (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id   TEXT REFERENCES orders(id) ON DELETE SET NULL,
  type       TEXT NOT NULL,
  amount     INTEGER NOT NULL,
  status     TEXT NOT NULL DEFAULT 'completed',
  note       TEXT,
  meta_json  TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX wallet_entries_user ON wallet_entries (user_id, created_at);
CREATE UNIQUE INDEX wallet_entries_order_type ON wallet_entries (order_id, type) WHERE order_id IS NOT NULL;
