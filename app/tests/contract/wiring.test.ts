/**
 * Static wiring checks: does every API call, screen link and realtime event the
 * UI relies on actually exist? These catch "the screen is built but nothing
 * happens when you tap it" bugs without needing an emulator.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { startTestServer } from '../../../server/test/helpers.ts';
import { APP_DIR, REPO_DIR, apiCalls, navigations, routeFiles, toRoutePattern } from './scan.ts';

let srv: Awaited<ReturnType<typeof startTestServer>>;
before(async () => {
  srv = await startTestServer();
});
after(() => srv.close());

test('the scanner finds the app’s API calls (sanity check)', () => {
  const calls = apiCalls();
  assert.ok(calls.length >= 20, `only found ${calls.length} API calls — did the scanner break?`);
  assert.ok(calls.some((c) => c.method === 'POST' && c.path === '/orders'));
});

test('every API call made by the UI hits a real server route', async () => {
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const call of apiCalls()) {
    const key = `${call.method} ${call.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // No token and an empty body: the router still has to *match* the route
    // (→ 400/401/403/404-for-a-record), but nothing gets written.
    const url = call.path.replaceAll(':param', '00000000-0000-0000-0000-000000000000');
    const res = await fetch(srv.base + url, {
      method: call.method,
      headers: call.method === 'GET' ? {} : { 'Content-Type': 'application/json' },
      body: call.method === 'GET' ? undefined : '{}',
      signal: AbortSignal.timeout(3000),
    });
    const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    const noRoute = res.status === 405 || (res.status === 404 && /Endpoint/.test(body?.error?.message ?? ''));
    if (noRoute) missing.push(`${key}  (used at ${call.where}) → ${res.status}`);
  }
  assert.deepEqual(missing, [], `The UI calls endpoints the server doesn't have:\n${missing.join('\n')}`);
});

test('every screen the UI navigates to exists as a route file', () => {
  const routes = routeFiles();
  assert.ok(navigations().length >= 20, 'scanner found too few navigations — did it break?');
  const broken = navigations()
    .filter((n) => !n.pathname.includes('${')) // dynamic strings can't be checked statically
    .filter((n) => !routes.has(toRoutePattern(n.pathname)))
    .map((n) => `${n.pathname}  (at ${n.where})`);
  assert.deepEqual(broken, [], `Links to screens that don't exist:\n${broken.join('\n')}\nKnown routes: ${[...routes].join(', ')}`);
});

test('the app listens for every realtime event the server sends', () => {
  // Event names come from the RealtimeEvent union in shared/src/api.ts.
  const apiTypes = readFileSync(path.join(REPO_DIR, 'shared/src/api.ts'), 'utf8');
  const union = apiTypes.slice(apiTypes.indexOf('export type RealtimeEvent'));
  const events = [...union.matchAll(/type:\s*'([a-z]+\.[a-z_]+)'/g)].map((m) => m[1]);
  assert.ok(events.includes('order.updated'), 'could not read RealtimeEvent from shared/src/api.ts');

  // The server sends *named* SSE events (`event: order.updated`). EventSource only
  // delivers those to listeners registered under that exact name — a generic
  // 'message' listener never sees them.
  const sse = readFileSync(path.join(APP_DIR, 'src/api/sse.ts'), 'utf8');
  const missing = events.filter((e) => !new RegExp(`addEventListener\\(\\s*['"\`]${e.replace('.', '\\.')}['"\`]`).test(sse));
  assert.deepEqual(missing, [], `src/api/sse.ts never subscribes to: ${missing.join(', ')}`);
});

test('the server really sends realtime updates as named SSE events', async () => {
  const wayan = await srv.login('081200000001');
  const made = await srv.login('081200000003');
  const [trip] = await srv.ok<{ id: string }[]>(srv.call('GET', '/trips/mine', made));
  const order = await srv.ok<{ id: string }>(
    srv.call('POST', '/orders', wayan, {
      category: 'Dokumen', size: 'XS',
      pickup: { label: 'Renon', lat: -8.6726, lng: 115.2335 },
      dropoff: { label: 'Kampus Bukit', lat: -8.7983, lng: 115.1716 },
      recipient: { name: 'Dewa', phone: '081299990001' }, tripId: trip.id,
    }),
    201,
  );

  const ctrl = new AbortController();
  const res = await fetch(`${srv.base}/events?token=${wayan}`, { signal: ctrl.signal });
  const reader = res.body!.getReader();
  await srv.ok(srv.call('POST', `/orders/${order.id}/accept`, made, {}));

  let text = '';
  const deadline = Date.now() + 3000;
  while (!text.includes('"accepted"') && Date.now() < deadline) {
    const { value, done } = await reader.read();
    if (done) break;
    text += new TextDecoder().decode(value);
  }
  ctrl.abort();
  assert.match(text, /^event: order\.updated$/m, 'expected a named "order.updated" event');
});
