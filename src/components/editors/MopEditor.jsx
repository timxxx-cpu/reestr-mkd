import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ArrowLeft, Save, Wand2, AlertCircle, DoorOpen, Ban,
  Plus, Trash2, Copy, ArrowDown
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, DebouncedInput, TabButton, Button } from '../ui/UIKit';
import { getBlocksList } from '../../lib/utils';
import { useBuildingFloors } from '../../hooks/useBuildingFloors';
import { Validators } from '../../lib/validators';

const MOP_TYPES = [
    'Лестничная клетка', 'Межквартирный коридор', 'Лифтовой холл', 'Тамбур', 'Вестибюль', 
    'Колясочная', 'Комната охраны', 'Санузел', 'ПУИ (Уборочная)', 'Электрощитовая', 
    'Слаботочная ниша', 'Мусорокамера', 'Техническое подполье', 'Технический этаж', 
    'Венткамера', 'ИТП', 'Насосная', 'Машинное отделение лифтов', 'Кровля', 
    'Паркинг (зона проезда)', 'Рампа', 'Кладовая', 'Техническое помещение', 'Другое'
];

/**
 * @param {{ buildingId: string, onBack: () => void }} props
 */
export default function MopEditor({ buildingId, onBack }) {
    const { composition, buildingDetails, entrancesData, mopData, setMopData, saveBuildingData, saveData } = useProject();
    const [activeBlockIndex, setActiveBlockIndex] = useState(0);
    
    // Рефы для навигации
    const inputsRef = useRef({});

    const building = composition.find(c => c.id === buildingId);
    
    const blocksList = useMemo(() => getBlocksList(building), [building]);
    
    const { floorList, currentBlock, isUndergroundParking } = useBuildingFloors(buildingId, activeBlockIndex);

    // Сброс рефов при смене блока
    useEffect(() => {
        inputsRef.current = {};
    }, [activeBlockIndex]);

    if (!building || !currentBlock) return <div className="p-12 text-center text-slate-500">Данные не найдены</div>;

    const showEditor = (currentBlock.type === 'Ж') || isUndergroundParking;

    // @ts-ignore
    const blockDetails = buildingDetails[`${building.id}_${currentBlock.id}`] || {};
    const entrancesCount = isUndergroundParking ? (blockDetails.inputs || 1) : (blockDetails.entrances || 1);
    const entrancesList = Array.from({ length: entrancesCount }, (_, i) => i + 1);

    // @ts-ignore
    const getTargetMopCount = (ent, floorId) => {
        const entKey = `${currentBlock.fullId}_ent${ent}_${floorId}`;
        // @ts-ignore
        const qty = parseInt(entrancesData[entKey]?.mopQty || 0);
        return isNaN(qty) ? 0 : qty;
    };

    /** @type {(ent: number, floorId: string) => any[]} */
    const getMops = (ent, floorId) => {
        const key = `${currentBlock.fullId}_e${ent}_f${floorId}_mops`;
        // @ts-ignore
        return mopData[key] || [];
    };

    /** @type {(ent: number, floorId: string, index: number, field: string, val: any) => void} */
    const updateMop = (ent, floorId, index, field, val) => {
        // Валидация ввода
        if (field === 'area' && val !== '' && (parseFloat(val) < 0 || String(val).includes('-'))) return;

        const key = `${currentBlock.fullId}_e${ent}_f${floorId}_mops`;
        // @ts-ignore
        const currentMops = [...(mopData[key] || [])];
        if (!currentMops[index]) {
            currentMops[index] = { id: crypto.randomUUID(), type: '', area: '' };
        }
        currentMops[index] = { ...currentMops[index], [field]: val };
        // @ts-ignore
        setMopData(prev => ({ ...prev, [key]: currentMops }));
    };

    // --- НОВОЕ: Умная навигация внутри списков ---
    const handleKeyDown = (e, fIdx, eIdx, mIdx, field) => {
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        e.preventDefault();

        // Порядок полей: type <-> area
        const isType = field === 'type';
        
        let nextF = fIdx;
        let nextE = eIdx;
        let nextM = mIdx;
        let nextField = field;

        if (e.key === 'ArrowLeft') {
            if (!isType) {
                // Area -> Type (в той же строке)
                nextField = 'type';
            } else {
                // Type -> Area (предыдущего подъезда, если есть)
                if (nextE > 1) {
                    nextE--;
                    nextField = 'area';
                    // Пытаемся сохранить индекс строки (mIdx), но если там меньше строк, берем последнюю
                    const prevEntMopsCount = getTargetMopCount(nextE, floorList[nextF].id);
                    if (nextM >= prevEntMopsCount) nextM = Math.max(0, prevEntMopsCount - 1);
                }
            }
        }

        if (e.key === 'ArrowRight') {
            if (isType) {
                // Type -> Area (в той же строке)
                nextField = 'area';
            } else {
                // Area -> Type (следующего подъезда)
                if (nextE < entrancesCount) {
                    nextE++;
                    nextField = 'type';
                    // Корректируем индекс строки, если в следующем подъезде их меньше
                    const nextEntMopsCount = getTargetMopCount(nextE, floorList[nextF].id);
                    if (nextM >= nextEntMopsCount) nextM = Math.max(0, nextEntMopsCount - 1);
                }
            }
        }

        if (e.key === 'ArrowDown') {
            const currentMopCount = getTargetMopCount(nextE, floorList[nextF].id);
            if (nextM < currentMopCount - 1) {
                // Вниз внутри текущей ячейки
                nextM++;
            } else {
                // Вниз на следующий этаж (первая строка)
                if (nextF < floorList.length - 1) {
                    nextF++;
                    nextM = 0;
                }
            }
        }

        if (e.key === 'ArrowUp') {
            if (nextM > 0) {
                // Вверх внутри текущей ячейки
                nextM--;
            } else {
                // Вверх на предыдущий этаж (на последнюю строку)
                if (nextF > 0) {
                    nextF--;
                    const prevFloorMopCount = getTargetMopCount(nextE, floorList[nextF].id);
                    nextM = Math.max(0, prevFloorMopCount - 1);
                }
            }
        }

        // Фокус
        const refKey = `${nextF}-${nextE}-${nextM}-${nextField}`;
        // @ts-ignore
        const target = inputsRef.current[refKey];
        if (target) {
            target.focus();
            // Если это селект, можно открыть его (опционально)
        }
    };

    const validationState = useMemo(() => {
        let isValid = true;
        let missingCount = 0;
        if (!showEditor) return { isValid: true, missingCount: 0 };
        floorList.forEach(f => {
            entrancesList.forEach(e => {
                const targetQty = getTargetMopCount(e, f.id);
                if (targetQty > 0) {
                    const mops = getMops(e, f.id);
                    for (let i = 0; i < targetQty; i++) {
                        if (!Validators.isMopValid(mops[i])) { isValid = false; missingCount++; }
                    }
                }
            });
        });
        return { isValid, missingCount };
    }, [floorList, entrancesList, getTargetMopCount, getMops, showEditor]);

    const autoFillMops = () => { 
        const updates = {}; 
        floorList.forEach(f => { 
            entrancesList.forEach(e => { 
                const targetQty = getTargetMopCount(e, f.id);
                if (targetQty > 0) {
                    const key = `${currentBlock.fullId}_e${e}_f${f.id}_mops`;
                    // @ts-ignore
                    const existing = mopData[key] || [];
                    const newMops = [...existing];
                    let defaultType = 'Лестничная клетка';
                    if (isUndergroundParking) defaultType = 'Паркинг (зона проезда)';
                    else if (f.type === 'basement') defaultType = 'Техническое подполье';
                    // @ts-ignore
                    else if (f.type === 'technical') defaultType = 'Технический этаж';
                    // @ts-ignore
                    else if (f.type === 'roof') defaultType = 'Кровля';

                    for (let i = 0; i < targetQty; i++) {
                        if (!newMops[i]) {
                            let type = defaultType;
                            if (!isUndergroundParking && i === 1) type = 'Лифтовой холл';
                            if (!isUndergroundParking && i === 2) type = 'Межквартирный коридор';
                            newMops[i] = { id: crypto.randomUUID(), type: type, area: '15' };
                        }
                    }
                    updates[key] = newMops; 
                }
            }); 
        }); 
        // @ts-ignore
        setMopData(p => ({...p, ...updates})); 
    };

    // @ts-ignore
    const renderBadge = (type) => {
        const map = {
            residential: { color: 'bg-blue-100 text-blue-700', label: 'Жилой' },
            mixed: { color: 'bg-violet-100 text-violet-700', label: 'Смеш.' },
            technical: { color: 'bg-amber-100 text-amber-700', label: 'Тех.' },
            basement: { color: 'bg-slate-200 text-slate-600', label: 'Подвал' },
            tsokol: { color: 'bg-purple-100 text-purple-700', label: 'Цоколь' },
            attic: { color: 'bg-teal-100 text-teal-700', label: 'Манс.' },
            loft: { color: 'bg-gray-200 text-gray-600', label: 'Чердак' },
            roof: { color: 'bg-sky-100 text-sky-700', label: 'Кровля' },
            parking_floor: { color: 'bg-indigo-100 text-indigo-700', label: 'Паркинг' }
        };
        // @ts-ignore
        const style = map[type] || map.residential;
        return <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${style.color}`}>{style.label}</span>
    }

    return (
        <div className="space-y-6 pb-20 w-full animate-in fade-in duration-500">
            <div className="flex items-center justify-between border-b border-slate-200 pb-6 mb-4">
                <div className="flex gap-4 items-center">
                    <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><ArrowLeft size={24}/></button>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 leading-tight">{building.label}</h2>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 items-center">
                             <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Инвентаризация МОП</p>
                             <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded text-xs text-slate-600"><span className="font-bold text-slate-400 uppercase text-[9px]">Дом</span><span className="font-bold">{building.houseNumber}</span></div>
                             <div className="flex items-center gap-1.5 text-xs text-slate-600 pl-2 border-l border-slate-200"><span className="font-bold text-slate-400 uppercase text-[9px]">Тип</span><span className="font-medium">{building.type}</span></div>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={autoFillMops} disabled={!showEditor} className={`px-4 py-2 bg-purple-50 text-purple-600 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${showEditor ? 'hover:bg-purple-100' : 'opacity-50 cursor-not-allowed'}`}><Wand2 size={14}/> Авто-генерация</button>
                    
                    <Button 
                        onClick={async () => { 
                            const specificData = {};
                            Object.keys(mopData).forEach(k => {
                                if (k.startsWith(building.id)) {
                                    // @ts-ignore
                                    specificData[k] = mopData[k];
                                }
                            });

                            await saveBuildingData(building.id, 'commonAreasData', specificData);
                            await saveData(); 
                            
                            onBack(); 
                        }} 
                        disabled={!validationState.isValid} 
                        className={`shadow-lg ${!validationState.isValid ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' : 'shadow-blue-200'}`}
                    >
                        <Save size={14}/> Готово
                    </Button>
                </div>
            </div>

            <div className="flex gap-2 p-1 bg-slate-200/50 rounded-xl w-max overflow-x-auto max-w-full mb-6 scrollbar-none">
                {blocksList.map((b,i) => (
                    <TabButton key={b.id} active={activeBlockIndex===i} onClick={()=>setActiveBlockIndex(i)}>{b.icon && <b.icon size={14} className="mr-1.5 opacity-70"/>}{b.tabLabel}</TabButton>
                ))}
            </div>

            {showEditor ? (
                <>
                    {!validationState.isValid && (<div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-xs text-red-600 animate-in slide-in-from-top-2"><AlertCircle size={16}/><span className="font-bold">Внимание!</span><span>Необходимо заполнить все поля (Тип и Площадь). Незаполненных позиций: <b>{validationState.missingCount}</b></span></div>)}
                    <Card className="shadow-lg border-0 ring-1 ring-slate-200 rounded-xl overflow-hidden flex flex-col">
                        <div className="flex-1 overflow-auto relative w-full max-w-[calc(100vw-64px)]" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                            <table className="w-max min-w-full border-collapse table-fixed">
                                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 font-bold uppercase sticky top-0 z-30 shadow-md">
                                    <tr>
                                        {/* Sticky Column: Floors */}
                                        <th className="p-4 w-36 min-w-[140px] sticky left-0 bg-slate-50 z-40 border-r border-slate-200 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">Этаж</th>
                                        {entrancesList.map(e => (
                                            <th key={e} className="p-4 w-[340px] min-w-[340px] border-r border-slate-200 bg-slate-50/95 backdrop-blur">{isUndergroundParking ? `Вход ${e}` : `Подъезд ${e}`}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {floorList.map((f, fIdx) => (
                                        <tr key={f.id} className="group hover:bg-slate-50/50 focus-within:bg-blue-50/50 transition-colors duration-200">
                                            {/* Sticky Row Title */}
                                            <td className="p-3 w-36 min-w-[140px] sticky left-0 bg-white group-focus-within:bg-blue-50 transition-colors duration-200 border-r align-top relative z-20 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)]">
                                                <div className="flex flex-col gap-1.5"><span className="font-bold text-sm text-slate-700">{f.label}</span>{renderBadge(f.type)}</div>
                                            </td>
                                            {entrancesList.map((e, eIdx) => {
                                                const targetQty = getTargetMopCount(e, f.id);
                                                const mops = getMops(e, f.id);
                                                return (
                                                    <td key={e} className="p-3 w-[340px] min-w-[340px] align-top border-r relative group/cell">
                                                        {targetQty > 0 ? (
                                                            <div className="flex flex-col gap-2">
                                                                {Array.from({ length: targetQty }).map((_, mIdx) => {
                                                                    const mop = mops[mIdx] || {};
                                                                    const isValid = Validators.isMopValid(mop);
                                                                    return (
                                                                        <div key={mIdx} className={`flex gap-1 items-center bg-white border rounded-lg p-1 shadow-sm transition-all focus-within:ring-2 focus-within:ring-blue-100 ${isValid ? 'border-slate-200' : 'border-red-300 bg-red-50/20'}`}>
                                                                            <div className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-500 shrink-0">{mIdx + 1}</div>
                                                                            
                                                                            {/* TYPE SELECT */}
                                                                            <select 
                                                                                // @ts-ignore
                                                                                ref={el => inputsRef.current[`${fIdx}-${e}-${mIdx}-type`] = el}
                                                                                onKeyDown={(ev) => handleKeyDown(ev, fIdx, e, mIdx, 'type')}
                                                                                className="bg-transparent text-[10px] font-bold w-full outline-none cursor-pointer hover:text-blue-600 focus:text-blue-700 truncate" 
                                                                                value={mop.type || ''} 
                                                                                onChange={ev=>updateMop(e, f.id, mIdx, 'type', ev.target.value)} 
                                                                                title={mop.type}
                                                                            >
                                                                                <option value="" disabled>Выберите тип</option>
                                                                                {MOP_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                                                                            </select>
                                                                            
                                                                            <div className="w-px h-4 bg-slate-200 shrink-0"/>
                                                                            
                                                                            {/* AREA INPUT */}
                                                                            <div className="relative w-16 shrink-0">
                                                                                <DebouncedInput 
                                                                                    // @ts-ignore
                                                                                    ref={el => inputsRef.current[`${fIdx}-${e}-${mIdx}-area`] = el}
                                                                                    onKeyDown={(ev) => handleKeyDown(ev, fIdx, e, mIdx, 'area')}
                                                                                    type="number" 
                                                                                    min="0"
                                                                                    className={`w-full bg-slate-50 border rounded px-1 py-0.5 text-[10px] font-medium text-center focus:bg-white focus:border-blue-300 outline-none transition-all ${!mop.area ? 'border-red-200' : 'border-slate-100'}`} 
                                                                                    placeholder="м²" 
                                                                                    value={mop.area || ''} 
                                                                                    onChange={val=>updateMop(e, f.id, mIdx, 'area', val)} 
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (<div className="h-full flex items-center justify-center text-slate-300 text-[10px] font-medium italic">Нет МОП</div>)}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4 animate-in fade-in">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400"><DoorOpen size={40} /><div className="absolute"><Ban size={20} className="text-slate-400 translate-x-4 translate-y-4"/></div></div>
                    <h3 className="text-xl font-bold text-slate-700">Настройка МОП недоступна</h3>
                    <p className="text-slate-500 max-w-md">Инвентаризация МОП производится только для жилых блоков и подземных паркингов.</p>
                </div>
            )}
        </div>
    );
}