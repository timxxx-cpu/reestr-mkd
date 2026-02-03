import React from 'react';
import { X, Check } from 'lucide-react';
import { Button } from '../../../ui/UIKit';

// Экспортируем и значок статистики, чтобы использовать внутри модалок
export const StatBadge = ({ label, value, subLabel, color }) => (
    <div className={`p-3 rounded-xl border ${color} flex flex-col items-center justify-center text-center w-full`}>
        <span className="text-[9px] uppercase font-bold tracking-wider opacity-70 mb-1">{label}</span>
        <span className="text-xl font-black leading-none">{value}</span>
        {subLabel && <span className="text-[9px] opacity-60 mt-1">{subLabel}</span>}
    </div>
);

export default function RegistryModalLayout({ 
    title, 
    subTitle, 
    onClose, 
    onSave, 
    isReadOnly, 
    statsContent, 
    children 
}) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <div className="text-slate-500 text-xs mb-1 font-bold uppercase">{subTitle}</div>
                        <h3 className="text-2xl font-black text-slate-800">{title}</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors bg-white shadow-sm border border-slate-200">
                        <X size={20} className="text-slate-400 hover:text-slate-700"/>
                    </button>
                </div>

                {/* Stats Panel (ТЭП) */}
                <div className="p-6 bg-white border-b border-slate-100">
                    {statsContent}
                </div>

                {/* Content (Список помещений) */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    {children}
                </div>

                {/* Footer */}
                <div className="p-6 bg-white border-t border-slate-200 flex justify-between items-center">
                    <div className="text-xs text-slate-400 max-w-md italic">
                        * Изменения вступят в силу после нажатия "Применить"
                    </div>
                    <div className="flex gap-3">
                        <Button variant="ghost" onClick={onClose}>{isReadOnly ? 'Закрыть' : 'Отмена'}</Button>
                        {!isReadOnly && (
                            <Button onClick={onSave} className="px-8 shadow-lg shadow-blue-200">
                                <Check size={16} className="mr-2"/> Применить
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}