import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export const ProtectedRoute = ({ children, roles, redirect404 = false }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && !roles.includes(user.role)) {
    if (redirect404) {
      return <Navigate to="/404" replace state={{ reason: 'not-authorized' }} />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};
