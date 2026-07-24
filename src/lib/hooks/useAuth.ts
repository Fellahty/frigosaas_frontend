import { useEffect, useState } from 'react';
import { apiRequest, getToken, clearToken } from '../api/client';
import { logout as authLogout } from '../auth';
import { clearTenantSession } from '../tenantResolver';

export interface CustomUser {
  id: string;
  name: string;
  phone: string;
  username?: string;
  email?: string;
  role: string;
  tenantId: string;
  userType?: 'manager' | 'client';
}

export const useAuth = () => {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const result = await apiRequest<{ user: CustomUser }>('/auth/me');
        setUser(result.user);
        localStorage.setItem('user', JSON.stringify(result.user));
        if (result.user.tenantId) {
          localStorage.setItem('tenantId', result.user.tenantId);
        }
      } catch {
        clearToken();
        localStorage.removeItem('user');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const logout = async () => {
    try {
      authLogout();
      clearTenantSession();
      setUser(null);
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur' };
    }
  };

  return {
    user,
    setUser,
    loading,
    logout,
  };
};
