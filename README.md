# Kirimin Mobile

Android, iOS, and Web app for **Kirimin** (original web prototype: [Yada912/MidLogi](https://github.com/Yada912/MidLogi)). Kirimin is crowdsourced commuter delivery in Bali: senders (**Kirim**) match with drivers (**Angkut**) already traveling the same route, saving cost and emissions while letting daily commuters earn along the way.

---

## What's Inside

| Layer | Status & Highlights |
|---|---|
| **Backend API (`server/`)** | ✅ Zero-dependency Node.js + TypeScript API (`node:http`, `node:sqlite`, Turso/libSQL, Cloudinary): auth & sessions, recurring weekly routes, route matching & detour pricing, end-to-end orders, pluggable payment gateway with SHA-512 signed webhooks, SSE realtime, chat, ratings, Expo push, saved places (`/me/places`), customizable route presets (`/me/settings`), KTP verification, reports, and driver wallet. **36 passing tests.** |
| **Shared Domain (`shared/`)** | ✅ Strongly typed domain models, Indonesian labels, detour matching, pricing rules, and order state machine shared across server and app. |
| **Mobile & Web App (`app/`)** | ✅ Expo SDK 58 (React Native + TypeScript + Expo Router): vibrant Gojek/Apple Maps-inspired UI, playful custom vector artwork, thumb-reach above-the-fold layouts, real road-following interactive navigation map, 3-step new-user onboarding wizard, full customizability (presets, saved locations, profile/vehicle/notifications, route editing), and complete Kirim/Angkut/Handover/Chat/Payment/Rating flows. **17 passing contract & routing tests.** |

---

## Key Features & UX Highlights

### 1. Real Road-Following Interactive Map & Driver Navigation
- **Actual Road Routing (`app/src/utils/routing.ts`)**: Fetches real driving road polylines and turn-by-turn steps via OSRM with automatic fallback to an embedded **South Bali Arterial Road Network Graph** (Renon, Sesetan, Bypass Ngurah Rai, Simpang Dewa Ruci, Jimbaran, Kampus Bukit, Nusa Dua) so routes always follow roads even offline.
- **Apple Maps / Google Maps / Uber Driver Navigation HUD (`app/src/ui/MapView.tsx`)**:
  - Floating **Turn-by-Turn Instruction Banner** showing maneuver icon, distance to next turn, street name, and a tappable **Panduan Rute Jalan** step drawer (tap any turn to focus that intersection).
  - Dual-tone road polyline: muted slate behind the driver (traveled), vivid white-cased blue ahead (remaining).
  - **Heading-aware rotating driver puck** with radar pulse and auto-follow toggle (pauses automatically when you drag to explore the map).
  - **4 Map Layers**: *Peta Bersih (Nav)* (Carto Voyager), *Peta Jalan Detail* (OSM), *Mode Malam (Driver)* (Carto Dark), and *Vektor Offline*.
  - Interactive marker tap cards, live ETA/distance capsule, and **Fullscreen Map** expansion.
- **Map-First Live Screens**: Both Driver Active Navigation (`app/app/angkut/jalan/[tripId].tsx`) and Sender Live Tracking (`app/app/kirim/lacak/[id].tsx`) place the interactive road map on top with primary actions (`Mulai Perjalanan`, `Konfirmasi Dijemput`, `Konfirmasi Tiba`, `Kode 4 Digit`, `Chat`) immediately within thumb's reach.

### 2. Lively, Colorful, Thumb-Reach UI
- **Distinct Role Identities**: Electric Cobalt (`#1463F3`) for **Kirim (Sender)** and Fresh Emerald (`#059669`) for **Angkut (Driver)**.
- **Custom Playful Vector Artwork (`app/src/ui/Illustrations.tsx`)**: Bali commuter scooter hero banner, route navigation map art, welcome corridor illustration, and handover verification shield.
- **Above-the-Fold Primary Actions**: Main CTAs, active order/trip live banners, quick customization buttons, and route presets are immediately reachable without scrolling; secondary info and logs sit cleanly below.

### 3. Full Customizability & Editing
- **Customizable Route Presets (`app/app/kelola/preset.tsx`)**: Create, edit, color-tag, delete, or reset 1-tap home-screen route presets (synced to `/me/settings`), usable in both Kirim and Angkut modes.
- **Saved & Custom Locations (`app/app/kelola/lokasi.tsx` + `PlacePickerSheet.tsx`)**: Add, edit, or delete Home/Work/Campus/Other locations by tapping directly on the map (`/me/places`). Saved places automatically appear at the top of every location picker across the app, plus inline quick-add.
- **Edit Published Driver Routes (`app/app/angkut/edit-rute/[tripId].tsx`)**: Update route name, stops, departure time, capacity, max detour, accepted package sizes (`PATCH /trips/:id`), or cancel a route.
- **Profile, Vehicle, Notifications & Verification (`app/app/kelola/profil.tsx`)**: Edit name, email, motor/mobil & license plate, toggle per-channel push notifications, and submit KTP verification.

### 4. Comprehensive 3-Step New User Onboarding
- **Guided Registration (`app/app/(auth)/register.tsx`)**:
  1. **Akun**: Full name, phone, optional email, password with live strength meter & confirmation, terms checkbox.
  2. **Peran & Kendaraan**: Visual Kirim vs. Angkut picker with inline vehicle type + license plate setup for drivers.
  3. **Lokasi Favorit**: Pin & save your first favorite location (`Rumah` / `Kampus` / `Kantor`) directly on the map (or skip in 1 tap).

### 5. Production-Structured Payment Gateway (Mock Sandbox → Midtrans / Xendit Ready)
- **Pluggable Gateway Architecture (`server/src/payments/gateway.ts`, `server/src/modules/payments.ts`, `003_payment_gateway.sql`)**:
  - Idempotent payment charge creation (`POST /orders/:id/payments` with `idempotencyKey`), automatic cancellation of superseded intents when switching methods, and full `payment_transactions` ledger persistence.
  - Generates authentic **EMVCo CRC16-CCITT QRIS payloads**, **Indonesian Bank Virtual Accounts** (`BCA`, `Mandiri`, `BNI`, `BRI`), **E-Wallet Deep Links** (`GoPay`, `ShopeePay`, `DANA`, `OVO`), and live expiry countdowns (`15 min` QRIS/E-Wallet, `24h` VA).
  - **Cryptographic SHA-512 Webhook Handler (`POST /webhooks/payments`)**: Verifies signatures using `crypto.timingSafeEqual`, rejects tampered signatures/amounts, guarantees idempotency on duplicate callbacks, settles orders atomically, and pushes realtime `payment.updated` + `order.updated` SSE events.
  - **Sandbox Gateway Simulator (`POST /payments/:id/sandbox/simulate`)**: Built directly into the checkout screen (`app/app/bayar/[orderId].tsx`) to test live **Settlement → Digital Receipt**, **Failed Payment → Retry**, and **Expired Invoice** flows through the real signed webhook pipeline. Swapping to live Midtrans/Xendit only requires implementing `PaymentGatewayProvider` and setting `PAYMENT_GATEWAY`.

---

## Demo Flow Videos

Recorded end-to-end against the live backend API and mobile viewport (`390×844`):

| Flow | Video | What It Covers |
|---|---|---|
| **1. New User Onboarding** | [`docs/demos/01_onboarding_new_user.mp4`](docs/demos/01_onboarding_new_user.mp4) | Welcome art → 3-step account, role/vehicle & favorite map location registration → Driver Beranda |
| **2. User (Kirim) View** | [`docs/demos/02_sender_kirim_flow.mp4`](docs/demos/02_sender_kirim_flow.mp4) | Kirim Beranda → Package details → Road route map & Place Picker → Choose matching driver → QRIS payment → Live tracking + 4-digit code |
| **3. Driver (Angkut) Navigation** | [`docs/demos/03_driver_angkut_navigation.mp4`](docs/demos/03_driver_angkut_navigation.mp4) | Driver Beranda → Incoming requests → Accept package → Live road navigation HUD, turn-by-turn steps drawer, Night Mode, GPS movement, pickup confirmation |
| **4. Handover & Rating** | [`docs/demos/04_handover_and_rating.mp4`](docs/demos/04_handover_and_rating.mp4) | Driver arrives → Enters 4-digit secret handover code → Delivery celebration → Complete trip → Sender rates driver 5 stars |
| **5. Customizability & Editing** | [`docs/demos/05_customization_and_editing.mp4`](docs/demos/05_customization_and_editing.mp4) | Create/edit custom route presets → Add custom map location → Edit profile/vehicle → Edit published driver route |

---

## Quick Start

Requires **Node.js 22.18+ (or 24 LTS)**.

### 1. Start the Backend API
```bash
cd server
npm install
npm run dev        # http://localhost:3000/health  (demo password: kirimin123)
```

### 2. Start the Mobile / Web App
```bash
cd app
npm install --legacy-peer-deps
npm start          # Press 'a' for Android emulator, 'w' for Web, or scan QR with Expo Go
```

### 3. Run All Tests & Typechecks
```bash
npm --prefix server run typecheck
npm --prefix app run typecheck
npm --prefix server test               # 33 backend unit & API tests
npm --prefix app run test:contract     # 17 UI ↔ API wiring, routing & flow contract tests
cd app && npm run e2e                  # Maestro Android emulator E2E flows
```

---

## Production Readiness Checklist (Supabase & Beyond)

If you already have a **Supabase** project, see the full step-by-step guide in **[`docs/PRODUCTION-CHECKLIST.md`](docs/PRODUCTION-CHECKLIST.md)**. Summary of what to run before launching to real users:

1. **Database & Storage (Supabase)**:
   - Unpause Supabase Postgres (and add a keep-alive cron if on free tier, or upgrade to Pro).
   - Connect via Supavisor Transaction Pooler (`port 6543`, `sslmode=require`) and implement a Postgres `Db` adapter (`server/src/db/postgres.ts`) + apply `001_init.sql` & `002_mvp_features.sql`.
   - Create `kirimin-uploads` (package photos) and private `kirimin-kyc` (KTP/selfie) buckets in Supabase Storage with a `supabaseFileStore` adapter.
   - *(Alternative already built-in with zero code changes: **Turso/libSQL** + **Cloudinary** — see [`docs/HOSTING.md`](docs/HOSTING.md).)*
2. **Always-On Backend API**: Deploy `server/` to Render/Railway/Fly.io/Oracle VM with `NODE_ENV=production`, strong `JWT_SECRET`, `SEED_ON_EMPTY=false`, `AUTO_APPROVE_VERIFICATION=false`, restricted `CORS_ORIGIN`, and SSE proxy buffering disabled (`X-Accel-Buffering: no`).
3. **Production Maps, Routing & Geocoding**: Self-host OSRM for Bali/Indonesia (or use OpenRouteService/Mapbox/Google Directions), switch map tiles to a commercial provider (MapTiler/Stadia/Mapbox), and connect Photon/Google Places geocoding.
4. **Real Payment Gateway (Indonesia)**: Integrate **Midtrans** or **Xendit** on `POST /orders/:id/pay` + signed webhook `POST /webhooks/midtrans` + Iris/Xendit disbursements for driver wallet withdrawals.
5. **Push Notifications & Phone OTP**: Configure Firebase Cloud Messaging (`app/google-services.json` + `EXPO_ACCESS_TOKEN`) and SMS/WhatsApp OTP (Fonnte/Twilio) on registration.
6. **Security, Moderation & Store Release**: Add rate limiting, Sentry error monitoring, an admin moderation queue for KTP/reports, release keystore (`keytool`), `EXPO_PUBLIC_API_URL`, and EAS Build (`.aab`) for Google Play Console.

---

## Documentation Index

- [`docs/PRODUCTION-CHECKLIST.md`](docs/PRODUCTION-CHECKLIST.md) — Full production readiness guide (Supabase Postgres/Storage + all other setups)
- [`docs/HOSTING.md`](docs/HOSTING.md) — Free Rp 0 hosting option (Turso + Cloudinary + Render)
- [`docs/UCD-REPORT.md`](docs/UCD-REPORT.md) — User-Centered Design audit, visual testing loop findings, and architecture notes
- [`docs/API.md`](docs/API.md) — Complete REST & SSE endpoint reference
- [`docs/APP.md`](docs/APP.md) — Mobile component system and design tokens
- [`docs/TESTING.md`](docs/TESTING.md) — Testing strategy across server, contract, and E2E layers
- [`docs/DATABASE.md`](docs/DATABASE.md) — Look at the data (Turso dashboard or laptop file) and fill Turso with demo content
- [`docs/APK-PACKAGING-NOTES.md`](docs/APK-PACKAGING-NOTES.md) — Checklist for whoever builds the next APK
- [`docs/APK-CONNECT.md`](docs/APK-CONNECT.md) — Build the APK and point it at the backend on your PC (same Wi-Fi or tunnel)
- [`docs/SETUP-LAPTOP.md`](docs/SETUP-LAPTOP.md) — Running locally with physical phones
