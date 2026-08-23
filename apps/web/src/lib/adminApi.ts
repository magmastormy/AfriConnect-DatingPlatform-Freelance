import type {
  ApplicationAdminView,
  EventView,
  MemberView,
  MemberDetail,
  RoleDescriptor,
  PlatformSettingsView,
  UpdateSettingsInput,
  SubscriptionAdminView,
  AdminAuditView,
  GlobalSearchResult,
} from '@/lib/types';
import type { EventStatus } from '@/lib/shared';

// Separate admin API surface — uses its OWN tokens (africonnect.admin*) so Clerk/user tokens never collide.
// Mount is the same obfuscated segment, but the storage keys are distinct.

const API_MOUNT = (process.env.NEXT_PUBLIC_API_MOUNT || 'api').replace(/^\/+|\/+$/g, '');

function apiPath(path: string): string {
  return `/${API_MOUNT}/v1${path}`;
}

const ADMIN_ACCESS = 'africonnect.adminAccessToken';
const ADMIN_REFRESH = 'africonnect.adminRefreshToken';
const ADMIN_DEVICE = 'africonnect.adminDeviceId';

function getAdminDeviceId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = window.sessionStorage.getItem(ADMIN_DEVICE);
    if (!id) {
      const bytes = crypto.getRandomValues(new Uint8Array(24));
      id = btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      window.sessionStorage.setItem(ADMIN_DEVICE, id);
    }
    return id;
  } catch {
    return '';
  }
}

let memAdminAccess: string | null = null;
let memAdminRefresh: string | null = null;

function readAdmin(key: string): string | null {
  if (key === ADMIN_ACCESS && memAdminAccess) return memAdminAccess;
  if (key === ADMIN_REFRESH && memAdminRefresh) return memAdminRefresh;
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeAdmin(key: string, value: string): void {
  if (key === ADMIN_ACCESS) memAdminAccess = value;
  if (key === ADMIN_REFRESH) memAdminRefresh = value;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {}
}

function removeAdmin(key: string): void {
  if (key === ADMIN_ACCESS) memAdminAccess = null;
  if (key === ADMIN_REFRESH) memAdminRefresh = null;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {}
}

export function getAdminAccessToken(): string | null {
  return readAdmin(ADMIN_ACCESS);
}
export function getAdminRefreshToken(): string | null {
  return readAdmin(ADMIN_REFRESH);
}
export function setAdminTokens(access: string, refresh: string): void {
  writeAdmin(ADMIN_ACCESS, access);
  writeAdmin(ADMIN_REFRESH, refresh);
}
export function clearAdminTokens(): void {
  removeAdmin(ADMIN_ACCESS);
  removeAdmin(ADMIN_REFRESH);
}

export class AdminApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'AdminApiError';
    this.code = code;
    this.status = status;
  }
}

interface AdminApiResponse<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
}

