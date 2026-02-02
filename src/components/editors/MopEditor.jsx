import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ArrowLeft, Wand2, ArrowDown, Trash2, 
  DoorOpen, Ban, Copy, X, AlertCircle 
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, DebouncedInput, TabButton, Button, useReadOnly } from '../ui/UIKit';
import SaveFloatingBar from '../ui/SaveFloatingBar'; 
import { getBlocksList } from '../../lib/utils';
import { useBuildingFloors } from '../../hooks/useBuildingFloors';
import { MopItemSchema } from '../../lib/schemas';
import { useBuildingType } from '../../hooks/useBuildingType';

const MOP_TYPES = [
    'Лестничная клетка', 'Межквартирный коридор', 'Лифтовой холл', 'Тамбур', 'Вестибюль', 
    'Колясочная', 'Комната охраны', 'Санузел', 'ПУИ (Уборочная)', 'Электрощитовая', 
    'Слаботочная ниша', 'Мусорокамера', 'Техническое подполье', 'Технический этаж', 
    'Венткамера', 'ИТП', 'Насосная', 'Машинное отделение лифтов', 'Кровля', 
    'Паркинг (зона проезда)', 'Рампа', 'Кладовая', 'Техническое помещение', 'Другое'
];

export default function MopEditor({ buildingId, onBack }) {
    const { composition, buildingDetails, entrancesData, mopData, setMopData, saveBuildingData, saveData } = useProject();
    const isReadOnly = useReadOnly();
    const [activeBlockIndex, setActiveBlockIndex] = useState(0);
    const [dataNormalized, setDataNormalized] = useState(false);
    
    const inputsRef = useRef({});

    const building = composition.find(c => c.id === buildingId);
    const { isUnderground } = useBuildingType(building);

    const blocksList = useMemo(() => getBlocksList(building), [building]);
    const { floorList, currentBlock } = useBuildingFloors(buildingId, activeBlockIndex);

    useEffect(() => {
        inputsRef.current = {};
    }, [activeBlockIndex]);

    // --- НОРМАЛИЗАЦИЯ ДАННЫХ (Внедрение ID и FK в существующие данные) ---
    useEffect(() => {
        if (!currentBlock || dataNormalized) return;

        let hasChanges = false;
        const updates = {};

        Object.keys(mopData).forEach(key => {
            if (key.startsWith(currentBlock.fullId)) {
                // Извлекаем метаданные из ключа для миграции старых данных
                // Ключ вида: buildingId_res_0_ent1_floor_1_mops
                const parts = key.match(/_ent(\d+)_(.*)_mops$/);
                const entIdx = parts ? parseInt(parts[1]) : 1;
                const floorId = parts ? parts[2] : 'unknown';

                const mops = mopData[key];
                if (Array.isArray(mops)) {
                    const fixedMops = mops.map(m => {
                        const fixed = { ...m };
                        let changed = false;
                        
                        // 1. UUID
                        if (!fixed.id) { fixed.id = crypto.randomUUID(); changed = true; }
                        // 2. Внешние ключи (FK)
                        if (!fixed.buildingId) { fixed.buildingId = building.id; changed = true; }
                        if (!fixed.blockId) { fixed.blockId = currentBlock.id; changed = true; }
                        if (!fixed.floorId) { fixed.floorId = floorId; changed = true; }
                        if (!fixed.entranceIndex) { fixed.entranceIndex = entIdx; changed = true; }

                        if (fixed.area === null || fixed.area === undefined) { fixed.area = ''; changed = true; }
                        if (!fixed.type) { fixed.type = ''; changed = true; }

                        if (changed) hasChanges = true;
                        return fixed;
                    });

                    if (hasChanges) {
                        updates[key] = fixedMops;
                    }
                }
            }
        });

        if (Object.keys(updates).length > 0) {
            setMopData(prev => ({ ...prev, ...updates }));
        }
        setDataNormalized(true);
    }, [currentBlock, mopData, setMopData, dataNormalized, building.id]);


    if (!building || !currentBlock) return <div className="p-12 text-center text-slate-500">Данные не найдены</div>;

    const showEditor = (currentBlock.type === 'Ж') || isUnderground;

    const blockDetails = buildingDetails[`${building.id}_${currentBlock.id}`] || {};
    const entrancesCount = isUnderground ? (blockDetails.inputs || 1) : (blockDetails.entrances || 1);
    const entrancesList = Array.from({ length: entrancesCount }, (_, i) => i + 1);

    const getTargetMopCount = (ent, floorId) => {
        const entKey = `${currentBlock.fullId}_ent${ent}_${floorId}`;
        const qty = parseInt(entrancesData[entKey]?.mopQty || 0);
        return isNaN(qty) ? 0 : qty;
    };

    const getMops = (ent, floorId) => {
        const key = `${currentBlock.fullId}_e${ent}_f${floorId}_mops`;
        return mopData[key] || [];
    };

    const updateMop = (ent, floorId, index, field, val) => {
        if (isReadOnly) return;
        if (field === 'area' && val !== '' && (parseFloat(val) < 0 || String(val).includes('-'))) return;

        const key = `${currentBlock.fullId}_e${ent}_f${floorId}_mops`;
        const currentMops = [...(mopData[key] || [])];
        
        if (!currentMops[index]) {
            currentMops[index] = { 
                id: crypto.randomUUID(), 
                type: '', 
                area: '',
                // FKs для новой записи
                buildingId: building.id,
                blockId: currentBlock.id,
                floorId: floorId,
                entranceIndex: ent
            };
        }
        currentMops[index] = { ...currentMops[index], [field]: val };
        
        setMopData(prev => ({ ...prev, [key]: currentMops }));
    };

    // --- ВАЛИДАЦИЯ ---
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
                        const mop = mops[i] || {};
                        const result = MopItemSchema.safeParse(mop);
                        if (!result.success) { 
                            isValid = false; 
                            missingCount++; 
                        }
                    }
                }
            });
        });
        return { isValid, missingCount };
    }, [floorList, entrancesList, mopData, entrancesData, showEditor]);

    // --- ФУНКЦИИ ДЕЙСТВИЙ ---

    const autoFillMops = () => { 
        if (isReadOnly) return;
        const updates = {}; 
        floorList.forEach(f => { 
            entrancesList.forEach(e => { 
                const targetQty = getTargetMopCount(e, f.id);
                if (targetQty > 0) {
                    const key = `${currentBlock.fullId}_e${e}_f${f.id}_mops`;
                    const existing = mopData[key] || [];
                    const newMops = [...existing];
                    
                    let defaultType = 'Лестничная клетка';
                    if (isUnderground) defaultType = 'Паркинг (зона проезда)';
                    else if (f.type === 'basement') defaultType = 'Техническое подполье';
                    else if (f.type === 'roof') defaultType = 'Кровля';

                    for (let i = 0; i < targetQty; i++) {
                        if (!newMops[i] || !newMops[i].type) {
                            let type = defaultType;
                            if (!isUnderground && i === 1) type = 'Лифтовой холл';
                            if (!isUnderground && i === 2) type = 'Межквартирный коридор';
                            
                            newMops[i] = { 
                                id: newMops[i]?.id || crypto.randomUUID(), 
                                type: type, 
                                area: newMops[i]?.area || '15',
                                // FKs
                                buildingId: building.id,
                                blockId: currentBlock.id,
                                floorId: f.id,
                                entranceIndex: e
                            };
                        }
                    }
                    updates[key] = newMops; 
                }
            }); 
        }); 
        setMopData(p => ({...p, ...updates})); 
    };

    const copyFirstFloorToAll = () => {
        if (isReadOnly || floorList.length === 0) return;
        const firstFloor = floorList[0];
        const updates = {};
        const templateData = {};
        entrancesList.forEach(e => {
             const key = `${currentBlock.fullId}_e${e}_f${firstFloor.id}_mops`;
             templateData[e] = mopData[key];
        });

        for (let i = 1; i < floorList.length; i++) {
            const f = floorList[i];
            entrancesList.forEach(e => {
                if (templateData[e]) {
                    const key = `${currentBlock.fullId}_e${e}_f${f.id}_mops`;
                    // Копируем, но генерируем новые ID и обновляем floorId
                    updates[key] = templateData[e].map(m => ({ 
                        ...m, 
                        id: crypto.randomUUID(),
                        floorId: f.id
                    }));
                }
            });
        }
        setMopData(p => ({...p, ...updates}));
    };

    const clearAllMops = () => {
        if (isReadOnly) return;
        if (!confirm('Вы уверены? Все введенные данные МОП для этого блока будут очищены.')) return;
        
        const updates = {};
        floorList.forEach(f => {
            entrancesList.forEach(e => {
                const key = `${currentBlock.fullId}_e${e}_f${f.id}_mops`;
                updates[key] = []; 
            });
        });
        
        setMopData(prev => ({ ...prev, ...updates }));
    };

    const renderBadge = (type) => {
        const map = {
            residential: { color: 'bg-blue-100 text-blue-700', label: 'Жилой' },
            mixed: { color: 'bg-violet-100 text-violet-700', label: 'Смеш.' },
            technical: { color: 'bg-amber-100 text-amber-700', label: 'Тех.' },
            basement: { color: 'bg-slate-200 text-slate-600', label: 'Подвал' },
            tsokol: { color: 'bg-purple-100 text-purple-700', label: 'Цоколь' },
            parking_floor: { color: 'bg-indigo-100 text-indigo-700', label: 'Паркинг' }
        };
        const style = map[type] || map.residential;
        return <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${style.color}`}>{style.label}</span>
    }

    const handleSave = async () => { 
        const specificData = {};
        Object.keys(mopData).forEach(k => { if (k.startsWith(building.id)) specificData[k] = mopData[k]; });
        // ProjectContext (обновленный) теперь может сам разрулить это, но мы используем явный метод
        // В данном случае, так как mopData - это массивы, мы просто сохраняем как есть через универсальный метод
        // В будущем можно будет добавить saveCommonAreas в контекст, если понадобится трансформация
        await saveBuildingData(building.id, 'commonAreasData', specificData);
        await saveData({}, true); 
    };

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
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={clearAllMops} disabled={!showEditor || isReadOnly} className={`px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${isReadOnly ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-100'}`} title="Очистить все данные МОП">
                        <Trash2 size={14}/> Очистить
                    </button>

                    <button onClick={copyFirstFloorToAll} disabled={isReadOnly} className={`px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${isReadOnly ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-200'}`} title="Скопировать 1-й этаж на все остальные">
                        <Copy size={14}/> Дублировать 1-й эт.
                    </button>
                    <button onClick={autoFillMops} disabled={!showEditor || isReadOnly} className={`px-4 py-2 bg-purple-50 text-purple-600 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${showEditor && !isReadOnly ? 'hover:bg-purple-100' : 'opacity-50 cursor-not-allowed'}`}>
                        <Wand2 size={14}/> Авто-генерация
                    </button>
                    
                    <Button variant="secondary" onClick={onBack}>Закрыть</Button>
                </div>
            </div>

            <div className="flex gap-2 p-1 bg-slate-200/50 rounded-xl w-max overflow-x-auto max-w-full mb-6 scrollbar-none">
                {blocksList.map((b,i) => (
                    <TabButton key={b.id} active={activeBlockIndex===i} onClick={()=>setActiveBlockIndex(i)}>{b.icon && <b.icon size={14} className="mr-1.5 opacity-70"/>}{b.tabLabel}</TabButton>
                ))}
            </div>

            {showEditor ? (
                <>
                    {!validationState.isValid && !isReadOnly && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-xs text-red-600 animate-in slide-in-from-top-2">
                            <AlertCircle size={16}/>
                            <span className="font-bold">Внимание!</span>
                            <span>Заполните данные для всех {validationState.missingCount} помещений. Используйте "Авто-генерацию" или "Дублирование" для ускорения.</span>
                        </div>
                    )}
                    <Card className="shadow-lg border-0 ring-1 ring-slate-200 rounded-xl overflow-hidden flex flex-col">
                        <div className="flex-1 overflow-auto relative w-full max-w-[calc(100vw-64px)]" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                            <table className="w-max min-w-full border-collapse table-fixed">
                                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 font-bold uppercase sticky top-0 z-30 shadow-md">
                                    <tr>
                                        <th className="p-4 w-36 min-w-[140px] sticky left-0 bg-slate-50 z-40 border-r border-slate-200 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">Этаж</th>
                                        {entrancesList.map(e => (
                                            <th key={e} className="p-4 w-[340px] min-w-[340px] border-r border-slate-200 bg-slate-50/95 backdrop-blur">{isUnderground ? `Вход ${e}` : `Подъезд ${e}`}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {floorList.map((f, fIdx) => (
                                        <tr key={f.id} className="group hover:bg-slate-50/50 focus-within:bg-blue-50/50 transition-colors duration-200">
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
                                                                    const result = MopItemSchema.safeParse(mop);
                                                                    const isValid = result.success;
                                                                    
                                                                    return (
                                                                        <div key={mIdx} className={`flex gap-1 items-center bg-white border rounded-lg p-1 shadow-sm transition-all focus-within:ring-2 focus-within:ring-blue-100 ${isValid ? 'border-slate-200' : 'border-red-300 bg-red-50/20'}`}>
                                                                            <div className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-500 shrink-0">{mIdx + 1}</div>
                                                                            <select 
                                                                                // @ts-ignore
                                                                                ref={el => inputsRef.current[`${fIdx}-${e}-${mIdx}-type`] = el}
                                                                                className={`bg-transparent text-[10px] font-bold w-full outline-none truncate ${isReadOnly ? 'cursor-default text-slate-700 appearance-none' : 'cursor-pointer hover:text-blue-600 focus:text-blue-700'}`} 
                                                                                value={mop.type || ''} 
                                                                                onChange={ev=>updateMop(e, f.id, mIdx, 'type', ev.target.value)} 
                                                                                title={mop.type}
                                                                                disabled={isReadOnly}
                                                                            >
                                                                                <option value="" disabled>Выберите тип</option>
                                                                                {MOP_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                                                                            </select>
                                                                            <div className="w-px h-4 bg-slate-200 shrink-0"/>
                                                                            <div className="relative w-16 shrink-0">
                                                                                <DebouncedInput 
                                                                                    // @ts-ignore
                                                                                    ref={el => inputsRef.current[`${fIdx}-${e}-${mIdx}-area`] = el}
                                                                                    type="number" 
                                                                                    min="0"
                                                                                    className={`w-full bg-slate-50 border rounded px-1 py-0.5 text-[10px] font-medium text-center focus:bg-white focus:border-blue-300 outline-none transition-all ${!mop.area ? 'border-red-200' : 'border-slate-100'} ${isReadOnly ? 'cursor-default bg-transparent border-transparent' : ''}`} 
                                                                                    placeholder="м²" 
                                                                                    value={mop.area || ''} 
                                                                                    onChange={val=>updateMop(e, f.id, mIdx, 'area', val)} 
                                                                                    disabled={isReadOnly}
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

            <SaveFloatingBar onSave={handleSave} disabled={!validationState.isValid} />
        </div>
    );
}