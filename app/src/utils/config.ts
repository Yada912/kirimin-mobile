import { Platform } from 'react-native';

const DEFAULT_ANDROID_API_URL = 'http://10.0.2.2:3000';
const DEFAULT_HOST_API_URL = 'http://localhost:3000';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android' ? DEFAULT_ANDROID_API_URL : DEFAULT_HOST_API_URL);

/** Resolves an image URL from the API (/uploads/...) to a full URL */
export function resolveApiUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const cleanBase = API_BASE_URL.replace(/\/+$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${cleanBase}${cleanPath}`;
}
