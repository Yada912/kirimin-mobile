# Brief: build the Kirimin Android app (`app/`)

This brief is for whoever (human or AI agent) builds the mobile app. Read it fully before starting, together with `README.md` and `docs/API.md`.

## Context

- Kirimin is crowdsourced delivery. Senders (**Kirim**) hand packages to commuters already driving that way, and drivers (**Angkut**) carry them on their daily routes. Think Gojek, but a little more blue.
- The **backend is done**: `server/` (Node API, zero dependencies) and `shared/` (types, labels, matching, pricing, order state machine). All 11 tests pass. **Don't rewrite or restructure them.** If the app truly needs a backend change, make it small, add or adjust a test in `server/test/`, and keep `npm test` green.
- Every endpoint is in `docs/API.md`, mapped to Figma screen codes (O1, S3, D4, …). Response types are in `shared/src/api.ts`.
- Figma (wireframes by Hecate): https://www.figma.com/design/RG3ubejQVL8MeC6ukD1kdH/SI
  - Page **"Wireframes – MVP (Hecate)"** (node `221:82`). Rows: `243:4117` Mulai & Beranda (O1–O6), `243:4118` Angkut/Driver (D1–D10), `243:4119` Kirim/Sender (S1–S9), `243:4120` Shared (X1–X4), `243:4125` States (E1–E5).
  - Page **"Components – Wireframe (Hecate)"** (node `234:3375`) is the component inventory to mirror in code.
  - If you have Figma access (MCP or otherwise), use it for layout and hierarchy. The wireframes are grey boxes, so apply the visual direction below.

## Goal of this phase

A working **MVP Android app** with a proper **component system** and **simple placeholder-quality UI** that can be polished later without touching screen logic. Focus on correct flows and clean structure, not pixel-perfect visuals.

## Tech stack (use these unless there is a strong reason not to)

- **Expo SDK (latest) + React Native + TypeScript**, created in `app/` at the repo root.
- **expo-router** (file-based routes) with two tab groups: Kirim (sender) and Angkut (driver), plus shared stacks.
- **@tanstack/react-query** for server state (caching, refetch, polling fallback).
- **expo-secure-store** for the auth token. **expo-location** for GPS. **expo-image-picker** + **expo-file-system** for photos.
- **react-native-sse** for realtime (`GET /events?token=…`), falling back to polling with react-query when the stream is down.
- **Maps:** a `<MapView>` wrapper component around **react-native-webview + Leaflet + OpenStreetMap tiles** (works in Expo Go, no API key). Screens only use the wrapper, so it can later become a native map (MapLibre) without touching screens.
- Package manager: npm.

## Running against Android Studio

1. **Android Studio:** install an SDK (API 35 or newer) and create an emulator in Device Manager (e.g. Pixel 8). Set `ANDROID_HOME` (usually `%LOCALAPPDATA%\Android\Sdk`) and add `%ANDROID_HOME%\platform-tools` to PATH so `adb devices` works.
2. **Backend:** in one terminal, `cd server`, then `npm run dev`. See `docs/SETUP-LAPTOP.md`.
3. **App:** in another terminal, `cd app`, then `npx expo start`, then press **`a`**. This opens the running emulator and installs Expo Go automatically.
4. **API URL:** from the Android emulator the laptop is **`http://10.0.2.2:3000`**. From a real phone it's the LAN IP the server prints, or an ngrok URL. Make it configurable via `app.config.ts` / `EXPO_PUBLIC_API_URL`, defaulting to `http://10.0.2.2:3000`. Always send header `ngrok-skip-browser-warning: 1` (harmless locally).
5. Plain-HTTP API calls need cleartext traffic allowed on Android. Expo Go allows it; for dev builds set `usesCleartextTraffic` via `expo-build-properties`.
6. Only if a native module that isn't in Expo Go becomes necessary: `npx expo run:android` (dev build through the Android Studio SDK).

## Using `shared/` from the app

Import types and helpers from `../shared/src` rather than duplicating them: labels (`ORDER_STATUS_LABELS`, `PACKAGE_SIZE_INFO`, …), `TRACKING_STEPS`, `nextStatuses()` (to decide which action buttons to show) and all API types. Configure:

- `app/tsconfig.json`: path alias `"@kirimin/shared": ["../shared/src/index.ts"]` and `allowImportingTsExtensions: true` (shared imports use explicit `.ts` extensions).
- `app/metro.config.js`: add the repo's `shared` folder to `watchFolders` and resolve `@kirimin/shared` to it.

Check this works early (import a label and render it) before building screens on top of it.

## Architecture inside `app/`

```
app/
├── app/                      expo-router routes ONLY (thin: compose components, call hooks)
│   ├── (auth)/               welcome, login, register, pilih-peran
│   ├── (kirim)/              sender tabs: beranda, aktivitas, notifikasi, profil
│   ├── (angkut)/             driver tabs: beranda, rute, aktivitas, profil
│   ├── kirim/…               S1–S5 flow as a stack (detail → rute → driver → konfirmasi), lacak/[id]
│   ├── angkut/…              D1–D2 buat rute, permintaan/[tripId], permintaan-detail/[orderId], perjalanan/[tripId]
│   └── order/[id]/…          chat, serah-terima, rating
├── src/
│   ├── theme/                tokens.ts (color, spacing, radius, typography, shadow, motion), ThemeProvider
│   ├── ui/                   design-system components (no API calls, no business logic)
│   ├── features/             feature components that combine ui/ + data (e.g. TripMatchCard, OrderTracker)
│   ├── api/                  client.ts (fetch wrapper, auth header, error mapping), one file per resource, query hooks
│   ├── realtime/             SSE connection + react-query cache updates
│   ├── auth/                 token storage, session context, role switching
│   └── lib/                  formatting (Rupiah, time "08:40", distance), validation
```

