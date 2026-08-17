// The API surface is mounted under an obfuscated segment in production
// (API_MOUNT_PATH on the server, mirrored by NEXT_PUBLIC_API_MOUNT on the web).
// This keeps the real endpoints out of path-enumeration reach.
import type { AuthUser } from './auth';
import type {
  EventView,
  NearbyProfileView,
  ProfileRedNoteView,
  ApplicationAdminView,
  PlatformSettingsView,
  UpdateSettingsInput,
  MemberView,
  NotificationView,
  GlobalSearchResult,
} from './types';

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
  /** Member self-service event submission (status: pending, awaiting review). */
  createEvent: (body: unknown) => request<EventView>('POST', '/events', body),
  /** Events the calling member created. */
  getMyEvents: () => request<EventView[]>('GET', '/events/mine'),
  /** Members in the caller's district who opted into WeChat-Nearby (premium). */
  getNearby: (params?: { city?: string; district?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.city) qs.set('city', params.city);
    if (params?.district) qs.set('district', params.district);
    if (params?.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return request<NearbyProfileView[]>('GET', `/discover/nearby${q ? `?${q}` : ''}`);
  },
  /** Tier-gated RedNote card for another member (free viewers see less). */
  getProfile: (targetId: string) => request<ProfileRedNoteView>('GET', `/profile/${targetId}`),
  /** Admin: list vetting applications (optionally filtered by status). */
  listApplications: (status?: string) =>
    request<ApplicationAdminView[]>(
      'GET',
      `/admin/applications${status ? `?status=${status}` : ''}`,
    ),
  /** Admin: accept/deny a vetting application with an optional reason. */
  reviewApplication: (id: string, body: { status: string; adminNotes?: string }) =>
    request<ApplicationAdminView>('POST', `/admin/applications/${id}/review`, body),
  /** Admin CRM: read the current platform gating configuration. */
  getSettings: () => request<PlatformSettingsView>('GET', '/settings'),
  /** Admin CRM: update the platform gating configuration. */
  updateSettings: (body: UpdateSettingsInput) =>
    request<PlatformSettingsView>('PUT', '/settings', body),

  // ── Admin: members (server-side pagination + search) ─────────────────────
  /** Returns a page of members plus the total count for pagination controls. */
  listMembers: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    role?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.search) qs.set('search', params.search);
    if (params?.status) qs.set('status', params.status);
    if (params?.role) qs.set('role', params.role);
    const q = qs.toString();
    return request<{ items: MemberView[]; total: number }>(
      'GET',
      `/admin/members${q ? `?${q}` : ''}`,
    );
  },

  // ── In-app notifications ────────────────────────────────────────────────
  listNotifications: () => request<NotificationView[]>('GET', '/notifications'),
  unreadNotificationCount: () => request<{ count: number }>('GET', '/notifications/unread-count'),
  markNotificationRead: (id: string) =>
    request<{ marked: boolean }>('PUT', `/notifications/${id}/read`),
  markAllNotificationsRead: () => request<{ marked: boolean }>('PUT', '/notifications/read-all'),

  // ── Admin global search (members / applications / subscriptions) ────────
  globalSearch: (q: string) =>
    request<GlobalSearchResult>('GET', `/admin/search?q=${encodeURIComponent(q)}`),
};

/**
 * Exchanges a Clerk session JWT for AfriConnect backend tokens.
 *
 * The web app authenticates the browser with Clerk (sign-in / sign-up / sign-
 * out all live in Clerk), but every API call downstream uses our own access
 * token. This call is the bridge: it presents the Clerk token to the backend,
 * which verifies it (strict alg + issuer + expiry, cached JWKS) and returns our
 * tokens plus the AfriConnect user record. Returns null if Clerk is not
 * configured or the exchange fails, so callers can fall back to the OTP flow.
 */
export async function exchangeClerkToken(
  clerkToken: string,
): Promise<{ accessToken: string; refreshToken: string; user: AuthUser } | null> {
  try {
    const res = await request<{
      accessToken: string;
      refreshToken: string;
      user: AuthUser;
    }>('POST', '/auth/clerk/exchange', { token: clerkToken });
    return res;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Uploads + analytics (Changes A & C)
// ─────────────────────────────────────────────────────────────────────────────

export interface Bucket {
  date: string; // YYYY-MM-DD (UTC)
  count: number;
}

export interface AnalyticsBundle {
  windowDays: 7 | 30 | 90;
  startDate: string;
  endDate: string;
  series: {
    profileViews: Bucket[];
    likesSent: Bucket[];
    likesReceived: Bucket[];
    mutualMatches: Bucket[];
    eventsRsvpd: Bucket[];
  };
  totals: {
    profileViews: number;
    likesSent: number;
    likesReceived: number;
    mutualMatches: number;
    eventsRsvpd: number;
  };
}

export type UploadFolder = 'vetting' | 'photos' | 'proof';

/**
 * Uploads a file to the backend proxy (`POST /upload`). The backend validates
 * magic bytes and forwards to R2; credentials never reach the browser.
 */
export async function uploadFile(
  file: File,
  folder: UploadFolder = 'vetting',
): Promise<{ url: string; publicId?: string }> {
  const token = getAccessToken();
  const deviceId = getDeviceId();
  const form = new FormData();
  form.append('file', file);

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (deviceId) headers['X-Device-Id'] = deviceId;
  // Content-Type is intentionally omitted so the browser sets the multipart
  // boundary.

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  let res: Response;
  try {
    res = await fetch(apiPath(`/upload?folder=${folder}`), {
      method: 'POST',
      headers,
      body: form,
      credentials: 'include',
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError('Upload timed out', 'TIMEOUT', 408);
    }
    throw new ApiError('Network error', 'NETWORK', 0);
  } finally {
    clearTimeout(timeout);
  }

  let json: ApiResponse<{ url: string; publicId?: string }>;
  try {
    json = (await res.json()) as ApiResponse<{ url: string; publicId?: string }>;
  } catch {
    throw new ApiError(`Unexpected response (${res.status})`, 'BAD_RESPONSE', res.status);
  }
  if (!json.success || json.error) {
    const err = json.error ?? { code: 'UNKNOWN', message: `Upload failed (${res.status})` };
    throw new ApiError(err.message, err.code, res.status, err.field, err.details);
  }
  return json.data;
}

/** Records that the current member viewed another profile (Change C). */
export async function trackProfileView(viewedUserId: string): Promise<{ recorded: boolean }> {
  return api.post<{ recorded: boolean }>('/analytics/profile-view', { viewedUserId });
}

/** Fetches the caller's analytics bundle for a 7/30/90-day window (Change C). */
export async function getMyAnalytics(windowDays: 7 | 30 | 90 = 30): Promise<AnalyticsBundle> {
  return api.get<AnalyticsBundle>(`/analytics/me?window=${windowDays}`);
}

export type { ApiResponse };
