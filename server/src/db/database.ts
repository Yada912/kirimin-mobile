import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The only database API the rest of the server uses.
 *
 * It is deliberately async even though node:sqlite is synchronous, so that a
 * hosted database (Turso/libSQL, or Postgres) can implement the same interface
 * later without touching any repository or service code. See docs/HOSTING.md.
 *
 * SQL uses `?` placeholders and SQLite syntax (which Turso speaks natively).
 */
export type SqlValue = string | number | bigint | null | Uint8Array;
export type SqlParam = SqlValue | boolean | undefined;

export interface Db {
  all<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T[]>;
  get<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T | undefined>;
  run(sql: string, params?: SqlParam[]): Promise<{ changes: number }>;
  /**
   * Runs `fn` atomically. Only await database calls inside it (no network/file I/O),
   * so other requests can't interleave on the single SQLite connection.
   */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  close(): void;
}

const normalise = (params: SqlParam[] = []): SqlValue[] =>
  params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p));

export function openSqlite(file: string): Db {
  if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new DatabaseSync(file);
  sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

  let depth = 0;
  const db: Db = {
    async all<T>(sql: string, params?: SqlParam[]) {
      return sqlite.prepare(sql).all(...normalise(params)) as T[];
    },
    async get<T>(sql: string, params?: SqlParam[]) {
      return sqlite.prepare(sql).get(...normalise(params)) as T | undefined;
    },
    async run(sql: string, params?: SqlParam[]) {
      const r = sqlite.prepare(sql).run(...normalise(params));
      return { changes: Number(r.changes) };
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      // Nested calls simply join the outer transaction.
      if (depth > 0) return fn(db);
      depth++;
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const result = await fn(db);
        sqlite.exec('COMMIT');
        return result;
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      } finally {
        depth--;
      }
    },
    close() {
      sqlite.close();
    },
  };
  return db;
}

/**
 * Applies every `migrations/NNN_name.sql` file that hasn't run yet, in order.
 * To change the schema, add a new numbered file — never edit an applied one.
 */
export async function migrate(db: Db): Promise<string[]> {
  await db.run('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const dir = path.join(import.meta.dirname, 'migrations');
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const applied = new Set((await db.all<{ name: string }>('SELECT name FROM _migrations')).map((r) => r.name));
  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(path.join(dir, file), 'utf8');
    await db.transaction(async (tx) => {
      // Split on semicolons at line ends; keep migrations to plain DDL statements.
      for (const stmt of sql.split(/;\s*$/m).map((s) => s.trim()).filter(Boolean)) await tx.run(stmt);
      await tx.run('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)', [file, new Date().toISOString()]);
    });
    ran.push(file);
  }
  return ran;
}
