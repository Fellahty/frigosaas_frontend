import { apiRequest, setToken, clearToken, ApiError } from './api/client.js';
import { clearTenantSession } from './tenantResolver.js';

export { ApiError };

export interface UserCredentials {
  id: string;
  name: string;
  phone: string;
  username?: string;
  email?: string;
  password?: string;
  role: 'admin' | 'manager' | 'viewer' | 'client' | 'operator';
  isActive: boolean;
  tenantId: string;
}

interface LoginResponse {
  token: string;
  user: UserCredentials & { userType: 'manager' | 'client' };
}

export const authenticateUser = async (
  loginField: string,
  password: string,
  tenantId: string,
  userType: 'manager' | 'client' = 'manager'
): Promise<UserCredentials | null> => {
  try {
    const result = await apiRequest<LoginResponse>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ loginField, password, tenantId, userType }),
      },
      false
    );

    setToken(result.token);
    return result.user;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    return null;
  }
};

export const getUserByUsername = async (
  username: string,
  tenantId: string
): Promise<UserCredentials | null> => {
  try {
    const users = await apiRequest<UserCredentials[]>(`/tenants/${tenantId}/users`);
    return users.find((u) => u.username === username) || null;
  } catch {
    return null;
  }
};

export const logout = () => {
  clearToken();
  localStorage.removeItem('user');
  // Conserver tenantSlug pour redirection login
  localStorage.removeItem('tenantId');
};
