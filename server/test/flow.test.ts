/**
 * End-to-end test of the MVP: a sender and a driver go through the whole
 * Figma flow (S1→S5, D1→D5, X1→X3) against a real HTTP server with an
 * in-memory database.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AuthResponse, IncomingRequest, Order, Trip, TripMatch } from '../../shared/src/index.ts';
import { createApp } from '../src/app.ts';
import { migrate, openSqlite, type Db } from '../src/db/database.ts';
import { seed, PLACES, DEMO_PASSWORD } from '../src/db/seed.ts';
import { createHub, type Hub } from '../src/realtime/hub.ts';
import { localFileStore } from '../src/storage/files.ts';

let server: Server;
let base: string;
let db: Db;
let hub: Hub;
const uploadDir = mkdtempSync(path.join(tmpdir(), 'kirimin-uploads-'));

before(async () => {
  db = openSqlite(':memory:');
  await migrate(db);
  await seed(db);
  hub = createHub();
  const app = createApp({ db, hub, files: localFileStore(uploadDir) });
  server = createServer((req, res) => void app.handle(req, res));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});

after(() => {
  hub.closeAll();
  server.close();
  db.close();
  rmSync(uploadDir, { recursive: true, force: true });
});

async function call<T = unknown>(method: string, url: string, token?: string, body?: unknown, raw?: { bytes: Buffer; type: string }) {
  const res = await fetch(base + url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(raw ? { 'Content-Type': raw.type } : body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: raw ? new Uint8Array(raw.bytes) : body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
}

const ok = async <T>(p: Promise<{ status: number; body: unknown }>, expected = 200): Promise<T> => {
  const r = await p;
  assert.equal(r.status, expected, JSON.stringify(r.body));
  return r.body as T;
};

const login = async (phone: string) => (await ok<AuthResponse>(call('POST', '/auth/login', undefined, { phone, password: DEMO_PASSWORD }))).token;

test('health, meta and auth basics', async () => {
  await ok(call('GET', '/health'));
  const meta = await ok<{ sizes: unknown[] }>(call('GET', '/api/meta'));
  assert.equal(meta.sizes.length, 4);

  assert.equal((await call('GET', '/me')).status, 401);
  assert.equal((await call('POST', '/auth/login', undefined, { phone: '081200000001', password: 'wrong' })).status, 401);

  const reg = await ok<AuthResponse>(call('POST', '/auth/register', undefined, { name: 'Tester', phone: '+62 811 0000 9999', password: 'secret1' }), 201);
  assert.equal(reg.user.phone, '081100009999');
  assert.equal((await call('POST', '/auth/register', undefined, { name: 'Dup', phone: '0811-0000-9999', password: 'secret1' })).status, 409);
  const bad = await call<{ error: { details: { field: string } } }>('POST', '/auth/register', undefined, { name: 'X', phone: '0811', password: '1' });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.details.field, 'name');
});

test('full flow: create route → search → request → accept → pickup → deliver → rate', async () => {
  const wayan = await login('081200000001');
  const made = await login('081200000003');

  // D1–D2: Made already has a seeded route; publish a second one with a manual price band.
  const departAt = new Date(Date.now() + 30 * 60_000).toISOString();
  const trip = await ok<Trip>(call('POST', '/trips', made, {
    name: 'Ke Kampus (sore)',
    origin: PLACES.renon,
    stops: [PLACES.sesetan],
    destination: PLACES.kampusBukit,
    departAt,
    acceptedSizes: ['XS', 'S'],
    maxPackages: 2,
    maxDetourKm: 2,
    priceBand: { min: 6000, max: 12000 },
  }), 201);
  assert.equal(trip.vehicle.plate, 'DK 1101 XL'); // taken from Made's profile
  assert.ok(trip.arriveAt > departAt);

  // S2: estimate.
  const est = await ok<{ range: { min: number; max: number } }>(call('POST', '/matches/estimate', wayan, {
    size: 'XS', pickup: PLACES.tukadBadung, dropoff: PLACES.gedungFT,
  }));
  assert.ok(est.range.min <= est.range.max);

  // S3: search finds Made's trips as direct matches; Putu's Nusa Dua route doesn't fit.
  const found = await ok<{ direct: TripMatch[]; detour: TripMatch[] }>(call('POST', '/matches/search', wayan, {
    size: 'XS', pickup: PLACES.tukadBadung, dropoff: PLACES.gedungFT,
  }));
  const all = [...found.direct, ...found.detour];
  const mine = all.find((m) => m.trip.id === trip.id);
  assert.ok(mine, 'new trip should match');
  assert.ok(!all.some((m) => m.trip.name === 'Ke Nusa Dua'));
  assert.ok(mine.price.fee >= 6000 && mine.price.fee <= 12000);

  // Upload a package photo (S1).
  const upload = await ok<{ url: string }>(call('POST', '/uploads', wayan, undefined, { bytes: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), type: 'image/jpeg' }), 201);
  const img = await fetch(base + upload.url);
  assert.equal(img.headers.get('content-type'), 'image/jpeg');

  // S4: create the order straight to Made's trip.
  const order = await ok<Order>(call('POST', '/orders', wayan, {
    category: 'Dokumen', size: 'XS', weightClass: 'lt1', handling: ['keep_dry'], photoUrl: upload.url,
    pickup: PLACES.tukadBadung, dropoff: PLACES.gedungFT,
    recipient: { name: 'Dewa', phone: '081299991111' },
    deliverBy: new Date(Date.now() + 4 * 3600_000).toISOString(),
    paymentMethod: 'qris', tripId: trip.id,
  }), 201);
  assert.equal(order.status, 'requested');
  assert.equal(order.driver?.name, 'Made S.');
  assert.match(order.handoverCode ?? '', /^\d{4}$/);
  assert.equal(order.price?.total, mine.price.total);

  // Driver can't see the handover code.
  const driverView = await ok<Order>(call('GET', `/orders/${order.id}`, made));
  assert.equal(driverView.handoverCode, undefined);

  // D3: request shows up first in Made's inbox, next to the seeded open request.
  const inbox = await ok<IncomingRequest[]>(call('GET', `/trips/${trip.id}/requests`, made));
  assert.equal(inbox[0].order.id, order.id);
  assert.equal(inbox[0].source, 'requested');
  assert.ok(inbox.some((r) => r.source === 'open'));

  // Wrong actor: the sender can't accept their own order.
  assert.equal((await call('POST', `/orders/${order.id}/accept`, wayan, {})).status, 400);

  // D4: accept. P: pay (mock).
  assert.equal((await ok<Order>(call('POST', `/orders/${order.id}/accept`, made, {}))).status, 'accepted');
  assert.equal((await ok<Order>(call('POST', `/orders/${order.id}/pay`, wayan, { method: 'qris' }))).payment.status, 'paid');

  // X1: chat both ways.
  await ok(call('POST', `/orders/${order.id}/messages`, wayan, { body: 'Saya tunggu di depan rumah ya' }), 201);
  await ok(call('POST', `/orders/${order.id}/messages`, made, { body: 'Siap, 10 menit lagi' }), 201);
  const msgs = await ok<{ body: string }[]>(call('GET', `/orders/${order.id}/messages`, wayan));
  assert.equal(msgs.length, 2);

  // D5: start trip, pick up (→ in transit because trip is ongoing), manifest lists stops.
  await ok(call('POST', `/trips/${trip.id}/start`, made));
  const picked = await ok<Order>(call('POST', `/orders/${order.id}/pickup`, made, {}));
  assert.equal(picked.status, 'in_transit');
  await ok(call('POST', `/trips/${trip.id}/location`, made, { lat: -8.70, lng: 115.21 }));
  const manifest = await ok<{ stops: { kind: string }[] }>(call('GET', `/trips/${trip.id}/manifest`, made));
  assert.deepEqual(manifest.stops.map((s) => s.kind), ['start', 'pickup', 'dropoff', 'end']);

  // Sender can no longer cancel after pickup.
  assert.equal((await call('POST', `/orders/${order.id}/cancel`, wayan, {})).status, 409);

  // X2: wrong code fails, right code delivers.
  const wrong = order.handoverCode === '0000' ? '1111' : '0000';
  assert.equal((await call('POST', `/orders/${order.id}/deliver`, made, { code: wrong })).status, 400);
  const delivered = await ok<Order>(call('POST', `/orders/${order.id}/deliver`, made, { code: order.handoverCode }));
  assert.equal(delivered.status, 'delivered');
  assert.deepEqual(
    delivered.timeline.map((t) => t.status),
    ['open', 'requested', 'accepted', 'picked_up', 'in_transit', 'arrived', 'delivered'],
  );

  // X3: ratings, once each.
  await ok(call('POST', `/orders/${order.id}/rating`, wayan, { stars: 5, tags: ['Tepat waktu'] }), 201);
  assert.equal((await call('POST', `/orders/${order.id}/rating`, wayan, { stars: 4 })).status, 409);
  await ok(call('POST', `/orders/${order.id}/rating`, made, { stars: 5 }), 201);

  // Trip can now be completed; history and notifications are populated.
  assert.equal((await ok<Trip>(call('POST', `/trips/${trip.id}/complete`, made))).status, 'completed');
  const history = await ok<Order[]>(call('GET', '/orders?as=sender&scope=history', wayan));
  assert.ok(history.some((o) => o.id === order.id));
  const notes = await ok<{ items: { type: string }[]; unreadCount: number }>(call('GET', '/notifications', wayan));
  assert.ok(notes.items.some((n) => n.type === 'order.delivered'));
  const stats = await ok<{ driver: { earningsTotal: number } }>(call('GET', '/me/stats', made));
  assert.equal(stats.driver.earningsTotal, delivered.price?.fee);
});

test('open request → driver claims it; driver cancels trip → order reopens', async () => {
  const ayu = await login('081200000002');
  const komang = await login('081200000004');
  const komangTrips = await ok<Trip[]>(call('GET', '/trips/mine', komang));
  const trip = komangTrips[0];

  const order = await ok<Order>(call('POST', '/orders', ayu, {
    category: 'Pakaian', size: 'S', pickup: PLACES.panjer, dropoff: PLACES.jimbaran,
    recipient: { name: 'Kadek', phone: '081233334444' },
  }), 201);
  assert.equal(order.status, 'open');
  assert.equal(order.price, null);

  // Komang claims it onto his trip; it gets priced now.
  const accepted = await ok<Order>(call('POST', `/orders/${order.id}/accept`, komang, { tripId: trip.id }));
  assert.equal(accepted.status, 'accepted');
  assert.ok(accepted.price && accepted.price.total > 0);

  // Komang cancels the whole trip → Ayu's order goes back to the open pool.
  await ok(call('POST', `/trips/${trip.id}/cancel`, komang, { reason: 'Motor mogok' }));
  const reopened = await ok<Order>(call('GET', `/orders/${order.id}`, ayu));
  assert.equal(reopened.status, 'open');
  assert.equal(reopened.driver, null);

  // Ayu cancels before anyone accepts: no fee.
  const cancelled = await ok<Order>(call('POST', `/orders/${order.id}/cancel`, ayu, { reason: 'Tidak jadi kirim' }));
  assert.equal(cancelled.status, 'cancelled');
});

test('realtime: sender receives order.updated over SSE when the driver accepts', async () => {
  const wayan = await login('081200000001');
  const putu = await login('081200000005');
  const [trip] = await ok<Trip[]>(call('GET', '/trips/mine', putu));
  const order = await ok<Order>(call('POST', '/orders', wayan, {
    category: 'Elektronik', size: 'M', pickup: PLACES.sanur, dropoff: PLACES.nusaDua,
    recipient: { name: 'Gede', phone: '081255556666' }, tripId: trip.id,
  }), 201);

  const controller = new AbortController();
  const res = await fetch(`${base}/events?token=${wayan}`, { signal: controller.signal });
  assert.equal(res.headers.get('content-type'), 'text/event-stream; charset=utf-8');
  const reader = res.body!.getReader();

  await ok(call('POST', `/orders/${order.id}/accept`, putu, {}));

  let received = '';
  const deadline = Date.now() + 3000;
  while (!received.includes('"status":"accepted"') && Date.now() < deadline) {
    const { value, done } = await reader.read();
    if (done) break;
    received += new TextDecoder().decode(value);
  }
  controller.abort();
  assert.ok(received.includes('event: order.updated'), received);
  assert.ok(received.includes('"status":"accepted"'));
});

test('expiry job: requests past their deadline expire', async () => {
  const wayan = await login('081200000001');
  const order = await ok<Order>(call('POST', '/orders', wayan, {
    category: 'Lainnya', size: 'XS', pickup: PLACES.renon, dropoff: PLACES.sanur,
    recipient: { name: 'X', phone: '081200001111' }, deliverBy: new Date(Date.now() + 60_000).toISOString(),
  }), 201);
  await db.run('UPDATE orders SET deliver_by = ? WHERE id = ?', [new Date(Date.now() - 1000).toISOString(), order.id]);
  // Run the job through a fresh service instance on the same database.
  const app = createApp({ db, hub, files: localFileStore(uploadDir) });
  assert.ok((await app.services.orders.expireOverdue()) >= 1);
  assert.equal((await ok<Order>(call('GET', `/orders/${order.id}`, wayan))).status, 'expired');
});
