import { Navigate } from 'react-router-dom';
import { getPlatformToken } from '../../lib/platformAuth';

export const AdminProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = getPlatformToken();
  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
};
