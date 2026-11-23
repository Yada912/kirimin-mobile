import type {
  PaymentChannel,
  PaymentGatewayName,
  PaymentInstructions,
  PaymentMethod,
  PaymentTransaction,
  PaymentTransactionStatus,
} from '../../../shared/src/index.ts';
import { PAYMENT_CHANNELS, PAYMENT_METHODS } from '../../../shared/src/index.ts';
import type { Db } from '../db/database.ts';
import type { Hub } from '../realtime/hub.ts';
import { Router } from '../http/router.ts';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../http/errors.ts';
import { parse, v } from '../http/validate.ts';
import { newId, nowIso, parseJson } from '../lib/util.ts';
import type { PaymentGatewayProvider, PaymentWebhookPayload } from '../payments/gateway.ts';
import type { NotificationsService } from './notifications.ts';
import type { WalletService } from './wallet.ts';
import type { OrdersService } from './orders.ts';

interface PaymentTxRow {
  id: string;
  order_id: string;
  user_id: string;
  idempotency_key: string | null;
  gateway: PaymentGatewayName;
  gateway_ref: string;
  method: PaymentMethod;
  channel: PaymentChannel;
  amount: number;
  status: PaymentTransactionStatus;
  instructions_json: string;
  signature_key: string | null;
  webhook_payload_json: string | null;
  expires_at: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  order_code?: string;
}

const DEFAULT_CHANNEL_FOR_METHOD: Record<PaymentMethod, PaymentChannel> = {
  cash: 'cash',
  qris: 'qris',
  ewallet: 'gopay',
  bank_va: 'bca',
};

const VALID_CHANNELS_BY_METHOD: Record<PaymentMethod, PaymentChannel[]> = {
  cash: ['cash'],
  qris: ['qris'],
  ewallet: ['gopay', 'shopeepay', 'dana', 'ovo'],
  bank_va: ['bca', 'mandiri', 'bni', 'bri'],
};

const createIntentBody = v.object({
  method: v.enum(PAYMENT_METHODS),
  channel: v.optional(v.enum(PAYMENT_CHANNELS)),
  idempotencyKey: v.optional(v.string({ min: 4, max: 120 })),
});

const webhookBody = v.object({
  gateway_ref: v.string({ min: 4, max: 100 }),
  status_code: v.string({ min: 1, max: 10 }),
  gross_amount: v.string({ min: 1, max: 30 }),
  transaction_status: v.enum(['settlement', 'pending', 'expire', 'failure', 'cancel', 'refund'] as const),
  signature_key: v.string({ min: 16, max: 256 }),
  payment_type: v.optional(v.string({ max: 60 })),
  settlement_time: v.optional(v.string({ max: 60 })),
  failure_reason: v.optional(v.string({ max: 200 })),
});

const simulateBody = v.object({
  outcome: v.enum(['settlement', 'expire', 'failure'] as const),
  failureReason: v.optional(v.string({ max: 160 })),
});