async function adminRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  withAuth = true,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (withAuth) {
    const token = getAdminAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const deviceId = getAdminDeviceId();
  if (deviceId) headers['X-Device-Id'] = deviceId;

  const res = await fetch(apiPath(path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  let json: AdminApiResponse<T>;
  try {
    json = (await res.json()) as AdminApiResponse<T>;
  } catch {
    throw new AdminApiError(`Unexpected response (${res.status})`, 'BAD_RESPONSE', res.status);
  }
  if (!json.success || json.error) {
    const err = json.error ?? { code: 'UNKNOWN', message: `Request failed (${res.status})` };
    throw new AdminApiError(err.message, err.code, res.status);
  }
  return json.data;
}

export const adminApi = {
  login: (email: string, password: string) =>
    adminRequest<{
      accessToken: string;
      refreshToken: string;
      user: { id: string; email: string; role: string; status: string };
    }>('POST', '/admin/auth/login', { email, password }, false),
  bootstrap: (email: string, password: string, setupToken: string) =>
    adminRequest<{
      accessToken: string;
      refreshToken: string;
      user: { id: string; email: string; role: string; status: string };
    }>('POST', '/admin/auth/bootstrap', { email, password, setupToken }, false),
  refresh: (refreshToken: string) =>
    adminRequest<{ accessToken: string; refreshToken: string }>(
      'POST',
      '/admin/auth/refresh',
      { refreshToken },
      false,
    ),
  me: () =>
    adminRequest<{ user: { userId: string; role: string; email: string; status: string } }>(
      'GET',
      '/admin/auth/me',
    ),
  logout: (refreshToken: string) =>
    adminRequest<{ loggedOut: boolean }>('POST', '/admin/auth/logout', { refreshToken }, false),
  listApplications: (status?: string) =>
    adminRequest<ApplicationAdminView[]>(
      'GET',
      `/admin/applications${status ? `?status=${status}` : ''}`,
    ),
  reviewApplication: (id: string, body: { status: string; adminNotes?: string }) =>
    adminRequest<ApplicationAdminView>('POST', `/admin/applications/${id}/review`, body),

  // ── Audit (any administrator) ─────────────────────────────────────────────
  listAudit: () => adminRequest<AdminAuditView[]>('GET', '/admin/audit'),

  // ── Members / Support ─────────────────────────────────────────────────────
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
    return adminRequest<{ items: MemberView[]; total: number }>(
      'GET',
      `/admin/members${q ? `?${q}` : ''}`,
    );
  },
  getMember: (userId: string) => adminRequest<MemberDetail>('GET', `/admin/members/${userId}`),
  suspendMember: (userId: string, body?: { reason?: string }) =>
    adminRequest<{ id: string; status: string }>(
      'POST',
      `/admin/members/${userId}/suspend`,
      body ?? {},
    ),
  unsuspendMember: (userId: string) =>
    adminRequest<{ id: string; status: string }>('POST', `/admin/members/${userId}/unsuspend`, {}),
  banMember: (userId: string, body?: { reason?: string }) =>
    adminRequest<{ id: string; status: string }>(
      'POST',
      `/admin/members/${userId}/ban`,
      body ?? {},
    ),
  unbanMember: (userId: string) =>
    adminRequest<{ id: string; status: string }>('POST', `/admin/members/${userId}/unban`, {}),
  verifyMember: (userId: string, body: { emailVerified?: boolean; phoneVerified?: boolean }) =>
    adminRequest<{ id: string; verified: boolean }>(
      'POST',
      `/admin/members/${userId}/verify`,
      body,
    ),

  // ── SuperAdmin: admins + role matrix ───────────────────────────────────────
  listAdmins: () => adminRequest<MemberView[]>('GET', '/admin/admins'),
  roleMatrix: () => adminRequest<RoleDescriptor[]>('GET', '/admin/roles'),
  assignRole: (userId: string, body: { role: string }) =>
    adminRequest<{ id: string; role: string }>('POST', `/admin/admins/${userId}/role`, body),

  // ── Billing ────────────────────────────────────────────────────────────────
  listSubscriptions: (status?: string) =>
    adminRequest<SubscriptionAdminView[]>(
      'GET',
      `/admin/subscriptions${status ? `?status=${status}` : ''}`,
    ),
  cancelSubscription: (userId: string, body: { atPeriodEnd: boolean; reason?: string }) =>
    adminRequest<{ id: string; cancelled: boolean }>(
      'POST',
      `/admin/subscriptions/${userId}/cancel`,
      body,
    ),
  grantSubscription: (userId: string, body: { plan: string; months: number; reason?: string }) =>
    adminRequest<{ id: string; granted: boolean }>(
      'POST',
      `/admin/subscriptions/${userId}/grant`,
      body,
    ),

  // ── Events ─────────────────────────────────────────────────────────────────
  listEvents: () => adminRequest<EventView[]>('GET', '/admin/events'),
  moderateEvent: (
    id: string,
    body: { status?: EventStatus; featured?: boolean; reason?: string },
  ) => adminRequest<EventView>('POST', `/admin/events/${id}/moderate`, body),

  // ── Content / broadcast ────────────────────────────────────────────────────
  broadcast: (body: {
    type: string;
    title: string;
    body: string;
    channel: string;
    role?: string;
    link?: string;
  }) => adminRequest<{ queued: number }>('POST', '/admin/notifications/broadcast', body),

  // ── Platform settings (CRM) ────────────────────────────────────────────────
  getSettings: () => adminRequest<PlatformSettingsView>('GET', '/settings'),
  updateSettings: (body: UpdateSettingsInput) =>
    adminRequest<PlatformSettingsView>('PUT', '/settings', body),

  // ── Global search (any administrator) ─────────────────────────────────────
  globalSearch: (q: string) =>
    adminRequest<GlobalSearchResult>('GET', `/admin/search?q=${encodeURIComponent(q)}`),
};