Rules:
- **Screens never style raw values.** Every colour, spacing, font size and radius comes from `theme/tokens.ts`, so the later visual polish changes only tokens and `ui/`.
- **`ui/` components are presentational and reusable.** Typed props, variants instead of copy-paste (e.g. `<Button variant="primary|secondary|ghost|danger" size="lg|md" loading />`), accessible (labels, 44pt minimum touch targets).
- Minimum `ui/` set, mirroring Hecate's components page: `Text` (variants: largeTitle, title, headline, body, callout, caption), `Button`, `IconButton`, `Card`, `ListItem`, `Chip`/`ChipGroup` (single and multi select), `SegmentedControl`, `TextField`, `Stepper` (the 1·2·3 step header and the numeric − 3 + control), `Badge`/`StatusPill`, `Avatar`, `PriceRow`, `Divider`, `BottomSheet`, `Dialog`, `TopBar`, `TabBar`, `Skeleton`, `EmptyState`, `ErrorState`, `MapView` (wrapper), `ProgressSteps` (S5 tracker), `CodeDisplay` (4-digit handover code) and `CodeInput`.
- **Data access only through `src/api/` hooks** (e.g. `useSearchTrips`, `useOrder(id)`, `useAcceptOrder`). Errors from the API already carry an Indonesian `message`, so show it as is.
- **Every data screen handles loading (Skeleton), empty (EmptyState) and error (ErrorState with retry)**, per Figma row 8.

## Visual direction (for the placeholder UI, keep it simple)

- **Gojek-like structure in blue.** A primary blue around `#1463F3` (pressed state slightly darker), white surfaces, a light grey app background (`#F5F7FA`), green for success/money, amber for warnings/"simpangan", red for destructive actions.
- **Apple HIG principles:** clear hierarchy (large titles, one obvious primary action per screen pinned at the bottom), 8-pt spacing grid, generous whitespace, grouped lists/cards with 12–16 radius, a system font, restrained colour (blue only for primary actions and key info), 44pt touch targets, and plenty of contrast.
- Text in the app is **Bahasa Indonesia** (copy from Figma). Code identifiers in **English**.

## MVP screens and the endpoints behind them

| Screen | Endpoint(s) |
|---|---|
| O1 Welcome / Masuk, Daftar | `POST /auth/login`, `POST /auth/register` |
| O2 Pilih Peran | `PATCH /me { activeRole }` |
| O3 Beranda (per role) | `GET /me`, `GET /orders?as=…&scope=active`, `GET /trips/mine` |
| O4 Aktivitas | `GET /orders?as=sender\|driver&scope=active\|history` |
| O5 Notifikasi | `GET /notifications`, `POST /notifications/read-all` |
| S1 Detail Paket | `GET /meta` (sizes, categories, handling), `POST /uploads` |
| S2 Jemput, Antar & Batas Waktu | `POST /matches/estimate` (pickup/drop-off picked on MapView or from preset places) |
| S3 Driver Searah | `POST /matches/search`; "Posting Permintaan Terbuka" → `POST /orders` without `tripId` |
| S4 Tinjau & Konfirmasi | `POST /orders` with `tripId` |
| S5 Lacak | `GET /orders/:id` + SSE `order.updated`/`trip.location`; show `handoverCode` |
| S6 Menunggu Driver, S7 Batalkan | `GET /orders/:id`, `POST /orders/:id/cancel` |
| D1–D2 Buat Rute | `POST /trips` |
| D3 Permintaan Masuk | `GET /trips/:id/requests` |
| D4 Detail Permintaan | `POST /orders/:id/accept`, `/decline` |
| D5 Perjalanan Aktif | `POST /trips/:id/start`, `GET /trips/:id/manifest`, `POST /orders/:id/pickup`, `/arrive`, send `POST /trips/:id/location` every ~10 s while ongoing |
| D6 Rute Saya | `GET /trips/mine?scope=…` |
| X1 Chat | `GET/POST /orders/:id/messages` + SSE `message.created` |
| X2 Serah Terima | `POST /orders/:id/deliver { code, photoUrl? }` |
| X3 Rating | `POST /orders/:id/rating` |
| Payment (P1) | Just a method picker; `POST /orders/:id/pay` is mocked |

Everything else in Figma (dropship, transfer, bus, most settings, dispute reporting) gets a **"Segera hadir"** placeholder route, so navigation is complete and ready to extend.

## Definition of done for this phase

On the Android Studio emulator, with the backend running and demo data (password `kirimin123`):

1. Log in as **Wayan (081200000001)**. Kirim: fill S1 → S2 (Jl. Tukad Badung → Gedung FT) → S3 shows Made S. as a direct match → S4 sends the request → S5 shows "Menunggu konfirmasi driver" and the 4-digit code.
2. Log out and log in as **Made (081200000003)**. Angkut: D3 shows the request → D4 accept → D5 start trip, pick up → X2 enter Wayan's code → delivered.
3. Back as Wayan: S5 shows "Selesai" (live via SSE, or within a few seconds by polling), then X3 rating works.
4. `cd server && npm test` still passes. `cd app && npx tsc --noEmit` passes.

## Working agreement

- Work on branch **`feat/mobile-app`** off `main`, commit in small steps, open a PR when the definition of done passes.
- Update `README.md` (status table plus how to run the app) and add `docs/APP.md` describing the component system and how to add a screen.
- Don't commit secrets, `node_modules`, `android/` or `ios/` build folders (already in `.gitignore`).
