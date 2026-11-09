import type { Notification, NotificationChannel } from '../../../shared/src/index.ts';
import type { Db } from '../db/database.ts';
import type { Hub } from '../realtime/hub.ts';
import type { PushSender } from '../push/expo.ts';
import { EXPO_TOKEN_PATTERN } from '../push/expo.ts';
import { Router } from '../http/router.ts';
import { badRequest } from '../http/errors.ts';
import { parse, v } from '../http/validate.ts';
import { newId, nowIso, parseJson } from '../lib/util.ts';
import { readSettings } from './users.ts';

interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data_json: string;
  read_at: string | null;
  created_at: string;
}

const toDto = (r: NotificationRow): Notification => ({
  id: r.id,
  type: r.type,
  title: r.title,
  body: r.body,
  data: parseJson(r.data_json, {}),
  readAt: r.read_at,
  createdAt: r.created_at,
});

/** Which preference toggle (ST "Notifikasi") controls a notification type. */
export function channelFor(type: string): NotificationChannel {
  if (type.startsWith('chat.')) return 'chat';
  if (type.startsWith('promo.')) return 'promos';
  if (type === 'order.requested' || type.startsWith('trip.')) return 'trips';
  return 'orders';
}

const registerBody = v.object({
  token: v.string({ min: 10, max: 200 }),
  platform: v.optional(v.enum(['android', 'ios', 'web'] as const)),
});

export function notificationsService(db: Db, hub: Hub, push: PushSender) {
  /**
   * Sends a phone push notification to every device of `userId`, if they allow
   * that channel. Fire-and-forget: never delays or fails the request.
   */
  async function sendPush(userId: string, channel: NotificationChannel, title: string, body: string, data: Record<string, unknown>) {
    const user = await db.get<{ settings_json: string }>('SELECT settings_json FROM users WHERE id = ? AND deleted_at IS NULL', [userId]);
    if (!user || !readSettings(user.settings_json).push[channel]) return;
    const tokens = await db.all<{ token: string }>('SELECT token FROM push_tokens WHERE user_id = ?', [userId]);
    if (tokens.length === 0) return;
    push
      .send(tokens.map((t) => ({ to: t.token, title, body, data })))
      .then(async ({ invalidTokens }) => {
        for (const token of invalidTokens) await db.run('DELETE FROM push_tokens WHERE token = ?', [token]);
      })
      .catch((e) => console.warn('push failed:', e instanceof Error ? e.message : e));
  }

  return {
    sendPush,

    /** Stores an in-app notification (O5), pushes it over SSE, and sends a phone push. */
    async notify(userId: string | null | undefined, type: string, title: string, body: string, data: Record<string, unknown> = {}) {
      if (!userId) return;
      const row: NotificationRow = {
        id: newId(),
        user_id: userId,
        type,
        title,
        body,
        data_json: JSON.stringify(data),
        read_at: null,
        created_at: nowIso(),
      };
      await db.run(
        'INSERT INTO notifications (id, user_id, type, title, body, data_json, read_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [row.id, row.user_id, row.type, row.title, row.body, row.data_json, row.read_at, row.created_at],
      );
      hub.publish([userId], { type: 'notification.created', notification: toDto(row) });
      await sendPush(userId, channelFor(type), title, body, { ...data, type, notificationId: row.id });
    },

    /** Register this device for push (call after login and whenever Expo gives a new token). */
    async registerToken(userId: string, input: unknown) {
      const { token, platform } = parse(input, registerBody);
      if (!EXPO_TOKEN_PATTERN.test(token)) throw badRequest('Token push harus berupa Expo push token', { field: 'token' });
      const now = nowIso();
      // A device that was used by another account now belongs to this one.
      await db.run(
        `INSERT INTO push_tokens (token, user_id, platform, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (token) DO UPDATE SET user_id = excluded.user_id, platform = excluded.platform, updated_at = excluded.updated_at`,
        [token, userId, platform ?? null, now, now],
      );
      return { ok: true };
    },

    /** Call on logout so the phone stops receiving this account's notifications. */
    async unregisterToken(userId: string, input: unknown) {
      const { token } = parse(input, v.object({ token: v.string({ min: 1, max: 200 }) }));
      await db.run('DELETE FROM push_tokens WHERE token = ? AND user_id = ?', [token, userId]);
      return { ok: true };
    },

    async list(userId: string, limit = 50) {
      const rows = await db.all<NotificationRow>(
        'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
        [userId, limit],
      );
      const unread = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', [userId]);
      return { items: rows.map(toDto), unreadCount: unread?.n ?? 0 };
    },

    async markRead(userId: string, id: string | null) {
      if (id) await db.run('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL', [nowIso(), id, userId]);
      else await db.run('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', [nowIso(), userId]);
      return { ok: true };
    },
  };
}

export type NotificationsService = ReturnType<typeof notificationsService>;

export function notificationsRoutes(svc: NotificationsService): Router {
  const r = new Router();
  r.get('/notifications', (ctx) => svc.list(ctx.userId(), Math.min(100, Number(ctx.query.get('limit') ?? 50) || 50)));
  r.post('/notifications/read-all', (ctx) => svc.markRead(ctx.userId(), null));
  r.post('/notifications/:id/read', (ctx) => svc.markRead(ctx.userId(), ctx.params.id));
  r.post('/me/push-tokens', async (ctx) => svc.registerToken(ctx.userId(), await ctx.json()));
  r.post('/me/push-tokens/remove', async (ctx) => svc.unregisterToken(ctx.userId(), await ctx.json()));
  return r;
}
