import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { X, CheckCircle2, AlertCircle, Info, Loader2 } from 'lucide-react';

/**
 * @typedef {'success' | 'error' | 'info' | 'warning' | 'loading'} ToastType
 */

/**
 * @typedef {Object} ToastAction
 * @property {string} label
 * @property {() => void} onClick
 */

/**
 * @typedef {Object} ToastOptions
 * @property {number} [duration]
 * @property {React.ReactNode} [icon]
 * @property {ToastAction} [action]
 */

/**
 * @typedef {Object} ToastContextType
 * @property {(message: string, options?: ToastOptions) => string} success
 * @property {(message: string, options?: ToastOptions) => string} error
 * @property {(message: string, options?: ToastOptions) => string} info
 * @property {(message: string, options?: ToastOptions) => string} warning
 * @property {(message: string, options?: ToastOptions) => string} loading
 * @property {(id: string) => void} dismiss
 */

const ToastContext = createContext(/** @type {ToastContextType | null} */ (null));

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback(id => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message, type = 'info', options = {}) => {
      const id = crypto.randomUUID();
      const { duration = type === 'loading' ? 0 : 3000, icon = null, action = null } = options;

      setToasts(prev => [...prev, { id, message, type, icon, action }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }

      return id;
    },
    [removeToast]
  );

  const toast = useMemo(
    () => ({
      success: (msg, options) => addToast(msg, 'success', options),
      error: (msg, options) => addToast(msg, 'error', options),
      info: (msg, options) => addToast(msg, 'info', options),
      warning: (msg, options) => addToast(msg, 'warning', options),
      loading: (msg, options) => addToast(msg, 'loading', options),
      dismiss: id => removeToast(id),
    }),
    [addToast, removeToast]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}

      <div className="fixed bottom-6 right-6 z-[10000] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`
                            pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border animate-in slide-in-from-right duration-300
                            ${t.type === 'success' ? 'bg-white border-emerald-100 text-emerald-800' : ''}
                            ${t.type === 'error' ? 'bg-white border-red-100 text-red-800' : ''}
                            ${t.type === 'info' ? 'bg-slate-800 border-slate-700 text-white' : ''}
                            ${t.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' : ''}
                            ${t.type === 'loading' ? 'bg-blue-50 border-blue-100 text-blue-800' : ''}
                        `}
          >
            <div className="shrink-0">
              {t.icon || (
                <>
                  {t.type === 'success' && <CheckCircle2 size={18} className="text-emerald-500" />}
                  {t.type === 'error' && <AlertCircle size={18} className="text-red-500" />}
                  {t.type === 'info' && <Info size={18} className="text-slate-400" />}
                  {t.type === 'warning' && <AlertCircle size={18} className="text-amber-500" />}
                  {t.type === 'loading' && <Loader2 size={18} className="animate-spin text-blue-500" />}
                </>
              )}
            </div>

            <span className="text-sm font-bold">{t.message}</span>

            {t.action && (
              <button
                onClick={() => {
                  t.action.onClick();
                  removeToast(t.id);
                }}
                className="ml-1 px-2 py-1 rounded-md text-xs font-bold bg-black/5 hover:bg-black/10 transition-colors"
              >
                {t.action.label}
              </button>
            )}

            <button
              onClick={() => removeToast(t.id)}
              className="ml-2 p-1 rounded-md hover:bg-black/5 opacity-50 hover:opacity-100 transition-all"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
