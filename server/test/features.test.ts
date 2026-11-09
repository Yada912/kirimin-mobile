/**
 * MVP round 2: push notifications, settings & sessions, saved places,
 * verification, problem reports, driver wallet, recurring routes, account deletion.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AuthResponse, Me, Order, PublicUser, Report, SavedPlace, Trip, UserSettings, WalletEntry, WalletSummary } from '../../shared/src/index.ts';
import { PLACES } from '../src/db/seed.ts';
import { startTestServer, tick } from './helpers.ts';

let t: Awaited<ReturnType<typeof startTestServer>>;
before(async () => {
  t = await startTestServer();
});
after(() => t.close());

const WAYAN = '081200000001';
const AYU = '081200000002';
const MADE = '081200000003';
const PUTU = '081200000005';

async function register(name: string, phone: string, role: 'sender' | 'driver' = 'sender') {
  return t.ok<AuthResponse>(t.call('POST', '/auth/register', undefined, { name, phone, password: 'rahasia1', role }), 201);
}

/** Wayan sends an XS document along Made's seeded route; returns the order and both tokens. */
async function orderOnMadesTrip(paymentMethod: 'cash' | 'qris') {
  const wayan = await t.login(WAYAN);
  const made = await t.login(MADE);
  const [trip] = await t.ok<Trip[]>(t.call('GET', '/trips/mine', made));
  const order = await t.ok<Order>(t.call('POST', '/orders', wayan, {
    category: 'Dokumen', size: 'XS', pickup: PLACES.tukadBadung, dropoff: PLACES.gedungFT,
    recipient: { name: 'Dewa', phone: '081299991111' }, paymentMethod, tripId: trip.id,
  }), 201);
  return { wayan, made, trip, order };
}

test('push: tokens are validated, notifications and chat reach the phone, preferences are respected', async () => {
  const wayan = await t.login(WAYAN);
  const made = await t.login(MADE);
  assert.equal((await t.call('POST', '/me/push-tokens', made, { token: 'not-a-token-at-all' })).status, 400);
  await t.ok(t.call('POST', '/me/push-tokens', made, { token: 'ExponentPushToken[made-phone]', platform: 'android' }));
  await t.ok(t.call('POST', '/me/push-tokens', wayan, { token: 'ExponentPushToken[wayan-phone]', platform: 'android' }));

  const before = t.push.sent.length;
  const { order } = await orderOnMadesTrip('cash');
  const toMade = t.push.sent.slice(before).filter((m) => m.to === 'ExponentPushToken[made-phone]');
  assert.equal(toMade.length, 1);
  assert.equal(toMade[0].title, 'Permintaan titipan baru');
  assert.equal(toMade[0].data?.orderId, order.id);

  // Chat goes to the other person's phone (not to the sender's own).
  await t.ok(t.call('POST', `/orders/${order.id}/accept`, made, {}));
  const beforeChat = t.push.sent.length;
  await t.ok(t.call('POST', `/orders/${order.id}/messages`, made, { body: 'Halo, saya jemput 10 menit lagi' }), 201);
  const chat = t.push.sent.slice(beforeChat);
  assert.deepEqual(chat.map((m) => m.to), ['ExponentPushToken[wayan-phone]']);
  assert.equal(chat[0].data?.type, 'chat.message');

  // Wayan mutes chat pushes; in-app (SSE) still works, but no phone push.
  const s = await t.ok<UserSettings>(t.call('PATCH', '/me/settings', wayan, { push: { chat: false } }));
  assert.equal(s.push.chat, false);
  assert.equal(s.push.orders, true);
  const beforeMuted = t.push.sent.length;
  await t.ok(t.call('POST', `/orders/${order.id}/messages`, made, { body: 'Sudah di depan' }), 201);
  assert.equal(t.push.sent.length, beforeMuted);

  // Expo says Made's token is dead → it is removed after the next push (Wayan cancels → Made is notified).
  t.push.invalid.add('ExponentPushToken[made-phone]');
  await t.ok(t.call('POST', `/orders/${order.id}/cancel`, wayan, {}));
  await tick();
  assert.equal(await t.db.get(`SELECT 1 FROM push_tokens WHERE token = 'ExponentPushToken[made-phone]'`), undefined);

  // Logout: the app unregisters its token.
  await t.ok(t.call('POST', '/me/push-tokens/remove', wayan, { token: 'ExponentPushToken[wayan-phone]' }));
  assert.equal(await t.db.get(`SELECT 1 FROM push_tokens WHERE token = 'ExponentPushToken[wayan-phone]'`), undefined);
});

