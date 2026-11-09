/**
 * The MVP flow, driven with exactly the data the screens produce.
 *
 * Kirim side: route params are encoded the way S1 (paket.tsx) and S2 (rute.tsx)
 * encode them, then read back with the same `readKirimDraft` / `searchPayload` /
 * `orderPayload` functions that S3 (driver.tsx) and S4 (konfirmasi.tsx) use.
 * Angkut side: request bodies match what the hooks in src/api/hooks/useApi.ts send.
 *
 * If a screen and the server drift apart (renamed field, wrong enum, missing id),
 * this test fails with the server's own error message.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { IncomingRequest, Order, Trip, TripMatch } from '../../../shared/src/index.ts';
import { ORDER_STATUSES } from '../../../shared/src/index.ts';
import { startTestServer } from '../../../server/test/helpers.ts';
import { confirmPrice, orderPayload, readKirimDraft, searchPayload, type RouteParams } from '../../src/features/kirim/draft.ts';
import { formatRupiah, formatSimilarity } from '../../src/utils/format.ts';

let srv: Awaited<ReturnType<typeof startTestServer>>;
before(async () => {
  srv = await startTestServer();
});
after(() => srv.close());

// What app/kirim/rute.tsx starts with (PRESET_PLACES.renon → kampus_bukit).
const RENON = { label: 'Renon', lat: -8.6726, lng: 115.2335 };
const KAMPUS = { label: 'Kampus Bukit Jimbaran', lat: -8.7983, lng: 115.1716 };

/** Params after S1 → S2, encoded the way paket.tsx and rute.tsx push them. */
function paramsAfterRute(overrides: RouteParams = {}): RouteParams {
  return {
    // paket.tsx
    category: 'Dokumen',
    size: 'XS',
    weightClass: 'lt1',
    handling: JSON.stringify(['keep_dry']),
    notes: '',
    photoUrl: '',
    // rute.tsx
    pickup: JSON.stringify(RENON),
    dropoff: JSON.stringify(KAMPUS),
    recipient: JSON.stringify({ name: 'Dewa', phone: '081299990001' }),
    handoverMethod: 'meet',
    ...overrides,
  };
}

test('S3 → S4 → S5: sender picks a driver searah and sends the request', async () => {
  const wayan = await srv.login('081200000001');

  // S3 driver.tsx
  const draft = readKirimDraft(paramsAfterRute());
  const found = await srv.ok<{ direct: TripMatch[]; detour: TripMatch[] }>(srv.call('POST', '/matches/search', wayan, searchPayload(draft)));
  const matches = [...found.direct, ...found.detour];
  const made = matches.find((m) => m.trip.driver.name === 'Made S.');
  assert.ok(made, `Made should match Renon → Kampus Bukit; got ${matches.map((m) => m.trip.driver.name).join(', ') || 'nothing'}`);
  for (const m of matches) {
    assert.match(formatSimilarity(m.similarity), /^\d{1,3}%$/);
    assert.ok(Number(formatSimilarity(m.similarity).slice(0, -1)) <= 100, 'similarity label must never exceed 100%');
  }

  // S4 konfirmasi.tsx — driver.tsx forwards all params plus tripId + matchData.
  const s4 = readKirimDraft(paramsAfterRute({ tripId: made.trip.id, matchData: JSON.stringify(made) }));
  assert.deepEqual(confirmPrice(s4), made.price, 'S4 must show the price the driver quoted on S3');
  const order = await srv.ok<Order>(srv.call('POST', '/orders', wayan, orderPayload(s4, 'cash')), 201);

  // S5 lacak/[id].tsx reads these.
  assert.equal(order.status, 'requested');
  assert.equal(order.driver?.name, 'Made S.');
  assert.match(order.handoverCode ?? '', /^\d{4}$/, 'sender must get a 4-digit handover code');
  assert.equal(order.price?.total, made.price.total);
  assert.equal(order.pickup.label, 'Renon');
  assert.ok(formatRupiah(order.price!.total).startsWith('Rp '));
});

test('S3 → S6: "Posting Permintaan Terbuka" creates an open request with no made-up price', async () => {
  const wayan = await srv.login('081200000001');
  // driver.tsx handlePostOpen pushes tripId: '' and no matchData.
  const draft = readKirimDraft(paramsAfterRute({ tripId: '' }));
  assert.equal(confirmPrice(draft), null, 'an open request has no price until a driver accepts');
  const order = await srv.ok<Order>(srv.call('POST', '/orders', wayan, orderPayload(draft, 'cash')), 201);
  assert.equal(order.status, 'open');
  assert.equal(order.price, null);
});

test('S1 options from /meta are all accepted by POST /orders', async () => {
  const wayan = await srv.login('081200000001');
  const meta = await srv.ok<{ sizes: { value: string }[]; categories: string[]; handling: { value: string }[]; weightClasses: { value: string }[] }>(
    srv.call('GET', '/meta'),
  );
  // Every size/category the picker offers must be orderable (open requests, so no driver capacity involved).
  for (const size of meta.sizes.map((s) => s.value)) {
    for (const category of meta.categories) {
      const d = readKirimDraft(paramsAfterRute({
        size, category, tripId: '',
        weightClass: meta.weightClasses[0].value,
        handling: JSON.stringify(meta.handling.map((h) => h.value)),
      }));
      const r = await srv.call('POST', '/orders', wayan, orderPayload(d, 'qris'));
      assert.equal(r.status, 201, `${category} ${size}: ${JSON.stringify(r.body)}`);
    }
  }
});

