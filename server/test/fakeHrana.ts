/**
 * A tiny stand-in for a Turso/libSQL server: speaks the Hrana-over-HTTP
 * `POST /v2/pipeline` protocol on top of node:sqlite, one SQLite connection per
 * stream (baton), all on one database file — just like the real thing.
 * Only for tests of src/db/libsql.ts; it is not a complete implementation.
 */
import { createServer, type IncomingMessage } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

type Value =
  | { type: 'null' }
  | { type: 'integer'; value: string }
  | { type: 'float'; value: number }
  | { type: 'text'; value: string }
  | { type: 'blob'; base64: string };

function fromHrana(v: Value) {
  switch (v.type) {
    case 'null':
      return null;
    case 'integer':
      return BigInt(v.value);
    case 'float':
      return v.value;
    case 'text':
      return v.value;
    case 'blob':
      return new Uint8Array(Buffer.from(v.base64, 'base64'));
  }
}

function toHrana(v: unknown): Value {
  if (v === null || v === undefined) return { type: 'null' };
  if (typeof v === 'bigint') return { type: 'integer', value: v.toString() };
  if (typeof v === 'number') return { type: 'float', value: v };
  if (typeof v === 'string') return { type: 'text', value: v };
  return { type: 'blob', base64: Buffer.from(v as Uint8Array).toString('base64') };
}

async function readJson(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export async function startFakeHrana(opts: { authToken?: string } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'kirimin-hrana-'));
  const file = path.join(dir, 'db.sqlite');
  const init = new DatabaseSync(file);
  init.exec('PRAGMA journal_mode = WAL');
  init.close();
  const streams = new Map<string, DatabaseSync>();
  const stats = { pipelines: 0, maxOpenStreams: 0, authHeaders: new Set<string>() };

  const server = createServer(async (req, res) => {
    stats.authHeaders.add(req.headers.authorization ?? '');
    if (opts.authToken && req.headers.authorization !== `Bearer ${opts.authToken}`) {
      res.writeHead(401).end('Unauthorized');
      return;
    }
    if (req.method !== 'POST' || req.url !== '/v2/pipeline') {
      res.writeHead(404).end();
      return;
    }
    stats.pipelines++;
    const body = (await readJson(req)) as { baton: string | null; requests: { type: string; stmt?: { sql: string; args?: Value[] } }[] };
    let conn: DatabaseSync | undefined;
    if (body.baton) {
      conn = streams.get(body.baton);
      if (!conn) {
        res.writeHead(400).end('Unknown baton');
        return;
      }
      streams.delete(body.baton);
    } else {
      conn = new DatabaseSync(file);
      // Fail fast instead of blocking the (synchronous) test process on a lock.
      conn.exec('PRAGMA busy_timeout = 0');
    }
    const results: unknown[] = [];
    let closed = false;
    for (const r of body.requests) {
      if (r.type === 'close') {
        conn.close();
        closed = true;
        results.push({ type: 'ok', response: { type: 'close' } });
        continue;
      }
      try {
        const stmt = conn.prepare(r.stmt!.sql);
        stmt.setReadBigInts(true);
        const args = (r.stmt!.args ?? []).map(fromHrana);
        const cols = stmt.columns();
        let rows: unknown[][] = [];
        let changes = 0;
        if (cols.length) {
          rows = (stmt.all(...args) as Record<string, unknown>[]).map((o) => cols.map((c) => o[c.name]));
        } else {
          changes = Number(stmt.run(...args).changes);
        }
        results.push({
          type: 'ok',
          response: {
            type: 'execute',
            result: { cols: cols.map((c) => ({ name: c.name, decltype: null })), rows: rows.map((row) => row.map(toHrana)), affected_row_count: changes, last_insert_rowid: null },
          },
        });
      } catch (e) {
        results.push({ type: 'error', error: { message: (e as Error).message, code: 'SQLITE_ERROR' } });
      }
    }
    let baton: string | null = null;
    if (!closed) {
      baton = randomUUID();
      streams.set(baton, conn);
      stats.maxOpenStreams = Math.max(stats.maxOpenStreams, streams.size);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ baton, base_url: null, results }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const url = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;

  async function close() {
    const closing = new Promise((resolve) => server.close(resolve));
    server.closeAllConnections();
    await closing;
    for (const c of streams.values()) c.close();
    rmSync(dir, { recursive: true, force: true });
  }
  return { url, file, stats, openStreams: () => streams.size, close };
}
