import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/hooks/useAuth';
import { getToken } from '../lib/api/client';

export const ProtectedRoute: React.FC = () => {
  const { user, loading } = useAuth();
  const hasToken = !!getToken();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-indigo-600 mx-auto mb-4" />
          <p className="text-sm text-slate-500">Vérification de la session...</p>
        </div>
      </div>
    );
  }

  if (!user || !hasToken) {
    const slug = localStorage.getItem('tenantSlug');
    return <Navigate to={slug ? `/login/${slug}` : '/login'} replace />;
  }

  return <Outlet />;
};
