/** Client for the Mango Invoice backend (../backend). Admin JWT is kept in localStorage. */
const BASE = ((import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_API_URL ?? '').replace(/\/$/, '');
const TOKEN_KEY = 'mango_admin_token';

export class ApiError extends Error {
  constructor(public status: number, message: string, public code = 'error', public details?: unknown) { super(message); }
}

export const token = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const UNAUTHORIZED = 'mango-admin:unauthorized';

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> } = {}): Promise<T> {
  const q = opts.query ? '?' + new URLSearchParams(Object.entries(opts.query).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString() : '';
  const headers: Record<string, string> = { Accept: 'application/json' };
  const t = token.get();
  if (t) headers.Authorization = `Bearer ${t}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/admin${path}${q}`, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'), headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Server se connect nahi ho paya. Backend chal raha hai? (cd backend && npm run dev)', 'network');
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event(UNAUTHORIZED));
    throw new ApiError(res.status, data?.error?.message ?? `Request failed (${res.status})`, data?.error?.code, data?.error?.details);
  }
  return data as T;
}
