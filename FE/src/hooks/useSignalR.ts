import { useCallback, useEffect, useRef, useState } from 'react';
import { signalRService } from '../services/signalrService';

// useSignalR no longer requires a URL. The connection should be started once
// (for example in `src/main.tsx`) via `signalRService.startConnection(...)`.
export const useSignalR = () => {
  const [isConnected, setIsConnected] = useState<boolean>(() => signalRService.isConnected());
  const [error] = useState<string | null>(null);
  const listenersRef = useRef<Map<string, (...args: any[]) => void>>(new Map());

  useEffect(() => {
    // Initialize isConnected state from the service. The service manages the
    // actual connection lifetime (main.tsx should call startConnection).
    setIsConnected(signalRService.isConnected());

    return () => {
      // Clean up listeners only; do NOT stop the shared connection here.
      listenersRef.current.forEach((callback, methodName) => {
        signalRService.off(methodName, callback);
      });
      listenersRef.current.clear();
    };
  }, []);

  const on = useCallback((methodName: string, callback: (...args: any[]) => void) => {
    signalRService.on(methodName, callback);
    listenersRef.current.set(methodName, callback);
  }, []);

  const off = useCallback((methodName: string) => {
    const callback = listenersRef.current.get(methodName);
    if (callback) {
      signalRService.off(methodName, callback);
      listenersRef.current.delete(methodName);
    } else {
      // If no specific callback tracked, remove all handlers for the method name
      signalRService.off(methodName);
    }
  }, []);

  const invoke = useCallback(async (methodName: string, ...args: any[]) => {
    return await signalRService.invoke(methodName, ...args);
  }, []);

  return {
    isConnected,
    error,
    on,
    off,
    invoke
  };
};
