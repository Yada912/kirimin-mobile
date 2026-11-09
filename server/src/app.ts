import type { IncomingMessage, ServerResponse } from 'node:http';
import * as shared from '../../shared/src/index.ts';
import { config } from './config.ts';
import type { Db } from './db/database.ts';
import { HttpError, notFound } from './http/errors.ts';
import { Router, createContext, sendJson } from './http/router.ts';
import { tokenFromRequest, verifyToken } from './auth/tokens.ts';
import type { Hub } from './realtime/hub.ts';
import type { FileStore } from './storage/files.ts';
import { usersRoutes, usersService } from './modules/users.ts';
import { notificationsRoutes, notificationsService } from './modules/notifications.ts';
import type { TripOrderHooks } from './modules/trips.ts';
import { tripsRoutes, tripsService } from './modules/trips.ts';
import { ordersRoutes, ordersService } from './modules/orders.ts';
import { matchesRoutes, matchesService } from './modules/matches.ts';
import { chatRoutes, chatService } from './modules/chat.ts';

export interface AppDeps {
  db: Db;
  hub: Hub;
  files: FileStore;
}

/**
 * Wires services together and returns the HTTP request handler.
 * Each module = service (rules) + routes (HTTP); add new features the same way.
 */
export function createApp({ db, hub, files }: AppDeps) {
  // Services, in dependency order.
  const users = usersService(db);
  const notifications = notificationsService(db, hub);
  let hooks: TripOrderHooks | null = null;
  const trips = tripsService(db, hub, users, () => hooks!);
  const orders = ordersService(db, hub, users, trips, notifications);
  hooks = orders.tripHooks;
  const matches = matchesService(trips, users);
  const chat = chatService(db, hub, orders, users);

  const router = new Router();

  router.get('/health', () => ({ ok: true, time: new Date().toISOString(), realtimeClients: hub.connectedCount() }));

  /** Everything the app needs to render pickers and labels (sizes, categories, statuses, pricing). */
  router.get('/meta', () => ({
    sizes: shared.PACKAGE_SIZES.map((s) => ({ value: s, ...shared.PACKAGE_SIZE_INFO[s] })),
    weightClasses: shared.WEIGHT_CLASSES.map((w) => ({ value: w, label: shared.WEIGHT_LABELS[w] })),
    categories: shared.CATEGORIES,
    handling: shared.HANDLING_FLAGS.map((h) => ({ value: h, label: shared.HANDLING_LABELS[h] })),
    handoverMethods: shared.HANDOVER_METHODS.map((h) => ({ value: h, label: shared.HANDOVER_LABELS[h] })),
    vehicles: shared.VEHICLE_TYPES.map((t) => ({ value: t, label: shared.VEHICLE_LABELS[t] })),
    orderStatuses: shared.ORDER_STATUSES.map((s) => ({ value: s, label: shared.ORDER_STATUS_LABELS[s] })),
    trackingSteps: shared.TRACKING_STEPS,
    paymentMethods: shared.PAYMENT_METHODS,
    pricing: shared.PRICING,
  }));

  /** Realtime stream (Server-Sent Events). Auth via `?token=` because EventSource can't send headers. */
  router.get('/events', (ctx) => {
    hub.connect(ctx.userId(), ctx.res);
    return undefined;
  });

  /** Upload a photo: send the raw image bytes with Content-Type image/jpeg|png|webp. Returns `{ url }`. */
  router.post('/uploads', async (ctx) => {
    ctx.userId();
    const bytes = await ctx.raw(config.maxUploadBytes);
    ctx.status = 201;
    return { url: await files.save(bytes, ctx.req.headers['content-type'] ?? '') };
  });
  router.get('/uploads/:name', (ctx) => {
    files.serve(ctx.params.name, ctx.res);
    return undefined;
  });

  router.use('', usersRoutes(users));
  router.use('', tripsRoutes(trips));
  router.use('', ordersRoutes(orders));
  router.use('', matchesRoutes(matches));
  router.use('', chatRoutes(chat));
  router.use('', notificationsRoutes(notifications));

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const started = Date.now();
    res.on('finish', () => {
      if (config.logRequests && !path.startsWith('/events')) console.log(`${req.method} ${path} → ${res.statusCode} (${Date.now() - started} ms)`);
    });
    const url = new URL(req.url ?? '/', 'http://local');
    // Accept both /orders and /api/orders so a reverse proxy prefix doesn't matter.
    const path = url.pathname.replace(/^\/api(?=\/|$)/, '') || '/';

    res.setHeader('Access-Control-Allow-Origin', config.corsOrigin);
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, ngrok-skip-browser-warning');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }

    try {
      const found = router.match(req.method ?? 'GET', path);
      if (found === null) throw notFound('Endpoint');
      if (found === 'method_not_allowed') throw new HttpError(405, 'method_not_allowed', 'Metode tidak diizinkan');
      const userId = verifyToken(tokenFromRequest(req.headers.authorization, url.searchParams));
      const ctx = createContext(req, res, url, found.params, userId);
      const result = await found.handler(ctx);
      if (!res.headersSent) sendJson(res, ctx.status, result ?? { ok: true });
    } catch (err) {
      if (res.headersSent) {
        res.end();
      } else if (err instanceof HttpError) {
        sendJson(res, err.status, { error: { code: err.code, message: err.message, details: err.details } });
      } else {
        console.error(err);
        sendJson(res, 500, { error: { code: 'internal', message: 'Terjadi kesalahan di server' } });
      }
    }
  }

  return { handle, services: { users, notifications, trips, orders, matches, chat } };
}

export type App = ReturnType<typeof createApp>;
