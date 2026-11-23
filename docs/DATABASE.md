# Looking at the database (Turso and the laptop file)

The backend stores everything in one SQLite database. Where that database lives depends on one setting in `server/.env`:

| `DATABASE_URL` in `server/.env` | Database used | How to look at it |
|---|---|---|
| not set (default) | the file `server/data/kirimin.db` on your laptop | a SQLite viewer (section 4) |
| `libsql://kirimin-<you>.turso.io` | your Turso database in the cloud | the Turso dashboard (section 2) |

When the server starts, its first lines tell you which one it picked:

```
Database: Turso/libSQL at kirimin-yande.turso.io      ← Turso
Database: SQLite file ./data/kirimin.db                ← laptop file
```

## 1. Connect the server to Turso (once)

1. In the [Turso dashboard](https://app.turso.tech), open your database (create one called `kirimin` if you haven't; pick the Singapore region, it's closest to Bali).
2. Copy the database **URL**. It looks like `libsql://kirimin-<you>.turso.io`.
3. Create a **token** for the database (the dashboard has a "Create token" button on the database page; with the CLI it's `turso db tokens create kirimin`).
4. In the project, copy `server/.env.example` to `server/.env` and set:
   ```
   DATABASE_URL=libsql://kirimin-<you>.turso.io
   DATABASE_AUTH_TOKEN=<the token>
   ```
   `server/.env` is git-ignored, so the token never ends up on GitHub. Don't paste it anywhere else.
5. Check it works: in `server/`, run `npm run verify:hosting`. Every Turso line should start with ✔.

## 2. Fill Turso with the demo data

In `server/`:

```powershell
npm run db:reset:turso
```

It asks you to type the database host (e.g. `kirimin-yande.turso.io`) because it **deletes everything in that database** first. Then it creates the tables and the demo content and prints what it made:

```
Turso kirimin-yande.turso.io: dropped 0 tables, applied 3 migrations, seeded demo data.
  users: 5 | trips: 7 | orders: 6 | messages: 4 | notifications: 6
```

The demo content covers every screen:

| Account (password `kirimin123`) | What they have |
|---|---|
| Wayan `081200000001`, sender | a request waiting for Komang, a delivered + rated order with a chat, a cancelled order, 2 saved places, notifications |
| Ayu `081200000002`, sender | an open request, a parcel **on the road right now** with Putu (live tracking + chat), a delivered order from Made |
| Made `081200000003`, driver | "Ke Kampus" and "Pulang Kampus" routes with requests waiting, earnings and a 5★ rating from today |
| Komang `081200000004`, driver | a route with Wayan's request in the inbox, 2 saved places |
| Putu `081200000005`, driver | an **ongoing trip** carrying Ayu's parcel, a route to Nusa Dua, a past delivery |

Run it again any time you want a clean demo (e.g. right before presenting). Then start the server as usual (`npm start` or `.\scripts\start-backend-for-phones.ps1`); it uses Turso automatically because of `server/.env`.

For the laptop file instead, `npm run db:reset` does the same without asking.

## 3. Look at the data in the Turso dashboard

1. Go to [app.turso.tech](https://app.turso.tech) → your database.
2. Open it in **Outerbase Studio** (the data browser built into the Turso dashboard). On the left are the tables; click one to see its rows like a spreadsheet. You can sort, filter, and edit cells there. Edits go straight into the live database the app uses, so be careful.
3. For anything more specific, open a **query** tab and run SQL (examples below).

The Turso CLI works too (`turso db shell kirimin`), but on Windows it needs WSL; the dashboard is easier.

### What's in each table

| Table | One row is… | Columns worth looking at |
|---|---|---|
| `users` | an account | `name`, `phone`, `active_role` (sender/driver), `vehicle_plate`, `rating_sum`/`rating_count` |
| `trips` | a route a driver published | `name`, `status` (published/ongoing/completed/cancelled), `depart_at`, `origin_json`/`destination_json`, `max_packages`, `last_lat`/`last_lng` (live position) |
| `orders` | a package being sent | `code` (KRM-…), `status`, `sender_id`, `driver_id`, `trip_id`, `pickup_json`/`dropoff_json`, `total`, `handover_code` |
| `order_events` | one step in an order's history | `order_id`, `status`, `note`, `created_at` |
| `messages` | a chat message on an order | `order_id`, `sender_id`, `body` |
| `ratings` | stars a sender gave a driver | `stars`, `tags_json`, `comment` |
| `notifications` | an item in someone's Notifikasi tab | `user_id`, `title`, `body`, `read_at` |
| `saved_places` | an "Alamat tersimpan" entry | `user_id`, `label`, `lat`, `lng` |
| `payment_transactions` | a payment attempt | `order_id`, `method`, `amount`, `status` |
| `wallet_entries` | a driver's earning/payout | `user_id`, `amount`, `type` |
| `push_tokens`, `reports` | phones registered for push, problem reports | |
| `_migrations` | which schema updates have run | don't edit |

Places and lists are stored as JSON text (`*_json` columns), e.g. `{"label":"Renon","lat":-8.67,"lng":115.23}`. Times are ISO text in UTC (`2026-11-23T09:40:11Z` is 17:40 in Bali).

### Handy queries

```sql
-- Every order with who sent it, who carries it and where it's going
SELECT o.code, o.status, s.name AS sender, d.name AS driver,
       json_extract(o.pickup_json, '$.label')  AS pickup,
       json_extract(o.dropoff_json, '$.label') AS dropoff,
       o.total, o.created_at
FROM orders o
JOIN users s ON s.id = o.sender_id
LEFT JOIN users d ON d.id = o.driver_id
ORDER BY o.created_at DESC;

-- The history of one order (replace the code)
SELECT e.created_at, e.status, e.note
FROM order_events e JOIN orders o ON o.id = e.order_id
WHERE o.code = 'KRM-XXXX' ORDER BY e.created_at;

-- Drivers' upcoming routes and how full they are
SELECT u.name, t.name, t.status, t.depart_at,
       (SELECT COUNT(*) FROM orders o WHERE o.trip_id = t.id
          AND o.status IN ('accepted','picked_up','in_transit','arrived','delivered')) AS used,
       t.max_packages
FROM trips t JOIN users u ON u.id = t.driver_id
WHERE t.status IN ('published','ongoing') ORDER BY t.depart_at;

-- Earnings per driver
SELECT u.name, COUNT(*) AS delivered, SUM(o.fee) AS earned
FROM orders o JOIN users u ON u.id = o.driver_id
WHERE o.status = 'delivered' GROUP BY u.name;

-- The handover code a sender sees (handy when testing)
SELECT code, handover_code FROM orders WHERE status NOT IN ('delivered','cancelled','expired');
```

## 4. Looking at the laptop file instead

When `DATABASE_URL` isn't set, the data is in `server/data/kirimin.db`. Open it with any SQLite viewer, for example:

- **VS Code**: install a SQLite viewer extension and click the file.
- **DB Browser for SQLite** (free desktop app): File → Open Database → `server/data/kirimin.db`, then the "Browse Data" tab.

Close the viewer (or at least don't keep a write open) while the server runs, and stop the server before `npm run db:reset`, which deletes the file.
