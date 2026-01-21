import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle2, AlertCircle, Info, Loader2 } from 'lucide-react';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info') => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { id, message, type }]);

        // Авто-удаление через 3 секунды
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    // Хелперы для быстрого вызова
    const toast = {
        success: (msg) => addToast(msg, 'success'),
        error: (msg) => addToast(msg, 'error'),
        info: (msg) => addToast(msg, 'info'),
        loading: (msg) => addToast(msg, 'loading')
    };

    return (
        <ToastContext.Provider value={toast}>
            {children}
            
            {/* Слой уведомлений (UI) */}
            <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
                {toasts.map(t => (
                    <div 
                        key={t.id} 
                        className={`
                            pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border animate-in slide-in-from-right duration-300
                            ${t.type === 'success' ? 'bg-white border-emerald-100 text-emerald-800' : ''}
                            ${t.type === 'error' ? 'bg-white border-red-100 text-red-800' : ''}
                            ${t.type === 'info' ? 'bg-slate-800 border-slate-700 text-white' : ''}
                            ${t.type === 'loading' ? 'bg-blue-50 border-blue-100 text-blue-800' : ''}
                        `}
                    >
                        {t.type === 'success' && <CheckCircle2 size={18} className="text-emerald-500" />}
                        {t.type === 'error' && <AlertCircle size={18} className="text-red-500" />}
                        {t.type === 'info' && <Info size={18} className="text-slate-400" />}
                        {t.type === 'loading' && <Loader2 size={18} className="animate-spin text-blue-500" />}
                        
                        <span className="text-sm font-bold">{t.message}</span>
                        
                        <button onClick={() => removeToast(t.id)} className="ml-2 opacity-50 hover:opacity-100 transition-opacity">
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};