test('password change and "logout everywhere" revoke old tokens', async () => {
  const { token: first } = await register('Sinta', '081377770001');
  const second = await t.login('081377770001', 'rahasia1');

  assert.equal((await t.call('POST', '/me/password', first, { currentPassword: 'salah', newPassword: 'baru123' })).status, 400);
  const changed = await t.ok<AuthResponse>(t.call('POST', '/me/password', first, { currentPassword: 'rahasia1', newPassword: 'baru123' }));
  assert.equal((await t.call('GET', '/me', first)).status, 401);
  assert.equal((await t.call('GET', '/me', second)).status, 401);
  await t.ok(t.call('GET', '/me', changed.token));
  assert.equal((await t.call('POST', '/auth/login', undefined, { phone: '081377770001', password: 'rahasia1' })).status, 401);

  const again = await t.login('081377770001', 'baru123');
  await t.ok(t.call('POST', '/auth/logout-all', again));
  assert.equal((await t.call('GET', '/me', again)).status, 401);
  assert.equal((await t.call('GET', '/me', changed.token)).status, 401);
});

test('saved places: create, list, update, delete; only your own', async () => {
  const wayan = await t.login(WAYAN);
  const ayu = await t.login(AYU);
  const home = await t.ok<SavedPlace>(t.call('POST', '/me/places', wayan, { kind: 'home', ...PLACES.tukadBadung }), 201);
  await t.ok(t.call('POST', '/me/places', wayan, { kind: 'campus', ...PLACES.gedungFT }), 201);
  assert.equal((await t.call('POST', '/me/places', wayan, { label: 'X', lat: 200, lng: 0 })).status, 400);

  const list = await t.ok<SavedPlace[]>(t.call('GET', '/me/places', wayan));
  assert.deepEqual(list.map((p) => p.kind), ['home', 'campus']);
  assert.equal((await t.ok<SavedPlace[]>(t.call('GET', '/me/places', ayu))).length, 0);

  const renamed = await t.ok<SavedPlace>(t.call('PATCH', `/me/places/${home.id}`, wayan, { label: 'Rumah Renon' }));
  assert.equal(renamed.label, 'Rumah Renon');
  assert.equal(renamed.lat, PLACES.tukadBadung.lat);
  assert.equal((await t.call('DELETE', `/me/places/${home.id}`, ayu)).status, 404);
  await t.ok(t.call('DELETE', `/me/places/${home.id}`, wayan));
  assert.equal((await t.ok<SavedPlace[]>(t.call('GET', '/me/places', wayan))).length, 1);
});

test('verification (X4): submit KTP + selfie → verified badge', async () => {
  const { token, user } = await register('Gede', '081377770002', 'driver');
  assert.equal(user.verificationStatus, 'none');
  assert.equal(user.verified, false);
  assert.equal((await t.call('POST', '/me/verification', token, { ktpPhotoUrl: '/uploads/ktp.jpg' })).status, 400);
  const me = await t.ok<Me>(t.call('POST', '/me/verification', token, { ktpPhotoUrl: '/uploads/ktp.jpg', selfiePhotoUrl: '/uploads/selfie.jpg' }));
  assert.equal(me.verificationStatus, 'verified');
  assert.equal(me.verified, true);
  assert.equal((await t.call('POST', '/me/verification', token, { ktpPhotoUrl: 'a', selfiePhotoUrl: 'b' })).status, 409);
});

test('reports (S9/D10): participants can report, others cannot', async () => {
  const { wayan, made, order } = await orderOnMadesTrip('cash');
  const putu = await t.login(PUTU);
  const ayu = await t.login(AYU);
  assert.equal((await t.call('POST', `/orders/${order.id}/reports`, wayan, { category: 'late', description: 'pendek' })).status, 400);
  const report = await t.ok<Report>(t.call('POST', `/orders/${order.id}/reports`, wayan, {
    category: 'late', description: 'Driver belum datang padahal sudah lewat 30 menit',
  }), 201);
  assert.equal(report.status, 'open');
  assert.equal(report.orderCode, order.code);
  assert.equal((await t.call('POST', `/orders/${order.id}/reports`, putu, { category: 'other', description: 'Saya bukan bagian pesanan ini' })).status, 403);
  assert.equal((await t.call('GET', `/orders/${order.id}/reports`, ayu)).status, 403);

  // The driver reports too; each person only sees their own reports.
  await t.ok(t.call('POST', `/orders/${order.id}/reports`, made, { category: 'behaviour', description: 'Pengirim tidak bisa dihubungi sama sekali' }), 201);
  assert.equal((await t.ok<Report[]>(t.call('GET', `/orders/${order.id}/reports`, wayan))).length, 1);
  assert.ok((await t.ok<Report[]>(t.call('GET', '/me/reports', made))).some((r) => r.category === 'behaviour'));
  await t.ok(t.call('POST', `/orders/${order.id}/cancel`, wayan, {}));
});

