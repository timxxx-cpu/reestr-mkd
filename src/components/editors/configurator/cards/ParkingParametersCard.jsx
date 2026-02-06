import React from 'react';
import { 
    Car, ArrowDown, ArrowUp, ArrowDownToLine, Footprints, MapPin, 
    Building2, X 
} from 'lucide-react';
import { Card, SectionTitle, Label, Input, useReadOnly } from '../../../ui/UIKit';

export default function ParkingParametersCard({
    details,
    updateDetail,
    isUnderground,
    errorBorder,
    availableParents,
    toggleParentBlock,
    canAddBasement,
    createBasement,
    blockBasements,
    updateBasement,
    removeBasement,
    increment,
    decrement,
    renderCounterValue
}) {
    const isReadOnly = useReadOnly();

    return (
        <Card className="p-6 shadow-sm border-t-4 border-t-slate-500">
            <SectionTitle icon={Car}>Параметры паркинга</SectionTitle>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                <div className="space-y-6">
                    {/* А. Подземный: Глубина и привязка */}
                    {isUnderground ? (
                        <div className="space-y-3">
                            <Label className="flex items-center gap-2">
                                <ArrowDown size={16} className="text-blue-600"/> Уровней вниз <span className="text-red-500">*</span>
                            </Label>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4].map(lvl => (
                                    <button 
                                        key={lvl} 
                                        disabled={isReadOnly} 
                                        onClick={() => updateDetail('levelsDepth', lvl)} 
                                        className={`flex-1 py-3 rounded-xl border font-bold text-sm transition-all ${parseInt(details.levelsDepth) === lvl ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'} ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        -{lvl}
                                    </button>
                                ))}
                            </div>
                            {/* Привязка к домам (только для подземного) */}
                            <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                                <Label className="flex items-center gap-2 mb-3 text-blue-800"><MapPin size={14}/> Расположен под блоками:</Label>
                                {availableParents.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                                        {availableParents.map(parent => {
                                            const isSelected = (details.parentBlocks || []).includes(parent.id);
                                            return (
                                                <button 
                                                    disabled={isReadOnly} 
                                                    key={parent.id} 
                                                    onClick={() => toggleParentBlock(parent.id)} 
                                                    className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-blue-200 text-slate-600 hover:border-blue-400'} ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`font-black text-xs px-1.5 py-0.5 rounded border border-white/20 ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{parent.houseNumber}</div>
                                                        <div className="min-w-0">
                                                            <span className="text-[11px] font-bold line-clamp-1 block">{parent.label}</span>
                                                            <span className={`text-[10px] line-clamp-1 block ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                                                                {parent.buildingLabel}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {isSelected && <div className="w-2 h-2 rounded-full bg-white shrink-0"/>}
                                                </button>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center text-[10px] text-slate-400 py-4 border border-dashed rounded-lg bg-white">Нет подходящих жилых блоков</div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Б. Наземный: Высота и Подвал */
                        <>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2"><ArrowUp size={16} className="text-blue-600"/> Этажей вверх</Label>
                                <Input 
                                    type="number" min="1" max="10" 
                                    value={details.floorsCount} 
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '') { updateDetail('floorsCount', ''); return; }
                                        updateDetail('floorsCount', parseInt(val));
                                    }}
                                    className={errorBorder('floorsCount')}
                                    disabled={isReadOnly}
                                />
                            </div>
                            
                            {/* Подвал для наземного */}
                            <div className="pt-2">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                                    <Label className="flex items-center gap-2"><ArrowDownToLine size={14}/> Подвал</Label>
                                    <button disabled={isReadOnly || !canAddBasement} onClick={createBasement} className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${ canAddBasement && !isReadOnly ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200' : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed opacity-60'}`}>{canAddBasement ? '+ Добавить' : 'Макс. 1'}</button>
                                </div>
                                {blockBasements.map((base, idx) => (
                                    <div key={base.id} className="p-3 bg-slate-800 rounded-lg text-white mb-2 relative group flex items-center justify-between">
                                        <div className="flex gap-3 items-center">
                                            <div className="w-8 h-8 flex items-center justify-center bg-slate-700 border border-slate-600 rounded font-bold text-xs">P-{idx+1}</div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-slate-400">Глубина:</span>
                                                <input disabled={isReadOnly} type="number" value={-base.depth} onChange={(e) => { let val = parseInt(e.target.value); if (!isNaN(val)) updateBasement(base.id, 'depth', Math.abs(val)); }} className="w-10 text-center bg-slate-900 border border-slate-600 rounded text-[10px] font-bold text-white outline-none py-0.5"/>
                                            </div>
                                        </div>
                                        {!isReadOnly && <button onClick={() => removeBasement(base.id)} className="text-slate-400 hover:text-white"><X size={14}/></button>}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* В. Въезды и Входы (Общее) */}
                <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100 h-fit">
                    <div className="space-y-1">
                        <Label className="flex items-center gap-2"><Car size={14} /> Въезды (авто)</Label>
                        <div className="flex items-center gap-3">
                            <button disabled={isReadOnly} onClick={() => decrement('vehicleEntries', 1)} className="w-8 h-8 bg-white rounded border border-slate-200 font-bold hover:bg-slate-100 disabled:opacity-50">-</button>
                            <span className="font-bold text-lg w-8 text-center">{renderCounterValue(details.vehicleEntries)}</span>
                            <button disabled={isReadOnly} onClick={() => increment('vehicleEntries')} className="w-8 h-8 bg-white rounded border border-slate-200 font-bold hover:bg-slate-100 disabled:opacity-50">+</button>
                        </div>
                    </div>
                    <div className="h-px bg-slate-200 w-full" />
                    <div className="space-y-1">
                        <Label className="flex items-center gap-2"><Footprints size={14} /> Входы (люди)</Label>
                        <div className="flex items-center gap-3">
                            <button disabled={isReadOnly} onClick={() => decrement('inputs', 0)} className="w-8 h-8 bg-white rounded border border-slate-200 font-bold hover:bg-slate-100 disabled:opacity-50">-</button>
                            <span className="font-bold text-lg w-8 text-center">{renderCounterValue(details.inputs)}</span>
                            <button disabled={isReadOnly} onClick={() => increment('inputs')} className="w-8 h-8 bg-white rounded border border-slate-200 font-bold hover:bg-slate-100 disabled:opacity-50">+</button>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}
