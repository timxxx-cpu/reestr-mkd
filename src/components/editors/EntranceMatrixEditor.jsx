import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, Save, Wand2, ArrowDown, ArrowUp, 
  DoorOpen, ChevronLeft, ChevronsRight, Info
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, DebouncedInput, TabButton, Button } from '../ui/UIKit';

// Утилита для получения списка блоков
function getBlocksList(building) {
    if (!building) return [];
    const list = [];
    if (building.category && building.category.includes('residential')) {
        for(let i=0; i<(building.resBlocks || 0); i++) {
            list.push({ id: `res_${i}`, type: 'Ж', index: i, fullId: `${building.id}_res_${i}` });
        }
    }
    // Если блоков нет, но это жилой дом
    if (list.length === 0 && building.category.includes('residential')) {
        list.push({ id: 'main', type: 'Основной', index: 0, fullId: `${building.id}_main` });
    }
    return list;
}

export default function EntranceMatrixEditor({ buildingId, onBack }) {
    const { composition, buildingDetails, entrancesData, setEntrancesData, floorData, setFloorData, saveData } = useProject();
    const [activeBlockIndex, setActiveBlockIndex] = useState(0);

    // 1. Безопасное получение здания
    const building = composition.find(c => c.id === buildingId);
    
    // 2. Безопасное получение блоков
    const blocksList = useMemo(() => getBlocksList(building), [building]);
    const currentBlock = blocksList[activeBlockIndex];

    if (!building || !currentBlock) return <div className="p-12 text-center text-slate-500">Данные не найдены</div>;

    // Детали блока
    const blockDetails = buildingDetails[`${building.id}_${currentBlock.id}`] || {};
    const entrancesCount = blockDetails.entrances || 1;
    const entrancesList = Array.from({ length: entrancesCount }, (_, i) => i + 1);
    const basements = buildingDetails[`${building.id}_features`]?.basements || [];

    // --- ГЕНЕРАЦИЯ СПИСКА ЭТАЖЕЙ ---
    const floorList = useMemo(() => {
        const list = [];
        const commFloors = blockDetails.commercialFloors || []; 

        // 1. ПОДВАЛЫ
        const isBasementMixed = commFloors.includes('basement');
        const currentBlockBasements = basements.filter(b => b.blocks?.includes(currentBlock.id));
        currentBlockBasements.forEach((b, bIdx) => { 
            for(let d = b.depth; d >= 1; d--) {
                list.push({ 
                    id: `base_${b.id}_L${d}`, 
                    label: `Подвал -${d}`, 
                    type: 'basement', 
                    isComm: isBasementMixed, 
                    sortOrder: -1000 - d + (bIdx * 0.1) 
                }); 
            }
        });
        
        // 2. ЦОКОЛЬ
        if(blockDetails.hasBasementFloor) { 
            const isTsokolMixed = commFloors.includes('tsokol');
            list.push({ id: 'floor_0', label: 'Цоколь', type: 'tsokol', isComm: isTsokolMixed, sortOrder: 0 }); 
        }
        
        // 3. НАЗЕМНЫЕ + ВСТАВКИ
        const start = blockDetails.floorsFrom || 1;
        const end = blockDetails.floorsTo || 1;
        
        for(let i=start; i<=end; i++) { 
            const isMixed = commFloors.includes(i); 
            list.push({ 
                id: `floor_${i}`, 
                label: `${i} этаж`, 
                index: i, 
                type: isMixed ? 'mixed' : 'residential', 
                isComm: isMixed, 
                sortOrder: i * 10 
            }); 

            if (blockDetails.technicalFloors?.includes(i)) {
                const isTechMixed = commFloors.includes(`${i}-Т`);
                list.push({ 
                    id: `floor_${i}_tech`, 
                    label: `${i}-Т (Тех)`, 
                    type: 'technical', 
                    isComm: isTechMixed, 
                    sortOrder: (i * 10) + 5 
                });
            }
        }
        
        // 4. ДОП. ТЕХ. ЭТАЖИ
        const extraTechs = (blockDetails.technicalFloors || []).filter(f => f > end);
        extraTechs.forEach(f => {
             list.push({ id: `floor_${f}_tech_extra`, label: `${f} (Тех)`, type: 'technical', isComm: false, sortOrder: (f * 10) });
        });

        // 5. СПЕЦ. УРОВНИ
        if(blockDetails.hasAttic) {
            const isAtticMixed = commFloors.includes('attic');
            list.push({ id: 'attic', label: 'Мансарда', type: 'attic', isComm: isAtticMixed, sortOrder: 50000 }); 
        }
        if(blockDetails.hasLoft) {
            const isLoftMixed = commFloors.includes('loft');
            list.push({ id: 'loft', label: 'Чердак', type: 'loft', isComm: isLoftMixed, sortOrder: 55000 }); 
        }
        if(blockDetails.hasExploitableRoof) {
            const isRoofMixed = commFloors.includes('roof');
            list.push({ id: 'roof', label: 'Кровля', type: 'roof', isComm: isRoofMixed, sortOrder: 60000 }); 
        }

        // Сортировка: НИЖНИЕ ВВЕРХУ (Ascending)
        return list.sort((a,b) => a.sortOrder - b.sortOrder); 
    }, [currentBlock, blockDetails, basements, building]);


    // --- ХЕЛПЕРЫ ДАННЫХ ---
    const setEntData = (entIdx, floorId, field, val) => {
        const key = `${currentBlock.fullId}_ent${entIdx}_${floorId}`;
        setEntrancesData(prev => ({ ...prev, [key]: { ...(prev[key]||{}), [field]: val } }));
    };

    const getEntData = (entIdx, floorId, field) => {
        const key = `${currentBlock.fullId}_ent${entIdx}_${floorId}`;
        return entrancesData[key]?.[field] || '';
    };

    const toggleDuplex = (floorId) => { 
        const key = `${currentBlock.fullId}_${floorId}`; 
        const current = floorData[key]?.isDuplex; 
        setFloorData(p => ({...p, [key]: {...(p[key]||{}), isDuplex: !current}})); 
    };

    // --- ЛОГИКА ДОСТУПНОСТИ ДУПЛЕКСА ---
    const getDuplexState = (f, idx) => {
        // 1. Только жилые или смешанные
        if (!['residential', 'mixed'].includes(f.type)) return { disabled: true, title: 'Только на жилых/смешанных этажах' };

        // 2. Проверка заполненности квартир
        let hasApts = false;
        for (const e of entrancesList) {
            const val = getEntData(e, f.id, 'apts');
            if (val && parseInt(val) > 0) {
                hasApts = true;
                break;
            }
        }
        if (!hasApts) return { disabled: true, title: 'Введите количество квартир' };

        // 3. Проверка этажа сверху
        // Так как сортировка Ascending (-1, 0, 1...), этаж сверху имеет индекс idx + 1
        const floorAbove = floorList[idx + 1];

        // Если сверху ничего нет (последний этаж)
        if (!floorAbove) return { disabled: true, title: 'Нет этажа сверху для второго уровня' };

        // Если сверху Технический этаж
        if (floorAbove.type === 'technical') return { disabled: true, title: 'Нельзя объединить с техническим этажом' };

        // Разрешено (сверху жилой, мансарда или кровля)
        return { disabled: false, title: 'Объединить с этажом выше' };
    };

    // Автозаполнение
    const autoFill = () => { 
        const updates = {}; 
        entrancesList.forEach(ent => floorList.forEach(f => { 
            let apts = 0;
            if (f.type === 'residential' || f.type === 'attic') apts = 4;
            if (f.type === 'mixed') apts = 3;
            
            updates[`${currentBlock.fullId}_ent${ent}_${f.id}`] = { 
                apts, 
                mopQty: 1, 
                units: (f.isComm) ? 1 : 0 
            }; 
        })); 
        setEntrancesData(p => ({...p, ...updates})); 
    };

    // --- ЛОГИКА КОПИРОВАНИЯ ---
    const copyFloorToNext = (idx) => { 
        if (idx >= floorList.length - 1) return; 
        const currentFloor = floorList[idx]; 
        const nextFloor = floorList[idx + 1]; 
        const updates = {}; 
        entrancesList.forEach(ent => { 
            const srcKey = `${currentBlock.fullId}_ent${ent}_${currentFloor.id}`; 
            const tgtKey = `${currentBlock.fullId}_ent${ent}_${nextFloor.id}`; 
            const srcData = entrancesData[srcKey]; 
            if(srcData) updates[tgtKey] = {...srcData}; 
        }); 
        setEntrancesData(prev => ({ ...prev, ...updates })); 
    };

    const fillFloorsAfter = (idx) => { 
        const sourceFloor = floorList[idx]; 
        const updates = {}; 
        const sourceValues = {}; 
        entrancesList.forEach(ent => sourceValues[ent] = entrancesData[`${currentBlock.fullId}_ent${ent}_${sourceFloor.id}`]); 
        
        for(let i = idx + 1; i < floorList.length; i++) { 
            const targetFloor = floorList[i]; 
            if (targetFloor.type === 'technical' && sourceFloor.type !== 'technical') continue;
            entrancesList.forEach(ent => { 
                if(sourceValues[ent]) { 
                    updates[`${currentBlock.fullId}_ent${ent}_${targetFloor.id}`] = {...sourceValues[ent]}; 
                } 
            }); 
        } 
        setEntrancesData(prev => ({ ...prev, ...updates })); 
    };

    const copyEntranceFromLeft = (floorId, entIdx) => { 
        if(entIdx <= 1) return; 
        const tgtKey = `${currentBlock.fullId}_ent${entIdx}_${floorId}`; 
        const srcKey = `${currentBlock.fullId}_ent${entIdx-1}_${floorId}`; 
        const srcData = entrancesData[srcKey]; 
        if(srcData) setEntrancesData(p => ({...p, [tgtKey]: {...srcData}})); 
    };

    const fillEntrancesRow = (floorId, srcEntIdx) => { 
        const srcKey = `${currentBlock.fullId}_ent${srcEntIdx}_${floorId}`; 
        const srcData = entrancesData[srcKey]; 
        if(!srcData) return; 
        const updates = {}; 
        entrancesList.forEach(ent => { if(ent !== srcEntIdx) updates[`${currentBlock.fullId}_ent${ent}_${floorId}`] = {...srcData}; }); 
        setEntrancesData(p => ({...p, ...updates})); 
    };

    const renderBadge = (type) => {
        const map = {
            residential: { color: 'bg-blue-100 text-blue-700', label: 'Жилой' },
            mixed: { color: 'bg-violet-100 text-violet-700', label: 'Смеш.' },
            technical: { color: 'bg-amber-100 text-amber-700', label: 'Тех.' },
            basement: { color: 'bg-slate-200 text-slate-600', label: 'Подвал' },
            tsokol: { color: 'bg-purple-100 text-purple-700', label: 'Цоколь' },
            attic: { color: 'bg-teal-100 text-teal-700', label: 'Манс.' },
            loft: { color: 'bg-gray-200 text-gray-600', label: 'Чердак' },
            roof: { color: 'bg-sky-100 text-sky-700', label: 'Кровля' }
        };
        const style = map[type] || map.residential;
        return <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${style.color}`}>{style.label}</span>
    }

    return (
        <div className="space-y-6 pb-20 max-w-full mx-auto animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-6 mb-4">
                <div className="flex gap-4 items-center">
                    <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><ArrowLeft size={24}/></button>
                    <div><h2 className="text-2xl font-bold text-slate-800">{building.label}</h2><p className="text-slate-400 text-xs font-bold uppercase">Матрица подъездов (Квартирография)</p></div>
                </div>
                <div className="flex gap-2">
                    <button onClick={autoFill} className="px-4 py-2 bg-purple-50 text-purple-600 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-purple-100 transition-colors"><Wand2 size={14}/> Заполнить типовыми</button>
                    <Button onClick={() => { saveData(); onBack(); }}><Save size={14}/> Готово</Button>
                </div>
            </div>

            {/* Блоки */}
            <div className="flex gap-2 p-1 bg-slate-200/50 rounded-xl w-max">
                {blocksList.map((b,i) => (<TabButton key={b.id} active={activeBlockIndex===i} onClick={()=>setActiveBlockIndex(i)}>Блок {i+1} ({b.type})</TabButton>))}
            </div>

            {/* Таблица */}
            <Card className="overflow-x-auto shadow-lg border-0 ring-1 ring-slate-200 rounded-xl">
                <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
                    <table className="w-full border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 font-bold uppercase sticky top-0 z-20 shadow-sm">
                            <tr>
                                <th className="p-3 text-left w-40 sticky left-0 bg-slate-50 z-30 border-r border-slate-200 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">Этаж</th>
                                {entrancesList.map(e => (
                                    <th key={e} className="p-2 min-w-[200px] border-r border-slate-200 bg-slate-50/95 backdrop-blur">
                                        <div className="flex flex-col items-center">
                                            <span className="text-blue-600 mb-1 font-bold text-xs">Подъезд {e}</span>
                                            <div className="grid grid-cols-3 gap-1 w-full text-center opacity-60 text-[9px]">
                                                <span>Квартир</span><span>Нежилых</span><span>МОП</span>
                                            </div>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {floorList.map((f, idx) => {
                                const isDuplex = floorData[`${currentBlock.fullId}_${f.id}`]?.isDuplex; 
                                const canHaveApts = ['residential', 'mixed', 'basement', 'tsokol', 'attic'].includes(f.type);
                                
                                // Проверка доступности чекбокса
                                const duplexState = getDuplexState(f, idx);

                                return (
                                    <tr key={f.id} className="hover:bg-blue-50/30 focus-within:bg-blue-50 transition-colors duration-200 group">
                                        {/* Левая колонка (Этаж) */}
                                        <td className="p-3 sticky left-0 bg-white group-focus-within:bg-blue-50 transition-colors duration-200 z-10 border-r border-slate-200 relative group/cell shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-slate-700">{f.label}</span>
                                                    {renderBadge(f.type)}
                                                </div>
                                                
                                                {/* Чекбокс Двухуровневые */}
                                                <div className="flex items-center gap-1.5 mt-1" title={duplexState.title}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isDuplex || false} 
                                                        onChange={() => !duplexState.disabled && toggleDuplex(f.id)} 
                                                        disabled={duplexState.disabled}
                                                        className={`rounded w-3 h-3 transition-all ${duplexState.disabled ? 'cursor-not-allowed opacity-30 bg-slate-100' : 'cursor-pointer text-purple-600'}`}
                                                    />
                                                    <span className={`text-[10px] ${duplexState.disabled ? 'text-slate-300' : 'text-slate-500'}`}>
                                                        Двухуровневые
                                                    </span>
                                                    {duplexState.disabled && <Info size={10} className="text-slate-300"/>}
                                                </div>
                                            </div>
                                            
                                            <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/cell:opacity-100 flex flex-col gap-1 z-20">
                                                <button onClick={() => fillFloorsAfter(idx)} title="Заполнить вниз" className="p-1 bg-white border border-slate-200 rounded shadow hover:text-blue-600"><ArrowDown size={12}/></button>
                                                <button onClick={() => copyFloorToNext(idx)} title="Копировать на следующий" className="p-1 bg-white border border-slate-200 rounded shadow hover:text-blue-600"><ArrowDown size={12} className="opacity-50"/></button>
                                            </div>
                                        </td>

                                        {/* Ячейки подъездов */}
                                        {entrancesList.map(e => {
                                            return (
                                                <td key={e} className={`p-0 border-r border-slate-100 h-12 relative group/cell ${isDuplex ? 'bg-purple-50/10' : ''}`}>
                                                    <div className="grid grid-cols-3 h-full divide-x divide-slate-100">
                                                        <DebouncedInput 
                                                            type="number" 
                                                            disabled={!canHaveApts}
                                                            className={`text-center text-xs font-bold outline-none h-full focus:bg-white focus:ring-2 focus:ring-inset focus:ring-blue-200 transition-all ${!canHaveApts ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : 'text-emerald-700 bg-emerald-50/30'}`} 
                                                            value={getEntData(e, f.id, 'apts')} 
                                                            onChange={val => setEntData(e, f.id, 'apts', val)} 
                                                            placeholder={canHaveApts ? "-" : ""}
                                                        />
                                                        <DebouncedInput 
                                                            type="number" 
                                                            disabled={!f.isComm} 
                                                            className={`text-center text-xs font-bold outline-none h-full focus:bg-white focus:ring-2 focus:ring-inset focus:ring-blue-200 transition-all ${f.isComm ? 'bg-blue-50/30 text-blue-700' : 'bg-slate-50 text-slate-200 cursor-not-allowed'}`} 
                                                            value={getEntData(e, f.id, 'units')} 
                                                            onChange={val => setEntData(e, f.id, 'units', val)} 
                                                        />
                                                        <DebouncedInput 
                                                            type="number" 
                                                            className="text-center text-xs font-bold outline-none h-full bg-white text-slate-500 focus:text-slate-800 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-blue-200 transition-all" 
                                                            value={getEntData(e, f.id, 'mopQty')} 
                                                            onChange={val => setEntData(e, f.id, 'mopQty', val)} 
                                                        />
                                                    </div>
                                                    <div className="absolute top-0 right-0 h-full flex items-center pr-0.5 opacity-0 group-hover/cell:opacity-100 transition-opacity z-10 pointer-events-none">
                                                        <div className="flex flex-col gap-0.5 pointer-events-auto bg-white/90 backdrop-blur-sm shadow-sm border border-slate-200 rounded p-0.5">
                                                            {e > 1 && <button onClick={()=>copyEntranceFromLeft(f.id, e)} title="Скопировать слева" className="p-0.5 hover:text-blue-600"><ChevronLeft size={10}/></button>}
                                                            <button onClick={()=>fillEntrancesRow(f.id, e)} title="Заполнить ряд вправо" className="p-0.5 hover:text-blue-600"><ChevronsRight size={10}/></button>
                                                        </div>
                                                    </div>
                                                </td>
                                            )
                                        })}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}