export function paymentsService(
  db: Db,
  hub: Hub,
  gateway: PaymentGatewayProvider,
  orders: OrdersService,
  wallet: WalletService,
  notifications: NotificationsService,
) {
  function toDto(r: PaymentTxRow, orderCode?: string): PaymentTransaction {
    return {
      id: r.id,
      orderId: r.order_id,
      orderCode: orderCode || r.order_code || '',
      gateway: r.gateway,
      gatewayRef: r.gateway_ref,
      idempotencyKey: r.idempotency_key,
      method: r.method,
      channel: r.channel,
      amount: r.amount,
      status: r.status,
      instructions: parseJson<PaymentInstructions>(r.instructions_json, { steps: [] }),
      expiresAt: r.expires_at,
      paidAt: r.paid_at,
      isSandbox: gateway.isSandbox,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  async function findById(id: string): Promise<PaymentTxRow | undefined> {
    return db.get<PaymentTxRow>(
      `SELECT pt.*, o.code AS order_code FROM payment_transactions pt
         JOIN orders o ON o.id = pt.order_id
        WHERE pt.id = ?`,
      [id],
    );
  }

  async function findByRef(ref: string): Promise<PaymentTxRow | undefined> {
    return db.get<PaymentTxRow>(
      `SELECT pt.*, o.code AS order_code FROM payment_transactions pt
         JOIN orders o ON o.id = pt.order_id
        WHERE pt.gateway_ref = ?`,
      [ref],
    );
  }

  /** Lazily expires a pending transaction whose `expires_at` has passed. */
  async function syncExpiry(row: PaymentTxRow): Promise<PaymentTxRow> {
    if (row.status === 'pending' && row.expires_at <= nowIso()) {
      const now = nowIso();
      await db.run(`UPDATE payment_transactions SET status = 'expired', updated_at = ? WHERE id = ?`, [now, row.id]);
      return { ...row, status: 'expired', updated_at: now };
    }
    return row;
  }

  return {
    /**
     * Creates (or idempotently reuses) a gateway payment charge/intent for an order.
     * Mirrors Midtrans Core API `/v2/charge` or Xendit Invoice creation.
     */
    async createIntent(senderId: string, orderId: string, input: unknown): Promise<PaymentTransaction> {
      const body = parse(input, createIntentBody);
      const channel = body.channel ?? DEFAULT_CHANNEL_FOR_METHOD[body.method];
      if (!VALID_CHANNELS_BY_METHOD[body.method].includes(channel)) {
        throw badRequest(`Channel ${channel} tidak cocok untuk metode ${body.method}`, { field: 'channel' });
      }

      // Check idempotency key first so safe retries never double-charge.
      if (body.idempotencyKey) {
        const existingByKey = await db.get<PaymentTxRow>(
          `SELECT pt.*, o.code AS order_code FROM payment_transactions pt
             JOIN orders o ON o.id = pt.order_id
            WHERE pt.idempotency_key = ? AND pt.user_id = ?`,
          [body.idempotencyKey, senderId],
        );
        if (existingByKey) {
          return toDto(await syncExpiry(existingByKey));
        }
      }

      const order = await db.get<{
        id: string;
        code: string;
        sender_id: string;
        status: string;
        total: number | null;
        payment_status: string;
      }>('SELECT id, code, sender_id, status, total, payment_status FROM orders WHERE id = ?', [orderId]);
      if (!order) throw notFound('Pesanan');
      if (order.sender_id !== senderId) throw forbidden('Hanya pengirim yang dapat membayar pesanan ini');
      if (['cancelled', 'expired'].includes(order.status)) throw conflict('Pesanan sudah tidak aktif');
      if (order.payment_status === 'paid') throw conflict('Pesanan ini sudah lunas');
      if (!order.total) throw conflict('Harga belum ditentukan, tunggu driver menerima');

      // Reuse an active pending transaction for the exact same method + channel
      const latestPending = await db.get<PaymentTxRow>(
        `SELECT pt.*, o.code AS order_code FROM payment_transactions pt
           JOIN orders o ON o.id = pt.order_id
          WHERE pt.order_id = ? AND pt.status = 'pending'
          ORDER BY pt.created_at DESC LIMIT 1`,
        [orderId],
      );
      if (latestPending) {
        const synced = await syncExpiry(latestPending);
        if (synced.status === 'pending' && synced.method === body.method && synced.channel === channel) {
          return toDto(synced);
        }
        if (synced.status === 'pending') {
          // User switched payment method/channel: cancel superseded pending intent
          await db.run(`UPDATE payment_transactions SET status = 'cancelled', updated_at = ? WHERE id = ?`, [
            nowIso(),
            synced.id,
          ]);
        }
      }

      const sender = await db.get<{ name: string; phone: string }>('SELECT name, phone FROM users WHERE id = ?', [
        senderId,
      ]);
      const charge = await gateway.createCharge({
        orderId: order.id,
        orderCode: order.code,
        amount: order.total,
        method: body.method,
        channel,
        customerName: sender?.name || 'Pengirim Kirimin',
        customerPhone: sender?.phone || '081200000000',
      });

      const now = nowIso();
      const row: PaymentTxRow = {
        id: newId(),
        order_id: order.id,
        user_id: senderId,
        idempotency_key: body.idempotencyKey ?? null,
        gateway: charge.gateway,
        gateway_ref: charge.gatewayRef,
        method: body.method,
        channel,
        amount: order.total,
        status: charge.status,
        instructions_json: JSON.stringify(charge.instructions),
        signature_key: null,
        webhook_payload_json: null,
        expires_at: charge.expiresAt,
        paid_at: null,
        created_at: now,
        updated_at: now,
        order_code: order.code,
      };

      await db.transaction(async (tx) => {
        await tx.run(
          `INSERT INTO payment_transactions
             (id, order_id, user_id, idempotency_key, gateway, gateway_ref, method, channel, amount,
              status, instructions_json, signature_key, webhook_payload_json, expires_at, paid_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL, ?, ?)`,
          [
            row.id,
            row.order_id,
            row.user_id,
            row.idempotency_key,
            row.gateway,
            row.gateway_ref,
            row.method,
            row.channel,
            row.amount,
            row.status,
            row.instructions_json,
            row.expires_at,
            row.created_at,
            row.updated_at,
          ],
        );
        // Record chosen payment method on the order while status remains unpaid until settlement webhook
        await tx.run(`UPDATE orders SET payment_method = ?, updated_at = ? WHERE id = ?`, [body.method, now, order.id]);
      });

      const dto = toDto(row, order.code);
      hub.publish([senderId], { type: 'payment.updated', payment: dto });
      return dto;
    },

    /** Returns the latest payment gateway transaction for an order (or null if none initiated). */
    async latestForOrder(userId: string, orderId: string): Promise<PaymentTransaction | null> {
      const order = await db.get<{ sender_id: string; driver_id: string | null }>(
        'SELECT sender_id, driver_id FROM orders WHERE id = ?',
        [orderId],
      );
      if (!order) throw notFound('Pesanan');
      if (order.sender_id !== userId && order.driver_id !== userId) throw forbidden();

      const row = await db.get<PaymentTxRow>(
        `SELECT pt.*, o.code AS order_code FROM payment_transactions pt
           JOIN orders o ON o.id = pt.order_id
          WHERE pt.order_id = ?
          ORDER BY pt.created_at DESC LIMIT 1`,
        [orderId],
      );
      if (!row) return null;
      return toDto(await syncExpiry(row));
    },

    async getById(userId: string, paymentId: string): Promise<PaymentTransaction> {
      const row = await findById(paymentId);
      if (!row) throw notFound('Transaksi pembayaran');
      if (row.user_id !== userId) throw forbidden();
      return toDto(await syncExpiry(row));
    },

    /**
     * Real payment gateway webhook handler (`POST /webhooks/payments`).
     *
     * Verifies the cryptographic SHA-512 signature (`timingSafeEqual`), guarantees
     * idempotency on duplicate callbacks, transitions the transaction + order atomically,
     * credits driver earnings when already delivered, and pushes realtime SSE + push updates.
     */
    async handleWebhook(rawPayload: unknown, headerSignature?: string) {
      const payload = parse(rawPayload, webhookBody) as PaymentWebhookPayload;

      if (!gateway.verifyWebhook(payload, headerSignature)) {
        throw unauthorized('Signature webhook pembayaran tidak valid');
      }

      const txRow = await findByRef(payload.gateway_ref);
      if (!txRow) throw notFound('Referensi transaksi gateway');

      // Validate gross amount matches ledger (prevents tampering)
      if (Number(payload.gross_amount) !== txRow.amount) {
        throw badRequest('Nominal webhook tidak cocok dengan tagihan transaksi');
      }

      // Idempotent guard: already finalized with the same terminal state
      if (txRow.status === 'settlement' && payload.transaction_status === 'settlement') {
        return { ok: true, idempotent: true, payment: toDto(txRow) };
      }

      const statusMap: Record<PaymentWebhookPayload['transaction_status'], PaymentTransactionStatus> = {
        settlement: 'settlement',
        pending: 'pending',
        expire: 'expired',
        failure: 'failed',
        cancel: 'cancelled',
        refund: 'refunded',
      };
      const nextStatus = statusMap[payload.transaction_status];
      const now = nowIso();
      const paidAt = nextStatus === 'settlement' ? payload.settlement_time || now : txRow.paid_at;

      const orderInfo = await db.transaction(async (tx) => {
        await tx.run(
          `UPDATE payment_transactions
              SET status = ?, signature_key = ?, webhook_payload_json = ?, paid_at = ?, updated_at = ?
            WHERE id = ?`,
          [nextStatus, payload.signature_key, JSON.stringify(payload), paidAt, now, txRow.id],
        );

        const order = await tx.get<{
          id: string;
          code: string;
          sender_id: string;
          driver_id: string | null;
          status: string;
          fee: number | null;
          payment_status: string;
        }>('SELECT id, code, sender_id, driver_id, status, fee, payment_status FROM orders WHERE id = ?', [
          txRow.order_id,
        ]);

        if (order && nextStatus === 'settlement' && order.payment_status !== 'paid') {
          await tx.run(
            `UPDATE orders SET payment_method = ?, payment_status = 'paid', updated_at = ? WHERE id = ?`,
            [txRow.method, now, order.id],
          );
          await tx.run(
            `INSERT INTO order_events (id, order_id, status, actor_id, note, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              newId(),
              order.id,
              order.status,
              order.sender_id,
              `Pembayaran ${txRow.channel.toUpperCase()} lunas (${txRow.gateway_ref})`,
              now,
            ],
          );
          if (order.status === 'delivered' && order.driver_id && order.fee) {
            await wallet.credit(
              tx,
              order.driver_id,
              order.id,
              txRow.method === 'cash' ? 'cash_earning' : 'earning',
              order.fee,
              `Titipan ${order.code}`,
            );
          }
        }
        return order;
      });

      const updatedRow = (await findById(txRow.id))!;
      const paymentDto = toDto(updatedRow);

      // Push realtime SSE events for both payment & order
      const audience = [txRow.user_id, orderInfo?.driver_id].filter((x): x is string => !!x);
      hub.publish(audience, { type: 'payment.updated', payment: paymentDto });

      if (orderInfo && nextStatus === 'settlement') {
        const senderOrderDto = await orders.get(orderInfo.sender_id, orderInfo.id);
        hub.publish([orderInfo.sender_id], { type: 'order.updated', order: senderOrderDto });
        if (orderInfo.driver_id) {
          const driverOrderDto = await orders.get(orderInfo.driver_id, orderInfo.id);
          hub.publish([orderInfo.driver_id], { type: 'order.updated', order: driverOrderDto });
        }
        await notifications.notify(
          orderInfo.sender_id,
          'order.paid',
          'Pembayaran Terverifikasi',
          `${orderInfo.code} (${txRow.channel.toUpperCase()}) sebesar Rp ${txRow.amount.toLocaleString('id-ID')} telah lunas.`,
          { orderId: orderInfo.id, paymentId: txRow.id, gatewayRef: txRow.gateway_ref },
        );
      }

      return { ok: true, idempotent: false, payment: paymentDto };
    },

    /**
     * Sandbox Gateway Simulator (`POST /payments/:id/sandbox/simulate`).
     *
     * Available ONLY when running in sandbox mode (`mock_gateway`).
     * Constructs a genuine SHA-512 signed webhook payload and routes it through
     * the exact same `handleWebhook()` verification & settlement pipeline as production!
     */
    async simulateSandboxWebhook(userId: string, paymentId: string, input: unknown) {
      if (!gateway.isSandbox) {
        throw forbidden('Simulator pembayaran hanya tersedia di mode Sandbox');
      }
      const body = parse(input, simulateBody);
      const txRow = await findById(paymentId);
      if (!txRow) throw notFound('Transaksi pembayaran');
      if (txRow.user_id !== userId) throw forbidden();
      if (txRow.status !== 'pending') {
        throw conflict(`Transaksi ini sudah berstatus "${txRow.status}"`);
      }

      const statusCode = body.outcome === 'settlement' ? '200' : body.outcome === 'expire' ? '407' : '402';
      const grossAmount = String(txRow.amount);
      const signature = gateway.signWebhook(txRow.gateway_ref, statusCode, grossAmount);

      const signedPayload: PaymentWebhookPayload = {
        gateway_ref: txRow.gateway_ref,
        status_code: statusCode,
        gross_amount: grossAmount,
        transaction_status: body.outcome,
        signature_key: signature,
        payment_type: `${txRow.method}:${txRow.channel}`,
        settlement_time: body.outcome === 'settlement' ? nowIso() : undefined,
        failure_reason: body.outcome === 'failure' ? body.failureReason || 'Saldo tidak mencukupi (Simulasi Sandbox)' : undefined,
      };

      return this.handleWebhook(signedPayload, signature);
    },
  };
}

export type PaymentsService = ReturnType<typeof paymentsService>;

export function paymentsRoutes(svc: PaymentsService): Router {
  const r = new Router();
  r.post('/orders/:id/payments', async (ctx) => {
    ctx.status = 201;
    return svc.createIntent(ctx.userId(), ctx.params.id, await ctx.json());
  });
  r.get('/orders/:id/payments/latest', (ctx) => svc.latestForOrder(ctx.userId(), ctx.params.id));
  r.get('/payments/:id', (ctx) => svc.getById(ctx.userId(), ctx.params.id));
  r.post('/payments/:id/sandbox/simulate', async (ctx) =>
    svc.simulateSandboxWebhook(ctx.userId(), ctx.params.id, await ctx.json()),
  );
  // Real public webhook endpoint — authenticated via SHA-512 signature_key / X-Kirimin-Signature
  r.post('/webhooks/payments', async (ctx) => {
    const headerSig = ctx.req.headers['x-kirimin-signature'];
    return svc.handleWebhook(await ctx.json(), typeof headerSig === 'string' ? headerSig : undefined);
  });
  return r;
}
