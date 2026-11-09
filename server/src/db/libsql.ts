import { AsyncLocalStorage } from 'node:async_hooks';
import type { Db, SqlParam } from './database.ts';

/**
 * Turso / libSQL adapter for the `Db` interface, using the Hrana-over-HTTP
 * pipeline API (`POST /v2/pipeline`) with plain `fetch` — no npm packages.
 *
 * Semantics mirror the single-connection SQLite adapter:
 * - Reads outside a transaction each run on a fresh one-shot stream.
 * - Writes outside a transaction and whole transactions are serialised through
 *   one in-process queue, so this server never fights itself for Turso's write lock.
 * - A transaction keeps one stream open (the "baton" carries it between HTTP
 *   requests). While its callback runs, every call made from that async context —
 *   through `tx` *or* the outer `db` (some repositories use `db` directly) — goes
 *   to the transaction's stream, exactly like it would on the single SQLite
 *   connection. Nested `transaction()` calls join the outer one.
 *
 * Docs: https://github.com/tursodatabase/libsql/blob/main/docs/HRANA_3_SPEC.md (HTTP section)
 */

type HranaValue =
  | { type: 'null' }
  | { type: 'integer'; value: string }
  | { type: 'float'; value: number }
  | { type: 'text'; value: string }
  | { type: 'blob'; base64: string };

interface ExecuteResult {
  cols: { name: string | null }[];
  rows: HranaValue[][];
  affected_row_count: number;
}

type StreamResult =
  | { type: 'ok'; response: { type: string; result?: ExecuteResult } }
  | { type: 'error'; error: { message: string; code?: string } };

interface PipelineResponse {
  baton: string | null;
  base_url: string | null;
  results: StreamResult[];
}

type Request = { type: 'execute'; stmt: { sql: string; args: HranaValue[] } } | { type: 'close' };

export class LibsqlError extends Error {
  readonly code: string | undefined;
  constructor(message: string, code?: string) {
    super(code ? `${code}: ${message}` : message);
    this.name = 'LibsqlError';
    this.code = code;
  }
}

function encode(p: SqlParam): HranaValue {
  if (p === null || p === undefined) return { type: 'null' };
  if (typeof p === 'boolean') return { type: 'integer', value: p ? '1' : '0' };
  if (typeof p === 'bigint') return { type: 'integer', value: p.toString() };
  if (typeof p === 'number') {
    // Whole numbers go as INTEGER so `?`-only expressions behave like node:sqlite.
    return Number.isSafeInteger(p) ? { type: 'integer', value: String(p) } : { type: 'float', value: p };
  }
  if (typeof p === 'string') return { type: 'text', value: p };
  return { type: 'blob', base64: Buffer.from(p).toString('base64') };
}

function decode(v: HranaValue): unknown {
  switch (v.type) {
    case 'null':
      return null;
    case 'integer': {
      const n = Number(v.value);
      if (!Number.isSafeInteger(n)) throw new LibsqlError(`Integer ${v.value} is outside the safe JavaScript range`);
      return n;
    }
    case 'float':
      return v.value;
    case 'text':
      return v.value;
    case 'blob':
      return new Uint8Array(Buffer.from(v.base64, 'base64'));
  }
}

function toRows<T>(r: ExecuteResult): T[] {
  return r.rows.map((row) => {
    const obj: Record<string, unknown> = {};
    r.cols.forEach((c, i) => (obj[c.name ?? `column${i}`] = decode(row[i])));
    return obj as T;
  });
}

