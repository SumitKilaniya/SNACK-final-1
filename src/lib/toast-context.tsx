'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type ToastType = 'success' | 'info' | 'error';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // Clear any pending timers if the provider ever unmounts.
  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach(clearTimeout);
      timers.current = {};
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    const timer = timers.current[id];
    if (timer) {
      clearTimeout(timer);
      delete timers.current[id];
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'success') => {
      const id = nextId++;
      setToasts((prev) => [...prev.slice(-2), { id, message, type }]);
      timers.current[id] = setTimeout(() => dismiss(id), 2400);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast stack — top center, above everything */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none px-4 w-full max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`toast-in pointer-events-auto w-full flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl shadow-black/15 text-sm font-semibold text-white ${
              toast.type === 'info'
                ? 'bg-foreground/95'
                : toast.type === 'error'
                  ? 'bg-red-600'
                  : 'bg-primary'
            }`}
          >
            <span className="text-base">
              {toast.type === 'info' ? '💬' : toast.type === 'error' ? '⚠️' : '✅'}
            </span>
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="opacity-70 hover:opacity-100 transition-opacity text-lg leading-none"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>');
  }
  return ctx;
}
