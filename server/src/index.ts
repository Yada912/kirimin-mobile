import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { config } from './config.ts';
import { migrate, openSqlite } from './db/database.ts';
import { seedIfEmpty } from './db/seed.ts';
import { createHub } from './realtime/hub.ts';
import { localFileStore } from './storage/files.ts';
import { createApp } from './app.ts';

const db = openSqlite(config.databasePath);
const applied = await migrate(db);
if (applied.length) console.log(`Migrations applied: ${applied.join(', ')}`);
if (config.seedOnEmpty && (await seedIfEmpty(db))) console.log('Seeded demo data (password for all demo users: kirimin123)');

const hub = createHub();
const app = createApp({ db, hub, files: localFileStore(config.uploadDir) });
const server = createServer((req, res) => void app.handle(req, res));

// Expire requests whose deadline passed without a driver.
const expiryJob = setInterval(() => {
  app.services.orders.expireOverdue().catch((e) => console.error('expiry job failed', e));
}, 60_000);

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
  hub.closeAll();
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
