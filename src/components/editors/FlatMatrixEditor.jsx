import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ArrowLeft, Wand2, AlertTriangle, CheckCircle2, 
  MousePointer2, CheckSquare, Square, X, Layers, AlertCircle
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, DebouncedInput, Button, useReadOnly } from '../ui/UIKit';
import { getBlocksList } from '../../lib/utils';
import { useBuildingFloors } from '../../hooks/useBuildingFloors';
import { UnitSchema } from '../../lib/schemas';
import { useBuildingType } from '../../hooks/useBuildingType';
import ConfigHeader from './configurator/ConfigHeader';

const TYPE_COLORS = {
    flat: 'bg-white border-slate-200 hover:border-blue-300 shadow-sm',
    office: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    pantry: 'bg-slate-50 border-slate-200 text-slate-500',
    duplex_up: 'bg-purple-50 border-purple-200 text-purple-700',
    duplex_down: 'bg-orange-50 border-orange-200 text-orange-700'
};

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

export default function FlatMatrixEditor({ buildingId, onBack }) {
    const { 
        composition = [], 
        buildingDetails = {}, 
        entrancesData = {}, 
        flatMatrix = {}, 
        setFlatMatrix, 
        floorData = {}, 
    } = useProject();
    
    const isReadOnly = useReadOnly();
    const [activeBlockIndex, setActiveBlockIndex] = useState(0);
    const [startNum, setStartNum] = useState(1);
    
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const inputsRef = useRef({});

    const building = composition?.find(c => c.id === buildingId);
    
    const typeInfo = useBuildingType(building);
    const { isParking, isInfrastructure, isUnderground } = typeInfo;

    const blocksList = useMemo(() => getBlocksList(building), [building]);
    
    const { floorList: rawFloorList, currentBlock } = useBuildingFloors(buildingId, activeBlockIndex);

    useEffect(() => {
        setSelectedIds(new Set());
        inputsRef.current = {};
    }, [activeBlockIndex]);

    const blockKey = (building && currentBlock) ? `${building.id}_${currentBlock.id}` : null;
    const blockDetails = blockKey ? (buildingDetails[blockKey] || {}) : {};
    
    const entrances = useMemo(() => 
        Array.from({ length: blockDetails.entrances || 1 }, (_, i) => i + 1),
    [blockDetails.entrances]);

    const floorList = useMemo(() => {
        if (!rawFloorList) return [];
        return rawFloorList.filter(f => {
            return entrances.some(e => {
                const key = `${currentBlock.fullId}_ent${e}_${f.id}`;
                const aptsCount = Number(entrancesData[key]?.apts || 0);
                return aptsCount > 0;
            });
        });
    }, [rawFloorList, entrances, entrancesData, currentBlock]);

    // --- ЖЕСТКИЙ РАСЧЕТ ШИРИНЫ ---
    const colWidths = useMemo(() => {
        const widths = {};
        entrances.forEach(e => {
            let maxCount = 0;
            floorList.forEach(f => {
                const key = `${currentBlock.fullId}_ent${e}_${f.id}`;
                const count = parseInt(entrancesData[key]?.apts || 0);
                if (count > maxCount) maxCount = count;
            });

            // Константы размеров (должны совпадать с CSS)
            const CELL_WIDTH = 68; // w-[68px]
            const GAP = 8;         // gap-2 (0.5rem = 8px)
            const PADDING = 24;    // p-3 (12px * 2)
            
            // Если квартир нет, ставим минимальную ширину заголовка
            if (maxCount === 0) {
                widths[e] = 100;
            } else {
                // Точная формула: (Кол-во * ширина) + (Промежутки) + Паддинги
                const contentWidth = (maxCount * CELL_WIDTH) + ((maxCount - 1) * GAP);
                widths[e] = contentWidth + PADDING + 2; // +2px на границы для надежности
            }
        });
        return widths;
    }, [entrances, floorList, entrancesData, currentBlock]);

    const duplicateSet = useMemo(() => {
        const counts = {};
        const dups = new Set();
        if (currentBlock) {
            Object.keys(flatMatrix).forEach(k => {
                if (k.startsWith(currentBlock.fullId)) {
                    const num = String(flatMatrix[k]?.num || '').trim();
                    if (num !== '') {
                        counts[num] = (counts[num] || 0) + 1;
                    }
                }
            });
        }
        Object.entries(counts).forEach(([num, count]) => {
            if (count > 1) dups.add(num);
        });
        return dups;
    }, [flatMatrix, currentBlock]);

    const getApt = (ent, floorId, idx) => {
        if (!currentBlock) return { num: '', type: 'flat' };
        const key = `${currentBlock.fullId}_e${ent}_f${floorId}_i${idx}`;
        const unit = flatMatrix[key] || { num: '', type: 'flat' };
        return unit;
    };

    const updateApt = (ent, floorId, idx, field, val) => {
        if (isReadOnly) return;
        if (!currentBlock) return;
        const key = `${currentBlock.fullId}_e${ent}_f${floorId}_i${idx}`;
        const existing = flatMatrix[key] || { type: 'flat' };
        
        setFlatMatrix(prev => ({
            ...prev,
            [key]: { 
                id: existing.id || crypto.randomUUID(),
                ...existing, 
                [field]: val,
                buildingId: building.id,
                blockId: currentBlock.id,
                entranceIndex: ent,
                floorId: floorId
            }
        }));
    };

    const handleKeyDown = (e, fIdx, ent, idx) => {
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        e.preventDefault();

        let nextFIdx = fIdx;
        let nextEnt = ent;
        let nextIdx = idx;

        if (e.key === 'ArrowUp') nextFIdx = Math.max(0, fIdx - 1);
        if (e.key === 'ArrowDown') nextFIdx = Math.min(floorList.length - 1, fIdx + 1);

        if (e.key === 'ArrowLeft') {
            if (nextIdx > 0) {
                nextIdx--;
            } else {
                if (nextEnt > 1) {
                    nextEnt--;
                    const prevCount = Number(entrancesData[`${currentBlock.fullId}_ent${nextEnt}_${floorList[nextFIdx].id}`]?.apts || 0);
                    nextIdx = Math.max(0, prevCount - 1);
                }
            }
        }
        if (e.key === 'ArrowRight') {
            const currentCount = Number(entrancesData[`${currentBlock.fullId}_ent${nextEnt}_${floorList[nextFIdx].id}`]?.apts || 0);
            if (nextIdx < currentCount - 1) {
                nextIdx++;
            } else {
                if (nextEnt < entrances.length) {
                    nextEnt++;
                    nextIdx = 0;
                }
            }
        }

        const nextFloorId = floorList[nextFIdx].id;
        const refKey = `${nextEnt}-${nextFloorId}-${nextIdx}`;
        if (inputsRef.current[refKey]) {
            inputsRef.current[refKey].focus();
        }
    };

    const toggleSelection = (key) => {
        if (isReadOnly) return;
        const newSet = new Set(selectedIds);
        if (newSet.has(key)) newSet.delete(key);
        else newSet.add(key);
        setSelectedIds(newSet);
    };

    const applyBulkType = (type) => {
        if (isReadOnly) return;
        const updates = {};
        selectedIds.forEach(key => {
            const existing = flatMatrix[key] || {};
            updates[key] = { 
                id: existing.id || crypto.randomUUID(),
                ...existing, 
                type 
            };
        });
        setFlatMatrix(prev => ({ ...prev, ...updates }));
        setSelectedIds(new Set());
        setIsSelectionMode(false);
    };

    const isFloorDuplexValid = (floorId) => {
        if (!currentBlock) return true;
        const isDuplexFloor = floorData[`${currentBlock.fullId}_${floorId}`]?.isDuplex;
        if (!isDuplexFloor) return true;
        return entrances.some(e => {
            const count = parseInt(entrancesData[`${currentBlock.fullId}_ent${e}_${floorId}`]?.apts || 0);
            for(let i=0; i<count; i++) {
                if (getApt(e, floorId, i).type !== 'flat') return true;
            }
            return false;
        });
    };

    const autoNumber = () => {
        if (isReadOnly) return;
        if (!currentBlock) return;
        let n = startNum;
        const updates = {};
        
        entrances.forEach(e => {
            floorList.forEach(f => {
                const count = parseInt(entrancesData[`${currentBlock.fullId}_ent${e}_${f.id}`]?.apts || 0);
                for(let i=0; i<count; i++) {
                    const key = `${currentBlock.fullId}_e${e}_f${f.id}_i${i}`;
                    const existing = (flatMatrix[key] || {});
                    
                    if (existing.type === 'office' || existing.type === 'pantry') continue;
                    
                    updates[key] = { 
                        id: existing.id || crypto.randomUUID(),
                        ...existing, 
                        num: String(n++), 
                        type: existing.type || 'flat',
                        buildingId: building.id,
                        blockId: currentBlock.id,
                        entranceIndex: e,
                        floorId: f.id
                    };
                }
            });
        });
        setFlatMatrix(p => ({...p, ...updates})); 
    };

    if (!building || !currentBlock) return <div className="p-12 text-center text-slate-500">Загрузка данных...</div>;

    const hasBasement = rawFloorList?.some(f => f.type === 'basement');

    return (
        <div className="space-y-6 pb-24 w-full px-4 md:px-6 2xl:px-8 max-w-[2400px] mx-auto animate-in fade-in duration-500 relative">
            
            {/* Header */}
            <ConfigHeader 
                building={building} 
                isParking={isParking} 
                isInfrastructure={isInfrastructure} 
                isUnderground={isUnderground} 
                onBack={onBack} 
                isSticky={false}
            />

            {/* Toolbar (Tabs + Actions) */}
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

                <div className="flex gap-3">
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Старт №:</span>
                        <input disabled={isReadOnly} type="number" className={`w-12 bg-transparent font-bold text-sm text-slate-700 outline-none text-center ${isReadOnly ? 'opacity-50' : ''}`} value={startNum} onChange={e=>setStartNum(parseInt(e.target.value)||1)} />
                    </div>
                    
                    <button disabled={isReadOnly} onClick={autoNumber} className={`px-4 py-2 bg-purple-50 text-purple-600 border-purple-100 border rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shadow-sm ${isReadOnly ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-100'}`}>
                        <Wand2 size={14}/> Авто-нум.
                    </button>
                    
                    <button 
                        disabled={isReadOnly}
                        onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds(new Set()); }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border shadow-sm ${isSelectionMode ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'} ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {isSelectionMode ? <CheckSquare size={14}/> : <MousePointer2 size={14}/>}
                        {isSelectionMode ? 'Режим выделения' : 'Выделение'}
                    </button>
                </div>
            </div>

            {/* Selection Toolbar */}
            {selectedIds.size > 0 && !isReadOnly && (
                <div className="sticky top-4 z-50 mb-4 mx-auto max-w-xl animate-in slide-in-from-top-4 fade-in duration-300">
                    <div className="bg-slate-900/95 backdrop-blur text-white p-2.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 ring-1 ring-white/10">
                        <div className="bg-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-2 shadow-sm">
                            <CheckCircle2 size={14} className="text-white/80"/>
                            {selectedIds.size}
                        </div>
                        <div className="h-6 w-px bg-white/10"></div>
                        <div className="flex gap-1">
                            <button onClick={() => applyBulkType('duplex_up')} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-xs font-bold transition-colors">Дуплекс</button>
                            <button onClick={() => applyBulkType('office')} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold transition-colors">Офис</button>
                            <button onClick={() => applyBulkType('flat')} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-bold transition-colors">Квартира</button>
                        </div>
                        <button onClick={() => setSelectedIds(new Set())} className="ml-auto p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"><X size={16}/></button>
                    </div>
                </div>
            )}

            {/* Matrix Table */}
            {/* ДОБАВЛЕНО: max-w-full для ограничения ширины контейнера */}
            <Card className="shadow-lg border-0 ring-1 ring-slate-200 rounded-xl overflow-hidden flex flex-col h-full bg-white max-w-full">
                {/* ДОБАВЛЕНО: w-full и max-w-full для скролл-контейнера */}
                <div className="flex-1 overflow-x-auto overflow-y-auto w-full max-w-full relative" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                    <table className="border-collapse bg-white w-max">
                        <thead className="sticky top-0 z-30 shadow-md">
                            <tr className="bg-slate-100 border-b-2 border-slate-300">
                                {/* Floor Header */}
                                <th className="p-3 sticky left-0 z-40 bg-slate-100 border-r-2 border-slate-300 w-20 min-w-[80px] text-center shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] text-xs font-black text-slate-600 uppercase tracking-wider">
                                    Этаж
                                </th>
                                {/* Entrance Headers */}
                                {entrances.map(e => (
                                    <th 
                                        key={e} 
                                        className="p-3 border-r-2 border-slate-300/50 bg-slate-50 text-center"
                                        style={{ width: colWidths[e], minWidth: colWidths[e] }}
                                    >
                                        <div className="flex flex-col gap-1 items-center">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Подъезд</span>
                                            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-sm font-black text-slate-700 shadow-sm">
                                                {e}
                                            </div>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {floorList.slice().map(f => {
                                const isDuplexFloor = floorData[`${currentBlock.fullId}_${f.id}`]?.isDuplex;
                                const isValid = isFloorDuplexValid(f.id);

                                return (
                                    <tr key={f.id} className={`${isDuplexFloor ? 'bg-purple-50/10' : 'bg-white'} hover:bg-slate-50 transition-colors h-auto`}>
                                        
                                        {/* Floor Column (Sticky) */}
                                        <td className={`p-3 font-bold text-sm sticky left-0 border-r-2 border-slate-300 text-center z-20 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] ${!isValid ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-700'}`}>
                                            <div className="flex flex-col items-center justify-center h-full">
                                                {f.label}
                                                {isDuplexFloor && (
                                                    <div title={!isValid ? "На дуплексном этаже должна быть хоть одна дуплексная квартира" : "Дуплексный этаж"} className="mt-1">
                                                        {!isValid ? <AlertTriangle size={14} className="text-red-500" /> : <Layers size={14} className="text-purple-500" />}
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        {/* Entrance Columns */}
                                        {entrances.map(e => {
                                            const count = parseInt(entrancesData[`${currentBlock.fullId}_ent${e}_${f.id}`]?.apts || 0);
                                            const isEvenCol = e % 2 === 0;
                                            const bgColor = isEvenCol ? 'bg-slate-50/50' : 'bg-white';
                                            
                                            // Empty cell for entrances without apartments on this floor
                                            if (count === 0) return <td key={e} className={`p-3 border-r-2 border-slate-300/50 ${bgColor}`} style={{ width: colWidths[e], minWidth: colWidths[e] }}></td>;
                                            
                                            return (
                                                <td key={e} className={`p-3 border-r-2 border-slate-300/50 align-top ${bgColor}`} style={{ width: colWidths[e], minWidth: colWidths[e] }}>
                                                    <div className="flex flex-wrap gap-2 content-start">
                                                        {Array.from({length: count}).map((_, i) => {
                                                            const a = getApt(e, f.id, i);
                                                            const cellKey = `${currentBlock.fullId}_e${e}_f${f.id}_i${i}`;
                                                            const isSelected = selectedIds.has(cellKey);
                                                            const isDuplicate = duplicateSet.has(a.num);
                                                            const isMissingNum = !a.num || String(a.num).trim() === '';
                                                            
                                                            const result = UnitSchema.safeParse(a);
                                                            const isInvalidSchema = !result.success && !isMissingNum;

                                                            let borderColorClass = '';
                                                            if (isSelected) borderColorClass = 'border-blue-500 ring-2 ring-blue-200 bg-blue-50';
                                                            else if (isDuplicate) borderColorClass = 'border-red-500 bg-red-50 shadow-red-100';
                                                            else if (isMissingNum) borderColorClass = 'border-amber-400 bg-amber-50 shadow-amber-100 border-dashed';
                                                            else if (isInvalidSchema) borderColorClass = 'border-red-300 border-dashed bg-red-50/30';
                                                            else borderColorClass = TYPE_COLORS[a.type] || TYPE_COLORS.flat;

                                                            return (
                                                                <div 
                                                                    key={i} 
                                                                    onClick={() => isSelectionMode && !isReadOnly && toggleSelection(cellKey)}
                                                                    className={`
                                                                        flex flex-col gap-1 p-1.5 border-2 rounded-lg w-[68px] text-center transition-all shadow-sm relative group
                                                                        ${borderColorClass}
                                                                        ${isSelectionMode && !isReadOnly ? 'cursor-pointer hover:border-blue-400' : ''}
                                                                    `}
                                                                >
                                                                    {/* Type Indicator */}
                                                                    <div className={`h-1.5 w-full rounded-full ${a.type === 'office' ? 'bg-emerald-400' : a.type.includes('duplex') ? 'bg-purple-400' : 'bg-slate-200'}`}></div>
                                                                    
                                                                    {isSelectionMode ? (
                                                                        <div className={`font-black text-sm py-1 ${isDuplicate ? 'text-red-600' : 'text-slate-700'}`}>
                                                                            {a.num || '-'}
                                                                        </div>
                                                                    ) : (
                                                                        <DebouncedInput 
                                                                            ref={el => inputsRef.current[`${e}-${f.id}-${i}`] = el}
                                                                            onKeyDown={(ev) => handleKeyDown(ev, floorList.indexOf(f), e, i)}
                                                                            type="text" 
                                                                            className={`w-full text-center font-black text-sm outline-none bg-transparent ${isDuplicate ? 'text-red-600' : isMissingNum ? 'placeholder:text-amber-400' : 'text-slate-700'} ${isReadOnly ? 'cursor-default' : ''}`} 
                                                                            value={a.num} 
                                                                            onChange={val=>updateApt(e,f.id,i,'num',val)} 
                                                                            placeholder="№"
                                                                            disabled={isReadOnly}
                                                                        />
                                                                    )}

                                                                    {(isDuplicate) && <div className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 z-20 shadow-sm ring-1 ring-white"><AlertCircle size={10}/></div>}
                                                                    {(isMissingNum && !isSelectionMode) && <div className="absolute -top-1.5 -right-1.5 bg-amber-400 text-white rounded-full p-0.5 z-20 shadow-sm ring-1 ring-white"><AlertCircle size={10}/></div>}
                                                                    
                                                                    {isDuplexFloor && !isSelectionMode && (
                                                                        <select 
                                                                            disabled={isReadOnly}
                                                                            className={`w-full text-[9px] bg-transparent outline-none font-bold text-center appearance-none border-t border-black/5 mt-0.5 pt-0.5 text-slate-500 uppercase tracking-tight ${isReadOnly ? 'cursor-default' : 'cursor-pointer hover:text-blue-600'}`} 
                                                                            value={a.type} 
                                                                            onChange={ev=>updateApt(e,f.id,i,'type',ev.target.value)}
                                                                        >
                                                                            <option value="flat">Кв.</option>
                                                                            <option value="duplex_up">Верх</option>
                                                                            {(f.label === '1' && hasBasement) && <option value="duplex_down">Низ</option>}
                                                                        </select>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}