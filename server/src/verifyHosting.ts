/**
 * `npm run verify:hosting` — checks the real Turso and Cloudinary accounts from
 * your .env (or environment) before deploying. Safe to run more than once:
 * it applies pending migrations, round-trips a rolled-back transaction, and
 * uploads one 1×1 test image. See docs/HOSTING.md.
 */
import { config } from './config.ts';
import { migrate } from './db/database.ts';
import { openLibsql } from './db/libsql.ts';
import { cloudinaryFileStore } from './storage/files.ts';

let failed = false;
const step = async (name: string, fn: () => Promise<string>) => {
  try {
    console.log(`✔ ${name}: ${await fn()}`);
  } catch (e) {
    failed = true;
    console.error(`✘ ${name}: ${(e as Error).message}`);
  }
};

if (!config.databaseUrl) console.log('– DATABASE_URL not set: skipping Turso');
else {
  const db = openLibsql(config.databaseUrl, config.databaseAuthToken);
  await step('Turso connection', async () => `SQLite ${(await db.get<{ v: string }>('SELECT sqlite_version() AS v'))!.v}`);
  await step('Turso migrations', async () => {
    const ran = await migrate(db);
    return ran.length ? `applied ${ran.join(', ')}` : 'already up to date';
  });
  await step('Turso transaction rollback', async () => {
    const marker = `verify-${Date.now()}`;
    await db
      .transaction(async (tx) => {
        await tx.run('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)', [marker, new Date().toISOString()]);
        if (!(await tx.get('SELECT 1 FROM _migrations WHERE name = ?', [marker]))) throw new Error('write not visible inside transaction');
        throw new Error('rollback');
      })
      .catch((e: Error) => {
        if (e.message !== 'rollback') throw e;
      });
    if (await db.get('SELECT 1 FROM _migrations WHERE name = ?', [marker])) throw new Error('rolled-back row is still there');
    return 'ok';
  });
  await step('Turso tables', async () => {
    const n = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM users');
    return `${n!.n} user(s)`;
  });
  db.close();
}

if (!config.cloudinaryUrl) console.log('– CLOUDINARY_URL not set: skipping Cloudinary');
else {
  // A 1×1 transparent PNG.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  const originalError = console.error;
  await step('Cloudinary signed upload', async () => {
    let detail = '';
    console.error = (msg: string) => (detail = msg);
    try {
      const url = await cloudinaryFileStore(config.cloudinaryUrl!, { folder: config.cloudinaryFolder }).save(png, 'image/png');
      const res = await fetch(url, { method: 'HEAD' });
      return `${url} (HEAD → ${res.status})`;
    } catch (e) {
      throw new Error(detail || (e as Error).message);
    } finally {
      console.error = originalError;
    }
  });
}

process.exit(failed ? 1 : 0);