/** `libsql://db-org.turso.io` → `https://db-org.turso.io`. http(s):// URLs (e.g. `turso dev`) pass through. */
export function libsqlHttpUrl(url: string): string {
  // (URL objects can't switch a non-special scheme like libsql: to https:, so swap the prefix as text.)
  const m = /^(libsql|wss|ws|https|http):\/\//i.exec(url.trim());
  if (!m) throw new Error(`Unsupported DATABASE_URL scheme in "${url.split(':')[0]}:"; expected libsql://`);
  const scheme = { libsql: 'https', wss: 'https', https: 'https', ws: 'http', http: 'http' }[m[1].toLowerCase()]!;
  const u = new URL(`${scheme}://${url.trim().slice(m[0].length)}`);
  // A token may also be passed as ?authToken=… (Turso CLI style); openLibsql reads it.
  return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '')}`;
}

/** One Hrana stream (= one server-side connection). Requests on it are strictly sequential. */
class Stream {
  private baton: string | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private closed = false;
  /** Set once the owning transaction has committed or rolled back. */
  finished = false;
  private baseUrl: string;
  private readonly authToken: string | null;
  constructor(baseUrl: string, authToken: string | null) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
  }

  /** Sends requests on this stream; `close` ends the stream after them. */
  send(requests: Request[], close = false): Promise<StreamResult[]> {
    const next = this.queue.then(() => this.post(close ? [...requests, { type: 'close' }] : requests));
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async post(requests: Request[]): Promise<StreamResult[]> {
    if (this.closed) throw new LibsqlError('Stream already closed');
    const res = await fetch(`${this.baseUrl}/v2/pipeline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
      },
      body: JSON.stringify({ baton: this.baton, requests }),
    });
    if (!res.ok) {
      this.closed = true;
      const text = await res.text().catch(() => '');
      throw new LibsqlError(`HTTP ${res.status} from libSQL server: ${text.slice(0, 500)}`, res.status === 401 ? 'UNAUTHORIZED' : undefined);
    }
    const body = (await res.json()) as PipelineResponse;
    this.baton = body.baton;
    if (body.base_url) this.baseUrl = body.base_url.replace(/\/+$/, '');
    if (requests.some((r) => r.type === 'close') || body.baton === null) this.closed = true;
    return body.results;
  }
}

function resultOf(r: StreamResult | undefined): ExecuteResult {
  if (!r) throw new LibsqlError('Missing result in libSQL pipeline response');
  if (r.type === 'error') throw new LibsqlError(r.error.message, r.error.code);
  if (!r.response.result) throw new LibsqlError(`Unexpected libSQL response type: ${r.response.type}`);
  return r.response.result;
}

const stmt = (sql: string, params: SqlParam[] = []): Request => ({ type: 'execute', stmt: { sql, args: params.map(encode) } });

/** Foreign keys are a per-connection setting in SQLite, so every stream turns them on first. */
const FOREIGN_KEYS_ON = stmt('PRAGMA foreign_keys = ON');

export function openLibsql(url: string, authToken?: string | null): Db {
  const token = authToken || new URL(url).searchParams.get('authToken') || null;
  const baseUrl = libsqlHttpUrl(url);
  const txStream = new AsyncLocalStorage<Stream>();
  let writeQueue: Promise<unknown> = Promise.resolve();
  let closed = false;

  /** Runs `job` after every earlier write/transaction has finished. */
  function serialised<T>(job: () => Promise<T>): Promise<T> {
    const next = writeQueue.then(job);
    writeQueue = next.catch(() => undefined);
    return next;
  }

  async function execute(sql: string, params: SqlParam[] | undefined, isWrite: boolean): Promise<ExecuteResult> {
    if (closed) throw new LibsqlError('Database is closed');
    const tx = txStream.getStore();
    // A callback left running after its transaction ended falls back to normal execution.
    if (tx && !tx.finished) return resultOf((await tx.send([stmt(sql, params)]))[0]);
    const once = async () => {
      const results = await new Stream(baseUrl, token).send([FOREIGN_KEYS_ON, stmt(sql, params)], true);
      resultOf(results[0]);
      return resultOf(results[1]);
    };
    return isWrite ? serialised(once) : once();
  }

  const db: Db = {
    async all<T>(sql: string, params?: SqlParam[]) {
      return toRows<T>(await execute(sql, params, false));
    },
    async get<T>(sql: string, params?: SqlParam[]) {
      return toRows<T>(await execute(sql, params, false))[0];
    },
    async run(sql: string, params?: SqlParam[]) {
      return { changes: (await execute(sql, params, true)).affected_row_count };
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      if (txStream.getStore()) return fn(db);
      if (closed) throw new LibsqlError('Database is closed');
      return serialised(async () => {
        const stream = new Stream(baseUrl, token);
        const begin = await stream.send([FOREIGN_KEYS_ON, stmt('BEGIN IMMEDIATE')]);
        try {
          resultOf(begin[0]);
          resultOf(begin[1]);
        } catch (e) {
          await stream.send([], true).catch(() => undefined);
          throw e;
        }
        let result: T;
        try {
          result = await txStream.run(stream, () => fn(db));
        } catch (e) {
          stream.finished = true;
          await stream.send([stmt('ROLLBACK')], true).catch(() => undefined);
          throw e;
        }
        stream.finished = true;
        const [commit] = await stream.send([stmt('COMMIT')], true);
        resultOf(commit);
        return result;
      });
    },
    close() {
      closed = true;
    },
  };
  return db;
}
