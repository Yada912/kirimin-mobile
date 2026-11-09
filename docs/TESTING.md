# Testing Kirimin

There are three layers. Each one catches a different kind of bug, and they go from fastest to most realistic.

| Layer | Where | Needs | Time | Catches |
|---|---|---|---|---|
| **1. Server tests** | `server/test/` | Node | ~2 s | Business rules: matching, pricing, the order state machine, permissions |
| **2. App contract tests** | `app/tests/contract/` | Node (no emulator, no `npm install`) | ~2 s | The UI and the server disagreeing: wrong endpoint, wrong request body, a link to a screen that doesn't exist, realtime not wired, formatting bugs |
| **3. End-to-end UI tests** | `app/e2e/` (Maestro) | Android emulator + backend + Maestro | ~3–5 min | What a real user sees and taps on the phone: screens render, buttons do the right thing, the whole send → deliver → rate flow works |

Plus `cd app && npm run typecheck` (TypeScript), which catches screens reading fields the API doesn't return.

## 1. Server tests

```powershell
cd server
npm test
```

## 2. App contract tests (run these after every change to a screen)

```powershell
cd app
npm run test:contract
```

These start the real server in memory, then check the app's source code and data against it:

| Test file | What it proves |
|---|---|
| `wiring.test.ts` | Scans every `api.get/post/…` call in the app and checks that each endpoint exists on the server. Checks that every `router.push(...)` target has a matching screen file. Checks that the app subscribes to every realtime event the server sends. |
| `kirim-angkut-flow.test.ts` | Runs the MVP flow (S1 → S5, S6, S7, D3 → D5, X2, X3) using **the same functions the screens use** to build requests (`src/features/kirim/draft.ts`), with params encoded exactly the way the screens pass them. It also checks that every size and category offered on S1 is accepted by the server. |
| `format.test.ts` | Rupiah, distance, time and similarity formatting |

**Rule for future screens:** if a screen builds a request body, put that code in a pure function under `src/features/` (no React Native imports) and add a case to the flow test. That's what makes it testable without an emulator.

## 3. End-to-end tests on the Android emulator (Maestro)

The flows are YAML files that tap through the real app like a user would. They mostly find things by their visible Indonesian text. The handover code screens use `testID`s.

| Flow | Covers |
|---|---|
| `01_smoke_screens.yaml` | Every tab of both roles renders; S1 and D1 open; switching role works |
| `02_kirim_send_to_driver.yaml` | Wayan: S1 → S2 (estimate shown) → S3 (Made offered, similarity ≤ 100%) → S4 → S5 (status and 4-digit code shown) |
| `03_angkut_accept_and_deliver.yaml` | Made: D3 accept → D5 start, pickup, arrive → X2 wrong code is rejected with a message, right code delivers → finish route |
| `04_kirim_rate_driver.yaml` | Wayan: delivered order in history, code hidden, X3 rating |
| `05_kirim_open_request_and_cancel.yaml` | S3 "Posting Permintaan Terbuka" → S4 shows no fake price → S6 → S7 cancel |

`e2e/scripts/api.js` runs on your laptop during a flow. It does two jobs: a **preflight** check (is the backend up, are the demo routes still fresh?) and it reads the handover code the way a real recipient would read it out to the driver.

### One-time setup

1. **Java 17+:** `winget install EclipseAdoptium.Temurin.17.JDK`. Android Studio's bundled JDK works too if `JAVA_HOME` points to it.
2. **Maestro CLI:** follow the Windows guide on docs.maestro.dev (*Getting Started → Installing Maestro → Windows*). Then check that `maestro --version` works in a new terminal.
3. **Emulator:** Maestro's docs list Android API 29–34 as supported, with 35/36 support announced for 2026. To be safe, create a **Pixel, API 34** emulator in Android Studio's Device Manager just for testing.
4. **Install the app as a real build** (Maestro needs the `com.kirimin.app` package, not Expo Go). With the emulator running:
   ```powershell
   cd app
   npx expo run:android
   ```
   This builds a debug APK with the Android SDK and installs it. Keep the Metro terminal it opens running, because the debug build loads its JavaScript from Metro.

### Every run

```powershell
# Terminal 1: fresh demo data, then the backend
cd server
npm run db:reset
npm run dev

# Terminal 2: Metro for the debug build (skip if `npx expo run:android` is still running)
cd app
npx expo start

# Terminal 3: the tests
cd app
npm run e2e:smoke      # 1 flow, ~1 min
npm run e2e            # all 5 flows in order
```

Maestro prints each step as it runs. On failure it stops and saves a screenshot plus a hierarchy dump in `~/.maestro/tests/<date>/`. Flows 02 and 03 also save `e2e-02-lacak.png` and `e2e-03-delivered.png`.

**Reset before each full run.** Each run uses up one of Made's 3 route slots, and the demo routes go stale after a few hours. The preflight step stops with a clear message when that happens.

Want to see the app while writing a flow? Run `maestro studio`. It opens a browser UI where you can tap elements on the emulator and get the YAML for them.

## Bugs these tests found (fixed in the same change)

| Bug | Effect in the app | Caught by |
|---|---|---|
| `src/api/sse.ts` only listened for the generic `message` event, but the server sends **named** events (`order.updated`, …) | Realtime never worked. Screens only updated through their 3–10 s polling. | `wiring.test.ts` (realtime) |
| S3 and S4 showed `similarity * 100`, but the API already returns 10–100 | "9400% searah" | `format.test.ts`, E2E flow 02 |
| S4 showed made-up prices (Rp 10.000 + 2.000) for an open request | The sender sees a price that doesn't exist | `kirim-angkut-flow.test.ts` (S6), E2E flow 05 |
| The rating screen always went to the **sender's** activity tab | A driver who rates ends up in the wrong role's tab | Code review while writing E2E flows |

Known gaps (not bugs, but worth knowing): D1 "Buat Rute" always departs *now* with a hard-coded vehicle (`DK 1101 XL`), and S2 has no deadline ("Batas Waktu") picker yet.
