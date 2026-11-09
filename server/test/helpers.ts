import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AuthResponse } from '../../shared/src/index.ts';
import { createApp } from '../src/app.ts';
import { migrate, openSqlite } from '../src/db/database.ts';
import { DEMO_PASSWORD, seed } from '../src/db/seed.ts';
import { createHub } from '../src/realtime/hub.ts';
import { localFileStore } from '../src/storage/files.ts';
import { recordingPushSender } from '../src/push/expo.ts';

/** A real HTTP server on a random port with an in-memory, freshly seeded database. */
export async function startTestServer() {
  const db = openSqlite(':memory:');
  await migrate(db);
  await seed(db);
  const hub = createHub();
  const push = recordingPushSender();
  const uploadDir = mkdtempSync(path.join(tmpdir(), 'kirimin-uploads-'));
  const app = createApp({ db, hub, files: localFileStore(uploadDir), push });
  const server = createServer((req, res) => void app.handle(req, res));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;

  async function call<T = unknown>(method: string, url: string, token?: string, body?: unknown) {
    const res = await fetch(base + url, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
  }

  async function ok<T>(p: Promise<{ status: number; body: unknown }>, expected = 200): Promise<T> {
    const r = await p;
    assert.equal(r.status, expected, JSON.stringify(r.body));
    return r.body as T;
  }

  const login = async (phone: string, password = DEMO_PASSWORD) =>
    (await ok<AuthResponse>(call('POST', '/auth/login', undefined, { phone, password }))).token;

  async function close() {
    hub.closeAll();
    await new Promise((resolve) => server.close(resolve));
    db.close();
    rmSync(uploadDir, { recursive: true, force: true });
  }

  return { db, hub, push, app, base, call, ok, login, close };
}

export const tick = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));
