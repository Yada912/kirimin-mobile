# Kirimin Mobile — Production Readiness Setup Checklist (Supabase & Full Stack)

This guide lists **every setup step required to take Kirimin Mobile from MVP/demo to a real production launch**, building on top of your existing **Supabase** setup (plus notes on the built-in Turso/Cloudinary alternative).

---

## 1. Database & File Storage — Supabase Setup

Your repository currently runs on local SQLite (`node:sqlite`) with a built-in **Turso/libSQL** adapter (`server/src/db/libsql.ts`) and **Cloudinary** adapter (`server/src/storage/files.ts`). To run production on your **existing Supabase project**:

### 1.1 PostgreSQL Database (Supabase)
- [ ] **Reactivate / unpause project**: Free-tier Supabase projects pause automatically after 7 days of inactivity. Restore it in the Supabase Dashboard (or upgrade to Pro for no-pause SLA).
- [ ] **Keep-alive ping (if staying on Free Tier)**: Schedule a lightweight cron (e.g. GitHub Actions or UptimeRobot every 12 hours) calling `GET https://your-api-domain/health` with a `SELECT 1` DB check so Supabase never auto-pauses.
- [ ] **Use Supavisor Transaction Pooler URL**: Copy the pooled connection string (`port 6543`, `?pgbouncer=true&sslmode=require`) into `DATABASE_URL`.
- [ ] **Add PostgreSQL `Db` Adapter (`server/src/db/postgres.ts`)**:
  - Implement the existing `Db` interface (`server/src/db/database.ts`) using `pg` (or `postgres` npm package).
  - Translate SQLite `?` placeholders to PostgreSQL `$1, $2, …` in the adapter wrapper.
  - Convert `INSERT OR IGNORE` (used in `trips.ts` recurring trip generator) to `ON CONFLICT DO NOTHING`.
  - Apply `001_init.sql` and `002_mvp_features.sql` (replace SQLite `INTEGER` boolean flags or keep `0/1` `SMALLINT` for full compatibility).
- [ ] **Enable Automated Daily Backups & PITR** in Supabase Project Settings → Database → Backups.

### 1.2 Photo Uploads — Supabase Storage
- [ ] Create a storage bucket named `kirimin-uploads` (public read for package photos, **private** bucket `kirimin-kyc` with signed URLs for KTP/selfie verification photos!).
- [ ] Add a `supabaseFileStore` implementation of `FileStore` in `server/src/storage/files.ts` using `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (server-side only — never expose the service role key in `app/`).
- [ ] Configure bucket file size limit (`5 MB`) and allowed MIME types (`image/jpeg`, `image/png`, `image/webp`).

> **Zero-Code Alternative (Already Built-In):** If you want Rp 0 production immediately without writing a Postgres adapter, `server/` already ships with zero-dependency **Turso/libSQL** (`DATABASE_URL=libsql://...`) + **Cloudinary** (`CLOUDINARY_URL=...`). Verify with `npm --prefix server run verify:hosting`.

---

## 2. Backend API Hosting & Realtime SSE

- [ ] **Deploy `server/` to an Always-On HTTPS Host**:
  - Options: **Render** (`render.yaml` already included — upgrade to Starter `$7/mo` to eliminate 1-minute cold starts), **Railway**, **Fly.io**, or **Oracle Cloud Always Free VM** + Caddy/Nginx reverse proxy.
- [ ] **Set Production Environment Variables**:
  - `NODE_ENV=production`
  - `JWT_SECRET` — strong 64-char hex secret (`openssl rand -hex 32`)
  - `CORS_ORIGIN` — restrict from `*` to your exact web/admin origins
  - `SEED_ON_EMPTY=false` — prevent demo accounts (`Wayan`, `Made S.`, `kirimin123`) from being created in production!
  - `AUTO_APPROVE_VERIFICATION=false` — require real admin review for KTP uploads
  - `TZ_OFFSET_MINUTES=480` — Bali / WITA (UTC+8)
- [ ] **Verify SSE Streaming Through Reverse Proxy**:
  - Ensure Nginx/Cloudflare/Load Balancer disables response buffering on `GET /events` (`X-Accel-Buffering: no`, idle timeout ≥ 120s) so realtime tracking & chat updates stream instantly.
- [ ] **Custom Domain + TLS**: Point `api.kirimin.id` (or your domain) with automatic HTTPS.
- [ ] **Uptime Monitoring**: Configure UptimeRobot / Better Stack to monitor `GET /health` every 5 minutes with alerting.

---

## 3. Maps, Real Road Routing & Geocoding at Scale

Currently, `MapView` uses Carto Voyager / OSM / Carto Dark tiles and OSRM public driving routing (`router.project-osrm.org`) with a built-in South Bali arterial road-graph fallback (`app/src/utils/routing.ts`).

- [ ] **Production Road Routing (Turn-by-Turn & Polylines)**:
  - The public OSRM demo server has strict fair-use rate limits and no SLA.
  - **Best low-cost option**: Self-host **OSRM** in Docker using the Geofabrik Bali/Indonesia `.osm.pbf` extract (uses < 200 MB RAM for Bali/Nusa Tenggara!), OR switch `fetchRoadRoute()` to **OpenRouteService**, **Mapbox Directions API**, or **Google Routes API**.
