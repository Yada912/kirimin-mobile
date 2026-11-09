-- Kirimin MVP schema (SQLite / libSQL).
-- Conventions: ids are UUID text, timestamps are ISO-8601 UTC text,
-- money is integer Rupiah, *_json columns hold JSON text.

CREATE TABLE users (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  phone            TEXT NOT NULL UNIQUE,
  email            TEXT UNIQUE,
  password_hash    TEXT NOT NULL,
  avatar_url       TEXT,
  active_role      TEXT NOT NULL DEFAULT 'sender' CHECK (active_role IN ('sender', 'driver')),
  verified         INTEGER NOT NULL DEFAULT 0,
  vehicle_type     TEXT,
  vehicle_plate    TEXT,
  rating_sum       INTEGER NOT NULL DEFAULT 0,
  rating_count     INTEGER NOT NULL DEFAULT 0,
  deliveries_count INTEGER NOT NULL DEFAULT 0,
  sends_count      INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

-- A driver's published route for one departure (D1–D2).
CREATE TABLE trips (
  id                  TEXT PRIMARY KEY,
  driver_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  origin_json         TEXT NOT NULL,
  stops_json          TEXT NOT NULL DEFAULT '[]',
  destination_json    TEXT NOT NULL,
  depart_at           TEXT NOT NULL,
  arrive_at           TEXT NOT NULL,
  repeat_days_json    TEXT NOT NULL DEFAULT '[]',
  vehicle_type        TEXT NOT NULL,
  vehicle_plate       TEXT NOT NULL,
  accepted_sizes_json TEXT NOT NULL,
  max_packages        INTEGER NOT NULL,
  max_weight_kg       REAL,
  max_detour_km       REAL NOT NULL,
  price_min           INTEGER,
  price_max           INTEGER,
  status              TEXT NOT NULL DEFAULT 'published',
  last_lat            REAL,
  last_lng            REAL,
  last_location_at    TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX trips_status_depart ON trips (status, depart_at);
CREATE INDEX trips_driver ON trips (driver_id);

-- A package being sent (S1–S9).
CREATE TABLE orders (
  id                 TEXT PRIMARY KEY,
  code               TEXT NOT NULL UNIQUE,
  sender_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_id          TEXT REFERENCES users(id) ON DELETE SET NULL,
  trip_id            TEXT REFERENCES trips(id) ON DELETE SET NULL,
  status             TEXT NOT NULL,
  category           TEXT NOT NULL,
  size               TEXT NOT NULL,
  weight_class       TEXT NOT NULL,
  handling_json      TEXT NOT NULL DEFAULT '[]',
  photo_url          TEXT,
  notes              TEXT NOT NULL DEFAULT '',
  pickup_json        TEXT NOT NULL,
  dropoff_json       TEXT NOT NULL,
  recipient_name     TEXT NOT NULL,
  recipient_phone    TEXT NOT NULL,
  deliver_by         TEXT,
  handover_method    TEXT NOT NULL DEFAULT 'meet',
  fee                INTEGER,
  service_fee        INTEGER,
  total              INTEGER,
  detour_km          REAL,
  eta_pickup_at      TEXT,
  eta_dropoff_at     TEXT,
  payment_method     TEXT,
  payment_status     TEXT NOT NULL DEFAULT 'unpaid',
  refund_amount      INTEGER NOT NULL DEFAULT 0,
  handover_code      TEXT NOT NULL,
  pickup_photo_url   TEXT,
  delivery_photo_url TEXT,
  cancel_reason      TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX orders_sender ON orders (sender_id, created_at);
CREATE INDEX orders_driver ON orders (driver_id, created_at);
CREATE INDEX orders_trip ON orders (trip_id);
CREATE INDEX orders_status ON orders (status);

-- Timeline shown on S5 / S8.
CREATE TABLE order_events (
  id         TEXT PRIMARY KEY,
  order_id   TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status     TEXT NOT NULL,
  actor_id   TEXT,
  note       TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX order_events_order ON order_events (order_id, created_at);

-- Chat per order (X1).
CREATE TABLE messages (
  id         TEXT PRIMARY KEY,
  order_id   TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at    TEXT
);
CREATE INDEX messages_order ON messages (order_id, created_at);

-- Ratings after delivery (X3). One per person per order.
CREATE TABLE ratings (
  id           TEXT PRIMARY KEY,
  order_id     TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stars        INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  tags_json    TEXT NOT NULL DEFAULT '[]',
  comment      TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL,
  UNIQUE (order_id, from_user_id)
);

-- In-app notifications (O5).
CREATE TABLE notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  data_json  TEXT NOT NULL DEFAULT '{}',
  read_at    TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX notifications_user ON notifications (user_id, created_at);
