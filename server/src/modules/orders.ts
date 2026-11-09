import type {
  Category,
  HandlingFlag,
  HandoverMethod,
  IncomingRequest,
  Order,
  OrderStatus,
  PackageSize,
  PaymentMethod,
  PaymentStatus,
  Place,
  WeightClass,
  Actor,
} from '../../../shared/src/index.ts';
import {
  CATEGORIES,
  HANDLING_FLAGS,
  HANDOVER_METHODS,
  ORDER_STATUS_LABELS,
  PACKAGE_SIZES,
  PAYMENT_METHODS,
  WEIGHT_CLASSES,
  canTransition,
  refundFor,
} from '../../../shared/src/index.ts';
import type { Db } from '../db/database.ts';
import type { Hub } from '../realtime/hub.ts';
import { Router } from '../http/router.ts';
import { badRequest, conflict, forbidden, notFound } from '../http/errors.ts';
import { parse, shapes, v } from '../http/validate.ts';
import { handoverCode, newId, nowIso, orderCode, parseJson } from '../lib/util.ts';
import type { UserRow, UsersService } from './users.ts';
import { toPublicUser } from './users.ts';
import type { TripOrderHooks, TripRow, TripsService } from './trips.ts';
import type { NotificationsService } from './notifications.ts';
import { evaluateTrip, placeToLatLng } from './tripMatch.ts';

// ─── Rows ───────────────────────────────────────────────────────────────────

