# Quick Demo & Free Deployment Guide (2–3 Mobile Devices Today)

This guide gets **KIRIMIN** running live across **2–3 phones** in under **5–10 minutes** for **Rp 0** — ideal for a same-day multi-device demo.

---

## Step 1 — Pick a Free Server Option (Choose One)

Because `server/` is zero-dependency Node.js (`node:http` + `node:sqlite`), you have three great **free** options depending on whether your laptop will stay open during the demo.

### Option A: Render Free Tier (Recommended if you want a Cloud URL, no laptop needed)
The repository already includes [`render.yaml`](../render.yaml) pre-configured with `PAYMENT_GATEWAY=mock_gateway`, `SEED_ON_EMPTY=true`, and auto-generated `JWT_SECRET` + `PAYMENT_WEBHOOK_SECRET`.

1. Push your latest branch to GitHub.
2. Go to **[render.com](https://render.com)** → **New +** → **Blueprint** → connect this repository.
3. Render reads `render.yaml` automatically. For a **today-only demo**, you can leave `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, and `CLOUDINARY_URL` **blank** (the server automatically uses local SQLite + local uploads and seeds all demo accounts!).
   - **Important for a same-day demo:** Render's free tier sleeps after **15 minutes of inactivity** (which resets local SQLite if Turso isn't connected).
   - **Keep-awake trick (free, 60 seconds):** Sign up at **[cron-job.org](https://cron-job.org)** or **[uptimerobot.com](https://uptimerobot.com)** and ping `https://<your-service>.onrender.com/health` every **10 minutes** until the end of today! Your server stays hot with **zero cold starts** and **zero data resets** all day.
   - *(Optional, 2 extra minutes)* If you want data to survive restarts too, add a free **[Turso](https://turso.tech)** database (`DATABASE_URL` + `DATABASE_AUTH_TOKEN`).
4. Verify your live backend by opening:
   ```
   https://<your-service>.onrender.com/health
   ```

### Option B: Laptop + ngrok Free (Fastest — 2 minutes, Zero Cold Starts, Full SSE Realtime)
Best if your laptop stays open next to you during the demo. Note that `app/src/api/client.ts` **already sends `ngrok-skip-browser-warning: 1`** on every request!

1. Start the backend locally (requires Node 22.18+ or Node 24 LTS):
   ```bash
   cd server
   npm run db:reset   # fresh seeded demo data
   npm start
   ```
2. In a second terminal, expose port `3000` with **[ngrok](https://ngrok.com)** (free account, static dev domain):
   ```bash
   ngrok http 3000
   ```
3. Copy the HTTPS forwarding URL (e.g. `https://<your-name>.ngrok-free.app`). All 2–3 phones can connect over **4G/5G or any Wi-Fi**, and SSE live updates work seamlessly.

*(Alternative: if all 2–3 phones and your laptop are on the **exact same personal Wi-Fi / mobile hotspot**, you don't even need ngrok — just use the `Phone: http://192.168.x.x:3000` address printed when `npm start` boots!)*

### Option C: Koyeb Free Tier (Alternative Free Cloud Host)
If Render is slow or full, **[koyeb.com](https://www.koyeb.com)** offers a free Nano web service:
1. Create a Web Service from this GitHub repo.
2. **Work directory:** `server`
3. **Run command:** `npm start`
4. **Port:** `3000`, **Health check:** `/health`
5. **Env vars:** `NODE_ENV=production`, `JWT_SECRET=<any-32-char-random>`, `PAYMENT_GATEWAY=mock_gateway`, `PAYMENT_WEBHOOK_SECRET=<any-32-char-random>`, `SEED_ON_EMPTY=true`.

---

## Step 2 — Put the App on 2–3 Phones (Choose One)

### Path 1: Instant Mobile Web App on 2–3 Phones (Fastest, Works on Both iOS & Android, Zero App Store/APK Hassle)
The entire Expo app (interactive road maps, turn-by-turn HUD, live SSE, QRIS payment gateway, custom presets) runs smoothly on mobile Safari & Chrome!

1. Build the static web bundle pointed at your live Step 1 API URL:
   ```bash
   cd app
   npm install --legacy-peer-deps
   EXPO_PUBLIC_API_URL=https://<your-api-url> npx expo export --platform web --output-dir dist
   ```
2. Deploy `app/dist` in **30 seconds** for free:
   - **Netlify Drop:** Drag the `app/dist` folder straight onto **[app.netlify.com/drop](https://app.netlify.com/drop)** — instant `https://...netlify.app` URL!
   - **Or Vercel CLI:** `npx vercel --prod app/dist`
   - **Or Cloudflare Pages:** `npx wrangler pages deploy app/dist --project-name kirimin-demo`
3. Open the URL on all **2–3 phones** → tap **Share → Add to Home Screen** (iOS) or **⋮ → Install / Add to Home Screen** (Android) so it launches full-screen with the new **KIRIMIN** icon!

### Path 2: Native App via Expo Go (All 2–3 Phones Scan 1 QR Code)
1. Install **Expo Go** from the App Store / Play Store on all 2–3 phones.
2. Start Metro with tunnel mode pointed at your live Step 1 API URL:
   ```bash
   cd app
   npm install --legacy-peer-deps
   EXPO_PUBLIC_API_URL=https://<your-api-url> npx expo start --tunnel
   ```
3. Scan the QR code on all 2–3 phones — they all connect simultaneously to the same live backend!

---

## Step 3 — Recommended 3-Device Live Demo Script

All seeded demo accounts use password **`kirimin123`** (and have 1-tap login pills on the Login screen):

| Device | Role | Account | What to Demo Live |
|---|---|---|---|
| **Phone 1** | **Pengirim (Sender)** | `Wayan` (`081200000001`) | Tap 1-tap preset `Renon → Kampus Bukit` → pick package → select driver **Made S.** → **Bayar** → pick **QRIS Dinamis** → tap **Simulasikan Bayar Berhasil (Settlement)** → show verified digital receipt & live tracking map. |
| **Phone 2** | **Pengemudi (Driver)** | `Made S.` (`081200000003`) | Watch incoming request appear in real time → tap **Terima** → tap **Mulai Perjalanan** → show interactive road map, turn-by-turn HUD, layer switcher (`Apple Clean`, `Peta Jalan`, `Satelit`, `Mode Malam`), & `Simulasi Gerak` → tap **Ambil Paket** → **Tiba di Tujuan** → enter Phone 1's **4-digit handover code** to complete! |
| **Phone 3** | **New User / Customizer** | Register live! | Walk through the **3-step onboarding** (`Daftar Akun Baru` → choose role + vehicle → save home/campus pin) → edit route presets (`Edit Preset`), add a custom location, and watch Phone 2's live position update. |

### Quick Pre-Demo Sanity Check (30 seconds before presenting)
1. Open `https://<your-api-url>/health` — confirm `{"ok":true}`.
2. Log into Phone 1 (`Wayan`) and Phone 2 (`Made S.`) so both are already signed in and ready on their home screens.
3. If you want a completely clean slate right before presenting, run `npm --prefix server run db:reset` (if on laptop/ngrok) or redeploy/restart (if on Render without Turso).
