import type { Notification } from '../../../shared/src/index.ts';
import type { Db } from '../db/database.ts';
import type { Hub } from '../realtime/hub.ts';
import { Router } from '../http/router.ts';
import { newId, nowIso, parseJson } from '../lib/util.ts';

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

export function notificationsService(db: Db, hub: Hub) {
  return {
    /**
     * Stores an in-app notification and pushes it live.
     * This is also the one place to add push notifications later (Expo Push / FCM).
     */
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
  return r;
}
