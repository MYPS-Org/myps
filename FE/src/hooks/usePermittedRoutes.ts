// src/hooks/usePermittedRoutes.ts
import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import protectedRoutes from '../components/Routes';

export function usePermittedRoutes() {
  const { isAuthenticated, ViewAccess } = useAuth();

  const permittedRoutes = useMemo(() => {
    if (!isAuthenticated) return [];

    return protectedRoutes.filter((route) => {
      if (!route.RouteName) return false;

      return ViewAccess.some((accessPath) =>
        route.RouteName === accessPath
      );
    });
  }, [isAuthenticated, ViewAccess]);

  return permittedRoutes;
}