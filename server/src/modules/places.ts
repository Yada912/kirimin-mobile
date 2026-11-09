import type { SavedPlace, SavedPlaceKind } from '../../../shared/src/index.ts';
import { SAVED_PLACE_KINDS } from '../../../shared/src/index.ts';
import type { Db } from '../db/database.ts';
import { Router } from '../http/router.ts';
import { conflict, notFound } from '../http/errors.ts';
import { parse, v } from '../http/validate.ts';
import { newId, nowIso } from '../lib/util.ts';

/** "Alamat tersimpan": quick picks for pickup/drop-off (S2) and route points (D1). */

interface PlaceRow {
  id: string;
  user_id: string;
  kind: SavedPlaceKind;
  label: string;
  address: string | null;
  lat: number;
  lng: number;
  created_at: string;
  updated_at: string;
}

const toDto = (r: PlaceRow): SavedPlace => ({
  id: r.id,
  kind: r.kind,
  label: r.label,
  ...(r.address ? { address: r.address } : {}),
  lat: r.lat,
  lng: r.lng,
  createdAt: r.created_at,
});

const MAX_PLACES = 20;

const createBody = v.object({
  kind: v.default(v.enum(SAVED_PLACE_KINDS), 'other'),
  label: v.string({ min: 1, max: 120 }),
  address: v.optional(v.string({ max: 300 })),
  lat: v.number({ min: -90, max: 90 }),
  lng: v.number({ min: -180, max: 180 }),
});
const updateBody = v.object({
  kind: v.optional(v.enum(SAVED_PLACE_KINDS)),
  label: v.optional(v.string({ min: 1, max: 120 })),
  address: v.nullable(v.string({ max: 300 })),
  lat: v.optional(v.number({ min: -90, max: 90 })),
  lng: v.optional(v.number({ min: -180, max: 180 })),
});

export function placesService(db: Db) {
  async function own(userId: string, id: string): Promise<PlaceRow> {
    const row = await db.get<PlaceRow>('SELECT * FROM saved_places WHERE id = ? AND user_id = ?', [id, userId]);
    if (!row) throw notFound('Alamat');
    return row;
  }

  return {
    async list(userId: string) {
      const rows = await db.all<PlaceRow>(
        `SELECT * FROM saved_places WHERE user_id = ?
          ORDER BY CASE kind WHEN 'home' THEN 0 WHEN 'work' THEN 1 WHEN 'campus' THEN 2 ELSE 3 END, created_at`,
        [userId],
      );
      return rows.map(toDto);
    },

    async create(userId: string, input: unknown) {
      const body = parse(input, createBody);
      const count = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM saved_places WHERE user_id = ?', [userId]);
      if ((count?.n ?? 0) >= MAX_PLACES) throw conflict(`Maksimal ${MAX_PLACES} alamat tersimpan`);
      const now = nowIso();
      const row: PlaceRow = {
        id: newId(), user_id: userId, kind: body.kind, label: body.label, address: body.address ?? null,
        lat: body.lat, lng: body.lng, created_at: now, updated_at: now,
      };
      await db.run(
        'INSERT INTO saved_places (id, user_id, kind, label, address, lat, lng, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [row.id, row.user_id, row.kind, row.label, row.address, row.lat, row.lng, row.created_at, row.updated_at],
      );
      return toDto(row);
    },

    async update(userId: string, id: string, input: unknown) {
      const body = parse(input, updateBody);
      const row = await own(userId, id);
      const next: PlaceRow = {
        ...row,
        kind: body.kind ?? row.kind,
        label: body.label ?? row.label,
        address: body.address === null ? null : (body.address ?? row.address),
        lat: body.lat ?? row.lat,
        lng: body.lng ?? row.lng,
        updated_at: nowIso(),
      };
      await db.run('UPDATE saved_places SET kind = ?, label = ?, address = ?, lat = ?, lng = ?, updated_at = ? WHERE id = ?', [
        next.kind, next.label, next.address, next.lat, next.lng, next.updated_at, id,
      ]);
      return toDto(next);
    },

    async remove(userId: string, id: string) {
      await own(userId, id);
      await db.run('DELETE FROM saved_places WHERE id = ?', [id]);
      return { ok: true };
    },
  };
}

export function placesRoutes(svc: ReturnType<typeof placesService>): Router {
  const r = new Router();
  r.get('/me/places', (ctx) => svc.list(ctx.userId()));
  r.post('/me/places', async (ctx) => {
    ctx.status = 201;
    return svc.create(ctx.userId(), await ctx.json());
  });
  r.patch('/me/places/:id', async (ctx) => svc.update(ctx.userId(), ctx.params.id, await ctx.json()));
  r.delete('/me/places/:id', (ctx) => svc.remove(ctx.userId(), ctx.params.id));
  return r;
}
