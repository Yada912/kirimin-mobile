# Running the backend on your laptop

The API is plain Node.js with **zero npm dependencies**. It uses Node's built-in HTTP server, SQLite (`node:sqlite`) and crypto, and Node runs the TypeScript files directly. You don't install anything except Node, and there's no separate database server.

## 1. Install Node 24 LTS (once)

You need **Node 22.18 or newer**, and Node 24 LTS is recommended. Older versions can't run `.ts` files directly or don't include `node:sqlite`.

```powershell
winget install OpenJS.NodeJS.LTS     # or download the LTS installer from nodejs.org
node -v                              # should print v24.x (or ≥ v22.18)
```

## 2. Start the server

```powershell
cd "D:\UNUD\Kuliah Informatika\smt 5\matkul pak gungde\kirimin-mobile\server"
copy .env.example .env               # optional, defaults are fine
npm run dev                          # auto-restarts when you edit code
```

You'll see something like this:

```
Migrations applied: 001_init.sql, 002_mvp_features.sql
Seeded demo data (password for all demo users: kirimin123)
Published 3 upcoming departure(s) of recurring routes

Kirimin API listening on port 3000
  Laptop:  http://localhost:3000/health
  Phone:   http://192.168.1.23:3000   (same Wi-Fi)
```

Stop it with `Ctrl+C`. The data is kept in `server/data/kirimin.db` between runs.

| Command | What it does |
|---|---|
| `npm run dev` | Start with auto-reload (use this while developing) |
| `npm start` | Start without auto-reload |
| `npm run db:reset` | Delete the database and photos, then reseed fresh demo data |
| `npm test` | Unit tests plus a full end-to-end flow test (in-memory database) |
| `npm install` then `npm run typecheck` | Optional type checking (installs only TypeScript and Node types) |

### Demo accounts (password `kirimin123`)

| Phone | Name | Mode |
|---|---|---|
| 081200000001 | Wayan | sender |
| 081200000002 | Ayu P. | sender (has one open request) |
| 081200000003 | Made S. | driver, Motor DK 1101 XL, route Renon → Kampus Bukit |
| 081200000004 | Komang A. | driver, route Panjer → Kampus Bukit |
| 081200000005 | Putu W. | driver, Mobil, route Sanur → Nusa Dua |

Demo trips are created to depart 1–1.5 hours after the database is seeded. They repeat Monday to Friday, so the server keeps publishing the next departures (two days ahead) while it runs. If the demo data still looks stale, run `npm run db:reset`.

**Already have a database from an earlier version?** Just start the server. New migrations are applied automatically, and your data and login tokens are kept.

### Try it without the app

- In a browser, open `http://localhost:3000/health` and `http://localhost:3000/meta`.
- In VS Code, install the **REST Client** extension, open `server/requests.http` and click **Send Request** on each block. It walks through the whole send → deliver flow.
- The full endpoint list is in [API.md](API.md).

## 3. Reach the laptop from your phone

Pick whichever option fits where you are.

### A. Same Wi-Fi (simplest, everything works)

1. Connect the phone and the laptop to the same Wi-Fi.
2. Use the `Phone:` URL that the server prints, e.g. `http://192.168.1.23:3000`, as the app's API URL.
3. The first time you run it, Windows Firewall asks whether to allow Node.js. Tick **Private networks** and allow it. If the phone can't connect, check that Windows lists your Wi-Fi as a *Private* network (Settings → Network & internet → Wi-Fi → your network → Network profile type).
4. **Campus or café Wi-Fi often blocks devices from talking to each other.** If that happens, turn on your phone's hotspot and connect the laptop to it. The laptop's IP changes, so use the new `Phone:` URL.

Android emulator: use `http://10.0.2.2:3000` (that address means "the computer running the emulator").

### B. Any network: ngrok (free account, URL never changes)

Use this when the phone isn't on the same network, or when you want to demo for your lecturer from anywhere.

1. Sign up at ngrok.com (free) and install it with `winget install ngrok.ngrok`, then run `ngrok config add-authtoken <your token>`.
2. With the server running: `ngrok http 3000`.
3. Use the `https://<your-name>.ngrok-free.app` (or `.ngrok-free.dev`) URL as the API URL. Free accounts get one fixed dev domain, so you only set this in the app once.
4. In the app's API client, send the header `ngrok-skip-browser-warning: 1` on every request. Without it, ngrok can serve its warning page instead of your JSON. The server already allows this header.

Free plan limits: 1 GB of traffic and about 20k requests a month. That's plenty for testing, but don't leave the app polling every second all day.

### C. Any network, no account: Cloudflare Quick Tunnel

```powershell
winget install --id Cloudflare.cloudflared
cloudflared tunnel --url http://localhost:3000
```

This gives you a random `https://….trycloudflare.com` URL that **changes every time** you run it. Cloudflare says quick tunnels are for testing only and **don't support Server-Sent Events**. Live updates (`/events`) won't stream through it, so the app falls back to polling. Everything else works.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `SyntaxError` on a `type` / `interface` line, or `Cannot find module 'node:sqlite'` | Node is too old. Install Node 24 LTS. |
| `EADDRINUSE` | Port 3000 is already in use. Stop the other server, or set `PORT=3001` in `.env`. |
| Phone times out on Wi-Fi | Check the firewall and Private network settings, or the Wi-Fi blocks devices from reaching each other (use a hotspot or option B). |
| `401` everywhere after `db:reset` | Old tokens point to deleted users. Log in again. |
| `ExperimentalWarning: SQLite…` | Harmless. The npm scripts already hide it. |