test('wallet: non-cash earnings are withdrawable, cash is tracked, late cancel compensates', async () => {
  const made = await t.login(MADE);
  const start = await t.ok<WalletSummary>(t.call('GET', '/wallet', made));

  // QRIS order delivered → fee is credited to the balance.
  const paid = await orderOnMadesTrip('qris');
  await t.ok(t.call('POST', `/orders/${paid.order.id}/accept`, made, {}));
  await t.ok(t.call('POST', `/orders/${paid.order.id}/pay`, paid.wayan, { method: 'qris' }));
  await t.ok(t.call('POST', `/orders/${paid.order.id}/pickup`, made, {}));
  await t.ok(t.call('POST', `/orders/${paid.order.id}/deliver`, made, { code: paid.order.handoverCode }));
  const fee = paid.order.price!.fee;

  // Cash order delivered → counted, not withdrawable.
  const cash = await orderOnMadesTrip('cash');
  await t.ok(t.call('POST', `/orders/${cash.order.id}/accept`, made, {}));
  await t.ok(t.call('POST', `/orders/${cash.order.id}/pickup`, made, {}));
  await t.ok(t.call('POST', `/orders/${cash.order.id}/deliver`, made, { code: cash.order.handoverCode }));

  // Paid order cancelled after acceptance → driver keeps Rp 2.000.
  const late = await orderOnMadesTrip('qris');
  await t.ok(t.call('POST', `/orders/${late.order.id}/accept`, made, {}));
  await t.ok(t.call('POST', `/orders/${late.order.id}/pay`, late.wayan, { method: 'qris' }));
  const cancelled = await t.ok<Order>(t.call('POST', `/orders/${late.order.id}/cancel`, late.wayan, {}));
  assert.equal(cancelled.payment.refundAmount, late.order.price!.total - 2000);

  const w = await t.ok<WalletSummary>(t.call('GET', '/wallet', made));
  assert.equal(w.balance - start.balance, fee + 2000);
  assert.equal(w.cashCollected - start.cashCollected, cash.order.price!.fee);
  assert.ok(w.entries.some((e) => e.type === 'earning' && e.orderCode === paid.order.code));

  // Withdraw: validation, insufficient balance, success.
  assert.equal((await t.call('POST', '/wallet/withdraw', made, { amount: 10000, method: 'bank', provider: 'Bank Antah', accountNumber: '1234567890', accountName: 'Made S' })).status, 400);
  assert.equal((await t.call('POST', '/wallet/withdraw', made, { amount: w.balance + 10000, method: 'bank', provider: 'BCA', accountNumber: '1234567890', accountName: 'Made S' })).status, 409);
  const entry = await t.ok<WalletEntry>(t.call('POST', '/wallet/withdraw', made, { amount: 10000, method: 'ewallet', provider: 'DANA', accountNumber: '0812-0000-0003', accountName: 'Made S' }), 201);
  assert.equal(entry.amount, -10000);
  assert.equal(entry.payout?.accountNumber, '081200000003');
  const after = await t.ok<WalletSummary>(t.call('GET', '/wallet', made));
  assert.equal(after.balance, w.balance - 10000);
  assert.equal(after.totalWithdrawn, w.totalWithdrawn + 10000);
});

