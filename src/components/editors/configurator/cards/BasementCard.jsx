import React from 'react';
import { ArrowDownToLine, X } from 'lucide-react';
import { Card, SectionTitle, useReadOnly } from '../../../ui/UIKit';

export default function BasementCard({
    blockBasements,
    canAddBasement,
    createBlockBasement,
    removeBasement,
    updateBasement
}) {
    const isReadOnly = useReadOnly();

    return (
        <Card className="p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                <SectionTitle icon={ArrowDownToLine} className="mb-0">Подвал</SectionTitle>
                <button 
                    disabled={isReadOnly || !canAddBasement} 
                    onClick={createBlockBasement} 
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all shadow-sm ${ canAddBasement && !isReadOnly ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200' : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed opacity-60'}`}
                >
                    {canAddBasement ? '+ Добавить' : 'Макс. 3'}
                </button>
            </div>
            {blockBasements.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    Подвальные помещения отсутствуют
                </div>
            ) : (
                <div className="space-y-3">
                    {blockBasements.map((base, idx) => (
                        <div key={base.id} className="p-3 bg-slate-800 rounded-xl border border-slate-700 relative group text-white shadow-inner">
                            <button disabled={isReadOnly} onClick={() => removeBasement(base.id)} className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white hover:bg-slate-700 p-1 rounded transition-all ${isReadOnly ? 'hidden' : ''}`}><X size={14}/></button>
                            <div className="flex gap-3 items-center">
                                <div className="w-10 h-10 flex items-center justify-center bg-slate-700 border border-slate-600 rounded-lg font-bold text-slate-300 shadow-sm shrink-0">P-{idx+1}</div>
                                <div className="flex flex-col gap-0.5 w-full">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Уровень {idx+1}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-slate-300 whitespace-nowrap">Глубина:</span>
                                        <input 
                                            disabled={isReadOnly} 
                                            type="number" 
                                            value={-base.depth} 
                                            onChange={(e) => { 
                                                let val = parseInt(e.target.value); 
                                                if (isNaN(val)) val = -1; 
                                                if (val > 0) val = -val; 
                                                if (val > -1) val = -1; 
                                                if (val < -4) val = -4; 
                                                updateBasement(base.id, 'depth', Math.abs(val)); 
                                            }} 
                                            className="w-full bg-slate-900 border border-slate-600 rounded text-sm font-bold text-white focus:border-blue-500 outline-none py-0.5 px-2 text-center disabled:opacity-50"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}