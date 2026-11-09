import { badRequest } from './errors.ts';

/**
 * A tiny, dependency-free validator in the spirit of zod.
 *
 *   const body = parse(ctx.body, v.object({ name: v.string({ min: 2 }), age: v.optional(v.int()) }));
 *   //    ^? { name: string; age: number | undefined }
 *
 * Swap for zod later if you add npm dependencies; the call sites barely change.
 */
export type Validator<T> = (value: unknown, path: string) => T;
export type Infer<V> = V extends Validator<infer T> ? T : never;

class ValidationError extends Error {
  path: string;
  constructor(path: string, message: string) {
    super(message);
    this.path = path;
  }
}

const fail = (path: string, message: string): never => {
  throw new ValidationError(path, message);
};

export const v = {
  string(opts: { min?: number; max?: number; trim?: boolean; pattern?: RegExp } = {}): Validator<string> {
    return (value, path) => {
      if (typeof value !== 'string') return fail(path, 'harus berupa teks');
      const s = opts.trim === false ? value : value.trim();
      if (opts.min !== undefined && s.length < opts.min) fail(path, `minimal ${opts.min} karakter`);
      if (opts.max !== undefined && s.length > opts.max) fail(path, `maksimal ${opts.max} karakter`);
      if (opts.pattern && !opts.pattern.test(s)) fail(path, 'format tidak valid');
      return s;
    };
  },

  number(opts: { min?: number; max?: number; int?: boolean } = {}): Validator<number> {
    return (value, path) => {
      const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
      if (typeof n !== 'number' || !Number.isFinite(n)) return fail(path, 'harus berupa angka');
      if (opts.int && !Number.isInteger(n)) fail(path, 'harus bilangan bulat');
      if (opts.min !== undefined && n < opts.min) fail(path, `minimal ${opts.min}`);
      if (opts.max !== undefined && n > opts.max) fail(path, `maksimal ${opts.max}`);
      return n;
    };
  },

  int(opts: { min?: number; max?: number } = {}): Validator<number> {
    return v.number({ ...opts, int: true });
  },

  boolean(): Validator<boolean> {
    return (value, path) => (typeof value === 'boolean' ? value : fail(path, 'harus true/false'));
  },

  enum<const T extends readonly string[]>(options: T): Validator<T[number]> {
    return (value, path) =>
      typeof value === 'string' && (options as readonly string[]).includes(value)
        ? (value as T[number])
        : fail(path, `harus salah satu dari: ${options.join(', ')}`);
  },

  /** ISO-8601 date-time string, normalised to UTC ISO. */
  datetime(): Validator<string> {
    return (value, path) => {
      if (typeof value !== 'string') return fail(path, 'harus berupa tanggal ISO');
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? fail(path, 'tanggal tidak valid') : d.toISOString();
    };
  },

  array<T>(item: Validator<T>, opts: { min?: number; max?: number } = {}): Validator<T[]> {
    return (value, path) => {
      if (!Array.isArray(value)) return fail(path, 'harus berupa daftar');
      if (opts.min !== undefined && value.length < opts.min) fail(path, `minimal ${opts.min} item`);
      if (opts.max !== undefined && value.length > opts.max) fail(path, `maksimal ${opts.max} item`);
      return value.map((x, i) => item(x, `${path}[${i}]`));
    };
  },

  object<S extends Record<string, Validator<unknown>>>(shape: S): Validator<{ [K in keyof S]: Infer<S[K]> }> {
    return (value, path) => {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return fail(path, 'harus berupa objek');
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(shape)) {
        out[key] = shape[key]((value as Record<string, unknown>)[key], path ? `${path}.${key}` : key);
      }
      return out as { [K in keyof S]: Infer<S[K]> };
    };
  },

  /** `undefined`/`null` → `undefined`; anything else must pass `inner`. */
  optional<T>(inner: Validator<T>): Validator<T | undefined> {
    return (value, path) => (value === undefined || value === null ? undefined : inner(value, path));
  },

  /** `undefined` → `fallback`. */
  default<T>(inner: Validator<T>, fallback: T): Validator<T> {
    return (value, path) => (value === undefined || value === null ? fallback : inner(value, path));
  },

  /** `null` stays `null` (useful for "clear this field" in PATCH bodies). */
  nullable<T>(inner: Validator<T>): Validator<T | null | undefined> {
    return (value, path) => (value === null ? null : value === undefined ? undefined : inner(value, path));
  },
};

/** Common shapes. */
export const shapes = {
  place: v.object({
    label: v.string({ min: 1, max: 120 }),
    address: v.optional(v.string({ max: 300 })),
    lat: v.number({ min: -90, max: 90 }),
    lng: v.number({ min: -180, max: 180 }),
  }),
  phone: v.string({ min: 8, max: 20, pattern: /^\+?[0-9 -]+$/ }),
};

/** Runs a validator and converts failures into a 400 with the offending field. */
export function parse<T>(value: unknown, validator: Validator<T>): T {
  try {
    return validator(value, '');
  } catch (e) {
    if (e instanceof ValidationError) {
      const field = e.path || 'body';
      throw badRequest(`${field} ${e.message}`, { field });
    }
    throw e;
  }
}
