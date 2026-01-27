import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ArrowLeft, Wand2, ArrowDown, ArrowUp, 
  DoorOpen, ChevronLeft, ChevronsRight, Ban,
  MoreHorizontal, ChevronsDown, LayoutTemplate,
  Home, Briefcase, PaintBucket, AlertCircle
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, DebouncedInput, TabButton, Button } from '../ui/UIKit';
import SaveFloatingBar from '../ui/SaveFloatingBar'; 
import { getBlocksList } from '../../lib/utils';
import { useBuildingFloors } from '../../hooks/useBuildingFloors';
import { Validators } from '../../lib/validators';
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

    // Сброс при смене блока
    useEffect(() => {
        inputsRef.current = {};
        setOpenMenuId(null);
    }, [activeBlockIndex]);

    // Закрытие меню при клике вне
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
    
    // --- ЛОГИКА ДАННЫХ ---

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
        
        // Если это не цифры, предотвращаем дефолтное поведение для навигации
        e.preventDefault();

        const fieldsOrder = ['apts', 'units', 'mopQty'];
        let currFloorIdx = floorIdx;
        let currEntIdx = entIdx;
        let currFieldIdx = fieldsOrder.indexOf(field);

        for (let i = 0; i < 10; i++) { // Защита от бесконечного цикла
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

    // --- ФУНКЦИИ АВТОМАТИЗАЦИИ ---

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

    const handleSave = async () => { 
        const specificData = {};
        Object.keys(entrancesData).forEach(k => {
            if (k.startsWith(building.id)) {
                // @ts-ignore
                specificData[k] = entrancesData[k];
            }
        });

        await saveBuildingData(building.id, 'entrancesData', specificData);
        await saveData({}, true);
    };

    return (
        <div className="space-y-6 pb-24 max-w-7xl mx-auto animate-in fade-in duration-500 relative">
            
            {/* --- HEADER --- */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col md:flex-row justify-between items-center gap-4">
                 <div className="flex items-center gap-4 w-full md:w-auto">
                     <button onClick={onBack} className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-800 transition-colors">
                         <ArrowLeft size={20}/>
                     </button>
                     <div>
                         <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                             <LayoutTemplate size={20} className="text-blue-600"/>
                             {building.label}
                         </h2>
                         <div className="flex items-center gap-3 mt-1.5">
                             <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Дом №</span>
                                <span className="text-xs font-bold text-slate-700">{building.houseNumber}</span>
                             </div>
                             <div className="w-px h-4 bg-slate-200"></div>
                             <span className="text-xs font-medium text-slate-500">{building.type}</span>
                         </div>
                     </div>
                 </div>
                 
                 <div className="flex items-center gap-3 w-full md:w-auto">
                     <button 
                        onClick={autoFill} 
                        disabled={!isResidentialBlock && !isParking} 
                        className={`flex-1 md:flex-none h-10 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors border ${!isResidentialBlock && !isParking ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border-indigo-100'}`}
                     >
                        <Wand2 size={14}/> Заполнить типовыми
                     </button>
                     <Button variant="secondary" onClick={onBack} className="h-10">Закрыть</Button>
                 </div>
             </div>

            {/* --- TABS --- */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {blocksList.map((b,i) => (
                    <TabButton key={b.id} active={activeBlockIndex===i} onClick={()=>setActiveBlockIndex(i)} className="shadow-sm border border-slate-200">
                        {b.icon && <b.icon size={14} className="mr-1.5 opacity-70"/>}{b.tabLabel}
                    </TabButton>
                ))}
            </div>

            {showEditor ? (
                <Card className="overflow-hidden shadow-sm border border-slate-200 rounded-2xl bg-white">
                    <div className="overflow-x-auto max-h-[70vh] scrollbar-thin">
                        <table className="w-max border-collapse table-fixed">
                            <thead className="sticky top-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                                <tr className="bg-slate-50/90 backdrop-blur border-b border-slate-200">
                                    {/* Липкая колонка этажей */}
                                    <th className="p-3 text-left w-[120px] min-w-[120px] sticky left-0 z-40 bg-slate-50 border-r border-slate-200 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)]">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Этаж</span>
                                    </th>
                                    {entrancesList.map(e => (
                                        <th key={e} className="p-2 w-[180px] min-w-[180px] border-r border-slate-200/60 bg-slate-50/50">
                                            <div className="flex flex-col items-center">
                                                <span className="text-blue-600 mb-1.5 font-bold text-xs bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                                                    {isUndergroundParking ? `Вход ${e}` : `Подъезд ${e}`}
                                                </span>
                                                <div className="grid grid-cols-3 gap-0.5 w-full text-center">
                                                    <div className="flex flex-col items-center gap-0.5" title="Квартир"><Home size={10} className="text-slate-400"/><span className="text-[8px] font-bold text-slate-400 uppercase">Кв</span></div>
                                                    <div className="flex flex-col items-center gap-0.5" title="Нежилых"><Briefcase size={10} className="text-slate-400"/><span className="text-[8px] font-bold text-slate-400 uppercase">Оф</span></div>
                                                    <div className="flex flex-col items-center gap-0.5" title="МОП"><PaintBucket size={10} className="text-slate-400"/><span className="text-[8px] font-bold text-slate-400 uppercase">МОП</span></div>
                                                </div>
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

                                    // Зебра
                                    const rowBg = idx % 2 === 0 ? "bg-slate-50/30" : "bg-white";

                                    return (
                                        <tr key={f.id} className={`${rowBg} hover:bg-slate-50 transition-colors group h-11`}>
                                            
                                            {/* КОЛОНКА ЭТАЖА */}
                                            <td className="p-3 w-[120px] min-w-[120px] sticky left-0 z-20 bg-inherit border-r border-slate-200 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] relative group/cell">
                                                <div className="flex items-center justify-between h-full px-1">
                                                    <div className="flex items-center gap-2">
                                                        {canHaveApts && (
                                                            <input 
                                                                type="checkbox" 
                                                                title={duplexState.title + (duplexState.disabled ? " (недоступно)" : "")} 
                                                                checked={isDuplex || false} 
                                                                onChange={() => !duplexState.disabled && toggleDuplex(f.id)} 
                                                                disabled={duplexState.disabled} 
                                                                className={`rounded w-3.5 h-3.5 transition-all flex-shrink-0 border-slate-300 ${duplexState.disabled ? 'cursor-not-allowed opacity-30 bg-slate-100' : 'cursor-pointer text-purple-600 focus:ring-purple-500'}`}
                                                            />
                                                        )}
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

                                                {/* Меню действий */}
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

                                            {/* ЯЧЕЙКИ ПОДЪЕЗДОВ */}
                                            {entrancesList.map(e => (
                                                <td key={e} className={`p-0 w-[180px] min-w-[180px] border-r border-slate-100 h-11 relative group/cell ${isDuplex ? 'bg-purple-50/5' : ''}`}>
                                                    <div className="grid grid-cols-3 h-full divide-x divide-slate-100">
                                                        {['apts', 'units', 'mopQty'].map(field => {
                                                            const canEdit = field === 'apts' ? canHaveApts : field === 'units' ? canHaveUnits : true;
                                                            const val = getEntData(e, f.id, field);
                                                            
                                                            // Validation
                                                            const check = EntranceDataSchema.shape[field].safeParse(val);
                                                            const isInvalid = val !== '' && !check.success;

                                                            // Styling
                                                            let bgClass = "bg-transparent";
                                                            let textClass = "text-slate-800";
                                                            
                                                            if (!canEdit) {
                                                                bgClass = "bg-slate-50";
                                                                textClass = "text-slate-300 cursor-not-allowed";
                                                            } else if (isInvalid) {
                                                                bgClass = "bg-red-50";
                                                                textClass = "text-red-600";
                                                            } else if (val !== '' && val !== '0') {
                                                                textClass = "text-slate-900 font-bold"; 
                                                            } else {
                                                                textClass = "text-slate-400";
                                                            }

                                                            return (
                                                                <div key={field} className="relative w-full h-full">
                                                                    <DebouncedInput 
                                                                        // @ts-ignore
                                                                        ref={el => inputsRef.current[`${idx}-${e}-${field}`] = el}
                                                                        onKeyDown={(ev) => handleKeyDown(ev, idx, e, field)}
                                                                        type="number" 
                                                                        min="0"
                                                                        disabled={!canEdit} 
                                                                        className={`w-full h-full text-center text-xs outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-blue-200 transition-all ${bgClass} ${textClass}`} 
                                                                        value={val} 
                                                                        onChange={v => setEntData(e, f.id, field, v)} 
                                                                        placeholder={canEdit ? "-" : ""}
                                                                    />
                                                                    {isInvalid && (
                                                                        <div className="absolute top-0.5 right-0.5 pointer-events-none">
                                                                            <AlertCircle size={8} className="text-red-500"/>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    
                                                    {/* Кнопки копирования (ховер) */}
                                                    <div className="absolute top-0 right-0 h-full flex items-center pr-0.5 opacity-0 group-hover/cell:opacity-100 transition-opacity z-10 pointer-events-none">
                                                        <div className="flex flex-col gap-0.5 pointer-events-auto bg-white/90 backdrop-blur-sm shadow-sm border border-slate-200 rounded p-0.5">
                                                            {e > 1 && <button onClick={()=>copyEntranceFromLeft(f.id, e)} title="Скопировать слева" className="p-0.5 hover:text-blue-600 hover:bg-blue-50 rounded"><ChevronLeft size={10}/></button>}
                                                            <button onClick={()=>fillEntrancesRow(f.id, e)} title="Заполнить ряд вправо" className="p-0.5 hover:text-blue-600 hover:bg-blue-50 rounded"><ChevronsRight size={10}/></button>
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

            <SaveFloatingBar onSave={handleSave} />
        </div>
    );
}