test('recurring routes: upcoming departures are published, edits and cancel apply to the series', async () => {
  const { token } = await register('Ketut', '081377770003', 'driver');
  const departAt = new Date(Date.now() + 60 * 60_000).toISOString();
  const trip = await t.ok<Trip>(t.call('POST', '/trips', token, {
    name: 'Ke Kampus', origin: PLACES.renon, destination: PLACES.kampusBukit, departAt,
    repeatDays: [0, 1, 2, 3, 4, 5, 6], vehicle: { type: 'motor', plate: 'DK 5555 ZZ' },
  }), 201);
  assert.equal(trip.seriesId, trip.id);

  // Horizon is 2 days: today's departure + tomorrow's (the day after is just past the horizon).
  let mine = await t.ok<Trip[]>(t.call('GET', '/trips/mine', token));
  assert.equal(mine.length, 2);
  assert.ok(mine.every((x) => x.seriesId === trip.id));
  assert.equal(new Date(mine[1].departAt).getTime() - new Date(departAt).getTime(), 86_400_000);

  // The job is idempotent, and catches up when time moves on.
  await t.app.services.trips.generateRecurring();
  assert.equal((await t.ok<Trip[]>(t.call('GET', '/trips/mine', token))).length, 2);
  await t.app.services.trips.generateRecurring(new Date(Date.now() + 86_400_000));

  // Editing with scope "series" updates every upcoming departure.
  await t.ok(t.call('PATCH', `/trips/${trip.id}`, token, { scope: 'series', maxPackages: 5, acceptedSizes: ['XS'] }));
  mine = await t.ok<Trip[]>(t.call('GET', '/trips/mine', token));
  assert.equal(mine.length, 3);
  assert.ok(mine.every((x) => x.maxPackages === 5 && x.acceptedSizes.join() === 'XS'));

  // Only one weekday: no new departure unless it falls on that day.
  const solo = await register('Nyoman', '081377770004', 'driver');
  const tomorrowLocalDay = new Date(Date.parse(departAt) + 86_400_000 + 480 * 60_000).getUTCDay();
  await t.ok(t.call('POST', '/trips', solo.token, {
    name: 'Les', origin: PLACES.renon, destination: PLACES.sanur, departAt,
    repeatDays: [(tomorrowLocalDay + 1) % 7], vehicle: { type: 'motor', plate: 'DK 6666 ZZ' },
  }), 201);
  assert.equal((await t.ok<Trip[]>(t.call('GET', '/trips/mine', solo.token))).length, 1);

  // Cancelling the series stops it for good.
  await t.ok(t.call('POST', `/trips/${trip.id}/cancel`, token, { scope: 'series', reason: 'Libur semester' }));
  assert.equal((await t.ok<Trip[]>(t.call('GET', '/trips/mine', token))).length, 0);
  await t.app.services.trips.generateRecurring(new Date(Date.now() + 5 * 86_400_000));
  assert.equal((await t.ok<Trip[]>(t.call('GET', '/trips/mine', token))).length, 0);
  const history = await t.ok<Trip[]>(t.call('GET', '/trips/mine?scope=history', token));
  assert.ok(history.every((x) => x.status === 'cancelled' && x.repeatDays.length === 0));
});

test('account deletion: blocked by active orders, then anonymised and signed out', async () => {
  const { token, user } = await register('Dewi', '081377770005');
  const order = await t.ok<Order>(t.call('POST', '/orders', token, {
    category: 'Pakaian', size: 'S', pickup: PLACES.panjer, dropoff: PLACES.jimbaran, recipient: { name: 'Kadek', phone: '081233334444' },
  }), 201);
  assert.equal((await t.call('POST', '/me/delete', token, { password: 'rahasia1' })).status, 409);
  await t.ok(t.call('POST', `/orders/${order.id}/cancel`, token, {}));
  assert.equal((await t.call('POST', '/me/delete', token, { password: 'salah' })).status, 400);
  await t.ok(t.call('POST', '/me/delete', token, { password: 'rahasia1' }));

  assert.equal((await t.call('GET', '/me', token)).status, 401);
  assert.equal((await t.call('POST', '/auth/login', undefined, { phone: '081377770005', password: 'rahasia1' })).status, 401);
  const wayan = await t.login(WAYAN);
  assert.equal((await t.ok<PublicUser>(t.call('GET', `/users/${user.id}`, wayan))).name, 'Akun dihapus');
  // The phone number can be used for a new account.
  await register('Dewi Baru', '081377770005');
});

test('meta lists the new pickers', async () => {
  const meta = await t.ok<Record<string, unknown>>(t.call('GET', '/meta'));
  for (const key of ['reportCategories', 'savedPlaceKinds', 'notificationChannels', 'verificationStatuses', 'walletEntryTypes', 'payout']) {
    assert.ok(key in meta, key);
  }
});
