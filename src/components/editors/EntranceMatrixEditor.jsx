import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ArrowDown, ArrowLeft, DoorOpen, ChevronLeft, ChevronsRight, Ban,
  MoreHorizontal, ChevronsDown,
  Home, Briefcase, PaintBucket, AlertCircle, Warehouse, Wand2
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, DebouncedInput, useReadOnly } from '../ui/UIKit';
import { getBlocksList } from '../../lib/utils';
import { useBuildingFloors } from '../../hooks/useBuildingFloors';
import { Validators } from '../../lib/validators';
import { EntranceDataSchema } from '../../lib/schemas';
import { useBuildingType } from '../../hooks/useBuildingType';
import ConfigHeader from './configurator/ConfigHeader';

// Кастомная кнопка таба в темном стиле
const DarkTabButton = ({ active, onClick, children, icon: Icon }) => (
    <button
        onClick={onClick}
        className={`
            px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2
            ${active 
                ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50 ring-1 ring-blue-400" 
                : "text-slate-400 hover:text-white hover:bg-slate-700"
            }
        `}
    >
        {Icon && <Icon size={14} className={active ? "text-blue-200" : "opacity-70"}/>}
        {children}
    </button>
);

export default function EntranceMatrixEditor({ buildingId, onBack }) {
    const { composition, buildingDetails, entrancesData, setEntrancesData, floorData, setFloorData } = useProject();
    const isReadOnly = useReadOnly();
    const [activeBlockIndex, setActiveBlockIndex] = useState(0);
    
    const [openMenuId, setOpenMenuId] = useState(null);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    
    const inputsRef = useRef({});
    const menuRef = useRef(null);

    const building = composition.find(c => c.id === buildingId);
    const typeInfo = useBuildingType(building);
    const { isUnderground, isParking, isInfrastructure } = typeInfo;

    const blocksList = useMemo(() => getBlocksList(building), [building]);
    const { floorList, currentBlock } = useBuildingFloors(buildingId, activeBlockIndex);

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
        const handleScroll = () => setOpenMenuId(null);

        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', handleScroll, true);
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, []);

    if (!building || !currentBlock) return <div className="p-12 text-center text-slate-500">Данные не найдены</div>;

    const isResidentialBlock = currentBlock.type === 'Ж';
    const showEditor = isResidentialBlock || isUnderground;

    const blockDetails = buildingDetails[`${building.id}_${currentBlock.id}`] || {};
    const entrancesCount = isUnderground 
        ? (blockDetails.inputs || 1) 
        : (blockDetails.entrances || 1);
        
    const entrancesList = Array.from({ length: entrancesCount }, (_, i) => i + 1);
    
    const setEntData = (entIdx, floorId, field, val) => {
        if (isReadOnly) return;
        let safeVal = val;
        if (val !== '' && val !== '-') {
            const num = parseFloat(val);
            if (!isNaN(num) && num < 0) {
                safeVal = Math.abs(num).toString();
            }
        }
        if (val === '-') safeVal = ''; 

        const key = `${currentBlock.fullId}_ent${entIdx}_${floorId}`;
        setEntrancesData(prev => {
            const existing = prev[key] || {};
            return { 
                ...prev, 
                [key]: { 
                    id: existing.id || crypto.randomUUID(), 
                    ...existing, 
                    [field]: safeVal,
                    buildingId: building.id,
                    blockId: currentBlock.id,
                    floorId: floorId,
                    entranceIndex: entIdx
                } 
            };
        });
    };

    const getEntData = (entIdx, floorId, field) => {
        const key = `${currentBlock.fullId}_ent${entIdx}_${floorId}`;
        return entrancesData[key]?.[field] || '';
    };

    const toggleDuplex = (floorId) => { 
        if (isReadOnly) return;
        const key = `${currentBlock.fullId}_${floorId}`; 
        const current = floorData[key]?.isDuplex; 
        setFloorData(p => ({...p, [key]: {...(p[key]||{}), isDuplex: !current}})); 
    };

    const isFieldEnabled = (floor, field) => {
        return Validators.checkFieldAvailability(floor, field, isUnderground);
    };

    const getCellError = (floor, floorIdx, ent, field, val) => {
        const check = EntranceDataSchema.shape[field].safeParse(val);
        if (val !== '' && !check.success) return true;

        const num = parseFloat(val);
        const isZeroOrEmpty = val === '' || num === 0;

        if (floor.isStylobate) return false;

        if (field === 'apts') {
            if (isZeroOrEmpty) {
                if (['basement', 'tsokol', 'attic'].includes(floor.type)) return false;
                if (floorIdx > 0) {
                     const prevFloor = floorList[floorIdx - 1];
                     const prevKey = `${currentBlock.fullId}_${prevFloor.id}`;
                     const isPrevDuplex = floorData[prevKey]?.isDuplex;
                     if (isPrevDuplex) return false;
                }
                if (floor.type === 'mixed') {
                    let hasAnyOffice = false;
                    for (const e of entrancesList) {
                         const uVal = getEntData(e, floor.id, 'units');
                         if (parseInt(uVal) > 0) {
                             hasAnyOffice = true;
                             break;
                         }
                    }
                    if (hasAnyOffice) return false;
                }
                return true; 
            }
        }

        if (field === 'units' && floor.type === 'mixed') {
            let totalUnitsOnFloor = 0;
            for (const e of entrancesList) {
                const uVal = getEntData(e, floor.id, 'units');
                totalUnitsOnFloor += (parseInt(uVal) || 0);
            }
            if (totalUnitsOnFloor === 0) return true; 
        }

        return false;
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
                if (inputsRef.current[targetKey]) inputsRef.current[targetKey].focus();
                return;
            }
        }
    };

    const handleMenuOpen = (e, floorId) => {
        if (isReadOnly) return;
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        setMenuPosition({ top: rect.bottom + 5, left: rect.left });
        setOpenMenuId(openMenuId === floorId ? null : floorId);
    };

    const fillColumnBelow = (ent, field) => {
        if (isReadOnly || floorList.length < 2) return;
        const sourceFloor = floorList[0];
        const sourceVal = getEntData(ent, sourceFloor.id, field);
        const updates = {};
        for (let i = 1; i < floorList.length; i++) {
            const targetFloor = floorList[i];
            if (isFieldEnabled(targetFloor, field)) {
                const key = `${currentBlock.fullId}_ent${ent}_${targetFloor.id}`;
                const currentData = entrancesData[key] || {};
                updates[key] = { 
                    id: currentData.id || crypto.randomUUID(), 
                    ...currentData, 
                    [field]: sourceVal,
                    buildingId: building.id,
                    blockId: currentBlock.id,
                    floorId: targetFloor.id,
                    entranceIndex: ent
                };
            }
        }
        if (Object.keys(updates).length > 0) {
            setEntrancesData(prev => ({ ...prev, ...updates }));
        }
    };

    const autoFill = () => { 
        if (isReadOnly) return;
        const updates = {}; 
        entrancesList.forEach(ent => floorList.forEach(f => { 
            let apts = 0;
            if (isResidentialBlock) {
                if (f.type === 'residential' || f.type === 'attic') apts = 4;
                if (f.type === 'mixed') apts = 3;
            }
            const key = `${currentBlock.fullId}_ent${ent}_${f.id}`;
            const existing = entrancesData[key] || {};
            updates[key] = { 
                id: existing.id || crypto.randomUUID(), 
                apts, 
                mopQty: 1, 
                units: (f.isComm) ? 1 : 0,
                buildingId: building.id,
                blockId: currentBlock.id,
                floorId: f.id,
                entranceIndex: ent
            }; 
        })); 
        setEntrancesData(p => ({...p, ...updates})); 
    };

    const copyFloorToNext = (idx) => { 
        if (isReadOnly || idx >= floorList.length - 1) return; 
        const currentFloor = floorList[idx]; 
        const nextFloor = floorList[idx + 1]; 
        const updates = {}; 
        entrancesList.forEach(ent => { 
            const srcKey = `${currentBlock.fullId}_ent${ent}_${currentFloor.id}`; 
            const tgtKey = `${currentBlock.fullId}_ent${ent}_${nextFloor.id}`; 
            const srcData = entrancesData[srcKey]; 
            const tgtExisting = entrancesData[tgtKey] || {};

            if(srcData) {
                const newData = { ...srcData };
                newData.id = tgtExisting.id || crypto.randomUUID();
                newData.floorId = nextFloor.id; 

                if (!isFieldEnabled(nextFloor, 'apts')) newData.apts = 0;
                if (!isFieldEnabled(nextFloor, 'units')) newData.units = 0;
                updates[tgtKey] = newData; 
            }
        }); 
        setEntrancesData(prev => ({ ...prev, ...updates })); 
        setOpenMenuId(null);
    };

    const fillFloorsAfter = (idx) => { 
        if (isReadOnly) return;
        const sourceFloor = floorList[idx]; 
        const updates = {}; 
        const sourceValues = {}; 
        entrancesList.forEach(ent => sourceValues[ent] = entrancesData[`${currentBlock.fullId}_ent${ent}_${sourceFloor.id}`]); 
        
        for(let i = idx + 1; i < floorList.length; i++) { 
            const targetFloor = floorList[i]; 
            entrancesList.forEach(ent => { 
                if(sourceValues[ent]) { 
                    const tgtKey = `${currentBlock.fullId}_ent${ent}_${targetFloor.id}`;
                    const tgtExisting = entrancesData[tgtKey] || {};
                    
                    const newData = { ...sourceValues[ent] };
                    newData.id = tgtExisting.id || crypto.randomUUID(); 
                    newData.floorId = targetFloor.id;

                    if (!isFieldEnabled(targetFloor, 'apts')) newData.apts = 0;
                    if (!isFieldEnabled(targetFloor, 'units')) newData.units = 0;
                    updates[tgtKey] = newData; 
                } 
            }); 
        } 
        setEntrancesData(prev => ({ ...prev, ...updates })); 
        setOpenMenuId(null);
    };

    const copyEntranceFromLeft = (floorId, entIdx) => { 
        if(isReadOnly || entIdx <= 1) return; 
        const tgtKey = `${currentBlock.fullId}_ent${entIdx}_${floorId}`; 
        const srcKey = `${currentBlock.fullId}_ent${entIdx-1}_${floorId}`; 
        const srcData = entrancesData[srcKey]; 
        const tgtExisting = entrancesData[tgtKey] || {};

        if(srcData) {
            setEntrancesData(p => ({
                ...p, 
                [tgtKey]: {
                    ...srcData, 
                    id: tgtExisting.id || crypto.randomUUID(),
                    entranceIndex: entIdx
                }
            })); 
        }
    };

    const fillEntrancesRow = (floorId, srcEntIdx) => { 
        if(isReadOnly) return;
        const srcKey = `${currentBlock.fullId}_ent${srcEntIdx}_${floorId}`; 
        const srcData = entrancesData[srcKey]; 
        if(!srcData) return; 
        const updates = {}; 
        entrancesList.forEach(ent => { 
            if(ent !== srcEntIdx) {
                const tgtKey = `${currentBlock.fullId}_ent${ent}_${floorId}`;
                const tgtExisting = entrancesData[tgtKey] || {};
                updates[tgtKey] = {
                    ...srcData, 
                    id: tgtExisting.id || crypto.randomUUID(), 
                    entranceIndex: ent
                };
            }
        }); 
        setEntrancesData(p => ({...p, ...updates})); 
    };

    const renderBadge = (type) => {
        const map = {
            residential: { color: 'bg-blue-50 text-blue-600 border-blue-100', label: 'Жилой' },
            mixed: { color: 'bg-violet-50 text-violet-600 border-violet-100', label: 'Смеш.' },
            technical: { color: 'bg-amber-50 text-amber-600 border-amber-100', label: 'Тех.' },
            basement: { color: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Подвал' },
            tsokol: { color: 'bg-purple-50 text-purple-600 border-purple-100', label: 'Цоколь' },
            attic: { color: 'bg-teal-50 text-teal-600 border-teal-100', label: 'Манс.' },
            loft: { color: 'bg-gray-100 text-gray-600 border-gray-200', label: 'Чердак' },
            roof: { color: 'bg-sky-50 text-sky-600 border-sky-100', label: 'Кровля' },
            parking_floor: { color: 'bg-indigo-50 text-indigo-600 border-indigo-100', label: 'Паркинг' },
            stylobate: { color: 'bg-orange-50 text-orange-700 border-orange-100', label: 'Нежилой блок' }
        };
        const style = map[type] || map.residential;
        return <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase border ${style.color}`}>{style.label}</span>
    }

    return (
        <div className="space-y-6 pb-24 w-full px-4 md:px-6 2xl:px-8 max-w-[2400px] mx-auto animate-in fade-in duration-500 relative">
            
            <ConfigHeader 
                building={building} 
                isParking={isParking} 
                isInfrastructure={isInfrastructure} 
                isUnderground={isUnderground} 
                onBack={onBack} 
                isSticky={false}
            />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                 <div className="flex items-center gap-1.5 p-1.5 bg-slate-800 rounded-xl w-max overflow-x-auto max-w-full shadow-inner border border-slate-700 custom-scrollbar">
                    {blocksList.map((b,i) => (
                        <DarkTabButton 
                            key={b.id} 
                            active={activeBlockIndex===i} 
                            onClick={()=>setActiveBlockIndex(i)} 
                            icon={b.icon}
                        >
                            {b.tabLabel}
                        </DarkTabButton>
                    ))}
                </div>

                <div className="flex items-center gap-3">
                     <button 
                        onClick={autoFill} 
                        disabled={isReadOnly || (!isResidentialBlock && !isParking)} 
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border shadow-sm ${isReadOnly || (!isResidentialBlock && !isParking) ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' : 'bg-white text-indigo-600 border-indigo-100 hover:bg-indigo-50 hover:border-indigo-200'}`}
                     >
                        <Wand2 size={16}/> Заполнить типовыми
                     </button>
                </div>
            </div>

            {openMenuId && !isReadOnly && (
                <div ref={menuRef} className="fixed z-[9999] w-48 bg-white rounded-xl shadow-2xl border border-slate-200 p-1 flex flex-col animate-in fade-in zoom-in-95 duration-200 origin-top-left" style={{ top: menuPosition.top, left: menuPosition.left }}>
                    <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">Действия</div>
                    {(() => {
                        const idx = floorList.findIndex(f => f.id === openMenuId);
                        return (
                            <>
                                <button onClick={() => copyFloorToNext(idx)} disabled={idx >= floorList.length - 1} className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg text-left transition-colors ${idx >= floorList.length - 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-50 hover:text-blue-600'}`}><ArrowDown size={14} className="text-slate-400"/> Скопировать вниз (1)</button>
                                <button onClick={() => fillFloorsAfter(idx)} disabled={idx >= floorList.length - 1} className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg text-left transition-colors ${idx >= floorList.length - 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-50 hover:text-blue-600'}`}><ChevronsDown size={14} className="text-slate-400"/> Заполнить все ниже</button>
                            </>
                        );
                    })()}
                </div>
            )}

            {showEditor ? (
                <Card className="overflow-hidden shadow-lg border border-slate-300 rounded-2xl bg-white">
                    <div className="overflow-x-auto max-h-[70vh] scrollbar-thin">
                        <table className="w-max border-collapse table-fixed">
                            <thead className="sticky top-0 z-30 shadow-md">
                                <tr className="bg-slate-100 border-b-2 border-slate-300">
                                    <th className="p-3 text-left w-[140px] min-w-[140px] sticky left-0 z-40 bg-slate-100 border-r border-slate-300 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider pl-1">Этаж</span>
                                    </th>
                                    {entrancesList.map(e => (
                                        <th key={e} className="p-2 w-[180px] min-w-[180px] border-r border-slate-300 bg-slate-100">
                                            <div className="flex flex-col items-center">
                                                <span className="text-blue-700 mb-2 font-bold text-xs bg-blue-50 px-3 py-1 rounded-md border border-blue-200 shadow-sm">{isUnderground ? `Вход ${e}` : `Подъезд ${e}`}</span>
                                                <div className="grid grid-cols-3 gap-0.5 w-full text-center">
                                                    
                                                    <div 
                                                        className={`group/col-header flex flex-col items-center gap-0.5 p-1 rounded-lg transition-colors relative ${isReadOnly ? 'cursor-default opacity-50' : 'cursor-pointer hover:bg-slate-200'}`}
                                                        onClick={() => !isReadOnly && fillColumnBelow(e, 'apts')}
                                                        title={isReadOnly ? "" : "Заполнить колонку вниз"}
                                                    >
                                                        <Home size={12} className="text-slate-500 group-hover/col-header:text-blue-600"/>
                                                        <span className="text-[9px] font-bold text-slate-500 group-hover/col-header:text-blue-700 uppercase">Кв</span>
                                                        {!isReadOnly && <ArrowDown size={10} className="absolute -bottom-1.5 text-blue-600 opacity-0 group-hover/col-header:opacity-100 transition-opacity bg-white rounded-full shadow-sm border border-slate-200" />}
                                                    </div>

                                                    <div 
                                                        className={`group/col-header flex flex-col items-center gap-0.5 p-1 rounded-lg transition-colors relative ${isReadOnly ? 'cursor-default opacity-50' : 'cursor-pointer hover:bg-slate-200'}`}
                                                        onClick={() => !isReadOnly && fillColumnBelow(e, 'units')}
                                                        title={isReadOnly ? "" : "Заполнить колонку вниз"}
                                                    >
                                                        <Briefcase size={12} className="text-slate-500 group-hover/col-header:text-blue-600"/>
                                                        <span className="text-[9px] font-bold text-slate-500 group-hover/col-header:text-blue-700 uppercase">Оф</span>
                                                        {!isReadOnly && <ArrowDown size={10} className="absolute -bottom-1.5 text-blue-600 opacity-0 group-hover/col-header:opacity-100 transition-opacity bg-white rounded-full shadow-sm border border-slate-200" />}
                                                    </div>

                                                    <div 
                                                        className={`group/col-header flex flex-col items-center gap-0.5 p-1 rounded-lg transition-colors relative ${isReadOnly ? 'cursor-default opacity-50' : 'cursor-pointer hover:bg-slate-200'}`}
                                                        onClick={() => !isReadOnly && fillColumnBelow(e, 'mopQty')}
                                                        title={isReadOnly ? "" : "Заполнить колонку вниз"}
                                                    >
                                                        <PaintBucket size={12} className="text-slate-500 group-hover/col-header:text-blue-600"/>
                                                        <span className="text-[9px] font-bold text-slate-500 group-hover/col-header:text-blue-700 uppercase">МОП</span>
                                                        {!isReadOnly && <ArrowDown size={10} className="absolute -bottom-1.5 text-blue-600 opacity-0 group-hover/col-header:opacity-100 transition-opacity bg-white rounded-full shadow-sm border border-slate-200" />}
                                                    </div>

                                                </div>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                                {floorList.map((f, idx) => {
                                    const isDuplex = floorData[`${currentBlock.fullId}_${f.id}`]?.isDuplex; 
                                    const canHaveApts = isFieldEnabled(f, 'apts');
                                    
                                    let hasApts = false;
                                    for (const e of entrancesList) {
                                        const val = getEntData(e, f.id, 'apts');
                                        if (val && parseInt(val) > 0) { hasApts = true; break; }
                                    }
                                    const duplexState = Validators.checkDuplexAvailability(f, floorList[idx + 1], hasApts);
                                    
                                    let isLowerFloorDuplex = false;
                                    if (idx > 0) {
                                        const prevFloor = floorList[idx - 1];
                                        const prevKey = `${currentBlock.fullId}_${prevFloor.id}`;
                                        isLowerFloorDuplex = floorData[prevKey]?.isDuplex;
                                    }
                                    
                                    const isDuplexDisabled = duplexState.disabled || isLowerFloorDuplex || isReadOnly;
                                    const rowBg = idx % 2 === 0 ? "bg-slate-50/50" : "bg-white";

                                    return (
                                        <tr key={f.id} className={`${rowBg} hover:bg-blue-50/30 transition-colors group h-14`}>
                                            <td className="p-3 w-[140px] min-w-[140px] sticky left-0 z-20 bg-inherit border-r border-slate-300 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] relative group/cell">
                                                <div className="flex flex-col gap-1.5">
                                                    {f.isStylobate && (
                                                        <div className="flex items-center gap-1 text-[9px] text-orange-700 font-bold bg-orange-50 border border-orange-100 px-1.5 rounded-sm w-fit mb-0.5" title="Этаж относится к нежилому блоку под домом">
                                                            <Warehouse size={8} /> {f.stylobateLabel}
                                                        </div>
                                                    )}
                                                    
                                                    <div className="flex items-center justify-between h-full px-1">
                                                        <div className="flex items-center gap-2">
                                                            {canHaveApts && !f.isStylobate && (
                                                                <input 
                                                                    type="checkbox" 
                                                                    title={isDuplexDisabled ? (isLowerFloorDuplex ? "Нижний этаж уже дуплекс" : duplexState.title) : "Сделать дуплексом"}
                                                                    checked={isDuplex || false} 
                                                                    onChange={() => !isDuplexDisabled && toggleDuplex(f.id)} 
                                                                    disabled={isDuplexDisabled} 
                                                                    className={`rounded w-4 h-4 transition-all flex-shrink-0 border-slate-300 ${isDuplexDisabled ? 'cursor-not-allowed opacity-30 bg-slate-100' : 'cursor-pointer text-purple-600 focus:ring-purple-500 hover:border-purple-400'}`}
                                                                />
                                                            )}
                                                            <span className="text-sm font-bold text-slate-800">{f.label}</span>
                                                        </div>
                                                        {renderBadge(f.type)}
                                                    </div>
                                                </div>
                                                
                                                {!isReadOnly && (
                                                    <div className={`absolute right-1 top-1/2 -translate-y-1/2 transition-opacity z-30 ${openMenuId === f.id ? 'opacity-100' : 'opacity-0 group-hover/cell:opacity-100'}`}>
                                                        <button onClick={(e) => handleMenuOpen(e, f.id)} className={`p-1.5 rounded-lg shadow-sm border border-slate-200 hover:text-blue-600 transition-colors ${openMenuId === f.id ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white/90 text-slate-400'}`}><MoreHorizontal size={14}/></button>
                                                    </div>
                                                )}
                                            </td>

                                            {entrancesList.map(e => (
                                                <td key={e} className={`p-2 w-[180px] min-w-[180px] border-r border-slate-200 relative group/cell align-middle ${isDuplex ? 'bg-purple-50/10' : ''}`}>
                                                    <div className="grid grid-cols-3 gap-2 h-full">
                                                        {['apts', 'units', 'mopQty'].map(field => {
                                                            const canEdit = isFieldEnabled(f, field) && !isReadOnly;
                                                            const val = getEntData(e, f.id, field);
                                                            const isInvalid = getCellError(f, idx, e, field, val);

                                                            let bgClass = "bg-white";
                                                            let textClass = "text-slate-700";
                                                            let borderClass = "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
                                                            
                                                            if (!isFieldEnabled(f, field)) { 
                                                                bgClass = "bg-slate-50";
                                                                textClass = "text-slate-300 cursor-not-allowed";
                                                                borderClass = "border-transparent";
                                                            } else if (isInvalid) {
                                                                bgClass = "bg-red-50";
                                                                textClass = "text-red-600 font-bold";
                                                                borderClass = "border-red-300 focus:border-red-500 focus:ring-red-100";
                                                            } else if (val !== '' && val !== '0') {
                                                                textClass = "text-slate-900 font-bold"; 
                                                            } else {
                                                                textClass = "text-slate-400";
                                                            }
                                                            
                                                            if (isReadOnly && isFieldEnabled(f, field)) {
                                                                bgClass = "bg-transparent";
                                                                borderClass = "border-transparent";
                                                                textClass = val ? "text-slate-800 font-bold" : "text-slate-300";
                                                            }

                                                            return (
                                                                <div key={field} className="relative w-full h-9">
                                                                    <DebouncedInput 
                                                                        ref={el => inputsRef.current[`${idx}-${e}-${field}`] = el}
                                                                        onKeyDown={(ev) => handleKeyDown(ev, idx, e, field)}
                                                                        type="number" 
                                                                        min="0"
                                                                        disabled={!canEdit} 
                                                                        className={`w-full h-full text-center text-xs rounded-lg outline-none transition-all border ${bgClass} ${borderClass} ${textClass} ${isReadOnly ? 'cursor-default' : ''}`} 
                                                                        value={val} 
                                                                        onChange={v => setEntData(e, f.id, field, v)} 
                                                                        placeholder={canEdit ? "-" : ""}
                                                                    />
                                                                    {isInvalid && (<div className="absolute top-0.5 right-0.5 pointer-events-none"><AlertCircle size={8} className="text-red-500"/></div>)}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    {!isReadOnly && (
                                                        <div className="absolute top-1/2 -translate-y-1/2 right-0 pr-1 opacity-0 group-hover/cell:opacity-100 transition-opacity z-10 pointer-events-none">
                                                            <div className="flex flex-col gap-1 pointer-events-auto bg-white/95 backdrop-blur-sm shadow-md border border-slate-200 rounded-md p-0.5">
                                                                {e > 1 && <button onClick={()=>copyEntranceFromLeft(f.id, e)} title="Скопировать слева" className="p-1 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><ChevronLeft size={10}/></button>}
                                                                <button onClick={()=>fillEntrancesRow(f.id, e)} title="Заполнить ряд вправо" className="p-1 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><ChevronsRight size={10}/></button>
                                                            </div>
                                                        </div>
                                                    )}
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
                <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4 animate-in fade-in bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 border border-slate-200"><DoorOpen size={40} /><div className="absolute"><Ban size={20} className="text-slate-400 translate-x-4 translate-y-4"/></div></div>
                    <h3 className="text-xl font-bold text-slate-700">Настройка подъездов недоступна</h3>
                    <p className="text-slate-500 max-w-md">Матрица подъездов и квартир заполняется только для жилых блоков и подземных паркингов.<br/>Для нежилых блоков и инфраструктуры это не требуется.</p>
                </div>
            )}
        </div>
    );
}