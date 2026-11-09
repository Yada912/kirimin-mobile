/** Cloudinary file store against a local fake upload endpoint that checks the signature like Cloudinary does. */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { cloudinaryFileStore, cloudinarySignature, parseCloudinaryUrl } from '../src/storage/files.ts';

const SECRET = 'abc_SECRET-123';
const CLOUDINARY_URL = `cloudinary://123456789012345:${SECRET}@demo-cloud`;
let server: Server;
let apiBase: string;
const received: { path: string; fields: Record<string, string>; file?: File }[] = [];

before(async () => {
  server = createServer(async (req, res) => {
    // Let the platform parse the multipart body, as Cloudinary would.
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const form = await new Response(Buffer.concat(chunks), { headers: { 'content-type': req.headers['content-type'] ?? '' } }).formData();
    const fields: Record<string, string> = {};
    let file: File | undefined;
    for (const [k, v] of form) {
      if (typeof v === 'string') fields[k] = v;
      else file = v;
    }
    received.push({ path: req.url ?? '', fields, file });
    const { signature, api_key, file: _f, ...signed } = fields;
    const ok = api_key === '123456789012345' && signature === cloudinarySignature(signed, SECRET);
    res.writeHead(ok ? 200 : 401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(ok
      ? { secure_url: `https://res.cloudinary.com/demo-cloud/image/upload/v1/${fields.folder}/${fields.public_id}.jpg` }
      : { error: { message: 'Invalid Signature' } }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  apiBase = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});
after(() => {
  server.closeAllConnections();
  server.close();
});

test('parses CLOUDINARY_URL', () => {
  assert.deepEqual(parseCloudinaryUrl(CLOUDINARY_URL), { cloudName: 'demo-cloud', apiKey: '123456789012345', apiSecret: SECRET });
  assert.throws(() => parseCloudinaryUrl('https://example.com'));
});

test('signature matches Cloudinary’s documented example', () => {
  // https://cloudinary.com/documentation/authentication_signatures
  assert.equal(
    cloudinarySignature({ eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop', public_id: 'sample_image', timestamp: '1315060510' }, 'abcd'),
    'bfd09f95f331f558cbd1320e67aa8d488770583e',
  );
});

test('signed upload returns the absolute secure_url', async () => {
  const store = cloudinaryFileStore(CLOUDINARY_URL, { apiBase });
  const url = await store.save(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg');
  assert.match(url, /^https:\/\/res\.cloudinary\.com\/demo-cloud\/image\/upload\/v1\/kirimin\/[0-9a-f-]{36}\.jpg$/);
  const last = received.at(-1)!;
  assert.equal(last.path, '/v1_1/demo-cloud/image/upload');
  assert.equal(last.file?.type, 'image/jpeg');
  assert.equal(last.file?.size, 4);
});

test('rejects unsupported/empty files before uploading, and maps Cloudinary errors to 502', async () => {
  const store = cloudinaryFileStore(CLOUDINARY_URL, { apiBase });
  const before = received.length;
  await assert.rejects(store.save(Buffer.from('x'), 'text/plain'), { status: 400 });
  await assert.rejects(store.save(Buffer.alloc(0), 'image/png'), { status: 400 });
  assert.equal(received.length, before);

  const wrong = cloudinaryFileStore('cloudinary://123456789012345:wrong@demo-cloud', { apiBase });
  const originalError = console.error;
  console.error = () => {};
  try {
    await assert.rejects(wrong.save(Buffer.from([1]), 'image/png'), { status: 502, code: 'upload_failed' });
  } finally {
    console.error = originalError;
  }
});
