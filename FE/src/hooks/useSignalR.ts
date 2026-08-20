import { useCallback, useEffect, useRef, useState } from 'react';
import { signalRService } from '../services/signalrService';

// useSignalR no longer requires a URL. The connection should be started once
// (for example in `src/main.tsx`) via `signalRService.startConnection(...)`.
// Pass a `hub` name to target a non-default connection (e.g. the import hub) —
// omit it to use the original shared `/notificationHub` connection.
export const useSignalR = (hub?: string) => {
  const [isConnected, setIsConnected] = useState<boolean>(() => signalRService.isConnected(hub));
  const [error] = useState<string | null>(null);
  const listenersRef = useRef<Map<string, (...args: any[]) => void>>(new Map());

  useEffect(() => {
    // Initialize isConnected state from the service. The service manages the
    // actual connection lifetime (main.tsx should call startConnection).
    setIsConnected(signalRService.isConnected(hub));

    return () => {
      // Clean up listeners only; do NOT stop the shared connection here.
      listenersRef.current.forEach((callback, methodName) => {
        signalRService.off(methodName, callback, hub);
      });
      listenersRef.current.clear();
    };
  }, [hub]);

  const on = useCallback((methodName: string, callback: (...args: any[]) => void) => {
    signalRService.on(methodName, callback, hub);
    listenersRef.current.set(methodName, callback);
  }, [hub]);

  const off = useCallback((methodName: string) => {
    const callback = listenersRef.current.get(methodName);
    if (callback) {
      signalRService.off(methodName, callback, hub);
      listenersRef.current.delete(methodName);
    } else {
      // If no specific callback tracked, remove all handlers for the method name
      signalRService.off(methodName, undefined, hub);
    }
  }, [hub]);

  const invoke = useCallback(async (methodName: string, ...args: any[]) => {
    return hub
      ? await signalRService.invokeOn(hub, methodName, ...args)
      : await signalRService.invoke(methodName, ...args);
  }, [hub]);

  return {
    isConnected,
    error,
    on,
    off,
    invoke
  };
};
