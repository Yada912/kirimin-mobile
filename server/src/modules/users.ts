import type { Me, PublicUser, Role, VehicleType } from '../../../shared/src/index.ts';
import { ROLES, VEHICLE_TYPES } from '../../../shared/src/index.ts';
import type { Db } from '../db/database.ts';
import { Router } from '../http/router.ts';
import { conflict, notFound, unauthorized } from '../http/errors.ts';
import { parse, shapes, v } from '../http/validate.ts';
import { hashPassword, issueToken, verifyPassword } from '../auth/tokens.ts';
import { newId, nowIso } from '../lib/util.ts';

// ─── Rows & serialisers ─────────────────────────────────────────────────────

export interface UserRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  password_hash: string;
  avatar_url: string | null;
  active_role: Role;
  verified: number;
  vehicle_type: VehicleType | null;
  vehicle_plate: string | null;
  rating_sum: number;
  rating_count: number;
  deliveries_count: number;
  sends_count: number;
  created_at: string;
  updated_at: string;
}

export function toPublicUser(u: UserRow): PublicUser {
  return {
    id: u.id,
    name: u.name,
    avatarUrl: u.avatar_url,
    ratingAvg: u.rating_count > 0 ? Math.round((u.rating_sum / u.rating_count) * 10) / 10 : null,
    ratingCount: u.rating_count,
    deliveriesCount: u.deliveries_count,
    sendsCount: u.sends_count,
    verified: u.verified === 1,
    vehicle: u.vehicle_type && u.vehicle_plate ? { type: u.vehicle_type, plate: u.vehicle_plate } : null,
  };
}

export function toMe(u: UserRow): Me {
  return { ...toPublicUser(u), phone: u.phone, email: u.email, activeRole: u.active_role, createdAt: u.created_at };
}

/** Normalises Indonesian phone numbers so "0812…", "+62812…" and "62812…" are the same account. */
export function normalisePhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.startsWith('62')) return '0' + digits.slice(2);
  return digits;
}

// ─── Repository ─────────────────────────────────────────────────────────────

