// src/components/AppRoutes.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './protectedroutes';
import AppLayout from '../layouts/AppLayout';
import LoginForm from '../pages/login/Page';
import Layout from '../pages/Layouts/Layout';
import GisPlaygroundPage from '../pages/GisPlayground/GisPlaygroundPage';
import { usePermittedRoutes } from '../hooks/usePermittedRoutes';

export default function AppRoutes() {
  const permittedRoutes = usePermittedRoutes();

  return (
    <Routes>
      <Route path="/login" element={<LoginForm />} />

      <Route element={<AppLayout />}>
        {permittedRoutes.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={
              <ProtectedRoute>
                {route.element}
              </ProtectedRoute>
            }
          />
        ))}
      </Route>

      <Route
        path="/layout"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      />

      <Route
        path="/gis-playground"
        element={
          <ProtectedRoute>
            <GisPlaygroundPage />
          </ProtectedRoute>
        }
      />

      {/* Redirect unknown routes based on access */}
      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}