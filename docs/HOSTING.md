# Hosting options (all free)

**Right now:** run the API on your laptop when you need it. See [SETUP-LAPTOP.md](SETUP-LAPTOP.md). It costs nothing, has no cold starts, and the data stays on your disk.

When you want the app to work without your laptop being on (e.g. for the final demo), this is the free setup the code is prepared for. The limits below were checked in November 2026. Free tiers change, so re-check each provider's pricing page before relying on one.

## Recommended free stack

| Piece | Service | Free tier (Nov 2026) | Why |
|---|---|---|---|
| API server | **Render**, free web service | 750 instance-hours/month, 512 MB RAM. **Sleeps after 15 min idle** and takes about 1 min to wake up. **Disk is wiped** on every restart. | Deploys straight from GitHub. `render.yaml` in the repo already describes the service. |
| Database | **Turso** (hosted SQLite/libSQL) | 100 databases, 5 GB, 500M row reads + 10M row writes a month, no credit card | Speaks the same SQLite dialect as the laptop DB, so the SQL and migrations don't change. Doesn't sleep. |
| Photos | **Cloudinary** | 25 credits/month (1 credit ≈ 1 GB storage *or* 1 GB bandwidth *or* 1k transformations), no credit card | Render's disk is temporary, so uploads must live somewhere else. |

Cost: Rp 0. The catch is that the first request after 15 idle minutes takes about a minute. Before a demo, open `/health` once to wake the server.

### Why not just put SQLite on Render?

Render's free disk is wiped whenever the service sleeps or redeploys. The server would start fine and reseed the demo data, but every real account and order would disappear. That's fine for a quick test and not fine for a demo. Turso fixes it.

## What changes in the code when you deploy

Nothing, because both adapters are already built in. The server picks them from environment variables, and no routes or services change. Without these variables it keeps using the laptop setup (SQLite file + `data/uploads`), and the tests always do.

1. **Database → Turso** (`server/src/db/libsql.ts`). This implements the same `Db` interface as `database.ts` over Turso's HTTP API ("Hrana over HTTP", `POST /v2/pipeline`) with plain `fetch`. There's no `@libsql/client`, so the server stays zero-dependency. The server uses it when `DATABASE_URL` starts with `libsql://`; the token goes in `DATABASE_AUTH_TOKEN`.
   - A transaction keeps one Turso stream open (the "baton") from `BEGIN IMMEDIATE` to `COMMIT`/`ROLLBACK`. Writes and transactions from this server are queued one at a time, as on the single SQLite connection, so the server never competes with itself for Turso's write lock. Reads outside a transaction run in parallel.
   - The migrations in `server/src/db/migrations/` run unchanged at startup, including `ALTER TABLE … ADD COLUMN` and the partial unique index in `002_mvp_features.sql`. Turso is SQLite. `PRAGMA foreign_keys = ON` is sent on every stream.
   - With `SEED_ON_EMPTY=true` (the `render.yaml` default), the demo users are created once on the first start against an empty Turso database. Set it to `false` if you don't want them.
   - `npm run db:reset` only touches the local SQLite file. To start a Turso database over, run `turso db destroy kirimin` and create it again.
2. **Photos → Cloudinary** (`cloudinaryFileStore` in `server/src/storage/files.ts`). This is a signed upload built from `CLOUDINARY_URL`. `POST /uploads` then returns the absolute `https://res.cloudinary.com/…` `secure_url` instead of `/uploads/<name>`, and `GET /uploads/:name` isn't used. The app already treats photo URLs as opaque strings, and the same type/size checks apply. Photos go into the `kirimin` folder; change it with `CLOUDINARY_FOLDER`.
3. **Environment variables on Render:** `NODE_ENV=production`, `JWT_SECRET` (the blueprint generates one), `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `CLOUDINARY_URL`. The blueprint lists the last three with `sync: false`, so Render asks for their values when you create it.
4. **App:** change the API base URL from the laptop/ngrok address to `https://kirimin-api.onrender.com`. Photo URLs from Cloudinary are already absolute. Photos uploaded earlier on the laptop (`/uploads/…`) stay on the laptop.

