import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Where the app finds the Kirimin backend.
 *
 * Order of precedence:
 *  1. A server address the user saved in the app ("Alamat Server" sheet on the
 *     welcome/login/profile screens). This is what makes one APK work with a backend
 *     running on any PC: type the address the server prints (same Wi-Fi) or a
 *     tunnel URL (any network) and it is remembered.
 *  2. EXPO_PUBLIC_API_URL baked in at build time (for a hosted backend).
 *  3. Local defaults: the Android emulator's host alias, or localhost on web/iOS.
 */

const DEFAULT_ANDROID_API_URL = 'http://10.0.2.2:3000';
const ANDROID_REVERSE_API_URL = 'http://127.0.0.1:3000';
const DEFAULT_HOST_API_URL = 'http://localhost:3000';
const SERVER_KEY = 'kirimin_server_url';

/** Build-time default (kept for code that needs a synchronous value). */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android' ? DEFAULT_ANDROID_API_URL : DEFAULT_HOST_API_URL);

let savedServerUrl: string | null | undefined; // undefined = not read yet
let cachedAndroidBaseUrl: string | null = null;
const listeners = new Set<(url: string) => void>();

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

async function readSaved(): Promise<string | null> {
  if (savedServerUrl !== undefined) return savedServerUrl;
  try {
    if (Platform.OS === 'web') {
      savedServerUrl = typeof window !== 'undefined' ? window.localStorage.getItem(SERVER_KEY) : null;
    } else {
      savedServerUrl = await SecureStore.getItemAsync(SERVER_KEY);
    }
  } catch {
    savedServerUrl = null;
  }
  return savedServerUrl ?? null;
}

/** The server address the user saved, or null when using the built-in default. */
export async function getSavedServerUrl(): Promise<string | null> {
  return readSaved();
}

/** Save (or clear with null) the server address. Takes effect on the next request. */
export async function setServerUrl(url: string | null): Promise<void> {
  const value = url ? normalizeServerUrl(url) : null;
  savedServerUrl = value;
  cachedAndroidBaseUrl = null;
  try {
    if (Platform.OS === 'web') {
      if (value) window.localStorage.setItem(SERVER_KEY, value);
      else window.localStorage.removeItem(SERVER_KEY);
    } else if (value) {
      await SecureStore.setItemAsync(SERVER_KEY, value);
    } else {
      await SecureStore.deleteItemAsync(SERVER_KEY);
    }
  } catch (err) {
    console.warn('Could not persist server address:', err);
  }
  const active = await getApiBaseUrl();
  listeners.forEach((fn) => fn(active));
}

/** Notified whenever the active server address changes (used to reconnect realtime). */
export function onServerUrlChange(fn: (url: string) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Pings `<url>/health`. Resolves to round-trip ms, or throws with a readable reason. */
export async function testServer(url: string, timeoutMs = 4000): Promise<number> {
  const base = normalizeServerUrl(url);
  if (!base) throw new Error('Alamat server masih kosong');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(`${base}/health`, {
      signal: ctrl.signal,
      headers: { 'ngrok-skip-browser-warning': '1' },
    });
    if (!res.ok) throw new Error(`Server menjawab ${res.status}`);
    const body = await res.json().catch(() => null);
    if (!body || body.ok !== true) throw new Error('Alamat ini bukan server Kirimin');
    return Date.now() - started;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Tidak ada jawaban. Pastikan HP dan PC di Wi-Fi yang sama dan server menyala.');
    }
    if (err instanceof TypeError) {
      throw new Error('Tidak bisa terhubung. Cek alamat, Wi-Fi, dan firewall PC.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * On Android emulator, `10.0.2.2:3000` can occasionally stall on OkHttp depending on
 * host/emulator network configuration while `adb reverse tcp:3000 tcp:3000` (`127.0.0.1:3000`)
 * responds in <10ms. Probe both quickly once and cache the reachable one.
 */
export async function getApiBaseUrl(): Promise<string> {
  const saved = await readSaved();
  if (saved) return saved;
  if (process.env.EXPO_PUBLIC_API_URL || Platform.OS !== 'android') {
    return API_BASE_URL;
  }
  if (cachedAndroidBaseUrl) return cachedAndroidBaseUrl;

  const candidates = [ANDROID_REVERSE_API_URL, DEFAULT_ANDROID_API_URL];
  for (const base of candidates) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    try {
      const res = await fetch(`${base}/health`, { signal: ctrl.signal });
      if (res.ok) {
        cachedAndroidBaseUrl = base;
        return base;
      }
    } catch {
      // try next candidate
    } finally {
      clearTimeout(timer);
    }
  }
  return API_BASE_URL;
}

/** Synchronous best guess of the active base URL (for building image URLs). */
export function currentApiBaseUrl(): string {
  return savedServerUrl || cachedAndroidBaseUrl || API_BASE_URL;
}

/** Resolves an image URL from the API (/uploads/...) to a full URL */
export function resolveApiUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const cleanBase = currentApiBaseUrl().replace(/\/+$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${cleanBase}${cleanPath}`;
}
