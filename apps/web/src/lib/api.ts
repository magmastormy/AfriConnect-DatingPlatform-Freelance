// The API surface is mounted under an obfuscated segment in production
// (API_MOUNT_PATH on the server, mirrored by NEXT_PUBLIC_API_MOUNT on the web).
// This keeps the real endpoints out of path-enumeration reach.
const API_MOUNT = (process.env.NEXT_PUBLIC_API_MOUNT || 'api').replace(/^\/+|\/+$/g, '');

function apiPath(path: string): string {
  return `/${API_MOUNT}/v1${path}`;
}

const TOKEN_KEY = 'africonnect.accessToken';
const REFRESH_KEY = 'africonnect.refreshToken';
const DEVICE_KEY = 'africonnect.deviceId';

// Stable per-browser device identifier used for token theft detection. Stored in
// sessionStorage (cleared on tab close) so a stolen access/refresh token replayed
// from another device fails the server-side device binding check.
function getDeviceId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = window.sessionStorage.getItem(DEVICE_KEY);
    if (!id) {
      // 24 random bytes -> base64url, ~32 chars, matches server's validation regex.
      const bytes = crypto.getRandomValues(new Uint8Array(24));
      id = btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      window.sessionStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

// In-memory cache so a refresh updates every in-flight caller immediately.
let memAccess: string | null = null;
let memRefresh: string | null = null;

function read(key: string): string | null {
  if (memAccess !== null && key === TOKEN_KEY) return memAccess;
  if (memRefresh !== null && key === REFRESH_KEY) return memRefresh;
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  if (key === TOKEN_KEY) memAccess = value;
  if (key === REFRESH_KEY) memRefresh = value;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* storage may be unavailable (private mode); memory cache still works */
  }
}

function remove(key: string): void {
  if (key === TOKEN_KEY) memAccess = null;
  if (key === REFRESH_KEY) memRefresh = null;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function getAccessToken(): string | null {
  return read(TOKEN_KEY);
}

export function setTokens(access: string, refresh: string): void {
  write(TOKEN_KEY, access);
  write(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  remove(TOKEN_KEY);
  remove(REFRESH_KEY);
}

export function getRefreshToken(): string | null {
  return read(REFRESH_KEY);
}

export class ApiError extends Error {
  code: string;
  field?: string;
  details?: unknown;
  status: number;
  constructor(message: string, code: string, status: number, field?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.field = field;
    this.details = details;
    this.status = status;
  }
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: { timestamp: string; [k: string]: unknown };
  error: { code: string; message: string; field?: string; details?: unknown } | null;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const deviceId = getDeviceId();
  if (deviceId) headers['X-Device-Id'] = deviceId;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let res: Response;
  try {
    res = await fetch(apiPath(path), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'include',
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError('Request timed out', 'TIMEOUT', 408);
    }
    throw new ApiError('Network error', 'NETWORK', 0);
  } finally {
    clearTimeout(timeout);
  }

  let json: ApiResponse<T>;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(`Unexpected response (${res.status})`, 'BAD_RESPONSE', res.status);
  }

  if (!json.success || json.error) {
    const err = json.error ?? { code: 'UNKNOWN', message: `Request failed (${res.status})` };
    // Never surface token/PII; forward only the safe server message.
    throw new ApiError(err.message, err.code, res.status, err.field, err.details);
  }
  return json.data;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};

export type { ApiResponse };
