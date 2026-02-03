import React from 'react';
import { Layers, Lock, Building2 } from 'lucide-react';
import { Card, SectionTitle, Label, useReadOnly } from '../../../ui/UIKit';

export default function StylobateCard({ 
    currentBlock, 
    localResBlocks, 
    details, 
    toggleParentBlock, 
    occupiedResBlocks 
}) {
    const isReadOnly = useReadOnly();

    return (
        <Card className="p-6 shadow-sm border-t-4 border-t-indigo-500">
            <SectionTitle icon={Layers}>Расположение (Стилобат)</SectionTitle>
            <div className="mt-4 space-y-2">
                <Label>Находится под жилыми блоками:</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {localResBlocks.map(res => {
                        const isSelected = (details.parentBlocks || []).includes(res.id);
                        const occupiedBy = occupiedResBlocks[res.id]; 
                        // Блокируем, если занят другим блоком
                        const isDisabled = !!occupiedBy && occupiedBy !== currentBlock.tabLabel;
                        
                        return (
                            <button 
                                disabled={isDisabled || isReadOnly} 
                                key={res.id} 
                                onClick={() => toggleParentBlock(res.id)} 
                                className={`
                                    flex items-center justify-between p-3 rounded-xl border text-left transition-all 
                                    ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 
                                      isDisabled ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed opacity-70' : 
                                      'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'} 
                                    ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}
                                `}
                            >
                                <div className="flex items-center gap-3">
                                    {isDisabled ? <Lock size={14}/> : <Building2 size={14}/>}
                                    <div>
                                        <span className="text-[10px] font-bold block">{res.tabLabel}</span>
                                        {isDisabled && <span className="text-[9px] text-red-400 block">Занят: {occupiedBy}</span>}
                                    </div>
                                </div>
                                {isSelected && <div className="w-2 h-2 rounded-full bg-white shrink-0"/>}
                            </button>
                        )
                    })}
                </div>
                {localResBlocks.length === 0 && (
                    <div className="text-xs text-slate-400 italic">Нет доступных жилых блоков для привязки.</div>
                )}
            </div>
        </Card>
    );
}