test('D3 → D5 → X2 → X3: driver accepts, delivers with the code, both sides rate', async () => {
  const wayan = await srv.login('081200000001');
  const made = await srv.login('081200000003');

  const draft0 = readKirimDraft(paramsAfterRute());
  const { direct, detour } = await srv.ok<{ direct: TripMatch[]; detour: TripMatch[] }>(srv.call('POST', '/matches/search', wayan, searchPayload(draft0)));
  const match = [...direct, ...detour].find((m) => m.trip.driver.name === 'Made S.')!;
  const draft = readKirimDraft(paramsAfterRute({ tripId: match.trip.id, matchData: JSON.stringify(match) }));
  const order = await srv.ok<Order>(srv.call('POST', '/orders', wayan, orderPayload(draft, 'cash')), 201);

  // (angkut)/beranda.tsx → active trip card → permintaan/[tripId].tsx
  const trips = await srv.ok<Trip[]>(srv.call('GET', '/trips/mine?scope=active', made));
  const trip = trips.find((t) => t.id === match.trip.id);
  assert.ok(trip, 'the trip the sender picked must be on the driver’s home screen');
  const inbox = await srv.ok<IncomingRequest[]>(srv.call('GET', `/trips/${trip.id}/requests`, made));
  const mine = inbox.find((r) => r.order.id === order.id);
  assert.equal(mine?.source, 'requested', 'the request shows up in the driver’s inbox (D3)');
  assert.ok(inbox.findIndex((r) => r.source === 'open') === -1 || inbox.findIndex((r) => r.source === 'open') > inbox.indexOf(mine!),
    'requests sent to this trip are listed before open requests');

  // useAcceptOrder sends { tripId } when the screen has one.
  await srv.ok(srv.call('POST', `/orders/${order.id}/accept`, made, { tripId: trip.id }));
  const afterAccept = await srv.ok<Trip>(srv.call('GET', `/trips/${trip.id}`, made));
  assert.ok(afterAccept.slotsUsed > 0, 'the "Perjalanan" button only appears when slotsUsed > 0');

  // jalan/[tripId].tsx
  await srv.ok(srv.call('POST', `/trips/${trip.id}/start`, made));
  await srv.ok(srv.call('POST', `/trips/${trip.id}/location`, made, { lat: -8.72, lng: 115.2 }));
  const manifest = await srv.ok<{ trip: Trip; stops: { kind: string }[]; orders: Order[] }>(srv.call('GET', `/trips/${trip.id}/manifest`, made));
  const onTrip = manifest.orders.find((o) => o.id === order.id)!;
  assert.equal(onTrip.status, 'accepted', 'shows "Konfirmasi Dijemput (X2)"');
  assert.equal(onTrip.recipient.name, 'Dewa', 'driver sees "Penerima: …"');
  assert.equal(onTrip.handoverCode, undefined, 'the driver must never see the handover code');

  // usePickupOrder sends { photoUrl: undefined } → "{}" over the wire.
  const picked = await srv.ok<Order>(srv.call('POST', `/orders/${order.id}/pickup`, made, { photoUrl: undefined }));
  assert.ok(['picked_up', 'in_transit'].includes(picked.status), 'shows "Konfirmasi Tiba di Lokasi"');
  const arrived = await srv.ok<Order>(srv.call('POST', `/orders/${order.id}/arrive`, made));
  assert.equal(arrived.status, 'arrived', 'shows "Masukkan Kode Serah Terima (X2)"');

  // serah-terima/[orderId].tsx: a wrong code shows the server's message, the right one completes.
  const wrong = order.handoverCode === '0000' ? '1111' : '0000';
  const bad = await srv.call<{ error: { message: string } }>('POST', `/orders/${order.id}/deliver`, made, { code: wrong });
  assert.equal(bad.status, 400);
  assert.ok(bad.body.error.message.length > 0, 'error message is shown to the driver as-is');
  const delivered = await srv.ok<Order>(srv.call('POST', `/orders/${order.id}/deliver`, made, { code: order.handoverCode }));
  assert.equal(delivered.status, 'delivered');

  // Sender's lacak screen sees the final status (polling path).
  const senderView = await srv.ok<Order>(srv.call('GET', `/orders/${order.id}`, wayan));
  assert.equal(senderView.status, 'delivered');
  assert.ok(ORDER_STATUSES.includes(senderView.status));

  // rating/[orderId].tsx sends its defaults when the user changes nothing.
  await srv.ok(srv.call('POST', `/orders/${order.id}/rating`, wayan, {
    stars: 5, tags: ['Tepat Waktu', 'Paket Terjaga Aman'], comment: 'Pelayanan sangat memuaskan.',
  }), 201);

  // "Selesaikan Rute Perjalanan"
  await srv.ok(srv.call('POST', `/trips/${trip.id}/complete`, made));
});

test('S7: sender can cancel an open request', async () => {
  const wayan = await srv.login('081200000001');
  const draft = readKirimDraft(paramsAfterRute({ tripId: '' }));
  const order = await srv.ok<Order>(srv.call('POST', '/orders', wayan, orderPayload(draft, 'cash')), 201);
  const cancelled = await srv.ok<Order>(srv.call('POST', `/orders/${order.id}/cancel`, wayan, { reason: undefined }));
  assert.equal(cancelled.status, 'cancelled');
});
