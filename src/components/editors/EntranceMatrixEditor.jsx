import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, Save, Wand2, ArrowUp, ChevronsDown, 
  DoorOpen, ChevronLeft, ChevronsRight 
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, DebouncedInput, TabButton, Button } from '../ui/UIKit';

// Получение списка блоков
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
    if (!building) return <div className="p-12 text-center text-slate-500">Здание не найдено</div>;

    // 2. Безопасное получение блоков
    const blocksList = useMemo(() => getBlocksList(building), [building]);
    const currentBlock = blocksList[activeBlockIndex];
    
    // Если нет блоков (например, выбран Паркинг, у которого нет подъездов в привычном смысле)
    if (!currentBlock) {
         return (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center">
                <DoorOpen size={48} className="mb-4 opacity-20"/>
                <p>В этом объекте нет жилых подъездов для настройки.</p>
                <Button onClick={onBack} variant="secondary" className="mt-4">Назад</Button>
            </div>
         );
    }

    // Детали блока
    const blockDetails = buildingDetails[`${building.id}_${currentBlock.id}`] || {};
    const entrancesCount = blockDetails.entrances || 1;
    const entrancesList = Array.from({ length: entrancesCount }, (_, i) => i + 1);
    const basements = buildingDetails[`${building.id}_features`]?.basements || [];

    // Генерируем список этажей
    const floorList = useMemo(() => {
        const list = [];
        
        // Подвалы
        basements.filter(b => b.blocks?.includes(currentBlock.id)).forEach(b => { 
            for(let d=b.depth; d>=1; d--) {
                list.push({ id: `base_${b.id}_L${d}`, label: `Подвал -${d}`, type: 'basement', isComm: false, sortOrder: -100-d }); 
            }
        });
        
        // Цоколь
        if(blockDetails.hasBasementFloor) { 
            list.push({ id: 'floor_0', label: 'Цоколь', type: 'basement_floor', isComm: false, sortOrder: 0 }); 
        }
        
        // Наземные
        const start = blockDetails.floorsFrom || 1;
        const end = blockDetails.floorsTo || 1;
        for(let i=start; i<=end; i++) { 
            const isComm = blockDetails.commercialFloors?.includes(i); 
            list.push({ id: `floor_${i}`, label: `${i} этаж`, index: i, type: isComm ? 'comm' : 'res', isComm: isComm, sortOrder: i }); 
        }
        return list.sort((a,b)=>a.sortOrder-b.sortOrder); 
    }, [currentBlock, blockDetails, basements, building]);

    // Хелперы для чтения/записи
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

    // Автозаполнение
    const autoFill = () => { 
        const updates = {}; 
        entrancesList.forEach(ent => floorList.forEach(f => { 
            const isDuplex = floorData[`${currentBlock.fullId}_${f.id}`]?.isDuplex; 
            // Если жилой этаж - ставим 4 квартиры, если коммерция - 2 офиса
            const apts = (!f.isComm && f.type !== 'basement') ? (isDuplex ? 2 : 4) : 0;
            const units = (f.isComm || f.type === 'basement_floor') ? 2 : 0;
            
            updates[`${currentBlock.fullId}_ent${ent}_${f.id}`] = { apts, mopQty: 1, units }; 
        })); 
        setEntrancesData(p => ({...p, ...updates})); 
    };

    // Копирование (логика кнопок)
    const copyFloorFromPrev = (idx) => { 
        if (idx <= 0) return; 
        const currentFloor = floorList[idx]; 
        const prevFloor = floorList[idx - 1]; 
        const updates = {}; 
        entrancesList.forEach(ent => { 
            const srcKey = `${currentBlock.fullId}_ent${ent}_${prevFloor.id}`; 
            const tgtKey = `${currentBlock.fullId}_ent${ent}_${currentFloor.id}`; 
            const srcData = entrancesData[srcKey]; 
            if(srcData) { 
                let newData = {...srcData}; 
                if (!currentFloor.isComm) newData.units = 0; 
                updates[tgtKey] = newData; 
            } 
        }); 
        setEntrancesData(prev => ({ ...prev, ...updates })); 
    };

    const fillFloorsBelow = (idx) => { 
        const sourceFloor = floorList[idx]; 
        const updates = {}; 
        const sourceValues = {}; 
        entrancesList.forEach(ent => sourceValues[ent] = entrancesData[`${currentBlock.fullId}_ent${ent}_${sourceFloor.id}`]); 
        
        for(let i = idx + 1; i < floorList.length; i++) { 
            const targetFloor = floorList[i]; 
            entrancesList.forEach(ent => { 
                if(sourceValues[ent]) { 
                    let newData = {...sourceValues[ent]}; 
                    if (!targetFloor.isComm) newData.units = 0; 
                    updates[`${currentBlock.fullId}_ent${ent}_${targetFloor.id}`] = newData; 
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

    return (
        <div className="space-y-6 pb-20 max-w-full mx-auto animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-6 mb-4">
                <div className="flex gap-4 items-center">
                    <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><ArrowLeft size={24}/></button>
                    <div><h2 className="text-2xl font-bold text-slate-800">{building.label}</h2><p className="text-slate-400 text-xs font-bold uppercase">Матрица подъездов</p></div>
                </div>
                <div className="flex gap-2">
                    <button onClick={autoFill} className="px-4 py-2 bg-purple-50 text-purple-600 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-purple-100 transition-colors"><Wand2 size={14}/> Заполнить по умолчанию</button>
                    <Button onClick={() => { saveData(); onBack(); }}><Save size={14}/> Готово</Button>
                </div>
            </div>

            {/* Блоки */}
            <div className="flex gap-2 p-1 bg-slate-200/50 rounded-xl w-max">
                {blocksList.map((b,i) => (<TabButton key={b.id} active={activeBlockIndex===i} onClick={()=>setActiveBlockIndex(i)}>Блок {i+1} ({b.type})</TabButton>))}
            </div>

            {/* Таблица */}
            <Card className="overflow-x-auto shadow-lg border-0 ring-1 ring-slate-200">
                <table className="w-full border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 font-bold uppercase">
                        <tr>
                            <th className="p-4 text-left w-32 sticky left-0 bg-slate-50 z-10 border-r shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]">Этаж</th>
                            {entrancesList.map(e => (
                                <th key={e} className="p-3 min-w-[200px] border-r border-slate-200 bg-slate-50/50">
                                    <div className="bg-white rounded-xl border p-2 text-center text-blue-600 shadow-sm">
                                        Подъезд {e}
                                        <div className="grid grid-cols-3 gap-1 mt-1 text-[9px] text-slate-400"><span>КВ</span><span>ОФ</span><span>МОП</span></div>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {floorList.map((f, idx) => {
                            const isDuplex = floorData[`${currentBlock.fullId}_${f.id}`]?.isDuplex; 
                            return (
                                <tr key={f.id} className="hover:bg-blue-50/10 group">
                                    <td className="p-3 sticky left-0 bg-white z-10 border-r font-bold text-xs text-slate-700 relative shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)]">
                                        <div className="flex items-center gap-2">
                                            <input type="checkbox" checked={isDuplex||false} onChange={()=>toggleDuplex(f.id)} className="rounded text-purple-600" title="Дуплекс"/>
                                            {f.label} {f.isComm && <span className="text-[9px] bg-blue-100 text-blue-600 px-1 rounded ml-1">K</span>}
                                        </div>
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex gap-1 bg-white shadow-sm border rounded-lg p-0.5 transition-all z-20">
                                            {idx > 0 && <button onClick={() => copyFloorFromPrev(idx)} className="p-1.5 hover:bg-slate-100 rounded text-slate-500"><ArrowUp size={12}/></button>}
                                            <button onClick={() => fillFloorsBelow(idx)} className="p-1.5 hover:bg-slate-100 rounded text-slate-500"><ChevronsDown size={12}/></button>
                                        </div>
                                    </td>
                                    {entrancesList.map(e => (
                                        <td key={e} className={`p-0 border-r border-slate-100 h-10 relative group/cell ${isDuplex ? 'bg-purple-50/20' : ''}`}>
                                            <div className="grid grid-cols-3 h-full divide-x divide-slate-100">
                                                <DebouncedInput type="number" className={`text-center text-xs font-bold outline-none h-full focus:bg-white ${isDuplex?'text-purple-700 bg-purple-50':'text-blue-700 bg-blue-50/30'}`} value={getEntData(e, f.id, 'apts')} onChange={val => setEntData(e, f.id, 'apts', val)} />
                                                <DebouncedInput type="number" disabled={!f.isComm && f.type !== 'basement'} className={`text-center text-xs font-bold outline-none h-full ${f.isComm || f.type === 'basement' ? 'bg-amber-50/30 text-amber-700' : 'bg-slate-50 text-slate-300'}`} value={getEntData(e, f.id, 'units')} onChange={val => setEntData(e, f.id, 'units', val)} />
                                                <DebouncedInput type="number" className="text-center text-xs font-bold outline-none h-full bg-white text-slate-600" value={getEntData(e, f.id, 'mopQty')} onChange={val => setEntData(e, f.id, 'mopQty', val)} />
                                            </div>
                                            <div className="absolute top-0 right-0 h-full flex items-center pr-1 opacity-0 group-hover/cell:opacity-100 pointer-events-none transition-opacity">
                                                <div className="flex flex-col gap-0.5 pointer-events-auto bg-white/80 backdrop-blur-sm rounded shadow-sm border p-0.5">
                                                    {e > 1 && <button onClick={()=>copyEntranceFromLeft(f.id, e)} className="p-0.5 hover:text-blue-600"><ChevronLeft size={10}/></button>}
                                                    <button onClick={()=>fillEntrancesRow(f.id, e)} className="p-0.5 hover:text-blue-600"><ChevronsRight size={10}/></button>
                                                </div>
                                            </div>
                                        </td>
                                    ))}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </Card>
        </div>
    );
}