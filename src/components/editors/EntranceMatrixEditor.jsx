import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ArrowLeft, Save, Wand2, ArrowDown, ArrowUp, 
  DoorOpen, ChevronLeft, ChevronsRight, Ban,
  MoreHorizontal, ChevronsDown
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, DebouncedInput, TabButton, Button } from '../ui/UIKit';
import { getBlocksList } from '../../lib/utils';
import { useBuildingFloors } from '../../hooks/useBuildingFloors';
import { Validators } from '../../lib/validators';
// ВАЛИДАЦИЯ
import { EntranceDataSchema } from '../../lib/schemas';

/**
 * @param {{ buildingId: string, onBack: () => void }} props
 */
export default function EntranceMatrixEditor({ buildingId, onBack }) {
    const { composition, buildingDetails, entrancesData, setEntrancesData, floorData, setFloorData, saveBuildingData, saveData } = useProject();
    const [activeBlockIndex, setActiveBlockIndex] = useState(0);
    const [openMenuId, setOpenMenuId] = useState(null);
    const inputsRef = useRef({});
    const menuRef = useRef(null);

    const building = composition.find(c => c.id === buildingId);
    const blocksList = useMemo(() => getBlocksList(building), [building]);
    
    const { floorList, currentBlock, isUndergroundParking, isParking } = useBuildingFloors(buildingId, activeBlockIndex);

    useEffect(() => {
        inputsRef.current = {};
        setOpenMenuId(null);
    }, [activeBlockIndex]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!building || !currentBlock) return <div className="p-12 text-center text-slate-500">Данные не найдены</div>;

    const isResidentialBlock = currentBlock.type === 'Ж';
    const showEditor = isResidentialBlock || isUndergroundParking;

    // @ts-ignore
    const blockDetails = buildingDetails[`${building.id}_${currentBlock.id}`] || {};
    const entrancesCount = isUndergroundParking 
        ? (blockDetails.inputs || 1) 
        : (blockDetails.entrances || 1);
        
    const entrancesList = Array.from({ length: entrancesCount }, (_, i) => i + 1);
    
    const setEntData = (entIdx, floorId, field, val) => {
        if (val !== '' && (parseFloat(val) < 0 || String(val).includes('-'))) return;
        const key = `${currentBlock.fullId}_ent${entIdx}_${floorId}`;
        // @ts-ignore
        setEntrancesData(prev => ({ ...prev, [key]: { ...(prev[key]||{}), [field]: val } }));
    };

    const getEntData = (entIdx, floorId, field) => {
        const key = `${currentBlock.fullId}_ent${entIdx}_${floorId}`;
        // @ts-ignore
        return entrancesData[key]?.[field] || '';
    };

    const toggleDuplex = (floorId) => { 
        const key = `${currentBlock.fullId}_${floorId}`; 
        // @ts-ignore
        const current = floorData[key]?.isDuplex; 
        // @ts-ignore
        setFloorData(p => ({...p, [key]: {...(p[key]||{}), isDuplex: !current}})); 
    };

    const isFieldEnabled = (floor, field) => {
        if (field === 'mopQty') return true; 
        if (isUndergroundParking) return false; 
        if (field === 'apts') return ['residential', 'mixed', 'basement', 'tsokol', 'attic'].includes(floor.type);
        if (field === 'units') return floor.isComm;
        return true;
    };

    const handleKeyDown = (e, floorIdx, entIdx, field) => {
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        e.preventDefault();

        const fieldsOrder = ['apts', 'units', 'mopQty'];
        let currFloorIdx = floorIdx;
        let currEntIdx = entIdx;
        let currFieldIdx = fieldsOrder.indexOf(field);

        for (let i = 0; i < 10; i++) {
            if (e.key === 'ArrowUp') currFloorIdx--;
            if (e.key === 'ArrowDown') currFloorIdx++;
            
            if (e.key === 'ArrowLeft') {
                currFieldIdx--;
                if (currFieldIdx < 0) {
                    if (currEntIdx > 1) {
                        currEntIdx--;
                        currFieldIdx = fieldsOrder.length - 1;
                    } else {
                        currFieldIdx = 0;
                        break; 
                    }
                }
            }
            
            if (e.key === 'ArrowRight') {
                currFieldIdx++;
                if (currFieldIdx >= fieldsOrder.length) {
                    if (currEntIdx < entrancesCount) {
                        currEntIdx++;
                        currFieldIdx = 0;
                    } else {
                        currFieldIdx = fieldsOrder.length - 1;
                        break;
                    }
                }
            }

            if (currFloorIdx < 0) { currFloorIdx = 0; break; }
            if (currFloorIdx >= floorList.length) { currFloorIdx = floorList.length - 1; break; }

            const targetFloor = floorList[currFloorIdx];
            const targetField = fieldsOrder[currFieldIdx];
            
            if (isFieldEnabled(targetFloor, targetField)) {
                const targetKey = `${currFloorIdx}-${currEntIdx}-${targetField}`;
                // @ts-ignore
                if (inputsRef.current[targetKey]) {
                    // @ts-ignore
                    inputsRef.current[targetKey].focus();
                }
                return;
            }
        }
    };

    const autoFill = () => { 
        const updates = {}; 
        entrancesList.forEach(ent => floorList.forEach(f => { 
            let apts = 0;
            if (isResidentialBlock) {
                if (f.type === 'residential' || f.type === 'attic') apts = 4;
                if (f.type === 'mixed') apts = 3;
            }
            // @ts-ignore
            updates[`${currentBlock.fullId}_ent${ent}_${f.id}`] = { apts, mopQty: 1, units: (f.isComm) ? 1 : 0 }; 
        })); 
        // @ts-ignore
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
            // @ts-ignore
            const srcData = entrancesData[srcKey]; 
            // @ts-ignore
            if(srcData) updates[tgtKey] = {...srcData}; 
        }); 
        // @ts-ignore
        setEntrancesData(prev => ({ ...prev, ...updates })); 
        setOpenMenuId(null);
    };

    const fillFloorsAfter = (idx) => { 
        const sourceFloor = floorList[idx]; 
        const updates = {}; 
        const sourceValues = {}; 
        // @ts-ignore
        entrancesList.forEach(ent => sourceValues[ent] = entrancesData[`${currentBlock.fullId}_ent${ent}_${sourceFloor.id}`]); 
        
        for(let i = idx + 1; i < floorList.length; i++) { 
            const targetFloor = floorList[i]; 
            if (targetFloor.type === 'technical' && sourceFloor.type !== 'technical') continue;
            entrancesList.forEach(ent => { 
                // @ts-ignore
                if(sourceValues[ent]) { 
                    // @ts-ignore
                    updates[`${currentBlock.fullId}_ent${ent}_${targetFloor.id}`] = {...sourceValues[ent]}; 
                } 
            }); 
        } 
        // @ts-ignore
        setEntrancesData(prev => ({ ...prev, ...updates })); 
        setOpenMenuId(null);
    };

    const copyEntranceFromLeft = (floorId, entIdx) => { 
        if(entIdx <= 1) return; 
        const tgtKey = `${currentBlock.fullId}_ent${entIdx}_${floorId}`; 
        const srcKey = `${currentBlock.fullId}_ent${entIdx-1}_${floorId}`; 
        // @ts-ignore
        const srcData = entrancesData[srcKey]; 
        // @ts-ignore
        if(srcData) setEntrancesData(p => ({...p, [tgtKey]: {...srcData}})); 
    };

    const fillEntrancesRow = (floorId, srcEntIdx) => { 
        const srcKey = `${currentBlock.fullId}_ent${srcEntIdx}_${floorId}`; 
        // @ts-ignore
        const srcData = entrancesData[srcKey]; 
        if(!srcData) return; 
        const updates = {}; 
        // @ts-ignore
        entrancesList.forEach(ent => { if(ent !== srcEntIdx) updates[`${currentBlock.fullId}_ent${ent}_${floorId}`] = {...srcData}; }); 
        // @ts-ignore
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
                             <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Матрица подъездов</p>
                             <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded text-xs text-slate-600"><span className="font-bold text-slate-400 uppercase text-[9px]">Дом</span><span className="font-bold">{building.houseNumber}</span></div>
                             <div className="flex items-center gap-1.5 text-xs text-slate-600 pl-2 border-l border-slate-200"><span className="font-bold text-slate-400 uppercase text-[9px]">Тип</span><span className="font-medium">{building.type}</span></div>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={autoFill} disabled={!isResidentialBlock && !isParking} className={`px-4 py-2 bg-purple-50 text-purple-600 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${!isResidentialBlock && !isParking ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-100'}`}><Wand2 size={14}/> Заполнить типовыми</button>
                    
                    <Button onClick={async () => { 
                        const specificData = {};
                        Object.keys(entrancesData).forEach(k => {
                            if (k.startsWith(building.id)) {
                                // @ts-ignore
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
                            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 font-bold uppercase sticky top-0 z-30 shadow-md">
                                <tr>
                                    {/* Липкая колонка этажей с тенью */}
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
                                    // @ts-ignore
                                    const isDuplex = floorData[`${currentBlock.fullId}_${f.id}`]?.isDuplex; 
                                    const canHaveApts = isFieldEnabled(f, 'apts');
                                    const canHaveUnits = isFieldEnabled(f, 'units');
                                    
                                    // Логика дуплекса
                                    let hasApts = false;
                                    for (const e of entrancesList) {
                                        const val = getEntData(e, f.id, 'apts');
                                        // @ts-ignore
                                        if (val && parseInt(val) > 0) { hasApts = true; break; }
                                    }
                                    const duplexState = Validators.checkDuplexAvailability(f, floorList[idx + 1], hasApts);

                                    return (
                                        <tr key={f.id} className="hover:bg-blue-50/30 focus-within:bg-blue-50 transition-colors duration-200 group h-10">
                                            
                                            {/* ПЕРВАЯ КОЛОНКА: МЕНЮ ДЕЙСТВИЙ */}
                                            <td className={`p-1 w-[110px] min-w-[110px] sticky left-0 bg-white group-focus-within:bg-blue-50 transition-colors duration-200 border-r border-slate-200 relative group/cell shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] ${openMenuId === f.id ? 'z-50' : 'z-20'}`}>
                                                <div className="flex items-center justify-between h-full px-1">
                                                    <div className="flex items-center gap-1.5">
                                                        {/* Чекбокс дуплекса */}
                                                        {canHaveApts && (<input type="checkbox" title={duplexState.title + (duplexState.disabled ? " (недоступно)" : "")} checked={isDuplex || false} onChange={() => !duplexState.disabled && toggleDuplex(f.id)} disabled={duplexState.disabled} className={`rounded w-3 h-3 transition-all flex-shrink-0 ${duplexState.disabled ? 'cursor-not-allowed opacity-30 bg-slate-100' : 'cursor-pointer text-purple-600'}`}/>)}
                                                        <span className="text-xs font-bold text-slate-700">{f.label}</span>
                                                    </div>
                                                    {renderBadge(f.type)}
                                                </div>

                                                {/* Кнопка "Три точки" */}
                                                <div className={`absolute right-1 top-1/2 -translate-y-1/2 transition-opacity z-30 ${openMenuId === f.id ? 'opacity-100' : 'opacity-0 group-hover/cell:opacity-100'}`}>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === f.id ? null : f.id); }}
                                                        className={`p-1 rounded-md shadow-sm border border-slate-200 hover:text-blue-600 transition-colors ${openMenuId === f.id ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white/90 text-slate-400'}`}
                                                    >
                                                        <MoreHorizontal size={14}/>
                                                    </button>
                                                </div>

                                                {/* Само меню действий */}
                                                {openMenuId === f.id && (
                                                    <div ref={menuRef} className="absolute left-[90px] top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 z-[100] p-1 flex flex-col animate-in fade-in zoom-in-95 duration-200 origin-top-left">
                                                        <button onClick={() => copyFloorToNext(idx)} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 rounded-lg text-left">
                                                            <ArrowDown size={14} className="text-slate-400"/> Скопировать вниз (1)
                                                        </button>
                                                        <button onClick={() => fillFloorsAfter(idx)} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 rounded-lg text-left border-t border-slate-100">
                                                            <ChevronsDown size={14} className="text-slate-400"/> Заполнить все ниже
                                                        </button>
                                                    </div>
                                                )}
                                            </td>

                                            {entrancesList.map(e => (
                                                <td key={e} className={`p-0 w-[180px] min-w-[180px] border-r border-slate-100 h-10 relative group/cell ${isDuplex ? 'bg-purple-50/10' : ''}`}>
                                                    <div className="grid grid-cols-3 h-full divide-x divide-slate-100">
                                                        {['apts', 'units', 'mopQty'].map(field => {
                                                            const canEdit = field === 'apts' ? canHaveApts : field === 'units' ? canHaveUnits : true;
                                                            const val = getEntData(e, f.id, field);
                                                            // ZOD Check
                                                            const check = EntranceDataSchema.shape[field].safeParse(val);
                                                            const isInvalid = val !== '' && !check.success;

                                                            return (
                                                                <DebouncedInput 
                                                                    key={field}
                                                                    // @ts-ignore
                                                                    ref={el => inputsRef.current[`${idx}-${e}-${field}`] = el}
                                                                    onKeyDown={(ev) => handleKeyDown(ev, idx, e, field)}
                                                                    type="number" 
                                                                    min="0"
                                                                    disabled={!canEdit} 
                                                                    className={`text-center text-xs font-bold outline-none h-full w-full focus:bg-white focus:ring-2 focus:ring-inset focus:ring-blue-200 transition-all ${!canEdit ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : (isInvalid ? 'bg-red-50 text-red-600' : 'bg-white text-slate-700')}`} 
                                                                    value={val} 
                                                                    onChange={v => setEntData(e, f.id, field, v)} 
                                                                    placeholder={canEdit ? "-" : ""}
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                    
                                                    {/* Кнопки копирования (ховер) */}
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