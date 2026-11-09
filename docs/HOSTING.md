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

The server was built with this move in mind. Each swap touches **one file**, and no routes or services change.

1. **Database → Turso.** `server/src/db/database.ts` defines a small async `Db` interface (`all`, `get`, `run`, `transaction`). Add `npm install @libsql/client`, then write an `openLibsql(url, authToken)` that implements the same four methods with `client.execute({ sql, args })` (and `client.transaction('write')` for transactions). In `index.ts`, use it when `DATABASE_URL` starts with `libsql://`. Migrations and SQL stay as they are.
2. **Photos → Cloudinary.** `server/src/storage/files.ts` defines `FileStore` (`save`, `serve`). Write a `cloudinaryFileStore` whose `save` uploads the bytes and returns the absolute `secure_url`. `serve` is no longer needed. The app already treats photo URLs as opaque strings.
3. **Environment variables on Render:** `NODE_ENV=production`, `JWT_SECRET` (the blueprint generates one), `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `CLOUDINARY_URL`.
4. **App:** change the API base URL from the laptop/ngrok address to `https://kirimin-api.onrender.com`.

Steps 1–2 are about 40 lines each. Ask Claude to do them when you get there; they couldn't be done in this session because package installs were disabled.

## Deploying to Render (when ready)

1. Push the repo to GitHub (already done).
2. render.com → **New → Blueprint** → pick `kirimin-mobile`. Render reads `render.yaml`.
3. Add the Turso and Cloudinary variables, then deploy. Check `https://<name>.onrender.com/health`.

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