- [ ] **Production Map Tiles**:
  - Replace public OSM/Carto tile URLs in `app/src/ui/MapView.tsx` with a commercial key (e.g. **MapTiler**, **Stadia Maps**, **Mapbox**, or native **Google Maps SDK** via `react-native-maps`) to prevent IP throttling at high user counts.
- [ ] **Free-Text Street Geocoding**:
  - Wire a geocoding proxy endpoint (`GET /places/search?q=...`) backed by **Photon**, **Mapbox Geocoding**, or **Google Places Autocomplete** so users can search any street/building name beyond saved & Bali corridor places.

---

## 4. Real Payment Gateway & Driver Payouts (Indonesia)

Kirimin already ships with a full **production-structured Payment Gateway pipeline** (`server/src/payments/gateway.ts`, `server/src/modules/payments.ts`, migration `003_payment_gateway.sql`, and `app/app/bayar/[orderId].tsx`):
- Idempotent charge creation (`POST /orders/:id/payments` with `idempotencyKey`)
- Server-generated EMVCo QRIS payloads, Bank VA numbers, E-Wallet deep links, and expiry countdowns
- Cryptographic SHA-512 webhook verification (`POST /webhooks/payments` with `timingSafeEqual`) + idempotent settlement + realtime `payment.updated` SSE events
- Built-in **Sandbox Simulator** (`POST /payments/:id/sandbox/simulate`) enabled only when `PAYMENT_GATEWAY=mock_gateway`

To switch from Sandbox to real money:
- [ ] **Midtrans or Xendit Account**: Complete KYB/UMKM verification (Rp 0 monthly fee, pay-per-transaction).
- [ ] **Plug in Live Provider Adapter (`server/src/payments/gateway.ts`)**:
  - Implement `PaymentGatewayProvider` (`createCharge`, `verifyWebhook`, `refundCharge`) calling Midtrans Core API (`/v2/charge`) or Xendit Invoice/QR/VA APIs using `MIDTRANS_SERVER_KEY` or `XENDIT_SECRET_KEY`.
  - Set `PAYMENT_GATEWAY=midtrans` (or `xendit`) and `PAYMENT_WEBHOOK_SECRET` in production env vars (this automatically disables the `/sandbox/simulate` endpoint).
- [ ] **Point Gateway Webhook URL**: Register `https://api.kirimin.id/webhooks/payments` in your Midtrans/Xendit dashboard so live settlement callbacks hit the existing verified webhook handler.
- [ ] **Automated Driver Disbursements**:
  - Connect `POST /wallet/withdraw` (`server/src/modules/wallet.ts`) to **Midtrans Iris** or **Xendit Disbursements** for real bank/e-wallet transfers.

---

## 5. Push Notifications & Phone Verification (OTP)

- [ ] **Firebase Cloud Messaging (FCM) for Android**:
  1. Create a Firebase project (`Spark` free tier) and register Android package `com.kirimin.app`.
  2. Download `google-services.json` → place in `app/google-services.json` and add `"googleServicesFile": "./google-services.json"` in `app/app.json`.
  3. Upload the Firebase Service Account key via `eas credentials` and set `EXPO_ACCESS_TOKEN` on `server/`.
- [ ] **Apple Push Notification Service (APNs)** (if releasing on iOS): Configure APNs key in EAS Credentials.
- [ ] **Real Phone OTP Verification**:
  - Integrate WhatsApp/SMS OTP (e.g., **Fonnte**, **Zenziva**, or **Twilio Verify**) on `/auth/register` and password reset so phone numbers are verified and spam accounts are prevented.

---

## 6. Security, Trust & Admin Operations

- [ ] **Rate Limiting**: Add IP + user rate limits on `/auth/login`, `/auth/register`, `/orders`, and `/uploads` (at reverse proxy or middleware level).
- [ ] **Admin Moderation Panel**:
  - Build a small protected admin view (or Supabase Studio + secure admin endpoints) to:
    - Review and approve/reject pending KTP verifications (`verification_status = 'pending'`)
    - Resolve user problem reports (`reports` table)
    - Handle payment disputes & manual refunds
- [ ] **Error Tracking & Telemetry**:
  - Add **Sentry** (`@sentry/node` on `server/`, `@sentry/react-native` in `app/`) for crash reporting & slow API tracing.
- [ ] **Legal & Compliance**:
  - Host public **Privacy Policy** & **Terms of Service** web pages (required by Google Play / App Store) and link them in app store listings. (Account deletion `POST /me/delete` is already implemented!)

---

## 7. Mobile App Release Build & Store Distribution

- [ ] **Point App to Production API**: Set `EXPO_PUBLIC_API_URL=https://api.kirimin.id` in EAS build profile (`eas.json`).
- [ ] **Generate & Secure Release Keystore**:
  ```bash
  keytool -genkeypair -v -storetype PKCS12 -keystore kirimin-release.keystore \
    -alias kirimin -keyalg RSA -keysize 2048 -validity 10000
  ```
  Store the keystore and passwords in a password manager / EAS Secrets — never commit them to git.
- [ ] **Configure EAS Build (`app/eas.json`)**:
  - `preview` profile (`.apk` for internal QA & testers)
  - `production` profile (`.aab` Android App Bundle for Google Play)
- [ ] **Google Play Console Setup**:
  - Complete App Content, Data Safety (disclose location, phone number, photos), and Foreground Location permission justification.
  - Run a Closed Testing track before promoting to Production.
