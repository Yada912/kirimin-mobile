import * as FileSystem from 'expo-file-system/legacy';
import { FileSystemUploadType } from 'expo-file-system/legacy';
import { API_BASE_URL } from '../utils/config';
import { getToken, removeToken } from '../auth/storage';

export class ApiError extends Error {
  code: string;
  details?: unknown;
  status: number;

  constructor(message: string, code = 'unknown_error', status = 500, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = await getToken();

  let url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (options.params) {
    const searchParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        searchParams.append(key, String(val));
      }
    });
    const qs = searchParams.toString();
    if (qs) {
      url += (url.includes('?') ? '&' : '?') + qs;
    }
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'ngrok-skip-browser-warning': '1',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err: any) {
    throw new ApiError(
      'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.',
      'network_error',
      0,
      err
    );
  }

  if (response.status === 401) {
    // If not on login/register, clear token
    if (!path.includes('/auth/')) {
      await removeToken();
    }
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    const errorPayload = data?.error;
    const message = errorPayload?.message || 'Terjadi kesalahan pada sistem.';
    const code = errorPayload?.code || `http_${response.status}`;
    throw new ApiError(message, code, response.status, errorPayload?.details);
  }

  return data as T;
}

export const api = {
  get<T>(path: string, params?: Record<string, any>): Promise<T> {
    return request<T>(path, { method: 'GET', params });
  },
  post<T>(path: string, body?: any): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },
  patch<T>(path: string, body?: any): Promise<T> {
    return request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },
  delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'DELETE' });
  },
};

/**
 * Upload image using expo-file-system binary upload as documented in API.md
 */
export async function uploadImage(uri: string): Promise<string> {
  const token = await getToken();
  const uploadUrl = `${API_BASE_URL}/uploads`;

  const headers: Record<string, string> = {
    'ngrok-skip-browser-warning': '1',
    'Content-Type': 'image/jpeg',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const result = await FileSystem.uploadAsync(uploadUrl, uri, {
      httpMethod: 'POST',
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      headers,
    });

    if (result.status >= 200 && result.status < 300) {
      const data = JSON.parse(result.body);
      return data.url; // e.g. "/uploads/uuid.jpg"
    } else {
      let msg = 'Gagal mengunggah foto.';
      try {
        const errorData = JSON.parse(result.body);
        if (errorData?.error?.message) msg = errorData.error.message;
      } catch {}
      throw new ApiError(msg, 'upload_failed', result.status);
    }
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError('Gagal mengunggah foto: ' + (err.message || 'Error'), 'upload_error');
  }
}
