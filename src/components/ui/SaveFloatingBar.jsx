import React from 'react';
import { Save, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from './UIKit';
import { useProject } from '../../context/ProjectContext';

export default function SaveFloatingBar({ onSave, disabled = false }) {
    const { hasUnsavedChanges, isSyncing } = useProject();

    // Панель видна только если есть изменения (или идет сохранение)
    if (!hasUnsavedChanges && !isSyncing) return null;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-2xl px-4 animate-in slide-in-from-bottom-10 fade-in duration-300">
            <div className="bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-2xl flex items-center justify-between border border-slate-700 ring-1 ring-white/10">
                <div className="flex items-center gap-3 px-2">
                    <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg animate-pulse">
                        <AlertCircle size={20} />
                    </div>
                    <div>
                        <div className="text-sm font-bold">Есть несохраненные изменения</div>
                        <div className="text-[10px] text-slate-400">Не забудьте сохранить данные перед уходом</div>
                    </div>
                </div>
                
                <div className="flex gap-2">
                    <Button 
                        onClick={onSave} 
                        disabled={disabled || isSyncing}
                        className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 border-0 h-10 px-6 transition-all active:scale-95"
                    >
                        {isSyncing ? (
                            <>
                                <Loader2 size={16} className="mr-2 animate-spin"/> Сохранение...
                            </>
                        ) : (
                            <>
                                <Save size={16} className="mr-2"/> Сохранить
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}