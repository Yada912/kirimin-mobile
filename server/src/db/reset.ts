/**
 * `npm run db:reset` — wipes the database and fills it with fresh demo data.
 *
 *   npm run db:reset          local SQLite file (server/data/kirimin.db) + local photos
 *   npm run db:reset:turso    the Turso database in DATABASE_URL (server/.env)
 *
 * The Turso variant asks you to type the database host first, because it deletes
 * everything in that database.
 */
import { rmSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { config } from '../config.ts';
import { migrate, openSqlite } from './database.ts';
import { openLibsql } from './libsql.ts';
import { seed } from './seed.ts';
import { dropAllTables } from './wipe.ts';

if (config.isProd) {
  console.error('Refusing to reset the database with NODE_ENV=production.');
  process.exit(1);
}

const wantTurso = process.argv.includes('--turso');

if (wantTurso) {
  const url = config.databaseUrl;
  if (!url || !/^(libsql|https?):\/\//i.test(url)) {
    console.error('DATABASE_URL is not set to a libsql:// address. Put it and DATABASE_AUTH_TOKEN in server/.env first.');
    process.exit(1);
  }
  const host = new URL(url).host;
  if (!process.argv.includes('--yes')) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(`This deletes ALL data in Turso database ${host}.\nType the host to continue: `);
    rl.close();
    if (answer.trim() !== host) {
      console.error('Host did not match. Nothing was changed.');
      process.exit(1);
    }
  }
  const db = openLibsql(url, config.databaseAuthToken);
  const dropped = await dropAllTables(db);
  const ran = await migrate(db);
  await seed(db, { demoExtras: true });
  const counts = await Promise.all(
    ['users', 'trips', 'orders', 'messages', 'notifications'].map(async (t) => {
      const r = await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`).catch(() => undefined);
      return `${t}: ${r?.n ?? '-'}`;
    }),
  );
  db.close();
  console.log(`Turso ${host}: dropped ${dropped.length} tables, applied ${ran.length} migrations, seeded demo data.`);
  console.log(`  ${counts.join(' | ')}`);
  console.log('Demo password for every account: kirimin123');
} else {
  if (config.databasePath !== ':memory:') {
    for (const suffix of ['', '-wal', '-shm']) rmSync(config.databasePath + suffix, { force: true });
  }
  rmSync(config.uploadDir, { recursive: true, force: true });

  const db = openSqlite(config.databasePath);
  await migrate(db);
  await seed(db, { demoExtras: true });
  db.close();
  console.log(`Database reset at ${config.databasePath}. Demo password: kirimin123`);
  if (config.databaseUrl) {
    console.log('Note: DATABASE_URL is set, so the server uses Turso, not this file. Use `npm run db:reset:turso` to reset Turso.');
  }
}