export function usersRepo(db: Db) {
  return {
    byId: (id: string) => db.get<UserRow>('SELECT * FROM users WHERE id = ?', [id]),
    byPhone: (phone: string) => db.get<UserRow>('SELECT * FROM users WHERE phone = ?', [phone]),
    async byIds(ids: (string | null | undefined)[]): Promise<Map<string, UserRow>> {
      const unique = [...new Set(ids.filter((x): x is string => !!x))];
      if (unique.length === 0) return new Map();
      const rows = await db.all<UserRow>(`SELECT * FROM users WHERE id IN (${unique.map(() => '?').join(',')})`, unique);
      return new Map(rows.map((r) => [r.id, r]));
    },
    async insert(u: Omit<UserRow, 'rating_sum' | 'rating_count' | 'deliveries_count' | 'sends_count'>) {
      await db.run(
        `INSERT INTO users (id, name, phone, email, password_hash, avatar_url, active_role, verified,
           vehicle_type, vehicle_plate, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [u.id, u.name, u.phone, u.email, u.password_hash, u.avatar_url, u.active_role, u.verified,
          u.vehicle_type, u.vehicle_plate, u.created_at, u.updated_at],
      );
    },
    async update(id: string, fields: Partial<UserRow>) {
      const keys = Object.keys(fields).filter((k) => (fields as Record<string, unknown>)[k] !== undefined);
      if (keys.length === 0) return;
      const sets = keys.map((k) => `${k} = ?`).join(', ');
      await db.run(`UPDATE users SET ${sets}, updated_at = ? WHERE id = ?`, [
        ...keys.map((k) => (fields as Record<string, string | number | null>)[k]),
        nowIso(),
        id,
      ]);
    },
    async bumpCounter(id: string, column: 'deliveries_count' | 'sends_count') {
      await db.run(`UPDATE users SET ${column} = ${column} + 1 WHERE id = ?`, [id]);
    },
    async addRating(id: string, stars: number) {
      await db.run('UPDATE users SET rating_sum = rating_sum + ?, rating_count = rating_count + 1 WHERE id = ?', [stars, id]);
    },
  };
}

// ─── Service ────────────────────────────────────────────────────────────────

const registerBody = v.object({
  name: v.string({ min: 2, max: 80 }),
  phone: shapes.phone,
  email: v.optional(v.string({ max: 120, pattern: /^[^@\s]+@[^@\s]+\.[^@\s]+$/ })),
  password: v.string({ min: 6, max: 128, trim: false }),
  role: v.default(v.enum(ROLES), 'sender'),
});

const loginBody = v.object({
  phone: shapes.phone,
  password: v.string({ min: 1, max: 128, trim: false }),
});

const updateMeBody = v.object({
  name: v.optional(v.string({ min: 2, max: 80 })),
  email: v.nullable(v.string({ max: 120, pattern: /^[^@\s]+@[^@\s]+\.[^@\s]+$/ })),
  avatarUrl: v.nullable(v.string({ max: 500 })),
  activeRole: v.optional(v.enum(ROLES)),
  vehicle: v.nullable(v.object({ type: v.enum(VEHICLE_TYPES), plate: v.string({ min: 3, max: 15 }) })),
});

export function usersService(db: Db) {
  const repo = usersRepo(db);

  async function requireUser(id: string): Promise<UserRow> {
    const u = await repo.byId(id);
    if (!u) throw unauthorized('Akun tidak ditemukan, silakan masuk lagi');
    return u;
  }

  return {
    repo,
    requireUser,

    async register(input: unknown) {
      const body = parse(input, registerBody);
      const phone = normalisePhone(body.phone);
      if (await repo.byPhone(phone)) throw conflict('Nomor HP sudah terdaftar', { field: 'phone' });
      if (body.email && (await db.get('SELECT 1 FROM users WHERE email = ?', [body.email]))) {
        throw conflict('Email sudah terdaftar', { field: 'email' });
      }
      const now = nowIso();
      const user: Parameters<typeof repo.insert>[0] = {
        id: newId(),
        name: body.name,
        phone,
        email: body.email ?? null,
        password_hash: await hashPassword(body.password),
        avatar_url: null,
        active_role: body.role,
        verified: 0,
        vehicle_type: null,
        vehicle_plate: null,
        created_at: now,
        updated_at: now,
      };
      await repo.insert(user);
      const row = await requireUser(user.id);
      return { token: issueToken(row.id), user: toMe(row) };
    },

    async login(input: unknown) {
      const body = parse(input, loginBody);
      const user = await repo.byPhone(normalisePhone(body.phone));
      if (!user || !(await verifyPassword(body.password, user.password_hash))) {
        throw unauthorized('Nomor HP atau kata sandi salah');
      }
      return { token: issueToken(user.id), user: toMe(user) };
    },

    async me(userId: string) {
      return toMe(await requireUser(userId));
    },

    async updateMe(userId: string, input: unknown) {
      const body = parse(input, updateMeBody);
      await requireUser(userId);
      await repo.update(userId, {
        name: body.name,
        email: body.email,
        avatar_url: body.avatarUrl,
        active_role: body.activeRole,
        vehicle_type: body.vehicle === null ? null : body.vehicle?.type,
        vehicle_plate: body.vehicle === null ? null : body.vehicle?.plate,
      });
      return toMe(await requireUser(userId));
    },

    async publicProfile(id: string) {
      const u = await repo.byId(id);
      if (!u) throw notFound('Pengguna');
      return toPublicUser(u);
    },

    /** Driver earnings summary (P10, simplified). */
    async stats(userId: string) {
      const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
      const r = await db.get<{ total: number | null; week: number | null; count: number }>(
        `SELECT SUM(fee) AS total,
                SUM(CASE WHEN updated_at >= ? THEN fee ELSE 0 END) AS week,
                COUNT(*) AS count
           FROM orders WHERE driver_id = ? AND status = 'delivered'`,
        [weekAgo, userId],
      );
      const s = await db.get<{ total: number | null; count: number }>(
        `SELECT SUM(total) AS total, COUNT(*) AS count FROM orders WHERE sender_id = ? AND status = 'delivered'`,
        [userId],
      );
      return {
        driver: { deliveries: r?.count ?? 0, earningsTotal: r?.total ?? 0, earningsLast7Days: r?.week ?? 0 },
        sender: { delivered: s?.count ?? 0, spentTotal: s?.total ?? 0 },
      };
    },
  };
}

export type UsersService = ReturnType<typeof usersService>;

// ─── Routes ─────────────────────────────────────────────────────────────────

export function usersRoutes(users: UsersService): Router {
  const r = new Router();
  r.post('/auth/register', async (ctx) => {
    ctx.status = 201;
    return users.register(await ctx.json());
  });
  r.post('/auth/login', async (ctx) => users.login(await ctx.json()));
  r.get('/me', (ctx) => users.me(ctx.userId()));
  r.patch('/me', async (ctx) => users.updateMe(ctx.userId(), await ctx.json()));
  r.get('/me/stats', (ctx) => users.stats(ctx.userId()));
  r.get('/users/:id', (ctx) => {
    ctx.userId();
    return users.publicProfile(ctx.params.id);
  });
  return r;
}
