import { useEffect, useRef, useState } from 'react';
import { signalRService } from '../services/signalrService';

export const useSignalR = (url: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listenersRef = useRef<Map<string, (...args: any[]) => void>>(new Map());

  useEffect(() => {
    const connect = async () => {
      try {
        await signalRService.startConnection(url);
        setIsConnected(true);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Connection failed');
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      // Clean up listeners
      listenersRef.current.forEach((callback, methodName) => {
        signalRService.off(methodName, callback);
      });
      listenersRef.current.clear();
      
      signalRService.stopConnection();
      setIsConnected(false);
    };
  }, [url]);

  const on = (methodName: string, callback: (...args: any[]) => void) => {
    signalRService.on(methodName, callback);
    listenersRef.current.set(methodName, callback);
  };

  const off = (methodName: string) => {
    const callback = listenersRef.current.get(methodName);
    if (callback) {
      signalRService.off(methodName, callback);
      listenersRef.current.delete(methodName);
    }
  };

  const invoke = async (methodName: string, ...args: any[]) => {
    return await signalRService.invoke(methodName, ...args);
  };

  return {
    isConnected,
    error,
    on,
    off,
    invoke
  };
};
