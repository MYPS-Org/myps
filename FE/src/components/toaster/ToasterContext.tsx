import React, { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { Toaster } from "./toaster";

type ToastType = "success" | "error" | "info" | "warning";

export interface ToastAction {
  label: string;
  href: string;
}

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  /** Optional call-to-action link (e.g. "View Report"). Presence suppresses auto-dismiss
   *  so the user has time to act on it — closed manually via the toast's X button instead. */
  action?: ToastAction;
}

interface ToastContextProps {
  showToast: (toast: Omit<Toast, "id">) => void;
}

const ToastContext = createContext<ToastContextProps | undefined>(undefined);

const TOAST_DURATION = 5000;

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToasterProvider");
  }
  return context;
};

export const ToasterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timerRefs = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const idCounter = useRef(0);

  const removeToast = useCallback((id: number) => {
    const timer = timerRefs.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timerRefs.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = ++idCounter.current;
    setToasts((prev) => [...prev, { ...toast, id }]);

    // Toasts with an action link stay until manually dismissed — an auto-dismiss
    // would risk losing the only way back to a background job's downloadable report.
    if (!toast.action) {
      const timer = setTimeout(() => {
        timerRefs.current.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, TOAST_DURATION);

      timerRefs.current.set(id, timer);
    }
  }, []);

  // Clear all pending timers on unmount
  useEffect(() => {
    return () => {
      timerRefs.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-999 max-w-sm">
        {toasts.map((toast) => (
          <Toaster
            key={toast.id}
            onClose={() => removeToast(toast.id)}
            message={toast.message}
            type={toast.type}
            action={toast.action}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
