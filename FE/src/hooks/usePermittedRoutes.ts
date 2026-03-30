// src/hooks/usePermittedRoutes.ts
import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import protectedRoutes from '../components/Routes';

export function usePermittedRoutes() {
  const { isAuthenticated, ViewAccess } = useAuth();

  const permittedRoutes = useMemo(() => {
    if (!isAuthenticated) return [];

    return protectedRoutes.filter((route) => {
      if (!route.path) return false;

      // Check if any ViewAccess entry matches the route path
      // e.g. ViewAccess = ["/dashboard"] matches route.path = "/dashboard"
      // Also allows sub-routes: "/programs/programdetails/:program" if "/programs" is in ViewAccess
      return ViewAccess.some((accessPath) =>
        route.path === accessPath || route.path?.startsWith(accessPath + '/')
      );
    });
  }, [isAuthenticated, ViewAccess]);

  return permittedRoutes;
}