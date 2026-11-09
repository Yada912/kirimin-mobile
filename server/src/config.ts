import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * All configuration comes from environment variables, optionally loaded from
 * `server/.env` (copy `.env.example`). Hosting providers set these in their
 * dashboard instead of using a file.
 */
const serverRoot = path.resolve(import.meta.dirname, '..');
const envFile = path.join(serverRoot, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const env = process.env;
const isProd = env.NODE_ENV === 'production';

function resolveFromServerRoot(p: string): string {
  return path.isAbsolute(p) ? p : path.join(serverRoot, p);
}

const DEV_SECRET = 'dev-only-secret-change-me';

export const config = {
  isProd,
  port: Number(env.PORT ?? 3000),
  /** 0.0.0.0 so phones on the same Wi-Fi can reach the laptop. */
  host: env.HOST ?? '0.0.0.0',
  /** SQLite file. Use ":memory:" for throwaway runs (tests do). */
  databasePath: env.DATABASE_PATH === ':memory:' ? ':memory:' : resolveFromServerRoot(env.DATABASE_PATH ?? './data/kirimin.db'),
  uploadDir: resolveFromServerRoot(env.UPLOAD_DIR ?? './data/uploads'),
  maxUploadBytes: Number(env.MAX_UPLOAD_MB ?? 5) * 1024 * 1024,
  jwtSecret: env.JWT_SECRET ?? DEV_SECRET,
  tokenTtlDays: Number(env.TOKEN_TTL_DAYS ?? 30),
  corsOrigin: env.CORS_ORIGIN ?? '*',
  /** Seed demo users/trips on first start when the database is empty. */
  seedOnEmpty: (env.SEED_ON_EMPTY ?? 'true') === 'true',
  logRequests: (env.LOG_REQUESTS ?? 'true') === 'true',
  /** Local time zone as a UTC offset, used to decide which weekday a recurring trip falls on. Bali (WITA) = 480. */
  tzOffsetMinutes: Number(env.TZ_OFFSET_MINUTES ?? 480),
  /** How many days ahead recurring routes are published as individual trips. */
  recurringHorizonDays: Number(env.RECURRING_HORIZON_DAYS ?? 2),
  /** Send Expo push notifications to registered devices. */
  pushEnabled: (env.PUSH_ENABLED ?? 'true') === 'true',
  /** Only needed if "Enhanced push security" is on in your Expo project. */
  expoAccessToken: env.EXPO_ACCESS_TOKEN || null,
  /**
   * There is no admin panel yet, so KTP submissions (X4) are approved straight away
   * for demos. Set to false to keep them "pending" until reviewed in the database.
   */
  autoApproveVerification: (env.AUTO_APPROVE_VERIFICATION ?? 'true') === 'true',
};

if (isProd && config.jwtSecret === DEV_SECRET) {
  throw new Error('Set JWT_SECRET to a long random string before running in production.');
}
