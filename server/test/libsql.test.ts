/**
 * The Turso/libSQL adapter, against a local fake libSQL server (test/fakeHrana.ts)
 * that speaks the same Hrana-over-HTTP protocol as Turso. To check against a real
 * Turso database, see "Verifying against real accounts" in docs/HOSTING.md.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { migrate, type Db } from '../src/db/database.ts';
import { libsqlHttpUrl, openLibsql } from '../src/db/libsql.ts';
import { seed } from '../src/db/seed.ts';
import { startFakeHrana } from './fakeHrana.ts';

let hrana: Awaited<ReturnType<typeof startFakeHrana>>;
let db: Db;

before(async () => {
  hrana = await startFakeHrana({ authToken: 'secret-token' });
  db = openLibsql(hrana.url, 'secret-token');
});
after(async () => {
  db.close();
  await hrana.close();
});

test('URL conversion', () => {
  assert.equal(libsqlHttpUrl('libsql://kirimin-me.turso.io'), 'https://kirimin-me.turso.io');
  assert.equal(libsqlHttpUrl('libsql://kirimin-me.turso.io/?authToken=x'), 'https://kirimin-me.turso.io');
  assert.equal(libsqlHttpUrl('http://127.0.0.1:8080'), 'http://127.0.0.1:8080');
  assert.throws(() => libsqlHttpUrl('postgres://x'));
});

test('all migrations (ALTER TABLE ADD COLUMN, partial unique index) and the seed run unchanged', async () => {
  const ran = await migrate(db);
  assert.ok(ran.includes('001_init.sql') && ran.includes('002_mvp_features.sql'), ran.join());
  assert.deepEqual(await migrate(db), [], 'second run applies nothing');
  const cols = await db.all<{ name: string }>('SELECT name FROM pragma_table_info(?)', ['users']);
  assert.ok(cols.some((c) => c.name === 'token_version'));
  await seed(db);
  const users = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM users');
  assert.ok(users!.n > 0);
  assert.ok([...hrana.stats.authHeaders].every((h) => h === 'Bearer secret-token'));
});

test('partial unique index on wallet_entries is enforced', async () => {
  const user = (await db.get<{ id: string }>('SELECT id FROM users LIMIT 1'))!.id;
  const order = await db.get<{ id: string }>('SELECT id FROM orders LIMIT 1');
  const insert = (id: string, orderId: string | null) =>
    db.run(
      `INSERT INTO wallet_entries (id, user_id, order_id, type, amount, created_at) VALUES (?, ?, ?, 'withdrawal', -1, '2026-01-01')`,
      [id, user, orderId],
    );
  await insert('w-null-1', null);
  await insert('w-null-2', null); // NULL order_id is outside the index
  if (order) {
    await insert('w-o-1', order.id);
    await assert.rejects(insert('w-o-2', order.id), /UNIQUE/);
  }
  await db.run(`DELETE FROM wallet_entries WHERE id LIKE 'w-%'`);
});

test('values round-trip with the same JS types as node:sqlite', async () => {
  await db.run('CREATE TABLE t_types (i INTEGER, f REAL, s TEXT, b BLOB, n TEXT, flag INTEGER, big INTEGER)');
  const r = await db.run('INSERT INTO t_types VALUES (?, ?, ?, ?, ?, ?, ?)', [42, 1.5, 'héllo', new Uint8Array([1, 2, 3]), undefined, true, 2n ** 40n]);
  assert.equal(r.changes, 1);
  const row = await db.get<Record<string, unknown>>('SELECT * FROM t_types');
  assert.deepEqual(row, { i: 42, f: 1.5, s: 'héllo', b: new Uint8Array([1, 2, 3]), n: null, flag: 1, big: 2 ** 40 });
  assert.equal(await db.get('SELECT * FROM t_types WHERE i = ?', [0]), undefined);
  assert.equal((await db.get<{ x: number }>('SELECT ? + 1 AS x', [2]))!.x, 3);
});

test('SQL errors reject', async () => {
  await assert.rejects(db.all('SELEC nonsense'), /syntax error/);
});

test('transactions commit, roll back, and see their own writes via tx and db', async () => {
  await db.run('CREATE TABLE t_tx (k TEXT PRIMARY KEY, v INTEGER)');
  await db.transaction(async (tx) => {
    await tx.run('INSERT INTO t_tx VALUES (?, ?)', ['a', 1]);
    // Repositories sometimes use the outer db inside a transaction: it must join, not deadlock.
    assert.equal((await db.get<{ v: number }>('SELECT v FROM t_tx WHERE k = ?', ['a']))?.v, 1);
    await db.run('UPDATE t_tx SET v = 2 WHERE k = ?', ['a']);
    await db.transaction((inner) => inner.run('INSERT INTO t_tx VALUES (?, ?)', ['nested', 1]));
  });
  assert.deepEqual(await db.all('SELECT * FROM t_tx ORDER BY k'), [{ k: 'a', v: 2 }, { k: 'nested', v: 1 }]);

  await assert.rejects(
    db.transaction(async (tx) => {
      await tx.run('INSERT INTO t_tx VALUES (?, ?)', ['b', 1]);
      throw new Error('boom');
    }),
    /boom/,
  );
  assert.equal(await db.get('SELECT * FROM t_tx WHERE k = ?', ['b']), undefined);
  assert.equal(hrana.openStreams(), 0, 'every stream is closed afterwards');
});

test('concurrent transactions and writes are serialised (no lost updates, no lock errors)', async () => {
  await db.run(`INSERT INTO t_tx VALUES ('counter', 0)`);
  const bump = () =>
    db.transaction(async (tx) => {
      const { v } = (await tx.get<{ v: number }>(`SELECT v FROM t_tx WHERE k = 'counter'`))!;
      await tx.run(`UPDATE t_tx SET v = ? WHERE k = 'counter'`, [v + 1]);
    });
  await Promise.all([bump(), bump(), db.run(`UPDATE t_tx SET v = v + 10 WHERE k = 'counter'`), bump(), db.all('SELECT * FROM t_tx')]);
  assert.equal((await db.get<{ v: number }>(`SELECT v FROM t_tx WHERE k = 'counter'`))!.v, 13);
  assert.equal(hrana.openStreams(), 0);
});

test('a wrong auth token is reported clearly', async () => {
  const bad = openLibsql(hrana.url, 'wrong');
  await assert.rejects(bad.all('SELECT 1'), /401/);
});
