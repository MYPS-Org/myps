import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchAdminAreas } from './Service';
import type { AdminAreaData } from './Model.d';

interface AdminAreaContextValue {
  data: AdminAreaData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const AdminAreaContext = createContext<AdminAreaContextValue>({
  data: null,
  loading: true,
  error: null,
  refetch: async () => {},
});

export const AdminAreaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData]       = useState<AdminAreaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminAreas();
      if (res.Status === 200 && res.Data) {
        setData(res.Data);
      } else {
        setError('Failed to load admin area data.');
      }
    } catch {
      setError('Network error – could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return (
    <AdminAreaContext.Provider value={{ data, loading, error, refetch }}>
      {children}
    </AdminAreaContext.Provider>
  );
};

export const useAdminAreaContext = () => useContext(AdminAreaContext);
