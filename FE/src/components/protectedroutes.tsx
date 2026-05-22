import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string | string[];
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredRole,
  redirectTo = '/login' 
}) => {
  const { isAuthenticated, isLoading, hasRole } = useAuth();
  const location = useLocation();

  // Show loading while validating session
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Check role-based access if required
  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  // const { isConnected, error, on, off, invoke } = useSignalR(`${import.meta.env.VITE_API_BASE_URL}:5001/notificationHub`);
  //   useEffect(() => {
  //     if (isConnected) {
  //       on('ReceiveNotification', (message: string) => {
  //         console.log('Notification', message)
  //       });
  //       // Join chat room
  //       //invoke('JoinRoom', 'general');
  
  //       return () => {
  //         off('ReceiveNotification');
  //       };
  //     }
  //   }, [isConnected, on, off, invoke]);
  return <>{children}</>;
};

export default ProtectedRoute;
