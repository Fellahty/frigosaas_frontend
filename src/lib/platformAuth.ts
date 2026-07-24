const API_URL = import.meta.env.VITE_API_URL || '/api';
const PLATFORM_TOKEN_KEY = 'platform_token';
const PLATFORM_USER_KEY = 'platform_user';

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'support' | 'billing';
  scope: 'platform';
}

export function getPlatformToken(): string | null {
  return localStorage.getItem(PLATFORM_TOKEN_KEY);
}

export function setPlatformToken(token: string) {
  localStorage.setItem(PLATFORM_TOKEN_KEY, token);
}

export function clearPlatformAuth() {
  localStorage.removeItem(PLATFORM_TOKEN_KEY);
  localStorage.removeItem(PLATFORM_USER_KEY);
}

export function getPlatformUser(): PlatformUser | null {
  const raw = localStorage.getItem(PLATFORM_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PlatformUser;
  } catch {
    return null;
  }
}

export function setPlatformUser(user: PlatformUser) {
  localStorage.setItem(PLATFORM_USER_KEY, JSON.stringify(user));
}

export async function platformApiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getPlatformToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || res.statusText);
  return body.data as T;
}

export async function loginPlatformAdmin(email: string, password: string): Promise<PlatformUser> {
  const result = await platformApiRequest<{ token: string; user: PlatformUser }>(
    '/platform/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) }
  );
  setPlatformToken(result.token);
  setPlatformUser(result.user);
  return result.user;
}
