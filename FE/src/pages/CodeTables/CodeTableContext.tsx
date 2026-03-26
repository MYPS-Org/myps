import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchCodeTableData } from './Service';
import type { CodeTableData } from './Model.d';

interface CodeTableContextValue {
  data: CodeTableData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const CodeTableContext = createContext<CodeTableContextValue>({
  data: null,
  loading: true,
  error: null,
  refetch: async () => {},
});

export const CodeTableProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData]     = useState<CodeTableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCodeTableData();
      if (res.Status === 200 && res.Data) {
        setData(res.Data);
      } else {
        setError('Failed to load code table data.');
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
    <CodeTableContext.Provider value={{ data, loading, error, refetch }}>
      {children}
    </CodeTableContext.Provider>
  );
};

export const useCodeTableContext = () => useContext(CodeTableContext);
