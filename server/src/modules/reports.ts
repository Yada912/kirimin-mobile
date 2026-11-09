import type { Report, ReportCategory, ReportStatus } from '../../../shared/src/index.ts';
import { REPORT_CATEGORIES, REPORT_CATEGORY_LABELS } from '../../../shared/src/index.ts';
import type { Db } from '../db/database.ts';
import { Router } from '../http/router.ts';
import { conflict, forbidden } from '../http/errors.ts';
import { parse, v } from '../http/validate.ts';
import { newId, nowIso } from '../lib/util.ts';
import type { NotificationsService } from './notifications.ts';
import type { OrdersService } from './orders.ts';

/**
 * S9 / D10 "Laporkan masalah". The sender or the driver of an order files a
 * report; it is stored for the team to follow up (no admin panel yet: read the
 * `reports` table). The other party is not notified, to avoid escalating disputes.
 */

interface ReportRow {
  id: string;
  order_id: string;
  reporter_id: string;
  category: ReportCategory;
  description: string;
  photo_url: string | null;
  status: ReportStatus;
  created_at: string;
  updated_at: string;
  order_code: string;
}

const toDto = (r: ReportRow): Report => ({
  id: r.id,
  orderId: r.order_id,
  orderCode: r.order_code,
  reporterId: r.reporter_id,
  category: r.category,
  description: r.description,
  photoUrl: r.photo_url,
  status: r.status,
  createdAt: r.created_at,
});

const createBody = v.object({
  category: v.enum(REPORT_CATEGORIES),
  description: v.string({ min: 10, max: 1000 }),
  photoUrl: v.optional(v.string({ max: 500 })),
});

const SELECT = 'SELECT r.*, o.code AS order_code FROM reports r JOIN orders o ON o.id = r.order_id';
const MAX_OPEN_PER_ORDER = 3;

export function reportsService(db: Db, orders: OrdersService, notifications: NotificationsService) {
  async function participant(orderId: string, userId: string) {
    const o = await orders.requireViewable(orderId, userId);
    if (o.sender_id !== userId && o.driver_id !== userId) throw forbidden('Hanya pengirim dan driver pesanan ini yang bisa melapor');
    return o;
  }

  return {
    async create(userId: string, orderId: string, input: unknown): Promise<Report> {
      const body = parse(input, createBody);
      const order = await participant(orderId, userId);
      const open = await db.get<{ n: number }>(
        `SELECT COUNT(*) AS n FROM reports WHERE order_id = ? AND reporter_id = ? AND status <> 'resolved'`,
        [orderId, userId],
      );
      if ((open?.n ?? 0) >= MAX_OPEN_PER_ORDER) throw conflict('Laporanmu untuk pesanan ini masih diproses');
      const now = nowIso();
      const row: ReportRow = {
        id: newId(), order_id: orderId, reporter_id: userId, category: body.category, description: body.description,
        photo_url: body.photoUrl ?? null, status: 'open', created_at: now, updated_at: now, order_code: order.code,
      };
      await db.run(
        `INSERT INTO reports (id, order_id, reporter_id, category, description, photo_url, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.order_id, row.reporter_id, row.category, row.description, row.photo_url, row.status, row.created_at, row.updated_at],
      );
      await notifications.notify(userId, 'report.created', 'Laporan diterima',
        `Laporan "${REPORT_CATEGORY_LABELS[body.category]}" untuk ${order.code} sedang kami tinjau`, { orderId, reportId: row.id });
      return toDto(row);
    },

    async forOrder(userId: string, orderId: string): Promise<Report[]> {
      await participant(orderId, userId);
      const rows = await db.all<ReportRow>(`${SELECT} WHERE r.order_id = ? AND r.reporter_id = ? ORDER BY r.created_at DESC`, [orderId, userId]);
      return rows.map(toDto);
    },

    async mine(userId: string): Promise<Report[]> {
      const rows = await db.all<ReportRow>(`${SELECT} WHERE r.reporter_id = ? ORDER BY r.created_at DESC LIMIT 100`, [userId]);
      return rows.map(toDto);
    },
  };
}

export function reportsRoutes(svc: ReturnType<typeof reportsService>): Router {
  const r = new Router();
  r.post('/orders/:id/reports', async (ctx) => {
    ctx.status = 201;
    return svc.create(ctx.userId(), ctx.params.id, await ctx.json());
  });
  r.get('/orders/:id/reports', (ctx) => svc.forOrder(ctx.userId(), ctx.params.id));
  r.get('/me/reports', (ctx) => svc.mine(ctx.userId()));
  return r;
}
