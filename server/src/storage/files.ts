import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { ServerResponse } from 'node:http';
import { badRequest, notFound } from '../http/errors.ts';

/**
 * Photo storage (package photos, pickup/delivery proof).
 *
 * Local disk is perfect on a laptop. Free hosts usually wipe the disk on every
 * restart, so when you deploy, implement this same interface with Cloudinary,
 * Supabase Storage or Cloudflare R2 (all have free tiers) — see docs/HOSTING.md.
 */
export interface FileStore {
  /** Saves bytes and returns a URL path like `/uploads/abc.jpg`. */
  save(bytes: Buffer, contentType: string): Promise<string>;
  /** Streams a stored file to the response. */
  serve(name: string, res: ServerResponse): void;
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};
const CONTENT_TYPES = Object.fromEntries(Object.entries(EXTENSIONS).map(([type, ext]) => [ext, type]));

export function localFileStore(dir: string): FileStore {
  mkdirSync(dir, { recursive: true });
  return {
    async save(bytes, contentType) {
      const ext = EXTENSIONS[contentType.split(';')[0].trim().toLowerCase()];
      if (!ext) throw badRequest(`Jenis file tidak didukung. Gunakan: ${Object.keys(EXTENSIONS).join(', ')}`);
      if (bytes.length === 0) throw badRequest('File kosong');
      const name = `${randomUUID()}.${ext}`;
      await writeFile(path.join(dir, name), bytes);
      return `/uploads/${name}`;
    },
    serve(name, res) {
      // Only allow our own generated names: no path traversal.
      if (!/^[0-9a-f-]{36}\.[a-z]+$/.test(name)) throw notFound('File');
      const file = path.join(dir, name);
      if (!existsSync(file)) throw notFound('File');
      const ext = name.split('.').pop() ?? '';
      res.writeHead(200, {
        'Content-Type': CONTENT_TYPES[ext] ?? 'application/octet-stream',
        'Content-Length': statSync(file).size,
        'Cache-Control': 'public, max-age=31536000, immutable',
      });
      createReadStream(file).pipe(res);
    },
  };
}