export interface OrderRow {
  id: string;
  code: string;
  sender_id: string;
  driver_id: string | null;
  trip_id: string | null;
  status: OrderStatus;
  category: Category;
  size: PackageSize;
  weight_class: WeightClass;
  handling_json: string;
  photo_url: string | null;
  notes: string;
  pickup_json: string;
  dropoff_json: string;
  recipient_name: string;
  recipient_phone: string;
  deliver_by: string | null;
  handover_method: HandoverMethod;
  fee: number | null;
  service_fee: number | null;
  total: number | null;
  detour_km: number | null;
  eta_pickup_at: string | null;
  eta_dropoff_at: string | null;
  payment_method: PaymentMethod | null;
  payment_status: PaymentStatus;
  refund_amount: number;
  handover_code: string;
  pickup_photo_url: string | null;
  delivery_photo_url: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface EventRow {
  order_id: string;
  status: OrderStatus;
  note: string | null;
  created_at: string;
}

const ACTIVE = ['accepted', 'picked_up', 'in_transit', 'arrived'] as const;
const inList = (xs: readonly string[]) => xs.map((x) => `'${x}'`).join(',');

/** Fields cleared when an order loses its driver (declined, withdrawn, trip cancelled). */
const DETACH: Partial<OrderRow> = {
  driver_id: null,
  trip_id: null,
  fee: null,
  service_fee: null,
  total: null,
  detour_km: null,
  eta_pickup_at: null,
  eta_dropoff_at: null,
};

// ─── Validation ─────────────────────────────────────────────────────────────

const createBody = v.object({
  category: v.enum(CATEGORIES),
  size: v.enum(PACKAGE_SIZES),
  weightClass: v.default(v.enum(WEIGHT_CLASSES), 'lt1'),
  handling: v.default(v.array(v.enum(HANDLING_FLAGS), { max: HANDLING_FLAGS.length }), []),
  photoUrl: v.optional(v.string({ max: 500 })),
  notes: v.default(v.string({ max: 500 }), ''),
  pickup: shapes.place,
  dropoff: shapes.place,
  recipient: v.object({ name: v.string({ min: 1, max: 80 }), phone: shapes.phone }),
  deliverBy: v.optional(v.datetime()),
  handoverMethod: v.default(v.enum(HANDOVER_METHODS), 'meet'),
  paymentMethod: v.optional(v.enum(PAYMENT_METHODS)),
  /** Send straight to this driver's trip (S4). Omit to post an open request (S6). */
  tripId: v.optional(v.string({ min: 1 })),
});

// ─── Service ────────────────────────────────────────────────────────────────

export function ordersService(
  db: Db,
  hub: Hub,
  users: UsersService,
  trips: TripsService,
  notifications: NotificationsService,
) {
  const tripRepo = trips.repo;

  const getRow = (id: string) => db.get<OrderRow>('SELECT * FROM orders WHERE id = ?', [id]);

  async function requireRow(id: string): Promise<OrderRow> {
    const o = await getRow(id);
    if (!o) throw notFound('Pesanan');
    return o;
  }

  /** Sender, assigned driver, or (for open requests) any signed-in driver may view. */
  async function requireViewable(id: string, userId: string): Promise<OrderRow> {
    const o = await requireRow(id);
    if (o.sender_id === userId || o.driver_id === userId || o.status === 'open') return o;
    throw forbidden();
  }

  // ── Serialisation ──

  async function toDtos(rows: OrderRow[], viewerId: string): Promise<Order[]> {
    if (rows.length === 0) return [];
    const people = await users.repo.byIds(rows.flatMap((r) => [r.sender_id, r.driver_id]));
    const ids = rows.map((r) => r.id);
    const events = await db.all<EventRow>(
      `SELECT order_id, status, note, created_at FROM order_events WHERE order_id IN (${ids.map(() => '?').join(',')})
        ORDER BY created_at, rowid`,
      ids,
    );
    const byOrder = new Map<string, EventRow[]>();
    for (const e of events) {
      const list = byOrder.get(e.order_id) ?? [];
      list.push(e);
      byOrder.set(e.order_id, list);
    }
    return rows.map((r) => toDto(r, viewerId, people, byOrder.get(r.id) ?? []));
  }

  const toOne = async (row: OrderRow, viewerId: string) => (await toDtos([row], viewerId))[0];

  // ── State changes ──

  /**
   * The only way an order's status changes. Validates against the state machine in
   * shared/src/orderFlow.ts, guards against two people acting at once, and logs the timeline.
   */
  async function move(
    tx: Db,
    order: OrderRow,
    to: OrderStatus,
    actor: Actor,
    actorId: string | null,
    patch: Partial<OrderRow> = {},
    note?: string,
  ): Promise<OrderRow> {
    if (!canTransition(order.status, to, actor)) {
      throw conflict(`Pesanan berstatus "${ORDER_STATUS_LABELS[order.status]}" tidak bisa diubah ke "${ORDER_STATUS_LABELS[to]}"`, {
        from: order.status,
        to,
      });
    }
    const now = nowIso();
    const fields = { ...patch, status: to, updated_at: now };
    const keys = Object.keys(fields);
    const res = await tx.run(
      `UPDATE orders SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ? AND status = ?`,
      [...keys.map((k) => (fields as Record<string, string | number | null>)[k]), order.id, order.status],
    );
    if (res.changes === 0) throw conflict('Pesanan baru saja diubah orang lain, muat ulang lalu coba lagi');
    await tx.run('INSERT INTO order_events (id, order_id, status, actor_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
      newId(), order.id, to, actorId, note ?? null, now,
    ]);
    return { ...order, ...fields } as OrderRow;
  }

  /** After a committed change: push the new state to everyone involved. */
  async function broadcast(order: OrderRow, extraUserIds: (string | null)[] = []) {
    const audience = [order.sender_id, order.driver_id, ...extraUserIds];
    for (const uid of new Set(audience)) {
      if (!uid) continue;
      hub.publish([uid], { type: 'order.updated', order: await toOne(order, uid) });
    }
  }

  async function requireTrip(tripId: string): Promise<TripRow> {
    const t = await tripRepo.byId(tripId);
    if (!t) throw notFound('Rute');
    return t;
  }

  /** Re-checks a trip against an order and returns the price/ETA fields to store. */
  async function priceOnTrip(tx: Db, order: OrderRow, trip: TripRow): Promise<Partial<OrderRow>> {
    const slots = await trips.repo.slotsUsed(trip.id);
    const evaluation = evaluateTrip(trip, slots, {
      size: order.size,
      pickup: placeToLatLng(JSON.parse(order.pickup_json)),
      dropoff: placeToLatLng(JSON.parse(order.dropoff_json)),
      deliverBy: order.deliver_by,
    });
    void tx;
    if (!evaluation.ok) throw conflict(`Rute ini tidak cocok: ${evaluation.reason}`, { reason: evaluation.reason });
    const m = evaluation.match;
    return {
      trip_id: trip.id,
      driver_id: trip.driver_id,
      fee: m.price.fee,
      service_fee: m.price.serviceFee,
      total: m.price.total,
      detour_km: m.detourKm,
      eta_pickup_at: m.eta.pickupAt,
      eta_dropoff_at: m.eta.dropoffAt,
    };
  }

