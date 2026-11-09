import type { Me, PublicUser, Role, UserSettings, VehicleType, VerificationStatus } from '../../../shared/src/index.ts';
import { NOTIFICATION_CHANNELS, ROLES, VEHICLE_TYPES } from '../../../shared/src/index.ts';
import { config } from '../config.ts';
import type { Db } from '../db/database.ts';
import { Router } from '../http/router.ts';
import { badRequest, conflict, notFound, unauthorized } from '../http/errors.ts';
import { parse, shapes, v } from '../http/validate.ts';
import { hashPassword, issueToken, verifyPassword } from '../auth/tokens.ts';
import { newId, nowIso, parseJson } from '../lib/util.ts';

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
  token_version: number;
  settings_json: string;
  verification_status: VerificationStatus;
  ktp_photo_url: string | null;
  selfie_photo_url: string | null;
  verification_note: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

const DEFAULT_SETTINGS: UserSettings = {
  push: Object.fromEntries(NOTIFICATION_CHANNELS.map((c) => [c, true])) as UserSettings['push'],
};

/** Stored settings merged over the defaults, so new toggles default to "on". */
export function readSettings(json: string | null | undefined): UserSettings {
  const stored = parseJson<Partial<UserSettings>>(json, {});
  return { push: { ...DEFAULT_SETTINGS.push, ...(stored.push ?? {}) } };
}

