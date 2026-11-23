import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Order, PaymentTransaction } from '../../shared/src/index.ts';
import { PLACES } from '../src/db/seed.ts';
import { startTestServer } from './helpers.ts';

let t: Awaited<ReturnType<typeof startTestServer>>;
before(async () => {
  t = await startTestServer();
});
after(() => t.close());

async function createPricedOrder(senderToken: string) {
  const made = await t.login('081200000003');
  const [trip] = await t.ok<{ id: string }[]>(t.call('GET', '/trips/mine', made));
  return t.ok<Order>(
    t.call('POST', '/orders', senderToken, {
      category: 'Dokumen',
      size: 'XS',
      pickup: PLACES.renon,
      dropoff: PLACES.kampusBukit,
      recipient: { name: 'Dewa', phone: '081299990001' },
      tripId: trip.id,
      paymentMethod: 'qris',
    }),
    201,
  );
}

test('payment gateway: idempotent charge creation, channel switching, and authentic EMVCo QRIS / Bank VA', async () => {
  const wayan = await t.login('081200000001');
  const order = await createPricedOrder(wayan);

  // 1. Create QRIS payment intent with idempotencyKey
  const tx1 = await t.ok<PaymentTransaction>(
    t.call('POST', `/orders/${order.id}/payments`, wayan, {
      method: 'qris',
      channel: 'qris',
      idempotencyKey: `idem-${order.id}-1`,
    }),
    201,
  );
  assert.equal(tx1.status, 'pending');
  assert.equal(tx1.gateway, 'mock_gateway');
  assert.equal(tx1.amount, order.price!.total);
  assert.ok(tx1.gatewayRef.startsWith('KRM-PAY-'));
  assert.ok(tx1.instructions.qrString?.startsWith('000201010212'), 'expected EMVCo QRIS payload');
  assert.ok(tx1.instructions.qrString?.includes('KIRIMIN BALI'));

  // 2. Retrying with same idempotencyKey returns exact same transaction (no double-charge)
  const tx1Retry = await t.ok<PaymentTransaction>(
    t.call('POST', `/orders/${order.id}/payments`, wayan, {
      method: 'qris',
      channel: 'qris',
      idempotencyKey: `idem-${order.id}-1`,
    }),
    201,
  );
  assert.equal(tx1Retry.id, tx1.id);
  assert.equal(tx1Retry.gatewayRef, tx1.gatewayRef);

  // 3. Switching to BCA Virtual Account cancels the old pending QRIS intent and issues a real BCA VA
  const txVa = await t.ok<PaymentTransaction>(
    t.call('POST', `/orders/${order.id}/payments`, wayan, {
      method: 'bank_va',
      channel: 'bca',
      idempotencyKey: `idem-${order.id}-2`,
    }),
    201,
  );
  assert.notEqual(txVa.id, tx1.id);
  assert.equal(txVa.channel, 'bca');
  assert.ok(txVa.instructions.vaNumber?.startsWith('3901'));
  assert.ok(txVa.instructions.steps.length >= 3);

  const oldTx = await t.ok<PaymentTransaction>(t.call('GET', `/payments/${tx1.id}`, wayan));
  assert.equal(oldTx.status, 'cancelled');
});

test('payment gateway webhook: rejects forged SHA-512 signatures, settles on valid signature, and is idempotent', async () => {
  const wayan = await t.login('081200000001');
  const order = await createPricedOrder(wayan);

  const tx = await t.ok<PaymentTransaction>(
    t.call('POST', `/orders/${order.id}/payments`, wayan, { method: 'ewallet', channel: 'gopay' }),
    201,
  );
  assert.ok(tx.instructions.deepLinkUrl?.startsWith('gojek://'));

  // Forged signature must be rejected with 401
  const forged = await t.call('POST', '/webhooks/payments', undefined, {
    gateway_ref: tx.gatewayRef,
    status_code: '200',
    gross_amount: String(tx.amount),
    transaction_status: 'settlement',
    signature_key: '0'.repeat(128),
  });
  assert.equal(forged.status, 401);

  // Valid SHA-512 signed webhook settles the payment and marks the order paid
  const sig = t.app.paymentGateway.signWebhook(tx.gatewayRef, '200', String(tx.amount));
  const settled = await t.ok<{ ok: boolean; idempotent: boolean; payment: PaymentTransaction }>(
    t.call('POST', '/webhooks/payments', undefined, {
      gateway_ref: tx.gatewayRef,
      status_code: '200',
      gross_amount: String(tx.amount),
      transaction_status: 'settlement',
      signature_key: sig,
    }),
  );
  assert.equal(settled.ok, true);
  assert.equal(settled.idempotent, false);
  assert.equal(settled.payment.status, 'settlement');
  assert.ok(settled.payment.paidAt);

  const paidOrder = await t.ok<Order>(t.call('GET', `/orders/${order.id}`, wayan));
  assert.equal(paidOrder.payment.status, 'paid');
  assert.equal(paidOrder.payment.method, 'ewallet');

  // Duplicate webhook callback is safely idempotent
  const dup = await t.ok<{ ok: boolean; idempotent: boolean; payment: PaymentTransaction }>(
    t.call('POST', '/webhooks/payments', undefined, {
      gateway_ref: tx.gatewayRef,
      status_code: '200',
      gross_amount: String(tx.amount),
      transaction_status: 'settlement',
      signature_key: sig,
    }),
  );
  assert.equal(dup.idempotent, true);
});

test('sandbox simulator exercises failed/retry recovery and real settlement + SSE broadcast', async () => {
  const wayan = await t.login('081200000001');
  const order = await createPricedOrder(wayan);

  // First attempt fails via sandbox webhook simulator
  const txFail = await t.ok<PaymentTransaction>(
    t.call('POST', `/orders/${order.id}/payments`, wayan, { method: 'qris', channel: 'qris' }),
    201,
  );
  const failRes = await t.ok<{ payment: PaymentTransaction }>(
    t.call('POST', `/payments/${txFail.id}/sandbox/simulate`, wayan, { outcome: 'failure' }),
  );
  assert.equal(failRes.payment.status, 'failed');

  // Order is still unpaid, so sender can retry with a fresh intent
  const stillUnpaid = await t.ok<Order>(t.call('GET', `/orders/${order.id}`, wayan));
  assert.equal(stillUnpaid.payment.status, 'unpaid');

  const txRetry = await t.ok<PaymentTransaction>(
    t.call('POST', `/orders/${order.id}/payments`, wayan, { method: 'qris', channel: 'qris' }),
    201,
  );
  assert.equal(txRetry.status, 'pending');

  // Open SSE stream to confirm realtime `payment.updated` event fires on settlement
  const ctrl = new AbortController();
  const sseRes = await fetch(`${t.base}/events?token=${wayan}`, { signal: ctrl.signal });
  const reader = sseRes.body!.getReader();

  const okRes = await t.ok<{ payment: PaymentTransaction }>(
    t.call('POST', `/payments/${txRetry.id}/sandbox/simulate`, wayan, { outcome: 'settlement' }),
  );
  assert.equal(okRes.payment.status, 'settlement');

  let streamText = '';
  const deadline = Date.now() + 3000;
  while (!streamText.includes('event: payment.updated') && Date.now() < deadline) {
    const { value, done } = await reader.read();
    if (done) break;
    streamText += new TextDecoder().decode(value);
  }
  ctrl.abort();
  assert.match(streamText, /^event: payment\.updated$/m);
});
