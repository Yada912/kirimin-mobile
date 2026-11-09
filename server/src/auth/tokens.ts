import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { config } from '../config.ts';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

// ─── Passwords (scrypt, built into Node) ───────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltB64, hashB64] = stored.split('$');
  if (algo !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}

// ─── JWT (HS256) ────────────────────────────────────────────────────────────
// Standard JWTs, so any library (or jwt.io) can read them; swap for `jose` any time.

const b64url = (buf: Buffer | string) => Buffer.from(buf).toString('base64url');
const sign = (data: string) => createHmac('sha256', config.jwtSecret).update(data).digest('base64url');

/**
 * `ver` is the user's token_version when the token was issued. Bumping the
 * version (password change, "keluar dari semua perangkat") invalidates every
 * older token; the server checks it on each request.
 */
export function issueToken(userId: string, version = 0): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ sub: userId, ver: version, iat: now, exp: now + config.tokenTtlDays * 86400 }));
  return `${header}.${payload}.${sign(`${header}.${payload}`)}`;
}

/** Returns `{ userId, version }`, or null if the token is missing, forged or expired. */
export function verifyToken(token: string | null | undefined): { userId: string; version: number } | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = Buffer.from(sign(`${header}.${payload}`));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: string; exp?: number; ver?: number };
    if (!claims.sub || !claims.exp || claims.exp < Date.now() / 1000) return null;
    return { userId: claims.sub, version: claims.ver ?? 0 };
  } catch {
    return null;
  }
}

/** Reads `Authorization: Bearer <token>`, or `?token=` (EventSource can't set headers). */
export function tokenFromRequest(authHeader: string | undefined, query: URLSearchParams): string | null {
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7).trim();
  return query.get('token');
}
