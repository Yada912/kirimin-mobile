import { Platform } from 'react-native';

const DEFAULT_ANDROID_API_URL = 'http://10.0.2.2:3000';
const ANDROID_REVERSE_API_URL = 'http://127.0.0.1:3000';
const DEFAULT_HOST_API_URL = 'http://localhost:3000';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android' ? DEFAULT_ANDROID_API_URL : DEFAULT_HOST_API_URL);

let cachedAndroidBaseUrl: string | null = null;

/**
 * On Android emulator, `10.0.2.2:3000` can occasionally stall on OkHttp depending on
 * host/emulator network configuration while `adb reverse tcp:3000 tcp:3000` (`127.0.0.1:3000`)
 * responds in <10ms. Probe both quickly once and cache the reachable one.
 */
export async function getApiBaseUrl(): Promise<string> {
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

/** Resolves an image URL from the API (/uploads/...) to a full URL */
export function resolveApiUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const activeBase = cachedAndroidBaseUrl || API_BASE_URL;
  const cleanBase = activeBase.replace(/\/+$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${cleanBase}${cleanPath}`;
}
