import type { IncomingMessage, ServerResponse } from 'node:http';
import { HttpError, badRequest, unauthorized } from './errors.ts';

/**
 * Minimal router on top of node:http.
 *
 *   router.get('/orders/:id', async (ctx) => service.get(ctx.userId(), ctx.params.id));
 *
 * A handler returns the JSON body (status 200, or `ctx.status` if set).
 * Return `undefined` after writing to `ctx.res` yourself (streams, files).
 */
export interface Context {
  req: IncomingMessage;
  res: ServerResponse;
  method: string;
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
  /** Parsed JSON body (`{}` when empty). Read lazily via `await ctx.json()`. */
  json(): Promise<unknown>;
  /** Raw body bytes, for uploads. */
  raw(limitBytes: number): Promise<Buffer>;
  /** User id from the bearer token, or throws 401. */
  userId(): string;
  /** User id if a valid token was sent, else null. */
  optionalUserId: string | null;
  status: number;
}

export type Handler = (ctx: Context) => unknown | Promise<unknown>;

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

export class Router {
  private routes: Route[] = [];

  private add(method: string, path: string, handler: Handler) {
    const keys: string[] = [];
    const pattern = new RegExp(
      '^' +
        path.replace(/\/:([A-Za-z_]+)/g, (_m, key: string) => {
          keys.push(key);
          return '/([^/]+)';
        }) +
        '/?$',
    );
    this.routes.push({ method, pattern, keys, handler });
  }

  get(path: string, h: Handler) {
    this.add('GET', path, h);
  }
  post(path: string, h: Handler) {
    this.add('POST', path, h);
  }
  patch(path: string, h: Handler) {
    this.add('PATCH', path, h);
  }
  delete(path: string, h: Handler) {
    this.add('DELETE', path, h);
  }

  /** Mount another router's routes under a prefix. */
  use(prefix: string, other: Router) {
    for (const r of other.routes) {
      const src = r.pattern.source.slice(1); // drop leading ^
      this.routes.push({ ...r, pattern: new RegExp('^' + prefix.replace(/\/$/, '') + src) });
    }
  }

  match(method: string, path: string): { handler: Handler; params: Record<string, string> } | 'method_not_allowed' | null {
    let pathMatched = false;
    for (const r of this.routes) {
      const m = r.pattern.exec(path);
      if (!m) continue;
      pathMatched = true;
      if (r.method !== method) continue;
      const params: Record<string, string> = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return { handler: r.handler, params };
    }
    return pathMatched ? 'method_not_allowed' : null;
  }
}

// ─── Body helpers ───────────────────────────────────────────────────────────

export function readBody(req: IncomingMessage, limitBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new HttpError(413, 'payload_too_large', `Ukuran maksimal ${Math.round(limitBytes / 1024)} KB`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const JSON_LIMIT = 1024 * 1024;

export function createContext(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  params: Record<string, string>,
  userId: string | null,
): Context {
  let jsonCache: Promise<unknown> | null = null;
  return {
    req,
    res,
    method: req.method ?? 'GET',
    path: url.pathname,
    params,
    query: url.searchParams,
    optionalUserId: userId,
    status: 200,
    json() {
      jsonCache ??= readBody(req, JSON_LIMIT).then((buf) => {
        if (buf.length === 0) return {};
        try {
          return JSON.parse(buf.toString('utf8'));
        } catch {
          throw badRequest('Body harus JSON yang valid');
        }
      });
      return jsonCache;
    },
    raw(limit) {
      return readBody(req, limit);
    },
    userId() {
      if (!userId) throw unauthorized();
      return userId;
    },
  };
}

export function sendJson(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}
