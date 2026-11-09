import type { LatLng, PackageSize, Place, Trip, TripStatus, VehicleType } from '../../../shared/src/index.ts';
import { PACKAGE_SIZES, VEHICLE_SPEED_KMH, VEHICLE_TYPES, minutesFor, pathKm } from '../../../shared/src/index.ts';
import type { Db } from '../db/database.ts';
import type { Hub } from '../realtime/hub.ts';
import { Router } from '../http/router.ts';
import { badRequest, conflict, forbidden, notFound } from '../http/errors.ts';
import { parse, shapes, v } from '../http/validate.ts';
import { addMinutes, newId, nowIso, parseJson } from '../lib/util.ts';
import type { UsersService } from './users.ts';
import { toPublicUser } from './users.ts';

// ─── Rows & serialisers ─────────────────────────────────────────────────────

export interface TripRow {
  id: string;
  driver_id: string;
  name: string;
  origin_json: string;
  stops_json: string;
  destination_json: string;
  depart_at: string;
  arrive_at: string;
  repeat_days_json: string;
  vehicle_type: VehicleType;
  vehicle_plate: string;
  accepted_sizes_json: string;
  max_packages: number;
  max_weight_kg: number | null;
  max_detour_km: number;
  price_min: number | null;
  price_max: number | null;
  status: TripStatus;
  last_lat: number | null;
  last_lng: number | null;
  last_location_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Statuses that occupy one of a trip's package slots. */
export const SLOT_STATUSES = ['accepted', 'picked_up', 'in_transit', 'arrived', 'delivered'];
const SLOT_SQL = SLOT_STATUSES.map((s) => `'${s}'`).join(',');

/** origin → stops → destination, as plain coordinates. */
export function tripPoints(t: TripRow): LatLng[] {
  const origin = JSON.parse(t.origin_json) as Place;
  const stops = JSON.parse(t.stops_json) as Place[];
  const dest = JSON.parse(t.destination_json) as Place;
  return [origin, ...stops, dest].map((p) => ({ lat: p.lat, lng: p.lng }));
}

// ─── Repository ─────────────────────────────────────────────────────────────

export function tripsRepo(db: Db) {
  return {
    byId: (id: string) => db.get<TripRow>('SELECT * FROM trips WHERE id = ?', [id]),
    async slotsUsed(tripId: string): Promise<number> {
      const r = await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM orders WHERE trip_id = ? AND status IN (${SLOT_SQL})`, [tripId]);
      return r?.n ?? 0;
    },
    async slotsUsedMany(tripIds: string[]): Promise<Map<string, number>> {
      if (tripIds.length === 0) return new Map();
      const rows = await db.all<{ trip_id: string; n: number }>(
        `SELECT trip_id, COUNT(*) AS n FROM orders WHERE trip_id IN (${tripIds.map(() => '?').join(',')})
           AND status IN (${SLOT_SQL}) GROUP BY trip_id`,
        tripIds,
      );
      return new Map(rows.map((r) => [r.trip_id, r.n]));
    },
    /** Trips other people could send with: published/ongoing, not finished long ago. */
    activeTrips(excludeDriverId: string | null, departBefore: string | null) {
      const since = new Date(Date.now() - 3 * 3600_000).toISOString();
      return db.all<TripRow>(
        `SELECT * FROM trips
          WHERE status IN ('published', 'ongoing') AND arrive_at >= ?
            AND (? IS NULL OR driver_id <> ?) AND (? IS NULL OR depart_at <= ?)
          ORDER BY depart_at LIMIT 200`,
        [since, excludeDriverId, excludeDriverId, departBefore, departBefore],
      );
    },
    async insert(t: TripRow) {
      const cols = Object.keys(t);
      await db.run(`INSERT INTO trips (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, Object.values(t) as (string | number | null)[]);
    },
    async update(id: string, fields: Partial<TripRow>) {
      const keys = Object.keys(fields).filter((k) => (fields as Record<string, unknown>)[k] !== undefined);
      if (keys.length === 0) return;
      await db.run(`UPDATE trips SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`, [
        ...keys.map((k) => (fields as Record<string, string | number | null>)[k]),
        nowIso(),
        id,
      ]);
    },
  };
}

export type TripsRepo = ReturnType<typeof tripsRepo>;

// ─── Service ────────────────────────────────────────────────────────────────

const priceBand = v.object({ min: v.int({ min: 1000, max: 500_000 }), max: v.int({ min: 1000, max: 500_000 }) });

const tripFields = {
  name: v.string({ min: 1, max: 60 }),
  origin: shapes.place,
  stops: v.default(v.array(shapes.place, { max: 8 }), []),
  destination: shapes.place,
  departAt: v.datetime(),
  /** Optional; estimated from distance and vehicle when omitted. */
  arriveAt: v.optional(v.datetime()),
  repeatDays: v.default(v.array(v.int({ min: 0, max: 6 }), { max: 7 }), []),
  vehicle: v.optional(v.object({ type: v.enum(VEHICLE_TYPES), plate: v.string({ min: 3, max: 15 }) })),
  acceptedSizes: v.default(v.array(v.enum(PACKAGE_SIZES), { min: 1 }), ['XS', 'S'] as PackageSize[]),
  maxPackages: v.default(v.int({ min: 1, max: 20 }), 3),
  maxWeightKg: v.optional(v.number({ min: 0.1, max: 100 })),
  maxDetourKm: v.default(v.number({ min: 0, max: 10 }), 2),
  /** null/omitted = "Harga otomatis". */
  priceBand: v.nullable(priceBand),
};

const createBody = v.object(tripFields);
const updateBody = v.object({
  name: v.optional(tripFields.name),
  stops: v.optional(v.array(shapes.place, { max: 8 })),
  departAt: v.optional(v.datetime()),
  arriveAt: v.optional(v.datetime()),
  repeatDays: v.optional(v.array(v.int({ min: 0, max: 6 }), { max: 7 })),
  acceptedSizes: v.optional(v.array(v.enum(PACKAGE_SIZES), { min: 1 })),
  maxPackages: v.optional(v.int({ min: 1, max: 20 })),
  maxWeightKg: v.nullable(v.number({ min: 0.1, max: 100 })),
  maxDetourKm: v.optional(v.number({ min: 0, max: 10 })),
  priceBand: v.nullable(priceBand),
});
const locationBody = v.object({ lat: v.number({ min: -90, max: 90 }), lng: v.number({ min: -180, max: 180 }) });

/** Implemented by the orders service; lets trip actions cascade to their orders. */
export interface TripOrderHooks {
  onTripStarted(trip: TripRow): Promise<void>;
  /** Called when a trip is cancelled or completed: pending requests are declined, unpicked orders reopened. */
  onTripClosed(trip: TripRow, reason: string): Promise<void>;
  activeOrderCount(tripId: string): Promise<number>;
  /** User ids that should receive this trip's live location (senders with active orders). */
  watchers(tripId: string): Promise<string[]>;
}

export function tripsService(db: Db, hub: Hub, users: UsersService, hooks: () => TripOrderHooks) {
  const repo = tripsRepo(db);

  async function toDto(t: TripRow, slotsUsed?: number): Promise<Trip> {
    const driver = await users.repo.byId(t.driver_id);
    return toTripDto(t, driver ? toPublicUser(driver) : null, slotsUsed ?? (await repo.slotsUsed(t.id)));
  }

  async function ownTrip(tripId: string, driverId: string): Promise<TripRow> {
    const t = await repo.byId(tripId);
    if (!t) throw notFound('Rute');
    if (t.driver_id !== driverId) throw forbidden('Ini bukan rute kamu');
    return t;
  }

  return {
    repo,
    toDto,

    async create(driverId: string, input: unknown) {
      const body = parse(input, createBody);
      const me = await users.requireUser(driverId);
      const vehicle = body.vehicle ?? (me.vehicle_type && me.vehicle_plate ? { type: me.vehicle_type, plate: me.vehicle_plate } : null);
      if (!vehicle) throw badRequest('Isi kendaraan dan plat nomor', { field: 'vehicle' });
      if (body.priceBand && body.priceBand.min > body.priceBand.max) throw badRequest('Harga minimum lebih besar dari maksimum');

      // Remember the vehicle on the profile so D2 is pre-filled next time.
      if (!me.vehicle_type) await users.repo.update(driverId, { vehicle_type: vehicle.type, vehicle_plate: vehicle.plate });

      const points = [body.origin, ...body.stops, body.destination];
      const arriveAt = body.arriveAt ?? addMinutes(body.departAt, minutesFor(pathKm(points), VEHICLE_SPEED_KMH[vehicle.type]));
      if (arriveAt <= body.departAt) throw badRequest('Waktu tiba harus setelah waktu berangkat', { field: 'arriveAt' });

      const now = nowIso();
      const row: TripRow = {
        id: newId(),
        driver_id: driverId,
        name: body.name,
        origin_json: JSON.stringify(body.origin),
        stops_json: JSON.stringify(body.stops),
        destination_json: JSON.stringify(body.destination),
        depart_at: body.departAt,
        arrive_at: arriveAt,
        repeat_days_json: JSON.stringify(body.repeatDays),
        vehicle_type: vehicle.type,
        vehicle_plate: vehicle.plate,
        accepted_sizes_json: JSON.stringify(body.acceptedSizes),
        max_packages: body.maxPackages,
        max_weight_kg: body.maxWeightKg ?? null,
        max_detour_km: body.maxDetourKm,
        price_min: body.priceBand?.min ?? null,
        price_max: body.priceBand?.max ?? null,
        status: 'published',
        last_lat: null,
        last_lng: null,
        last_location_at: null,
        created_at: now,
        updated_at: now,
      };
      await repo.insert(row);
      return toDto(row, 0);
    },

    /** D6 "Rute Saya". scope: active (published/ongoing) | history. */
    async listMine(driverId: string, scope: string | null) {
      const statuses = scope === 'history' ? ['completed', 'cancelled'] : ['published', 'ongoing'];
      const rows = await db.all<TripRow>(
        `SELECT * FROM trips WHERE driver_id = ? AND status IN (${statuses.map(() => '?').join(',')})
          ORDER BY depart_at ${scope === 'history' ? 'DESC' : 'ASC'} LIMIT 100`,
        [driverId, ...statuses],
      );
      const slots = await repo.slotsUsedMany(rows.map((r) => r.id));
      return Promise.all(rows.map((r) => toDto(r, slots.get(r.id) ?? 0)));
    },

    async get(tripId: string) {
      const t = await repo.byId(tripId);
      if (!t) throw notFound('Rute');
      return toDto(t);
    },

    /** D7 edit. Route geometry can't change once packages are accepted (stops only). */
    async update(driverId: string, tripId: string, input: unknown) {
      const body = parse(input, updateBody);
      const t = await ownTrip(tripId, driverId);
      if (t.status !== 'published') throw conflict('Rute yang sudah berjalan atau selesai tidak bisa diubah');
      if (body.maxPackages !== undefined && body.maxPackages < (await repo.slotsUsed(tripId))) {
        throw conflict('Kapasitas lebih kecil dari paket yang sudah diterima');
      }
      if (body.stops && (await hooks().activeOrderCount(tripId)) > 0) {
        throw conflict('Titik singgah tidak bisa diubah setelah ada paket diterima');
      }
      const band = body.priceBand;
      if (band && band.min > band.max) throw badRequest('Harga minimum lebih besar dari maksimum');
      await repo.update(tripId, {
        name: body.name,
        stops_json: body.stops ? JSON.stringify(body.stops) : undefined,
        depart_at: body.departAt,
        arrive_at: body.arriveAt,
        repeat_days_json: body.repeatDays ? JSON.stringify(body.repeatDays) : undefined,
        accepted_sizes_json: body.acceptedSizes ? JSON.stringify(body.acceptedSizes) : undefined,
        max_packages: body.maxPackages,
        max_weight_kg: body.maxWeightKg,
        max_detour_km: body.maxDetourKm,
        price_min: band === null ? null : band?.min,
        price_max: band === null ? null : band?.max,
      });
      return toDto((await repo.byId(tripId))!);
    },

    async start(driverId: string, tripId: string) {
      const t = await ownTrip(tripId, driverId);
      if (t.status !== 'published') throw conflict('Rute ini tidak bisa dimulai');
      await repo.update(tripId, { status: 'ongoing' });
      const updated = (await repo.byId(tripId))!;
      await hooks().onTripStarted(updated);
      return toDto(updated);
    },

    async complete(driverId: string, tripId: string) {
      const t = await ownTrip(tripId, driverId);
      if (t.status !== 'ongoing' && t.status !== 'published') throw conflict('Rute ini sudah selesai');
      const active = await hooks().activeOrderCount(tripId);
      if (active > 0) throw conflict(`Masih ada ${active} paket yang belum selesai diantar`);
      await repo.update(tripId, { status: 'completed' });
      const updated = (await repo.byId(tripId))!;
      await hooks().onTripClosed(updated, 'Perjalanan driver sudah selesai');
      return toDto(updated);
    },

    /** D8. Accepted-but-not-picked-up packages go back to the open pool; senders are notified. */
    async cancel(driverId: string, tripId: string, input: unknown) {
      const { reason } = parse(input, v.object({ reason: v.default(v.string({ max: 200 }), 'Driver membatalkan perjalanan') }));
      const t = await ownTrip(tripId, driverId);
      if (t.status !== 'published' && t.status !== 'ongoing') throw conflict('Rute ini sudah selesai');
      const carrying = await db.get<{ n: number }>(
        `SELECT COUNT(*) AS n FROM orders WHERE trip_id = ? AND status IN ('picked_up','in_transit','arrived')`,
        [tripId],
      );
      if ((carrying?.n ?? 0) > 0) throw conflict('Antar dulu paket yang sudah dijemput sebelum membatalkan');
      await repo.update(tripId, { status: 'cancelled' });
      const updated = (await repo.byId(tripId))!;
      await hooks().onTripClosed(updated, reason);
      return toDto(updated);
    },

    /** Driver app posts GPS every ~10 s while a trip is ongoing; senders see it on S5. */
    async updateLocation(driverId: string, tripId: string, input: unknown) {
      const { lat, lng } = parse(input, locationBody);
      const t = await ownTrip(tripId, driverId);
      if (t.status !== 'ongoing') throw conflict('Mulai perjalanan dulu sebelum mengirim lokasi');
      const at = nowIso();
      await repo.update(tripId, { last_lat: lat, last_lng: lng, last_location_at: at });
      hub.publish(await hooks().watchers(tripId), { type: 'trip.location', tripId, lat, lng, at });
      return { ok: true };
    },
  };
}

export type TripsService = ReturnType<typeof tripsService>;

export function toTripDto(t: TripRow, driver: Trip['driver'] | null, slotsUsed: number): Trip {
  return {
    id: t.id,
    driver: driver ?? {
      id: t.driver_id, name: 'Pengguna', avatarUrl: null, ratingAvg: null, ratingCount: 0,
      deliveriesCount: 0, sendsCount: 0, verified: false, vehicle: null,
    },
    name: t.name,
    origin: parseJson<Place>(t.origin_json, { label: '', lat: 0, lng: 0 }),
    stops: parseJson<Place[]>(t.stops_json, []),
    destination: parseJson<Place>(t.destination_json, { label: '', lat: 0, lng: 0 }),
    departAt: t.depart_at,
    arriveAt: t.arrive_at,
    repeatDays: parseJson<number[]>(t.repeat_days_json, []),
    vehicle: { type: t.vehicle_type, plate: t.vehicle_plate },
    acceptedSizes: parseJson<PackageSize[]>(t.accepted_sizes_json, []),
    maxPackages: t.max_packages,
    maxWeightKg: t.max_weight_kg,
    maxDetourKm: t.max_detour_km,
    priceBand: t.price_min !== null && t.price_max !== null ? { min: t.price_min, max: t.price_max } : null,
    status: t.status,
    slotsUsed,
    lastLocation:
      t.last_lat !== null && t.last_lng !== null && t.last_location_at
        ? { lat: t.last_lat, lng: t.last_lng, at: t.last_location_at }
        : null,
    createdAt: t.created_at,
  };
}

// ─── Routes ─────────────────────────────────────────────────────────────────

export function tripsRoutes(trips: TripsService): Router {
  const r = new Router();
  r.post('/trips', async (ctx) => {
    ctx.status = 201;
    return trips.create(ctx.userId(), await ctx.json());
  });
  r.get('/trips/mine', (ctx) => trips.listMine(ctx.userId(), ctx.query.get('scope')));
  r.get('/trips/:id', (ctx) => {
    ctx.userId();
    return trips.get(ctx.params.id);
  });
  r.patch('/trips/:id', async (ctx) => trips.update(ctx.userId(), ctx.params.id, await ctx.json()));
  r.post('/trips/:id/start', (ctx) => trips.start(ctx.userId(), ctx.params.id));
  r.post('/trips/:id/complete', (ctx) => trips.complete(ctx.userId(), ctx.params.id));
  r.post('/trips/:id/cancel', async (ctx) => trips.cancel(ctx.userId(), ctx.params.id, await ctx.json()));
  r.post('/trips/:id/location', async (ctx) => trips.updateLocation(ctx.userId(), ctx.params.id, await ctx.json()));
  return r;
}
