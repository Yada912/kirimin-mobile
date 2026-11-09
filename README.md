# Kirimin Mobile

Android version of **Kirimin** (web prototype: [Yada912/MidLogi](https://github.com/Yada912/MidLogi)). Kirimin is crowdsourced delivery: commuters carry packages along routes they already travel. Senders (**Kirim**) find a driver heading the same way, and drivers (**Angkut**) earn a little on their daily commute.

The UI follows Hecate's MVP wireframes in [Figma](https://www.figma.com/design/RG3ubejQVL8MeC6ukD1kdH/SI?node-id=243-684).

## Status

| Part | State |
|---|---|
| **Backend API** (`server/`) | ✅ MVP done: auth & sessions, routes/trips (incl. weekly recurring), matching & pricing, orders end-to-end, chat, ratings, notifications + Expo push, photo uploads, realtime, settings, saved places, KTP verification, problem reports, driver wallet. 20 passing tests. |
| **Shared domain** (`shared/`) | ✅ Types, labels, matching, pricing and the order state machine, shared by server and app |
| **Mobile app** (`app/`) | ⏭ Next: Expo (React Native + TypeScript) with a component system and placeholder UI |

## Repository layout

```
kirimin-mobile/
├── shared/src/            Imported by both server and app; no dependencies
│   ├── domain.ts          Sizes, categories, statuses + Indonesian labels
│   ├── matching.ts        "Driver searah": best pickup/drop-off insertion into a route (detour km)
│   ├── pricing.ts         Ongkos titip, service fee, refunds
│   ├── orderFlow.ts       Order state machine (who may move an order where)
│   └── api.ts             JSON response types (User, Trip, Order, TripMatch, …)
├── server/                Node.js API, zero npm dependencies
│   ├── src/
│   │   ├── index.ts       Boot: DB, migrations, seed, HTTP server, expiry job
│   │   ├── app.ts         Wires services together + CORS/errors/logging
│   │   ├── config.ts      Env vars (.env)
│   │   ├── http/          Tiny router + validator
│   │   ├── auth/          scrypt passwords + JWT
│   │   ├── db/            SQLite adapter, migrations/, seed (Denpasar ↔ Bukit demo data)
│   │   ├── realtime/      Server-Sent Events hub
│   │   ├── storage/       Photo storage (local disk now, Cloudinary later)
│   │   ├── push/          Expo push notifications (plain fetch)
│   │   └── modules/       One file per feature: users, trips, orders, matches, chat, notifications,
│   │                      places, reports, wallet
│   ├── test/              Unit tests + full end-to-end flow test
│   └── requests.http      Click-to-run API walkthrough (VS Code REST Client)
├── docs/
│   ├── SETUP-LAPTOP.md    Run it, reach it from your phone
│   ├── API.md             Every endpoint, mapped to Figma screens
│   └── HOSTING.md         Free hosting options for later + what to change
└── render.yaml            Optional Render deployment blueprint
```

## Quick start

Requires Node 24 LTS (or Node 22.18 or newer). Nothing else.

```bash
cd server
npm run dev        # http://localhost:3000/health, demo password: kirimin123
npm test
```

See [docs/SETUP-LAPTOP.md](docs/SETUP-LAPTOP.md) for connecting a phone (same Wi-Fi, ngrok or Cloudflare tunnel).

## How the backend is organised

Each feature in `server/src/modules/` has the same three layers:

- **Repository**: SQL only (`db.all/get/run`).
- **Service**: business rules. Validates input, checks permissions, changes state, notifies people.
- **Routes**: thin HTTP mapping (`r.post('/orders/:id/accept', ctx => orders.accept(ctx.userId(), ctx.params.id, await ctx.json()))`).

Rules worth knowing before you change anything:

- **Order statuses only change through `move()`** in `orders.ts`. It checks `shared/src/orderFlow.ts`, prevents two people acting on the same order at once, and writes the timeline. To add a status or transition, edit the table in `orderFlow.ts`.
- **Matching, pricing and ETAs come from one function**, `evaluateTrip()` in `modules/tripMatch.ts`. The search (S3), the driver inbox (D3) and acceptance all call it, so they can't disagree.
- **Schema changes go in a new numbered file** in `server/src/db/migrations/` (e.g. `002_add_vouchers.sql`). It's applied automatically on the next start. Never edit a migration that has already run.
- **Swappable infrastructure.** `Db` (database), `FileStore` (photos) and `Hub` (realtime) are small interfaces, so moving to Turso, Cloudinary or WebSockets touches one file each. See [docs/HOSTING.md](docs/HOSTING.md).

### Adding a feature (example: vouchers)

1. If it needs new data, add `server/src/db/migrations/002_vouchers.sql`.
2. Create `server/src/modules/vouchers.ts` with `vouchersService(db, …)` and `vouchersRoutes(svc)`.
3. Register it in `app.ts`: create the service, then `router.use('', vouchersRoutes(vouchers))`.
4. Add the response type to `shared/src/api.ts` so the app gets it too.
5. Add a test in `server/test/`.

## MVP scope (Figma rows)

| Row | Screens | Backend |
|---|---|---|
| 0 · Mulai & Beranda | O1 login, O2 pilih peran, O3 beranda, O4 aktivitas, O5 notifikasi | ✅ |
| 1 · Angkut | D1–D2 buat rute, D3 permintaan, D4 detail, D5 perjalanan aktif, D6 rute saya, D7 edit, D8 batalkan, D9 riwayat | ✅ incl. weekly recurring routes |
| 2 · Kirim | S1–S5 detail → jemput/antar → driver searah → konfirmasi → lacak, S6 permintaan terbuka, S7 batal & refund, S8 struk | ✅ |
| 3 · Shared | X1 chat, X2 serah terima (4-digit code + photo), X3 rating, X4 verifikasi KTP | ✅ (X4 auto-approved until there's an admin panel) |
| 6–7 · Pembayaran | P1–P12 | 🟡 payments mocked (`/orders/:id/pay`). Driver wallet ledger is real: earnings, cash, compensation, balance. Withdrawals are mocked. |
| 8 · States | loading / empty / error / location permission | App side |
| 4, 5, 9, 10 · Dropship, Transfer, Bus, Bus driver | | ⏭ later |
| S9 / D10 · Laporkan masalah | | ✅ stored for follow-up (no admin panel yet) |
| 11–12 · Pengaturan | ST1–ST19 | ✅ profile, password, logout-all, notification toggles, saved addresses, delete account |
| Push notifications | | ✅ Expo push for every notification + chat, per-channel mute |
