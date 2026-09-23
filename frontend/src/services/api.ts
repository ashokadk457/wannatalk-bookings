const tokenKey = 'wannatalkApiToken';
const apiBase = import.meta.env.VITE_API_BASE || '/api';
export const getToken = () => localStorage.getItem(tokenKey);
export function setToken(token: string | null) {
  if (token) localStorage.setItem(tokenKey, token);
  else localStorage.removeItem(tokenKey);
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${apiBase}${path}`, { ...options, headers });
  const payload = response.status === 204 ? undefined : await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') {
      setToken(null);
      window.dispatchEvent(new Event('session-expired'));
    }
    throw new ApiError(payload?.error || `Request failed (${response.status})`, response.status);
  }
  return payload as T;
}
export function mutate<T>(path: string, method: string, body?: unknown) {
  return api<T>(path, { method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}