  /** Refund fields when a paid order is cancelled/expired (S7). */
  function refundPatch(order: OrderRow): Partial<OrderRow> {
    if (order.payment_status !== 'paid' || !order.total) return {};
    const { refund } = refundFor(order.total, order.status === 'accepted');
    return { refund_amount: refund, payment_status: refund === order.total ? 'refunded' : 'partially_refunded' };
  }

  const svc = {
    requireViewable,
    toDtos,

    async create(senderId: string, input: unknown) {
      const body = parse(input, createBody);
      const sender = await users.requireUser(senderId);
      if (body.deliverBy && body.deliverBy <= nowIso()) throw badRequest('Batas waktu harus di masa depan', { field: 'deliverBy' });

      const now = nowIso();
      let row: OrderRow = {
        id: newId(),
        code: orderCode(),
        sender_id: sender.id,
        driver_id: null,
        trip_id: null,
        status: 'open',
        category: body.category,
        size: body.size,
        weight_class: body.weightClass,
        handling_json: JSON.stringify(body.handling),
        photo_url: body.photoUrl ?? null,
        notes: body.notes,
        pickup_json: JSON.stringify(body.pickup),
        dropoff_json: JSON.stringify(body.dropoff),
        recipient_name: body.recipient.name,
        recipient_phone: body.recipient.phone,
        deliver_by: body.deliverBy ?? null,
        handover_method: body.handoverMethod,
        fee: null,
        service_fee: null,
        total: null,
        detour_km: null,
        eta_pickup_at: null,
        eta_dropoff_at: null,
        payment_method: body.paymentMethod ?? null,
        payment_status: 'unpaid',
        refund_amount: 0,
        handover_code: handoverCode(),
        pickup_photo_url: null,
        delivery_photo_url: null,
        cancel_reason: null,
        created_at: now,
        updated_at: now,
      };

      row = await db.transaction(async (tx) => {
        const cols = Object.keys(row);
        await tx.run(`INSERT INTO orders (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, Object.values(row) as (string | number | null)[]);
        await tx.run('INSERT INTO order_events (id, order_id, status, actor_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
          newId(), row.id, 'open', senderId, null, now,
        ]);
        if (!body.tripId) return row;
        const trip = await requireTrip(body.tripId);
        if (trip.driver_id === senderId) throw badRequest('Tidak bisa mengirim ke rute sendiri');
        return move(tx, row, 'requested', 'sender', senderId, await priceOnTrip(tx, row, trip));
      });

      if (row.status === 'requested') {
        await notifications.notify(row.driver_id, 'order.requested', 'Permintaan titipan baru',
          `${sender.name} ingin menitip ${row.category} (${row.size})`, { orderId: row.id, tripId: row.trip_id });
      }
      await broadcast(row);
      return toOne(row, senderId);
    },

    /** "Aktivitas" (O4). as = sender | driver, scope = active | history | all. */
    async list(userId: string, as: string | null, scope: string | null) {
      const column = as === 'driver' ? 'driver_id' : 'sender_id';
      const statusFilter =
        scope === 'history'
          ? `AND status IN ('delivered','cancelled','expired')`
          : scope === 'all'
            ? ''
            : `AND status NOT IN ('delivered','cancelled','expired')`;
      const rows = await db.all<OrderRow>(
        `SELECT * FROM orders WHERE ${column} = ? ${statusFilter} ORDER BY updated_at DESC LIMIT 100`,
        [userId],
      );
      return toDtos(rows, userId);
    },

    async get(userId: string, orderId: string) {
      return toOne(await requireViewable(orderId, userId), userId);
    },

    /** Sender sends an open/declined order to a specific trip (S3 → S4). */
    async requestTrip(senderId: string, orderId: string, input: unknown) {
      const { tripId } = parse(input, v.object({ tripId: v.string({ min: 1 }) }));
      const order = await requireRow(orderId);
      if (order.sender_id !== senderId) throw forbidden();
      const trip = await requireTrip(tripId);
      if (trip.driver_id === senderId) throw badRequest('Tidak bisa mengirim ke rute sendiri');
      const updated = await db.transaction(async (tx) => move(tx, order, 'requested', 'sender', senderId, await priceOnTrip(tx, order, trip)));
      const sender = await users.requireUser(senderId);
      await notifications.notify(trip.driver_id, 'order.requested', 'Permintaan titipan baru',
        `${sender.name} ingin menitip ${order.category} (${order.size})`, { orderId, tripId });
      await broadcast(updated);
      return toOne(updated, senderId);
    },

    /** Sender withdraws a request and posts it publicly instead (S6). */
    async postOpen(senderId: string, orderId: string) {
      const order = await requireRow(orderId);
      if (order.sender_id !== senderId) throw forbidden();
      const previousDriver = order.driver_id;
      const updated = await db.transaction((tx) => move(tx, order, 'open', 'sender', senderId, DETACH));
      await broadcast(updated, [previousDriver]);
      return toOne(updated, senderId);
    },

    /** Driver accepts (D4 "Terima"). For open requests, `tripId` says which of their trips takes it. */
    async accept(driverId: string, orderId: string, input: unknown) {
      const body = parse(input, v.object({ tripId: v.optional(v.string({ min: 1 })) }));
      const order = await requireRow(orderId);
      if (order.sender_id === driverId) throw badRequest('Tidak bisa menerima paket sendiri');
      const tripId = order.status === 'requested' ? order.trip_id : body.tripId;
      if (!tripId) throw badRequest('Pilih rute untuk paket ini', { field: 'tripId' });
      const trip = await requireTrip(tripId);
      if (trip.driver_id !== driverId) throw forbidden('Permintaan ini bukan untuk rute kamu');

      const updated = await db.transaction(async (tx) => {
        const fresh = (await tx.get<OrderRow>('SELECT * FROM orders WHERE id = ?', [orderId]))!;
        // A requested order keeps the price the sender already saw; an open one is priced now.
        const patch = fresh.status === 'requested' ? { trip_id: trip.id, driver_id: driverId } : await priceOnTrip(tx, fresh, trip);
        if ((await trips.repo.slotsUsed(trip.id)) >= trip.max_packages) throw conflict('Slot rute ini sudah penuh');
        return move(tx, fresh, 'accepted', 'driver', driverId, patch);
      });
      const driver = await users.requireUser(driverId);
      await notifications.notify(order.sender_id, 'order.accepted', 'Driver menerima titipanmu',
        `${driver.name} akan menjemput paketmu`, { orderId });
      await broadcast(updated);
      return toOne(updated, driverId);
    },

    /** Driver declines a request sent to their trip (D4 "Tolak"). */
    async decline(driverId: string, orderId: string, input: unknown) {
      const { reason } = parse(input, v.object({ reason: v.optional(v.string({ max: 200 })) }));
      const order = await requireRow(orderId);
      if (order.driver_id !== driverId) throw forbidden('Permintaan ini bukan untuk rute kamu');
      const driver = await users.requireUser(driverId);
      const updated = await db.transaction((tx) =>
        move(tx, order, 'declined', 'driver', driverId, DETACH, reason ?? `Ditolak oleh ${driver.name}`),
      );
      await notifications.notify(order.sender_id, 'order.declined', 'Driver tidak bisa membawa titipanmu',
        'Pilih driver lain atau posting permintaan terbuka', { orderId });
      await broadcast(updated, [driverId]);
      return toOne(updated, driverId);
    },

    /** Driver drops an accepted order before pickup; it goes back to the open pool. */
    async withdraw(driverId: string, orderId: string, input: unknown) {
      const { reason } = parse(input, v.object({ reason: v.default(v.string({ max: 200 }), 'Driver batal membawa') }));
      const order = await requireRow(orderId);
      if (order.driver_id !== driverId) throw forbidden();
      const updated = await db.transaction((tx) => move(tx, order, 'open', 'driver', driverId, DETACH, reason));
      await notifications.notify(order.sender_id, 'order.reopened', 'Driver membatalkan',
        'Pesananmu kembali mencari driver searah', { orderId });
      await broadcast(updated, [driverId]);
      return toOne(updated, driverId);
    },

    /** Sender cancels (S7). Free before a driver accepts; after that the driver keeps a small compensation. */
    async cancel(senderId: string, orderId: string, input: unknown) {
      const { reason } = parse(input, v.object({ reason: v.default(v.string({ max: 200 }), 'Dibatalkan pengirim') }));
      const order = await requireRow(orderId);
      if (order.sender_id !== senderId) throw forbidden();
      if (!['open', 'requested', 'declined', 'accepted'].includes(order.status)) {
        throw conflict('Paket sudah dijemput. Gunakan "Laporkan masalah" untuk sengketa.');
      }
      const updated = await db.transaction((tx) =>
        move(tx, order, 'cancelled', 'sender', senderId, { ...refundPatch(order), cancel_reason: reason }, reason),
      );
      if (order.driver_id) {
        await notifications.notify(order.driver_id, 'order.cancelled', 'Titipan dibatalkan', `${order.code}: ${reason}`, { orderId });
      }
      await broadcast(updated, [order.driver_id]);
      return toOne(updated, senderId);
    },

    /** Mock payment (P1–P6): marks the order paid. Swap for Midtrans/Xendit sandbox later. */
    async pay(senderId: string, orderId: string, input: unknown) {
      const { method } = parse(input, v.object({ method: v.enum(PAYMENT_METHODS) }));
      const order = await requireRow(orderId);
      if (order.sender_id !== senderId) throw forbidden();
      if (order.payment_status !== 'unpaid') throw conflict('Pesanan ini sudah dibayar');
      if (['cancelled', 'expired'].includes(order.status)) throw conflict('Pesanan sudah tidak aktif');
      if (!order.total) throw conflict('Harga belum ditentukan, tunggu driver menerima');
      await db.run(`UPDATE orders SET payment_method = ?, payment_status = 'paid', updated_at = ? WHERE id = ?`, [method, nowIso(), orderId]);
      const updated = await requireRow(orderId);
      await broadcast(updated);
      return toOne(updated, senderId);
    },

    /** Driver picked the package up (D5 → X2 at pickup). */
    async pickup(driverId: string, orderId: string, input: unknown) {
      const { photoUrl } = parse(input, v.object({ photoUrl: v.optional(v.string({ max: 500 })) }));
      const order = await requireRow(orderId);
      if (order.driver_id !== driverId) throw forbidden();
      const trip = order.trip_id ? await tripRepo.byId(order.trip_id) : null;
      const updated = await db.transaction(async (tx) => {
        let o = await move(tx, order, 'picked_up', 'driver', driverId, { pickup_photo_url: photoUrl ?? null });
        // If the trip is already under way the package is immediately "Jalan".
        if (trip?.status === 'ongoing') o = await move(tx, o, 'in_transit', 'driver', driverId);
        return o;
      });
      await notifications.notify(order.sender_id, 'order.picked_up', 'Paket sudah dijemput', `${order.code} sedang dibawa driver`, { orderId });
      await broadcast(updated);
      return toOne(updated, driverId);
    },

    async arrive(driverId: string, orderId: string) {
      const order = await requireRow(orderId);
      if (order.driver_id !== driverId) throw forbidden();
      const updated = await db.transaction((tx) => move(tx, order, 'arrived', 'driver', driverId));
      await notifications.notify(order.sender_id, 'order.arrived', 'Driver sudah tiba di tujuan',
        `Berikan kode serah terima kepada ${order.recipient_name}`, { orderId });
      await broadcast(updated);
      return toOne(updated, driverId);
    },

    /** Handover at drop-off (X2): driver enters the recipient's 4-digit code. */
    async deliver(driverId: string, orderId: string, input: unknown) {
      const body = parse(input, v.object({ code: v.string({ min: 4, max: 4 }), photoUrl: v.optional(v.string({ max: 500 })) }));
      const order = await requireRow(orderId);
      if (order.driver_id !== driverId) throw forbidden();
      if (body.code !== order.handover_code) throw badRequest('Kode serah terima salah', { field: 'code' });
      if (order.handover_method === 'leave_at_location' && !body.photoUrl) {
        throw badRequest('Foto bukti wajib untuk "Titip di lokasi"', { field: 'photoUrl' });
      }
      const updated = await db.transaction(async (tx) => {
        let o = order;
        if (o.status === 'picked_up' || o.status === 'in_transit') o = await move(tx, o, 'arrived', 'driver', driverId);
        const payment: Partial<OrderRow> = o.payment_method === 'cash' || !o.payment_method ? { payment_status: 'paid', payment_method: 'cash' } : {};
        o = await move(tx, o, 'delivered', 'driver', driverId, { delivery_photo_url: body.photoUrl ?? null, ...(o.payment_status === 'unpaid' ? payment : {}) });
        await tx.run('UPDATE users SET deliveries_count = deliveries_count + 1 WHERE id = ?', [driverId]);
        await tx.run('UPDATE users SET sends_count = sends_count + 1 WHERE id = ?', [o.sender_id]);
        return o;
      });
      await notifications.notify(order.sender_id, 'order.delivered', 'Paket sudah diterima',
        `${order.code} telah diserahkan. Beri rating untuk driver!`, { orderId });
      await broadcast(updated);
      return toOne(updated, driverId);
    },

    /** D3 inbox: requests sent to this trip, plus open requests that fit it. */
    async incoming(driverId: string, tripId: string): Promise<IncomingRequest[]> {
      const trip = await requireTrip(tripId);
      if (trip.driver_id !== driverId) throw forbidden('Ini bukan rute kamu');
      const slots = await trips.repo.slotsUsed(tripId);
      const requested = await db.all<OrderRow>(`SELECT * FROM orders WHERE trip_id = ? AND status = 'requested' ORDER BY created_at`, [tripId]);
      const open = await db.all<OrderRow>(
        `SELECT * FROM orders WHERE status = 'open' AND sender_id <> ? AND (deliver_by IS NULL OR deliver_by > ?) ORDER BY created_at LIMIT 200`,
        [driverId, nowIso()],
      );

      const out: { row: OrderRow; source: 'requested' | 'open'; match: Exclude<ReturnType<typeof evaluateTrip>, { ok: false }>['match'] }[] = [];
      for (const [rows, source] of [[requested, 'requested'], [open, 'open']] as const) {
        for (const row of rows) {
          // Requested orders were already checked; still evaluate for fresh detour/ETA numbers (ignore slot limit here).
          const e = evaluateTrip(trip, source === 'requested' ? 0 : slots, {
            size: row.size,
            pickup: placeToLatLng(JSON.parse(row.pickup_json)),
            dropoff: placeToLatLng(JSON.parse(row.dropoff_json)),
            deliverBy: row.deliver_by,
          });
          if (e.ok) out.push({ row, source, match: e.match });
          else if (source === 'requested') {
            out.push({ row, source, match: { kind: 'detour', similarity: 0, detourKm: row.detour_km ?? 0, detourMinutes: 0,
              price: { fee: row.fee ?? 0, serviceFee: row.service_fee ?? 0, total: row.total ?? 0 },
              eta: { pickupAt: row.eta_pickup_at ?? '', dropoffAt: row.eta_dropoff_at ?? '' } } });
          }
        }
      }
      const dtos = await toDtos(out.map((x) => x.row), driverId);
      return out
        .map((x, i) => ({
          order: dtos[i],
          source: x.source,
          kind: x.match.kind,
          similarity: x.match.similarity,
          detourKm: x.match.detourKm,
          detourMinutes: x.match.detourMinutes,
          earning: x.source === 'requested' ? (x.row.fee ?? x.match.price.fee) : x.match.price.fee,
        }))
        .sort((a, b) => (a.source === b.source ? (a.kind === b.kind ? b.similarity - a.similarity : a.kind === 'direct' ? -1 : 1) : a.source === 'requested' ? -1 : 1));
    },

    /** D5 "Urutan berhenti": every pickup and drop-off on a trip, in time order. */
    async manifest(driverId: string, tripId: string) {
      const trip = await requireTrip(tripId);
      if (trip.driver_id !== driverId) throw forbidden('Ini bukan rute kamu');
      const rows = await db.all<OrderRow>(
        `SELECT * FROM orders WHERE trip_id = ? AND status IN (${inList([...ACTIVE, 'delivered'])}) ORDER BY eta_pickup_at`,
        [tripId],
      );
      const orders = await toDtos(rows, driverId);
      type Stop = { kind: 'start' | 'pickup' | 'dropoff' | 'end'; at: string; place: Place; orderId?: string; done: boolean };
      const stops: Stop[] = [];
      const doneAfterPickup: OrderStatus[] = ['picked_up', 'in_transit', 'arrived', 'delivered'];
      for (const o of orders) {
        stops.push({ kind: 'pickup', at: o.eta.pickupAt ?? trip.depart_at, place: o.pickup, orderId: o.id, done: doneAfterPickup.includes(o.status) });
        stops.push({ kind: 'dropoff', at: o.eta.dropoffAt ?? trip.arrive_at, place: o.dropoff, orderId: o.id, done: o.status === 'delivered' });
      }
      stops.sort((a, b) => a.at.localeCompare(b.at));
      const dto = await trips.toDto(trip);
      return {
        trip: dto,
        stops: [
          { kind: 'start', at: trip.depart_at, place: dto.origin, done: trip.status !== 'published' } as Stop,
          ...stops,
          { kind: 'end', at: trip.arrive_at, place: dto.destination, done: trip.status === 'completed' } as Stop,
        ],
        orders,
      };
    },

    /** Background job: requests whose deadline passed without a driver. */
    async expireOverdue(): Promise<number> {
      const rows = await db.all<OrderRow>(
        `SELECT * FROM orders WHERE status IN ('open','requested','declined') AND deliver_by IS NOT NULL AND deliver_by < ?`,
        [nowIso()],
      );
      for (const row of rows) {
        try {
          const updated = await db.transaction((tx) => move(tx, row, 'expired', 'system', null, { ...refundPatch(row), ...DETACH }));
          await notifications.notify(row.sender_id, 'order.expired', 'Belum ada driver searah',
            `${row.code} melewati batas waktu dan dibatalkan otomatis`, { orderId: row.id });
          await broadcast(updated, [row.driver_id]);
        } catch {
          // Someone acted on it at the same moment; it will be re-checked next run.
        }
      }
      return rows.length;
    },
  };

  /** Hooks the trips service calls (start / cancel / complete / location). */
  const tripHooks: TripOrderHooks = {
    async onTripStarted(trip) {
      const rows = await db.all<OrderRow>(`SELECT * FROM orders WHERE trip_id = ? AND status = 'picked_up'`, [trip.id]);
      for (const row of rows) {
        const updated = await db.transaction((tx) => move(tx, row, 'in_transit', 'driver', trip.driver_id));
        await broadcast(updated);
      }
    },
    async onTripClosed(trip, reason) {
      const rows = await db.all<OrderRow>(`SELECT * FROM orders WHERE trip_id = ? AND status IN ('requested','accepted')`, [trip.id]);
      for (const row of rows) {
        const to: OrderStatus = row.status === 'requested' ? 'declined' : 'open';
        const updated = await db.transaction((tx) => move(tx, row, to, 'driver', trip.driver_id, DETACH, reason));
        await notifications.notify(row.sender_id, 'order.reopened', 'Driver membatalkan perjalanan',
          to === 'open' ? 'Pesananmu kembali mencari driver searah' : 'Pilih driver lain untuk titipanmu', { orderId: row.id });
        await broadcast(updated, [trip.driver_id]);
      }
    },
    async activeOrderCount(tripId) {
      const r = await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM orders WHERE trip_id = ? AND status IN (${inList(ACTIVE)})`, [tripId]);
      return r?.n ?? 0;
    },
    async watchers(tripId) {
      const rows = await db.all<{ sender_id: string }>(
        `SELECT DISTINCT sender_id FROM orders WHERE trip_id = ? AND status IN (${inList(ACTIVE)})`,
        [tripId],
      );
      return rows.map((r) => r.sender_id);
    },
  };

  return { ...svc, tripHooks };
}

export type OrdersService = ReturnType<typeof ordersService>;

function toDto(r: OrderRow, viewerId: string, people: Map<string, UserRow>, events: EventRow[]): Order {
  const sender = people.get(r.sender_id);
  const driver = r.driver_id ? people.get(r.driver_id) : undefined;
  const isSender = viewerId === r.sender_id;
  const canSeeRecipient = isSender || viewerId === r.driver_id;
  return {
    id: r.id,
    code: r.code,
    sender: sender
      ? toPublicUser(sender)
      : { id: r.sender_id, name: 'Pengguna', avatarUrl: null, ratingAvg: null, ratingCount: 0, deliveriesCount: 0, sendsCount: 0, verified: false, vehicle: null },
    driver: driver ? toPublicUser(driver) : null,
    tripId: r.trip_id,
    status: r.status,
    category: r.category,
    size: r.size,
    weightClass: r.weight_class,
    handling: parseJson<HandlingFlag[]>(r.handling_json, []),
    photoUrl: r.photo_url,
    notes: r.notes,
    pickup: parseJson<Place>(r.pickup_json, { label: '', lat: 0, lng: 0 }),
    dropoff: parseJson<Place>(r.dropoff_json, { label: '', lat: 0, lng: 0 }),
    // Drivers browsing open requests don't get the recipient's phone number.
    recipient: canSeeRecipient ? { name: r.recipient_name, phone: r.recipient_phone } : { name: r.recipient_name, phone: '' },
    deliverBy: r.deliver_by,
    handoverMethod: r.handover_method,
    price: r.total !== null && r.fee !== null && r.service_fee !== null ? { fee: r.fee, serviceFee: r.service_fee, total: r.total } : null,
    detourKm: r.detour_km,
    eta: { pickupAt: r.eta_pickup_at, dropoffAt: r.eta_dropoff_at },
    payment: { method: r.payment_method, status: r.payment_status, refundAmount: r.refund_amount },
    ...(isSender ? { handoverCode: r.handover_code } : {}),
    pickupPhotoUrl: r.pickup_photo_url,
    deliveryPhotoUrl: r.delivery_photo_url,
    cancelReason: r.cancel_reason,
    timeline: events.map((e) => ({ status: e.status, at: e.created_at, ...(e.note ? { note: e.note } : {}) })),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ─── Routes ─────────────────────────────────────────────────────────────────

export function ordersRoutes(orders: OrdersService): Router {
  const r = new Router();
  r.post('/orders', async (ctx) => {
    ctx.status = 201;
    return orders.create(ctx.userId(), await ctx.json());
  });
  r.get('/orders', (ctx) => orders.list(ctx.userId(), ctx.query.get('as'), ctx.query.get('scope')));
  r.get('/orders/:id', (ctx) => orders.get(ctx.userId(), ctx.params.id));
  r.post('/orders/:id/request', async (ctx) => orders.requestTrip(ctx.userId(), ctx.params.id, await ctx.json()));
  r.post('/orders/:id/post-open', (ctx) => orders.postOpen(ctx.userId(), ctx.params.id));
  r.post('/orders/:id/accept', async (ctx) => orders.accept(ctx.userId(), ctx.params.id, await ctx.json()));
  r.post('/orders/:id/decline', async (ctx) => orders.decline(ctx.userId(), ctx.params.id, await ctx.json()));
  r.post('/orders/:id/withdraw', async (ctx) => orders.withdraw(ctx.userId(), ctx.params.id, await ctx.json()));
  r.post('/orders/:id/cancel', async (ctx) => orders.cancel(ctx.userId(), ctx.params.id, await ctx.json()));
  r.post('/orders/:id/pay', async (ctx) => orders.pay(ctx.userId(), ctx.params.id, await ctx.json()));
  r.post('/orders/:id/pickup', async (ctx) => orders.pickup(ctx.userId(), ctx.params.id, await ctx.json()));
  r.post('/orders/:id/arrive', (ctx) => orders.arrive(ctx.userId(), ctx.params.id));
  r.post('/orders/:id/deliver', async (ctx) => orders.deliver(ctx.userId(), ctx.params.id, await ctx.json()));
  r.get('/trips/:id/requests', (ctx) => orders.incoming(ctx.userId(), ctx.params.id));
  r.get('/trips/:id/manifest', (ctx) => orders.manifest(ctx.userId(), ctx.params.id));
  return r;
}
