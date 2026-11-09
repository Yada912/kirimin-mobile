import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import type { ServerResponse } from 'node:http';
import { HttpError, badRequest, notFound } from '../http/errors.ts';

/**
 * Photo storage (package photos, pickup/delivery proof).
 *
 * Local disk is perfect on a laptop. Free hosts usually wipe the disk on every
 * restart, so when you deploy, implement this same interface with Cloudinary,
 * Supabase Storage or Cloudflare R2 (all have free tiers) — see docs/HOSTING.md.
 */
export interface FileStore {
  /**
   * Saves bytes and returns either a URL path like `/uploads/abc.jpg` (local disk)
   * or an absolute URL (Cloudinary). Clients treat it as an opaque string.
   */
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

/** Validates an upload and returns its file extension. */
function checkUpload(bytes: Buffer, contentType: string): string {
  const ext = EXTENSIONS[contentType.split(';')[0].trim().toLowerCase()];
  if (!ext) throw badRequest(`Jenis file tidak didukung. Gunakan: ${Object.keys(EXTENSIONS).join(', ')}`);
  if (bytes.length === 0) throw badRequest('File kosong');
  return ext;
}

export function localFileStore(dir: string): FileStore {
  mkdirSync(dir, { recursive: true });
  return {
    async save(bytes, contentType) {
      const ext = checkUpload(bytes, contentType);
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

/** Parses `cloudinary://<api_key>:<api_secret>@<cloud_name>` (the "API environment variable" in the Cloudinary console). */
export function parseCloudinaryUrl(url: string): { cloudName: string; apiKey: string; apiSecret: string } {
  const u = new URL(url);
  const cloudName = u.hostname;
  const apiKey = decodeURIComponent(u.username);
  const apiSecret = decodeURIComponent(u.password);
  if (u.protocol !== 'cloudinary:' || !cloudName || !apiKey || !apiSecret) {
    throw new Error('CLOUDINARY_URL must look like cloudinary://<api_key>:<api_secret>@<cloud_name>');
  }
  return { cloudName, apiKey, apiSecret };
}

/** Cloudinary's signature: SHA-1 of the sorted `key=value&…` params followed by the API secret. */
export function cloudinarySignature(params: Record<string, string>, apiSecret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return createHash('sha1').update(toSign + apiSecret).digest('hex');
}

/**
 * Photos on Cloudinary (free tier), for hosts whose disk is wiped on restart.
 * `save` does a signed upload and returns the absolute `https://res.cloudinary.com/…` URL,
 * so `GET /uploads/:name` is never used for these photos.
 */
export function cloudinaryFileStore(
  cloudinaryUrl: string,
  options: { folder?: string; apiBase?: string } = {},
): FileStore {
  const { cloudName, apiKey, apiSecret } = parseCloudinaryUrl(cloudinaryUrl);
  const folder = options.folder ?? 'kirimin';
  const endpoint = `${options.apiBase ?? 'https://api.cloudinary.com'}/v1_1/${encodeURIComponent(cloudName)}/image/upload`;
  return {
    async save(bytes, contentType) {
      const ext = checkUpload(bytes, contentType);
      const params: Record<string, string> = {
        folder,
        public_id: randomUUID(),
        timestamp: String(Math.floor(Date.now() / 1000)),
      };
      const form = new FormData();
      for (const [k, v] of Object.entries(params)) form.append(k, v);
      form.append('api_key', apiKey);
      form.append('signature', cloudinarySignature(params, apiSecret));
      form.append('file', new Blob([new Uint8Array(bytes)], { type: CONTENT_TYPES[ext] }), `upload.${ext}`);
      const failed = (detail: string) => {
        console.error(`Cloudinary upload failed: ${detail}`);
        return new HttpError(502, 'upload_failed', 'Gagal mengunggah foto. Coba lagi sebentar lagi.');
      };
      let res: Response;
      try {
        res = await fetch(endpoint, { method: 'POST', body: form });
      } catch (e) {
        throw failed((e as Error).message);
      }
      const body = (await res.json().catch(() => ({}))) as { secure_url?: string; error?: { message?: string } };
      if (!res.ok || !body.secure_url) throw failed(`HTTP ${res.status}: ${body.error?.message ?? 'no secure_url in response'}`);
      return body.secure_url;
    },
    serve() {
      // Photos are served by Cloudinary's CDN; their URLs never point at this server.
      throw notFound('File');
    },
  };
}
