import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { config } from './config.ts';
import { migrate, openSqlite } from './db/database.ts';
import { seedIfEmpty } from './db/seed.ts';
import { createHub } from './realtime/hub.ts';
import { openLibsql } from './db/libsql.ts';
import { cloudinaryFileStore, localFileStore } from './storage/files.ts';
import { createApp } from './app.ts';
import { expoPushSender, noopPushSender } from './push/expo.ts';

function openDatabase() {
  const url = config.databaseUrl;
  if (url && /^(libsql|https?):\/\//i.test(url)) {
    console.log(`Database: Turso/libSQL at ${new URL(url).host}`);
    return openLibsql(url, config.databaseAuthToken);
  }
  if (url) throw new Error(`DATABASE_URL must start with libsql:// (got "${url.split(':')[0]}:"). Unset it to use DATABASE_PATH.`);
  console.log(`Database: SQLite file ${config.databasePath}`);
  return openSqlite(config.databasePath);
}

const db = openDatabase();
const applied = await migrate(db);
if (applied.length) console.log(`Migrations applied: ${applied.join(', ')}`);
if (config.seedOnEmpty && (await seedIfEmpty(db))) console.log('Seeded demo data (password for all demo users: kirimin123)');

const hub = createHub();
const push = config.pushEnabled ? expoPushSender(config.expoAccessToken) : noopPushSender;
const files = config.cloudinaryUrl
  ? cloudinaryFileStore(config.cloudinaryUrl, { folder: config.cloudinaryFolder })
  : localFileStore(config.uploadDir);
console.log(`Photos: ${config.cloudinaryUrl ? 'Cloudinary' : `local folder ${config.uploadDir}`}`);
const app = createApp({ db, hub, files, push });
const server = createServer((req, res) => void app.handle(req, res));

// Expire requests whose deadline passed without a driver.
const expiryJob = setInterval(() => {
  app.services.orders.expireOverdue().catch((e) => console.error('expiry job failed', e));
}, 60_000);

// Publish upcoming departures of weekly routes (D1 "Ulangi"), now and every hour.
const runRecurring = () =>
  app.services.trips
    .generateRecurring()
    .then((n) => n > 0 && console.log(`Published ${n} upcoming departure(s) of recurring routes`))
    .catch((e) => console.error('recurring job failed', e));
await runRecurring();
const recurringJob = setInterval(runRecurring, 60 * 60_000);

server.listen(config.port, config.host, () => {
  console.log(`\nKirimin API listening on port ${config.port}`);
  console.log(`  Laptop:  http://localhost:${config.port}/health`);
  for (const nets of Object.values(networkInterfaces())) {
    for (const n of nets ?? []) {
      if (n.family === 'IPv4' && !n.internal) console.log(`  Phone:   http://${n.address}:${config.port}   (same Wi-Fi)`);
    }
  }
  console.log('');
});

function shutdown() {
  console.log('Shutting down…');
  clearInterval(expiryJob);
  clearInterval(recurringJob);
  hub.closeAll();
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
