/**
 * Thin fetch wrapper for the Mango Invoice API.
 * - Access token is kept in memory; the refresh token in localStorage so a reload keeps you logged in.
 * - A 401 triggers one silent refresh and a retry.
 * - The selected business goes in the X-Business-Id header.
 */

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const REFRESH_KEY = 'mango_refresh_token';
const BUSINESS_KEY = 'mango_business_id';

export class ApiError extends Error {
  constructor(public status: number, message: string, public code = 'ERROR', public details?: unknown) {
    super(message);
  }
  /** Human-readable message including pre-validation issues, for toasts. */
  get display() {
    if (Array.isArray(this.details) && this.details.length) {
      const lines = (this.details as { message?: string; path?: string }[]).slice(0, 3).map(d => d.message ?? String(d));
      return `${this.message}: ${lines.join(' · ')}`;
    }
    return this.message;
  }
}

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onSessionExpired: (() => void) | null = null;

export const session = {
  setTokens(access: string, refresh: string) {
    accessToken = access;
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    accessToken = null;
    localStorage.removeItem(REFRESH_KEY);
  },
  hasRefreshToken: () => !!localStorage.getItem(REFRESH_KEY),
  refreshToken: () => localStorage.getItem(REFRESH_KEY),
  businessId: () => localStorage.getItem(BUSINESS_KEY),
  setBusinessId(id: string | null) {
    if (id) localStorage.setItem(BUSINESS_KEY, id);
    else localStorage.removeItem(BUSINESS_KEY);
  },
  onExpired(fn: () => void) {
    onSessionExpired = fn;
  }
};

async function refresh(): Promise<boolean> {
  const token = session.refreshToken();
  if (!token) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${BASE}/api/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: token }) });
      if (!res.ok) return false;
      const body = await res.json();
      session.setTokens(body.accessToken, body.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

export async function api<T = unknown>(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown, retry = true): Promise<T> {
  // login / OTP / refresh calls never need (or trigger) a token refresh; /api/auth/me does
  const isLoginCall = /^\/api\/auth\/(otp|login|refresh|logout)/.test(path);
  if (!accessToken && retry && session.hasRefreshToken() && !isLoginCall) await refresh();
  const headers: Record<string, string> = { 'X-Platform': 'Web' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const biz = session.businessId();
  if (biz) headers['X-Business-Id'] = biz;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Is the API running?', 'NETWORK');
  }

  if (res.status === 401 && retry && !isLoginCall) {
    if (await refresh()) return api<T>(method, path, body, false);
    session.clear();
    onSessionExpired?.();
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const e = data?.error ?? {};
    throw new ApiError(res.status, e.message ?? `Request failed (${res.status})`, e.code, e.details);
  }
  return data as T;
}

export const get = <T>(path: string) => api<T>('GET', path);
export const post = <T>(path: string, body?: unknown) => api<T>('POST', path, body ?? {});
export const patch = <T>(path: string, body: unknown) => api<T>('PATCH', path, body);
export const put = <T>(path: string, body: unknown) => api<T>('PUT', path, body);
export const del = <T>(path: string, body?: unknown) => api<T>('DELETE', path, body);

/** Downloads a non-JSON response (XML, CSV…) with the same auth headers and token refresh as api(). */
export async function download(path: string, filename: string, retry = true): Promise<void> {
  if (!accessToken && session.hasRefreshToken()) await refresh();
  const headers: Record<string, string> = { 'X-Platform': 'Web' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const biz = session.businessId();
  if (biz) headers['X-Business-Id'] = biz;
  const res = await fetch(`${BASE}${path}`, { headers });
  if (res.status === 401 && retry && (await refresh())) return download(path, filename, false);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data?.error?.message ?? `Download failed (${res.status})`, data?.error?.code);
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Error → message for a toast. */
export const errMsg = (e: unknown) => (e instanceof ApiError ? e.display : e instanceof Error ? e.message : 'Something went wrong');