### Getting the values

- **Turso:** sign up at turso.tech (no card), install the CLI, then run:
  ```bash
  turso db create kirimin --location sin    # Singapore is the closest region to Bali
  turso db show kirimin --url               # → DATABASE_URL (libsql://kirimin-<you>.turso.io)
  turso db tokens create kirimin            # → DATABASE_AUTH_TOKEN
  ```
  Check `turso db locations` for the exact region code.
- **Cloudinary:** sign up at cloudinary.com (no card). In the console go to **Settings → API Keys** and copy the **API environment variable**: `cloudinary://<api_key>:<api_secret>@<cloud_name>`. That is `CLOUDINARY_URL`.

### Verifying against real Turso/Cloudinary accounts

Do this once on the laptop before deploying:

1. Put the values in `server/.env` (see `.env.example`). Use a **separate** Turso database for this check (e.g. `turso db create kirimin-check`) if you don't want demo data in the real one.
2. Run `npm run verify:hosting` in `server/`. It connects to Turso, applies the migrations, checks that a transaction rolls back, uploads one 1×1 test image to Cloudinary and fetches it back. Every line should start with ✔. A ✘ line shows Turso's or Cloudinary's own error message (a wrong token shows up as `HTTP 401`, a wrong secret as `Invalid Signature`).
3. Run `npm run dev`. The first lines should say `Database: Turso/libSQL at …` and `Photos: Cloudinary`. Log in with a demo account, upload a photo with `POST /uploads` (see `requests.http`) and open the returned `https://res.cloudinary.com/…` URL. Restart the server and check the data is still there.
4. Optional: `turso db shell kirimin "SELECT name FROM _migrations"` should list every migration file.

Afterwards delete the test image in the Cloudinary Media Library (folder `kirimin`) and the check database with `turso db destroy kirimin-check` if you made one.

The automated tests don't need any accounts. `npm test` uses in-memory SQLite and local files. `npm run test:libsql` runs the feature tests through the Turso adapter against a local fake libSQL server (`server/test/fakeHrana.ts`). `test/cloudinary.test.ts` checks the upload signature against Cloudinary's documented example.

## Deploying to Render (when ready)

1. Push the repo to GitHub (already done).
2. render.com → **New → Blueprint** → pick `kirimin-mobile`. Render reads `render.yaml`.
3. Enter the Turso and Cloudinary values when Render asks for them (or later under **Environment**), then deploy. The deploy log should show `Database: Turso/libSQL` and `Photos: Cloudinary`. Check `https://<name>.onrender.com/health`.

The server needs no build step. Render runs `npm start` in `server/`, which runs the TypeScript directly on Node 24.

## Other options, and why they're not first choice

| Option | Notes |
|---|---|
| **Laptop + ngrok / Cloudflare tunnel** | What you're doing now. Free, but only works while the laptop is on. Cloudflare quick tunnels don't stream Server-Sent Events, so the app has to poll. |
| **Supabase** (your old project) | Free Postgres + storage, but free projects **pause after inactivity** (this already happened to your project). It would also need a Postgres version of the `Db` adapter (`?` → `$1` placeholders, a few type tweaks). Good choice if you ever want Postgres. |
| **Koyeb** | Used to have a free always-on instance. Since the Mistral AI acquisition (Feb 2026), reports say the free compute tier is closed to new sign-ups or needs a card. Check before trying. |
| **Railway** | Trial credit only, no lasting free tier. |
| **Fly.io** | No free tier for new accounts. |
| **Render free Postgres** | Expires after about 30 days. Avoid it; use Turso instead. |
| **Oracle Cloud Always Free VM** | Truly free and always on (you'd run `npm start` on a VM), but sign-up needs a card and the setup is more work. A good fallback if Render's cold starts bother you. |
