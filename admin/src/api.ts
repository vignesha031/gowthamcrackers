const KEY = 'gc_admin_token';
export const getToken = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const setToken = (t: string | null) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* storage blocked */ } };

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}
let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

type Q = Record<string, string | number | boolean | undefined | null>;
const qs = (q?: Q) => {
  const p = new URLSearchParams();
  Object.entries(q ?? {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, String(v)); });
  const s = p.toString();
  return s ? `?${s}` : '';
};

async function raw(method: string, path: string, body?: unknown, q?: Q): Promise<Response> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`/api${path}${qs(q)}`, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch { throw new ApiError(0, 'Cannot reach the server. Check your connection.'); }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`, code: string | undefined;
    try { const j = await res.json(); msg = j.error ?? msg; code = j.code; } catch { /* not json */ }
    if (res.status === 401 && token && !path.startsWith('/admin/auth/login')) onUnauthorized();
    throw new ApiError(res.status, msg, code);
  }
  return res;
}

export const api = {
  get: async <T = any>(path: string, q?: Q): Promise<T> => (await raw('GET', path, undefined, q)).json(),
  post: async <T = any>(path: string, body?: unknown): Promise<T> => (await raw('POST', path, body ?? {})).json(),
  patch: async <T = any>(path: string, body: unknown): Promise<T> => (await raw('PATCH', path, body)).json(),
  put: async <T = any>(path: string, body: unknown): Promise<T> => (await raw('PUT', path, body)).json(),
  /** Download a CSV (needs the bearer token, so it goes through fetch + blob). */
  download: async (path: string, q: Q | undefined, fallbackName: string) => {
    const res = await raw('GET', path, undefined, q);
    const cd = res.headers.get('Content-Disposition') ?? '';
    const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? fallbackName;
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

export type Page<T> = { items: T[]; pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean } };
