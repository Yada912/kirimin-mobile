/** The "Alamat server" field accepts whatever people type from the PC's console. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeServerUrl } from '../../src/utils/serverUrl.ts';

test('a bare LAN IP gets http:// and the default API port', () => {
  assert.equal(normalizeServerUrl('192.168.1.23'), 'http://192.168.1.23:3000');
  assert.equal(normalizeServerUrl(' 192.168.1.23:3000/ '), 'http://192.168.1.23:3000');
  assert.equal(normalizeServerUrl('10.0.2.2:4000'), 'http://10.0.2.2:4000');
});

test('copied URLs are kept as typed, minus trailing slashes', () => {
  assert.equal(normalizeServerUrl('http://192.168.1.23:3000/'), 'http://192.168.1.23:3000');
  assert.equal(normalizeServerUrl('https://quiet-river-1234.trycloudflare.com/'), 'https://quiet-river-1234.trycloudflare.com');
});

test('a host name without a scheme is assumed to be a public HTTPS tunnel', () => {
  assert.equal(normalizeServerUrl('quiet-river-1234.trycloudflare.com'), 'https://quiet-river-1234.trycloudflare.com');
  assert.equal(normalizeServerUrl('localhost:3000'), 'http://localhost:3000');
});

test('an empty field means "use the built-in default"', () => {
  assert.equal(normalizeServerUrl('   '), '');
});
