import { randomInt, randomUUID } from 'node:crypto';

export const newId = () => randomUUID();
export const nowIso = () => new Date().toISOString();

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L to avoid misreads

/** Human-friendly order code like "KRM-7XK2" (S8). */
export function orderCode(): string {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `KRM-${s}`;
}

/** 4-digit code the recipient tells the driver at drop-off (S5 / X2). */
export const handoverCode = () => String(randomInt(0, 10_000)).padStart(4, '0');

export function parseJson<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export const addMinutes = (iso: string, minutes: number) => new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
