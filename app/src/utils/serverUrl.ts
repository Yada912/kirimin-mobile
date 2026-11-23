/** Pure helper (no React Native imports) so it can be unit-tested with plain Node. */

/** Turns "192.168.1.5", "192.168.1.5:3000" or "abc.trycloudflare.com" into a full base URL. */
export function normalizeServerUrl(input: string): string {
  let s = input.trim().replace(/\/+$/, '');
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) {
    const host = s.split('/')[0];
    const isLocal = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/.test(host) || host.startsWith('localhost');
    s = `${isLocal ? 'http' : 'https'}://${s}`;
  }
  // A bare LAN IP almost always means the default API port.
  if (/^http:\/\/(\d{1,3}\.){3}\d{1,3}$/.test(s)) s += ':3000';
  return s;
}
