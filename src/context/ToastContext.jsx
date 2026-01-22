import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { X, CheckCircle2, AlertCircle, Info, Loader2 } from 'lucide-react';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    // Функция удаления (мемоизирована, чтобы не менялась ссылка)
    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const addToast = useCallback((message, type = 'info') => {
        // Улучшенный ID: время + случайное число
        const id = Date.now().toString() + Math.random().toString(36).slice(2);
        
        setToasts(prev => [...prev, { id, message, type }]);

        // Авто-удаление: 
        // Если это 'loading', мы его НЕ удаляем автоматически (ждем завершения операции)
        // Для остальных типов ставим таймер
        if (type !== 'loading') {
            setTimeout(() => {
                removeToast(id); // Используем функцию удаления
            }, 3000);
        }
        
        return id; // Возвращаем ID, чтобы можно было удалить программно
    }, [removeToast]);

    // МЕМОИЗАЦИЯ (Самое важное исправление)
    // Теперь объект `toast` не пересоздается при каждом чихе
    const toast = useMemo(() => ({
        success: (msg) => addToast(msg, 'success'),
        error: (msg) => addToast(msg, 'error'),
        info: (msg) => addToast(msg, 'info'),
        loading: (msg) => addToast(msg, 'loading'),
        dismiss: (id) => removeToast(id) // Возможность закрыть тост вручную из кода
    }), [addToast, removeToast]);

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
                            ${t.type === 'loading' ? 'bg-blue-50 border-blue-100 text-blue-800' : ''}
                        `}
                    >
                        {/* Иконки */}
                        <div className="shrink-0">
                            {t.type === 'success' && <CheckCircle2 size={18} className="text-emerald-500" />}
                            {t.type === 'error' && <AlertCircle size={18} className="text-red-500" />}
                            {t.type === 'info' && <Info size={18} className="text-slate-400" />}
                            {t.type === 'loading' && <Loader2 size={18} className="animate-spin text-blue-500" />}
                        </div>
                        
                        <span className="text-sm font-bold">{t.message}</span>
                        
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