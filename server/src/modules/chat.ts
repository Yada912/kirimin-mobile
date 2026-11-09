import type { ChatMessage, Rating } from '../../../shared/src/index.ts';
import type { Db } from '../db/database.ts';
import type { Hub } from '../realtime/hub.ts';
import { Router } from '../http/router.ts';
import { conflict, forbidden } from '../http/errors.ts';
import { parse, v } from '../http/validate.ts';
import { newId, nowIso, parseJson } from '../lib/util.ts';
import type { OrdersService } from './orders.ts';
import type { UsersService } from './users.ts';

/**
 * Chat (X1) and ratings (X3): both hang off an order and only its sender and
 * driver may use them.
 */

interface MessageRow {
  id: string;
  order_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

const toMessage = (m: MessageRow): ChatMessage => ({
  id: m.id,
  orderId: m.order_id,
  senderId: m.sender_id,
  body: m.body,
  createdAt: m.created_at,
  readAt: m.read_at,
});

export function chatService(db: Db, hub: Hub, orders: OrdersService, users: UsersService) {
  async function participants(orderId: string, userId: string) {
    const o = await orders.requireViewable(orderId, userId);
    if (o.sender_id !== userId && o.driver_id !== userId) throw forbidden('Chat hanya untuk pengirim dan driver pesanan ini');
    return o;
  }

  return {
    async list(userId: string, orderId: string, after: string | null) {
      await participants(orderId, userId);
      const rows = await db.all<MessageRow>(
        `SELECT * FROM messages WHERE order_id = ? AND (? IS NULL OR created_at > ?) ORDER BY created_at, rowid LIMIT 500`,
        [orderId, after, after],
      );
      return rows.map(toMessage);
    },

    async send(userId: string, orderId: string, input: unknown) {
      const { body } = parse(input, v.object({ body: v.string({ min: 1, max: 1000 }) }));
      const o = await participants(orderId, userId);
      if (!o.driver_id) throw conflict('Chat tersedia setelah ada driver');
      const row: MessageRow = { id: newId(), order_id: orderId, sender_id: userId, body, created_at: nowIso(), read_at: null };
      await db.run('INSERT INTO messages (id, order_id, sender_id, body, created_at, read_at) VALUES (?, ?, ?, ?, ?, ?)', [
        row.id, row.order_id, row.sender_id, row.body, row.created_at, row.read_at,
      ]);
      const message = toMessage(row);
      hub.publish([o.sender_id, o.driver_id], { type: 'message.created', message });
      return message;
    },

    async markRead(userId: string, orderId: string) {
      await participants(orderId, userId);
      await db.run('UPDATE messages SET read_at = ? WHERE order_id = ? AND sender_id <> ? AND read_at IS NULL', [nowIso(), orderId, userId]);
      return { ok: true };
    },

    /** X3. Sender rates the driver, driver rates the sender; once each, after delivery. */
    async rate(userId: string, orderId: string, input: unknown): Promise<Rating> {
      const body = parse(input, v.object({
        stars: v.int({ min: 1, max: 5 }),
        tags: v.default(v.array(v.string({ min: 1, max: 40 }), { max: 10 }), []),
        comment: v.default(v.string({ max: 500 }), ''),
      }));
      const o = await participants(orderId, userId);
      if (o.status !== 'delivered') throw conflict('Rating bisa diberikan setelah paket diterima');
      const toUserId = userId === o.sender_id ? o.driver_id! : o.sender_id;
      const existing = await db.get('SELECT 1 FROM ratings WHERE order_id = ? AND from_user_id = ?', [orderId, userId]);
      if (existing) throw conflict('Kamu sudah memberi rating untuk pesanan ini');
      const rating: Rating = {
        id: newId(), orderId, fromUserId: userId, toUserId, stars: body.stars, tags: body.tags, comment: body.comment, createdAt: nowIso(),
      };
      await db.transaction(async (tx) => {
        await tx.run(
          'INSERT INTO ratings (id, order_id, from_user_id, to_user_id, stars, tags_json, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [rating.id, orderId, userId, toUserId, rating.stars, JSON.stringify(rating.tags), rating.comment, rating.createdAt],
        );
        await users.repo.addRating(toUserId, rating.stars);
      });
      return rating;
    },

    async ratingsFor(orderId: string, userId: string): Promise<Rating[]> {
      await participants(orderId, userId);
      const rows = await db.all<{ id: string; order_id: string; from_user_id: string; to_user_id: string; stars: number; tags_json: string; comment: string; created_at: string }>(
        'SELECT * FROM ratings WHERE order_id = ?',
        [orderId],
      );
      return rows.map((r) => ({
        id: r.id, orderId: r.order_id, fromUserId: r.from_user_id, toUserId: r.to_user_id,
        stars: r.stars, tags: parseJson<string[]>(r.tags_json, []), comment: r.comment, createdAt: r.created_at,
      }));
    },
  };
}

export function chatRoutes(svc: ReturnType<typeof chatService>): Router {
  const r = new Router();
  r.get('/orders/:id/messages', (ctx) => svc.list(ctx.userId(), ctx.params.id, ctx.query.get('after')));
  r.post('/orders/:id/messages', async (ctx) => {
    ctx.status = 201;
    return svc.send(ctx.userId(), ctx.params.id, await ctx.json());
  });
  r.post('/orders/:id/messages/read', (ctx) => svc.markRead(ctx.userId(), ctx.params.id));
  r.get('/orders/:id/ratings', (ctx) => svc.ratingsFor(ctx.params.id, ctx.userId()));
  r.post('/orders/:id/rating', async (ctx) => {
    ctx.status = 201;
    return svc.rate(ctx.userId(), ctx.params.id, await ctx.json());
  });
  return r;
}
