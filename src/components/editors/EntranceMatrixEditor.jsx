import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, Save, Wand2, ArrowDown, ArrowUp, 
  DoorOpen, ChevronLeft, ChevronsRight, Building2, Store, Car, Box, Ban
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, DebouncedInput, TabButton, Button } from '../ui/UIKit';
import { getBlocksList } from '../../lib/utils'; // <--- Импорт утилиты

export default function EntranceMatrixEditor({ buildingId, onBack }) {
    // ВАЖНО: Добавили saveBuildingData в импорт
    const { composition, buildingDetails, entrancesData, setEntrancesData, floorData, setFloorData, saveBuildingData, saveData } = useProject();
    const [activeBlockIndex, setActiveBlockIndex] = useState(0);

    const building = composition.find(c => c.id === buildingId);
    
    // Используем общую функцию
    const blocksList = useMemo(() => getBlocksList(building), [building]);
    const currentBlock = blocksList[activeBlockIndex];

    if (!building || !currentBlock) return <div className="p-12 text-center text-slate-500">Данные не найдены</div>;

    // --- ПРОВЕРКИ ТИПА ---
    const isResidentialBlock = currentBlock.type === 'Ж';
    // Подземный паркинг тоже разрешен
    const isUndergroundParking = building.category === 'parking_separate' && building.parkingType === 'underground';
    
    // Показывать ли редактор? (Жилой блок ИЛИ Подземный паркинг)
    const showEditor = isResidentialBlock || isUndergroundParking;

    const blockDetails = buildingDetails[`${building.id}_${currentBlock.id}`] || {};
    const entrancesCount = isUndergroundParking 
        ? (blockDetails.inputs || 1) 
        : (blockDetails.entrances || 1);
        
    const entrancesList = Array.from({ length: entrancesCount }, (_, i) => i + 1);
    const basements = buildingDetails[`${building.id}_features`]?.basements || [];

    // --- ГЕНЕРАЦИЯ СПИСКА ЭТАЖЕЙ ---
    const floorList = useMemo(() => {
        if (!showEditor) return [];

        const list = [];

        // 1. СЦЕНАРИЙ: ПОДЗЕМНЫЙ ПАРКИНГ
        if (isUndergroundParking) {
            const depth = blockDetails.levelsDepth || 1;
            for (let i = 1; i <= depth; i++) {
                list.push({
                    id: `level_minus_${i}`,
                    label: `Уровень -${i}`,
                    type: 'parking_floor',
                    isComm: false, // Коммерции нет
                    sortOrder: -i
                });
            }
            return list.sort((a,b) => b.sortOrder - a.sortOrder); 
        }

        // 2. СЦЕНАРИЙ: ЖИЛОЙ БЛОК
        const commFloors = blockDetails.commercialFloors || []; 

        // Подвалы
        const isBasementMixed = commFloors.includes('basement');
        const currentBlockBasements = basements.filter(b => b.blocks?.includes(currentBlock.id));
        currentBlockBasements.forEach((b, bIdx) => { 
            for(let d = b.depth; d >= 1; d--) {
                list.push({ 
                    id: `base_${b.id}_L${d}`, label: `Подвал -${d}`, type: 'basement', 
                    isComm: isBasementMixed, sortOrder: -1000 - d + (bIdx * 0.1) 
                }); 
            }
        });
        
        // Цоколь
        if(blockDetails.hasBasementFloor) { 
            const isTsokolMixed = commFloors.includes('tsokol');
            list.push({ id: 'floor_0', label: 'Цоколь', type: 'tsokol', isComm: isTsokolMixed, sortOrder: 0 }); 
        }
        
        // Наземные этажи
        const start = blockDetails.floorsFrom || 1;
        const end = blockDetails.floorsTo || 1;
        
        for(let i=start; i<=end; i++) { 
            const isMixed = commFloors.includes(i); 
            list.push({ 
                id: `floor_${i}`, label: `${i} этаж`, index: i, type: isMixed ? 'mixed' : 'residential', 
                isComm: isMixed, sortOrder: i * 10 
            }); 

            if (blockDetails.technicalFloors?.includes(i)) {
                const isTechMixed = commFloors.includes(`${i}-Т`);
                list.push({ 
                    id: `floor_${i}_tech`, label: `${i}-Т (Тех)`, type: 'technical', 
                    isComm: isTechMixed, sortOrder: (i * 10) + 5 
                });
            }
        }
        
        // Верхние тех. этажи
        const extraTechs = (blockDetails.technicalFloors || []).filter(f => f > end);
        extraTechs.forEach(f => {
             list.push({ id: `floor_${f}_tech_extra`, label: `${f} (Тех)`, type: 'technical', isComm: false, sortOrder: (f * 10) });
        });

        // Крыша
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

        return list.sort((a,b) => a.sortOrder - b.sortOrder); 
    }, [currentBlock, blockDetails, basements, building, isResidentialBlock, isUndergroundParking, showEditor]);

    // --- DATA HANDLERS ---
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

    const getDuplexState = (f, idx) => {
        if (!['residential', 'mixed'].includes(f.type)) return { disabled: true, title: 'Только на жилых/смешанных этажах' };
        let hasApts = false;
        for (const e of entrancesList) {
            const val = getEntData(e, f.id, 'apts');
            if (val && parseInt(val) > 0) { hasApts = true; break; }
        }
        if (!hasApts) return { disabled: true, title: 'Введите количество квартир' };
        const floorAbove = floorList[idx + 1];
        if (!floorAbove) return { disabled: true, title: 'Нет этажа сверху для второго уровня' };
        if (floorAbove.type === 'technical') return { disabled: true, title: 'Нельзя объединить с техническим этажом' };
        return { disabled: false, title: 'Объединить с этажом выше' };
    };

    const autoFill = () => { 
        const updates = {}; 
        entrancesList.forEach(ent => floorList.forEach(f => { 
            let apts = 0;
            if (isResidentialBlock) {
                if (f.type === 'residential' || f.type === 'attic') apts = 4;
                if (f.type === 'mixed') apts = 3;
            }
            updates[`${currentBlock.fullId}_ent${ent}_${f.id}`] = { apts, mopQty: 1, units: (f.isComm) ? 1 : 0 }; 
        })); 
        setEntrancesData(p => ({...p, ...updates})); 
    };

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
            roof: { color: 'bg-sky-100 text-sky-700', label: 'Кровля' },
            parking_floor: { color: 'bg-indigo-100 text-indigo-700', label: 'Паркинг' }
        };
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
                             <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Матрица подъездов</p>
                             <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded text-xs text-slate-600"><span className="font-bold text-slate-400 uppercase text-[9px]">Дом</span><span className="font-bold">{building.houseNumber}</span></div>
                             <div className="flex items-center gap-1.5 text-xs text-slate-600 pl-2 border-l border-slate-200"><span className="font-bold text-slate-400 uppercase text-[9px]">Тип</span><span className="font-medium">{building.type}</span></div>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={autoFill} disabled={!isResidentialBlock} className={`px-4 py-2 bg-purple-50 text-purple-600 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${isResidentialBlock ? 'hover:bg-purple-100' : 'opacity-50 cursor-not-allowed'}`}><Wand2 size={14}/> Заполнить типовыми</button>
                    
                    {/* ОБНОВЛЕНО: Используем saveBuildingData */}
                    <Button onClick={async () => { 
                        const specificData = {};
                        Object.keys(entrancesData).forEach(k => {
                            if (k.startsWith(building.id)) {
                                specificData[k] = entrancesData[k];
                            }
                        });

                        await saveBuildingData(building.id, 'entrancesData', specificData);
                        await saveData(); 
                        
                        onBack(); 
                    }}><Save size={14}/> Готово</Button>
                </div>
            </div>

            <div className="flex gap-2 p-1 bg-slate-200/50 rounded-xl w-max overflow-x-auto max-w-full mb-6 scrollbar-none">
                {blocksList.map((b,i) => (
                    <TabButton key={b.id} active={activeBlockIndex===i} onClick={()=>setActiveBlockIndex(i)}>{b.icon && <b.icon size={14} className="mr-1.5 opacity-70"/>}{b.tabLabel}</TabButton>
                ))}
            </div>

            {showEditor ? (
                <Card className="shadow-lg border-0 ring-1 ring-slate-200 rounded-xl overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-auto relative w-full max-w-[calc(100vw-64px)]" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                        <table className="w-max border-collapse table-fixed">
                            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 font-bold uppercase sticky top-0 z-30 shadow-sm">
                                <tr>
                                    <th className="p-2 text-left w-[110px] min-w-[110px] sticky left-0 bg-slate-50 z-40 border-r border-slate-200 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">Этаж</th>
                                    {entrancesList.map(e => (
                                        <th key={e} className="p-1 w-[180px] min-w-[180px] border-r border-slate-200 bg-slate-50/95 backdrop-blur">
                                            <div className="flex flex-col items-center">
                                                <span className="text-blue-600 mb-1 font-bold text-xs">{isUndergroundParking ? `Вход ${e}` : `Подъезд ${e}`}</span>
                                                <div className="grid grid-cols-3 gap-1 w-full text-center opacity-60 text-[9px]"><span>Квартир</span><span>Нежилых</span><span>МОП</span></div>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {floorList.map((f, idx) => {
                                    const isDuplex = floorData[`${currentBlock.fullId}_${f.id}`]?.isDuplex; 
                                    const canHaveApts = ['residential', 'mixed', 'basement', 'tsokol', 'attic'].includes(f.type) && !isUndergroundParking;
                                    const duplexState = getDuplexState(f, idx);

                                    return (
                                        <tr key={f.id} className="hover:bg-blue-50/30 focus-within:bg-blue-50 transition-colors duration-200 group h-10">
                                            <td className="p-1 w-[110px] min-w-[110px] sticky left-0 bg-white group-focus-within:bg-blue-50 transition-colors duration-200 z-20 border-r border-slate-200 relative group/cell shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                                <div className="flex items-center justify-between h-full px-1">
                                                    <div className="flex items-center gap-1.5">
                                                        {canHaveApts && (<input type="checkbox" title={duplexState.title + (duplexState.disabled ? " (недоступно)" : "")} checked={isDuplex || false} onChange={() => !duplexState.disabled && toggleDuplex(f.id)} disabled={duplexState.disabled} className={`rounded w-3 h-3 transition-all flex-shrink-0 ${duplexState.disabled ? 'cursor-not-allowed opacity-30 bg-slate-100' : 'cursor-pointer text-purple-600'}`}/>)}
                                                        <span className="text-xs font-bold text-slate-700">{f.label}</span>
                                                    </div>
                                                    {renderBadge(f.type)}
                                                </div>
                                                <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/cell:opacity-100 flex gap-1 z-30 bg-white/90 p-0.5 rounded shadow-sm border border-slate-200">
                                                    <button onClick={() => fillFloorsAfter(idx)} title="Заполнить вниз" className="p-0.5 hover:text-blue-600"><ArrowDown size={10}/></button>
                                                    <button onClick={() => copyFloorToNext(idx)} title="Копировать на следующий" className="p-0.5 hover:text-blue-600"><ArrowDown size={10} className="opacity-50"/></button>
                                                </div>
                                            </td>
                                            {entrancesList.map(e => (
                                                <td key={e} className={`p-0 w-[180px] min-w-[180px] border-r border-slate-100 h-10 relative group/cell ${isDuplex ? 'bg-purple-50/10' : ''}`}>
                                                    <div className="grid grid-cols-3 h-full divide-x divide-slate-100">
                                                        <DebouncedInput type="number" disabled={!canHaveApts} className={`text-center text-xs font-bold outline-none h-full w-full focus:bg-white focus:ring-2 focus:ring-inset focus:ring-blue-200 transition-all ${!canHaveApts ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : 'text-emerald-700 bg-emerald-50/30'}`} value={getEntData(e, f.id, 'apts')} onChange={val => setEntData(e, f.id, 'apts', val)} placeholder={canHaveApts ? "-" : ""}/>
                                                        <DebouncedInput type="number" disabled={!f.isComm || isUndergroundParking} className={`text-center text-xs font-bold outline-none h-full w-full focus:bg-white focus:ring-2 focus:ring-inset focus:ring-blue-200 transition-all ${(!f.isComm || isUndergroundParking) ? 'bg-slate-50 text-slate-200 cursor-not-allowed' : 'bg-blue-50/30 text-blue-700'}`} value={getEntData(e, f.id, 'units')} onChange={val => setEntData(e, f.id, 'units', val)} />
                                                        <DebouncedInput type="number" className="text-center text-xs font-bold outline-none h-full w-full bg-white text-slate-500 focus:text-slate-800 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-blue-200 transition-all" value={getEntData(e, f.id, 'mopQty')} onChange={val => setEntData(e, f.id, 'mopQty', val)} />
                                                    </div>
                                                    <div className="absolute top-0 right-0 h-full flex items-center pr-0.5 opacity-0 group-hover/cell:opacity-100 transition-opacity z-10 pointer-events-none">
                                                        <div className="flex flex-col gap-0.5 pointer-events-auto bg-white/90 backdrop-blur-sm shadow-sm border border-slate-200 rounded p-0.5">
                                                            {e > 1 && <button onClick={()=>copyEntranceFromLeft(f.id, e)} title="Скопировать слева" className="p-0.5 hover:text-blue-600"><ChevronLeft size={10}/></button>}
                                                            <button onClick={()=>fillEntrancesRow(f.id, e)} title="Заполнить ряд вправо" className="p-0.5 hover:text-blue-600"><ChevronsRight size={10}/></button>
                                                        </div>
                                                    </div>
                                                </td>
                                            ))}
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            ) : (
                <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4 animate-in fade-in">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400"><DoorOpen size={40} /><div className="absolute"><Ban size={20} className="text-slate-400 translate-x-4 translate-y-4"/></div></div>
                    <h3 className="text-xl font-bold text-slate-700">Настройка подъездов недоступна</h3>
                    <p className="text-slate-500 max-w-md">Матрица подъездов и квартир заполняется только для жилых блоков и подземных паркингов.<br/>Для нежилых блоков и инфраструктуры это не требуется.</p>
                </div>
            )}
        </div>
    );
}