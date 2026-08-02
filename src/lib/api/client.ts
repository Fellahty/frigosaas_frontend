const API_URL = import.meta.env.VITE_API_URL || '/api';

export function getToken(): string | null {
  return localStorage.getItem('token');
}

export function setToken(token: string) {
  localStorage.setItem('token', token);
}

export function clearToken() {
  localStorage.removeItem('token');
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getSelectedSeasonHeader(): string | null {
  try {
    return sessionStorage.getItem('frigosmart.selectedSeasonId');
  } catch {
    return null;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  auth = true
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const seasonId = getSelectedSeasonHeader();
  if (seasonId && !headers['X-Selected-Season-Id']) {
    headers['X-Selected-Season-Id'] = seasonId;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(body.error || res.statusText, res.status, body.code, body.details);
  }

  return body.data as T;
}

export async function apiUpload(file: File, storagePath: string): Promise<string> {
  const token = getToken();
  const form = new FormData();
  form.append('file', file);
  form.append('path', storagePath);

  const res = await fetch(`${API_URL}/uploads`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  const body = await res.json();
  if (!res.ok) throw new ApiError(body.error || 'Upload failed', res.status);

  const base = API_URL.replace('/api', '');
  return `${base}${body.data.url}`;
}
