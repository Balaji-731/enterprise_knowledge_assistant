import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message, type = 'info', duration = 3500) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, message, type }]);
      if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
      }
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}

      {/* Toast Stack (Bottom Right) */}
      <div
        className="fixed bottom-4 right-4 z-[60] flex flex-col space-y-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const styles = {
            success: 'bg-white border-emerald-200 text-slate-800 shadow-lg',
            error: 'bg-white border-red-200 text-slate-800 shadow-lg',
            warning: 'bg-white border-amber-200 text-slate-800 shadow-lg',
            info: 'bg-white border-blue-200 text-slate-800 shadow-lg',
          };
          const icons = {
            success: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />,
            error: <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />,
            warning: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />,
            info: <Info className="w-4 h-4 text-blue-600 shrink-0" />,
          };

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start space-x-2.5 p-3.5 rounded-xl border text-xs font-medium transition-all page-enter ${
                styles[t.type] || styles.info
              }`}
            >
              <div className="mt-0.5">{icons[t.type] || icons.info}</div>
              <div className="flex-1 text-slate-700 leading-snug">{t.message}</div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
