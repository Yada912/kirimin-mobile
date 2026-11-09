/**
 * `npm run db:reset` — deletes the local SQLite database (and uploaded photos)
 * and re-creates it with fresh demo data. Only for your laptop.
 */
import { rmSync } from 'node:fs';
import { config } from '../config.ts';
import { migrate, openSqlite } from './database.ts';
import { seed } from './seed.ts';

if (config.isProd) {
  console.error('Refusing to reset the database with NODE_ENV=production.');
  process.exit(1);
}

if (config.databasePath !== ':memory:') {
  for (const suffix of ['', '-wal', '-shm']) rmSync(config.databasePath + suffix, { force: true });
}
rmSync(config.uploadDir, { recursive: true, force: true });

const db = openSqlite(config.databasePath);
await migrate(db);
await seed(db);
db.close();
console.log(`Database reset at ${config.databasePath}. Demo password: kirimin123`);