export function toPublicUser(u: UserRow): PublicUser {
  return {
    id: u.id,
    name: u.deleted_at ? 'Akun dihapus' : u.name,
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
  return {
    ...toPublicUser(u),
    phone: u.phone,
    email: u.email,
    activeRole: u.active_role,
    verificationStatus: u.verification_status,
    verificationNote: u.verification_note,
    settings: readSettings(u.settings_json),
    createdAt: u.created_at,
  };
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
    async insert(u: Pick<UserRow, 'id' | 'name' | 'phone' | 'email' | 'password_hash' | 'avatar_url' | 'active_role' | 'verified'
      | 'vehicle_type' | 'vehicle_plate' | 'created_at' | 'updated_at'>) {
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

const passwordBody = v.object({
  currentPassword: v.string({ min: 1, max: 128, trim: false }),
  newPassword: v.string({ min: 6, max: 128, trim: false }),
});

const settingsBody = v.object({
  push: v.optional(v.object({
    orders: v.optional(v.boolean()),
    chat: v.optional(v.boolean()),
    trips: v.optional(v.boolean()),
    promos: v.optional(v.boolean()),
  })),
});

const verificationBody = v.object({
  ktpPhotoUrl: v.string({ min: 1, max: 500 }),
  selfiePhotoUrl: v.string({ min: 1, max: 500 }),
});

/** Order statuses that block deleting an account. */
const UNFINISHED = ['open', 'requested', 'declined', 'accepted', 'picked_up', 'in_transit', 'arrived'];

export function usersService(db: Db) {
  const repo = usersRepo(db);

  async function requireUser(id: string): Promise<UserRow> {
    const u = await repo.byId(id);
    if (!u || u.deleted_at) throw unauthorized('Akun tidak ditemukan, silakan masuk lagi');
    return u;
  }

  async function checkPassword(u: UserRow, password: string) {
    if (!(await verifyPassword(password, u.password_hash))) throw badRequest('Kata sandi salah', { field: 'currentPassword' });
  }

  return {
    repo,
    requireUser,

    /** Called for every request with a token: the account must exist and the token must not be revoked. */
    async isSessionValid(userId: string, version: number): Promise<boolean> {
      const u = await db.get<{ token_version: number }>('SELECT token_version FROM users WHERE id = ? AND deleted_at IS NULL', [userId]);
      return !!u && u.token_version === version;
    },

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
      return { token: issueToken(row.id, row.token_version), user: toMe(row) };
    },

    async login(input: unknown) {
      const body = parse(input, loginBody);
      const user = await repo.byPhone(normalisePhone(body.phone));
      if (!user || user.deleted_at || !(await verifyPassword(body.password, user.password_hash))) {
        throw unauthorized('Nomor HP atau kata sandi salah');
      }
      return { token: issueToken(user.id, user.token_version), user: toMe(user) };
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

    /** ST "Ubah kata sandi". Signs out every other device and returns a fresh token for this one. */
    async changePassword(userId: string, input: unknown) {
      const body = parse(input, passwordBody);
      const u = await requireUser(userId);
      await checkPassword(u, body.currentPassword);
      if (body.currentPassword === body.newPassword) throw badRequest('Kata sandi baru harus berbeda', { field: 'newPassword' });
      await db.run('UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = ? WHERE id = ?', [
        await hashPassword(body.newPassword), nowIso(), userId,
      ]);
      const fresh = await requireUser(userId);
      return { token: issueToken(fresh.id, fresh.token_version), user: toMe(fresh) };
    },

    /** "Keluar dari semua perangkat": every existing token stops working, including this one. */
    async logoutAll(userId: string) {
      await db.run('UPDATE users SET token_version = token_version + 1, updated_at = ? WHERE id = ?', [nowIso(), userId]);
      await db.run('DELETE FROM push_tokens WHERE user_id = ?', [userId]);
      return { ok: true };
    },

    async settings(userId: string) {
      return readSettings((await requireUser(userId)).settings_json);
    },

    /** ST "Notifikasi": partial update, e.g. `{ "push": { "promos": false } }`. */
    async updateSettings(userId: string, input: unknown) {
      const body = parse(input, settingsBody);
      const current = readSettings((await requireUser(userId)).settings_json);
      const pushPatch = Object.fromEntries(Object.entries(body.push ?? {}).filter(([, val]) => val !== undefined));
      const next: UserSettings = { push: { ...current.push, ...pushPatch } };
      await repo.update(userId, { settings_json: JSON.stringify(next) });
      return next;
    },

    /** X4: KTP photo + selfie (upload both with POST /uploads first). */
    async submitVerification(userId: string, input: unknown) {
      const body = parse(input, verificationBody);
      const u = await requireUser(userId);
      if (u.verification_status === 'verified') throw conflict('Akun kamu sudah terverifikasi');
      const approved = config.autoApproveVerification;
      await repo.update(userId, {
        ktp_photo_url: body.ktpPhotoUrl,
        selfie_photo_url: body.selfiePhotoUrl,
        verification_status: approved ? 'verified' : 'pending',
        verified: approved ? 1 : 0,
        verification_note: null,
      });
      return toMe(await requireUser(userId));
    },

    /**
     * ST "Hapus akun". Needs the password. Refused while packages are still on the
     * way; published routes without packages are cancelled. The row is anonymised
     * (not deleted) so the other person's order history stays readable.
     */
    async deleteAccount(userId: string, input: unknown) {
      const { password } = parse(input, v.object({ password: v.string({ min: 1, max: 128, trim: false }) }));
      const u = await requireUser(userId);
      await checkPassword(u, password);
      const busy = await db.get<{ n: number }>(
        `SELECT COUNT(*) AS n FROM orders WHERE (sender_id = ? OR driver_id = ?) AND status IN (${UNFINISHED.map(() => '?').join(',')})`,
        [userId, userId, ...UNFINISHED],
      );
      if ((busy?.n ?? 0) > 0) throw conflict('Selesaikan atau batalkan pesanan yang masih berjalan sebelum menghapus akun');
      const now = nowIso();
      await db.transaction(async (tx) => {
        await tx.run(`UPDATE trips SET status = 'cancelled', repeat_days_json = '[]', updated_at = ? WHERE driver_id = ? AND status IN ('published','ongoing')`, [now, userId]);
        await tx.run('DELETE FROM push_tokens WHERE user_id = ?', [userId]);
        await tx.run('DELETE FROM saved_places WHERE user_id = ?', [userId]);
        await tx.run(
          `UPDATE users SET name = 'Akun dihapus', phone = ?, email = NULL, password_hash = '!', avatar_url = NULL,
             ktp_photo_url = NULL, selfie_photo_url = NULL, vehicle_type = NULL, vehicle_plate = NULL,
             settings_json = '{}', token_version = token_version + 1, deleted_at = ?, updated_at = ? WHERE id = ?`,
          [`deleted:${userId}`, now, now, userId],
        );
      });
      return { ok: true };
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
  r.post('/me/password', async (ctx) => users.changePassword(ctx.userId(), await ctx.json()));
  r.post('/auth/logout-all', (ctx) => users.logoutAll(ctx.userId()));
  r.get('/me/settings', (ctx) => users.settings(ctx.userId()));
  r.patch('/me/settings', async (ctx) => users.updateSettings(ctx.userId(), await ctx.json()));
  r.post('/me/verification', async (ctx) => users.submitVerification(ctx.userId(), await ctx.json()));
  r.post('/me/delete', async (ctx) => users.deleteAccount(ctx.userId(), await ctx.json()));
  r.get('/users/:id', (ctx) => {
    ctx.userId();
    return users.publicProfile(ctx.params.id);
  });
  return r;
}
