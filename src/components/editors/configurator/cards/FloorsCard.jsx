import React from 'react';
import { 
    Maximize, Settings2, Store, Lock, ArrowUpFromLine, Plus 
} from 'lucide-react';
import { Card, SectionTitle, Label, Input, useReadOnly } from '../../../ui/UIKit';

export default function FloorsCard({
    details,
    updateDetail,
    isFloorFromDisabled,
    errorBorder,
    floorRange,
    isResBasementLocked,
    isStylobate,
    stylobateHeightUnderCurrentBlock,
    currentBlock,
    building,
    blockBasements, // Нужен только для рендера кнопок P-1 в блоке коммерции
    toggleFloorAttribute
}) {
    const isReadOnly = useReadOnly();

    return (
        <Card className="p-6 shadow-sm">
            <SectionTitle icon={Maximize}>Параметры этажности</SectionTitle>
            
            {/* 1. Поля ввода этажей */}
            <div className="grid grid-cols-2 gap-8 mb-6">
                <div className="space-y-1">
                    <Label>С этажа</Label>
                    <Input 
                        type="number" 
                        min="1" 
                        value={details.floorsFrom} 
                        onChange={(e) => {
                            const val = e.target.value; 
                            if (val === '') { updateDetail('floorsFrom', ''); return; }
                            let num = parseInt(val);
                            if (!isNaN(num)) {
                                if (num < 1) num = 1; 
                                updateDetail('floorsFrom', num); 
                            }
                        }}
                        disabled={isReadOnly || isFloorFromDisabled} 
                        className={errorBorder('floorsFrom')}
                    />
                    {isFloorFromDisabled && <p className="text-[9px] text-slate-400">Начальный этаж фиксирован</p>}
                </div>
                <div className="space-y-1">
                    <Label>По этаж</Label>
                    <Input 
                        type="number" 
                        min="1" 
                        max="100" 
                        value={details.floorsTo} 
                        onChange={(e) => {
                            const val = e.target.value; 
                            if (val === '') { updateDetail('floorsTo', ''); return; }
                            let num = parseInt(val);
                            if (!isNaN(num)) {
                                if (num > 50) num = 50; 
                                updateDetail('floorsTo', num); 
                            }
                        }}
                        className={errorBorder('floorsTo')}
                        disabled={isReadOnly}
                    />
                </div>
            </div>

            {/* 2. Чекбоксы доп. этажей */}
            <div className="flex flex-wrap gap-4 mt-4 mb-6">
                {[
                    { k: 'hasBasementFloor', l: 'Цокольный этаж', disabled: isResBasementLocked }, 
                    { k: 'hasAttic', l: 'Мансарда', disabled: isStylobate }, 
                    { k: 'hasLoft', l: 'Чердак', disabled: isStylobate }, 
                    { k: 'hasExploitableRoof', l: 'Эксплуатируемая крыша', disabled: isStylobate }
                ].map(({ k, l, disabled }) => (
                    <label 
                        key={k} 
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-100 transition-colors ${disabled || isReadOnly ? 'bg-slate-50 opacity-50 cursor-not-allowed' : 'bg-white cursor-pointer hover:border-blue-300'}`}
                    >
                        <input 
                            disabled={disabled || isReadOnly} 
                            type="checkbox" 
                            checked={details[k] || false} 
                            onChange={(e) => updateDetail(k, e.target.checked)} 
                            className="rounded text-blue-600 w-4 h-4 disabled:cursor-not-allowed"
                        />
                        <span className="text-xs font-bold text-slate-600">{l}</span>
                        {disabled && k === 'hasBasementFloor' && <span className="text-[8px] text-red-400 ml-auto pl-1">Занят</span>}
                    </label>
                ))}
            </div>

            {/* 3. Технические этажи */}
            <div className="mt-4 p-4 bg-amber-50/50 border border-amber-100 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg"><Settings2 size={16}/></div>
                    <div>
                        <Label className="text-amber-900 mb-0">Вставка тех. этажей</Label>
                        <p className="text-[10px] text-amber-600/80 leading-tight">Выберите этаж, <b>НАД</b> которым нужно добавить тех.этаж</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {floorRange.map((f, idx) => { 
                        const isTech = details.technicalFloors?.includes(f); 
                        const isGap = (idx > 0) && (idx % 10 === 0); 
                        const isLockedByStylobate = currentBlock.type === 'Ж' && f <= stylobateHeightUnderCurrentBlock; 
                        const isDisabled = isLockedByStylobate || isReadOnly;
                        
                        return (
                            <React.Fragment key={f}>
                                {isGap && <div className="w-3"></div>}
                                <button 
                                    disabled={isDisabled} 
                                    onClick={() => toggleFloorAttribute('technicalFloors', f)} 
                                    className={`
                                        w-8 h-8 rounded-md text-xs font-bold shadow-sm transition-all border flex items-center justify-center gap-1 relative 
                                        ${isLockedByStylobate ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed' : 
                                          isTech ? 'bg-amber-500 border-amber-600 text-white shadow-md' : 
                                          'bg-white border-amber-200 text-amber-600 hover:bg-amber-50'} 
                                        ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}
                                    `}
                                    title={isLockedByStylobate ? 'Этаж занят стилобатом' : ''}
                                >
                                    {f}
                                    {isLockedByStylobate ? <Lock size={8} className="absolute top-0.5 right-0.5 opacity-50"/> : 
                                     (isTech ? <ArrowUpFromLine size={10}/> : <Plus size={10} className="opacity-50"/>)}
                                </button>
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {/* 4. Коммерция (Только для жилых блоков, если в доме есть коммерция) */}
            {building.hasNonResPart && currentBlock.type === 'Ж' && (
                <div className="mt-6 p-4 bg-blue-50/50 border border-blue-100 rounded-xl animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><Store size={16}/></div>
                        <div>
                            <Label className="text-blue-900 mb-0">Нежилые объекты (Коммерция)</Label>
                            <p className="text-[10px] text-blue-500/80 leading-tight">Отметьте этажи с нежилыми помещениями.</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                        {/* Подвалы - показываем кнопки для выбора, если подвалы созданы */}
                        {blockBasements.map((b, idx) => {
                            const val = `basement_${b.id}`; 
                            const isActive = details.commercialFloors?.includes(val);
                            return (
                                <button 
                                    key={b.id} 
                                    disabled={isReadOnly} 
                                    onClick={() => toggleFloorAttribute('commercialFloors', val)} 
                                    className={`px-2 h-8 rounded-md text-xs font-bold shadow-sm transition-all border relative ${isActive ? 'bg-blue-600 border-blue-600 text-white transform scale-105' : 'bg-white border-blue-200 text-blue-400 hover:bg-blue-100'} ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    P-{idx+1}
                                </button>
                            )
                        })}
                        
                        {/* Цоколь */}
                        {details.hasBasementFloor && (
                            <button disabled={isReadOnly} onClick={() => toggleFloorAttribute('commercialFloors', 'tsokol')} className={`px-2 h-8 rounded-md text-xs font-bold shadow-sm transition-all border relative ${details.commercialFloors?.includes('tsokol') ? 'bg-blue-600 border-blue-600 text-white transform scale-105' : 'bg-white border-blue-200 text-blue-400 hover:bg-blue-100'} ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}>Цоколь</button>
                        )}
                        
                        {/* Этажи */}
                        {floorRange.map((f, idx) => { 
                            const isComm = details.commercialFloors?.includes(f); 
                            const isCommTech = details.commercialFloors?.includes(`${f}-Т`); 
                            const isLockedByStylobate = f <= stylobateHeightUnderCurrentBlock; 
                            const isDisabled = isLockedByStylobate || isReadOnly;
                            return (
                                <React.Fragment key={f}>
                                    {idx > 0 && idx % 10 === 0 && <div className="w-3"></div>}
                                    <button 
                                        disabled={isDisabled} 
                                        onClick={() => toggleFloorAttribute('commercialFloors', f)} 
                                        className={`
                                            w-8 h-8 rounded-md text-xs font-bold shadow-sm transition-all border relative 
                                            ${isLockedByStylobate ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed' : 
                                              isComm ? 'bg-blue-600 border-blue-600 text-white transform scale-105' : 
                                              'bg-white border-blue-200 text-blue-400 hover:bg-blue-100'} 
                                            ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}
                                        `} 
                                        title={isLockedByStylobate ? 'Этаж занят стилобатом' : ''}
                                    >
                                        {f}
                                        {isLockedByStylobate && <Lock size={8} className="absolute top-0.5 right-0.5 opacity-50"/>}
                                    </button>
                                    
                                    {/* Кнопка для Тех. этажа */}
                                    {details.technicalFloors?.includes(f) && (
                                        <button 
                                            disabled={isReadOnly} 
                                            onClick={() => toggleFloorAttribute('commercialFloors', `${f}-Т`)} 
                                            className={`
                                                px-1.5 h-8 rounded-md text-[10px] font-bold shadow-sm transition-all border flex items-center justify-center relative 
                                                ${isCommTech ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-indigo-50 border-indigo-200 text-indigo-500 hover:bg-indigo-100'} 
                                                ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}
                                            `} 
                                            title={`Отметить тех.этаж ${f}-Т как нежилой`}
                                        >
                                            {f}-Т
                                        </button>
                                    )}
                                </React.Fragment>
                            ) 
                        })}

                        {/* Спец. этажи */}
                        {details.hasAttic && <button disabled={isReadOnly} onClick={() => toggleFloorAttribute('commercialFloors', 'attic')} className={`px-2 h-8 rounded-md text-xs font-bold shadow-sm transition-all border relative ${details.commercialFloors?.includes('attic') ? 'bg-blue-600 border-blue-600 text-white transform scale-105' : 'bg-white border-blue-200 text-blue-400 hover:bg-blue-100'} ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}>Мансарда</button>}
                        {details.hasLoft && <button disabled={isReadOnly} onClick={() => toggleFloorAttribute('commercialFloors', 'loft')} className={`px-2 h-8 rounded-md text-xs font-bold shadow-sm transition-all border relative ${details.commercialFloors?.includes('loft') ? 'bg-blue-600 border-blue-600 text-white transform scale-105' : 'bg-white border-blue-200 text-blue-400 hover:bg-blue-100'} ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}>Чердак</button>}
                        {details.hasExploitableRoof && <button disabled={isReadOnly} onClick={() => toggleFloorAttribute('commercialFloors', 'roof')} className={`px-2 h-8 rounded-md text-xs font-bold shadow-sm transition-all border relative ${details.commercialFloors?.includes('roof') ? 'bg-blue-600 border-blue-600 text-white transform scale-105' : 'bg-white border-blue-200 text-blue-400 hover:bg-blue-100'} ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}>Кровля</button>}
                    </div>
                </div>
            )}
        </Card>
    );
}