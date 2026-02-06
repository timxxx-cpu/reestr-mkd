import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ArrowDown, DoorOpen, Ban, MoreHorizontal, ChevronLeft, ChevronsRight, AlertCircle, Wand2,
  Building2, Car, Box, Store, LayoutGrid, X // [FIX] Добавлен X (на всякий случай)
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useDirectBuildings } from '../../hooks/api/useDirectBuildings';
import { useDirectFloors } from '../../hooks/api/useDirectFloors';
import { useDirectMatrix } from '../../hooks/api/useDirectMatrix';
import { useBuildingType } from '../../hooks/useBuildingType';
import { Card, DebouncedInput, useReadOnly } from '../ui/UIKit';
import { Validators } from '../../lib/validators';
import { ApiService } from '../../lib/api-service';
import ConfigHeader from './configurator/ConfigHeader';
import { formatBlockSwitcherLabel } from '../../lib/building-details';

const getBlockIcon = (type) => {
    if (type === 'residential') return Building2;
    if (type === 'parking') return Car;
    if (type === 'infrastructure') return Box;
    if (type === 'non_residential') return Store;
    return LayoutGrid;
};


const isLinkedStylobateFloor = (floor) => {
    if (!floor) return false;

    const explicitStylobate =
        !!floor.isStylobate ||
        !!floor.flags?.isStylobate ||
        floor.type === 'stylobate' ||
        floor.floorKey === 'stylobate' ||
        String(floor.floorKey || '').includes('stylobate');

    if (explicitStylobate) return true;

    // Fallback: у части старых/перенесенных данных стилобатные этажи
    // приходят без явного флага. Для связанного нежилого блока берем
    // надземные этажи, исключая подвал/кровлю/чердак/мансарду.
    const isExcluded =
        !!floor.flags?.isBasement ||
        !!floor.flags?.isRoof ||
        !!floor.flags?.isLoft ||
        !!floor.flags?.isAttic ||
        ['basement', 'roof', 'loft', 'attic', 'parking_floor'].includes(floor.type);

    return !isExcluded && (Number(floor.index) || 0) > 0;
};

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
    const { projectId, buildingDetails } = useProject();
    const isReadOnly = useReadOnly();

    // 1. Здание и жилые блоки
    const { buildings } = useDirectBuildings(projectId);
    const building = useMemo(() => buildings.find(b => b.id === buildingId), [buildings, buildingId]);

    const residentialBlocks = useMemo(() => {
        if (!building?.blocks?.length) return [];
        return building.blocks.filter((b) => b.type === 'residential');
    }, [building]);

    const [activeBlockIndex, setActiveBlockIndex] = useState(0);
    const currentBlock = useMemo(() => residentialBlocks[activeBlockIndex], [residentialBlocks, activeBlockIndex]);

    useEffect(() => {
        if (activeBlockIndex < residentialBlocks.length) return;
        setActiveBlockIndex(0);
    }, [activeBlockIndex, residentialBlocks.length]);

    // 2. Тип (шаг только для жилых блоков)
    const typeInfo = useBuildingType(building);
    const { isParking } = typeInfo;
    const isUnderground = false;

    // 3. Данные (Этажи + Матрица)
    const { floors: rawFloors, updateFloor } = useDirectFloors(currentBlock?.id);
    const [linkedStylobateFloors, setLinkedStylobateFloors] = useState([]);

    useEffect(() => {
        let cancelled = false;

        const loadLinkedStylobateFloors = async () => {
            if (!building?.blocks?.length || !currentBlock?.id) {
                if (!cancelled) setLinkedStylobateFloors([]);
                return;
            }

            const linkedStylobateBlocks = building.blocks.filter((block) => {
                if (block.type !== 'non_residential') return false;
                const detailsKey = `${building.id}_${block.id}`;
                const details = buildingDetails?.[detailsKey] || {};
                return Array.isArray(details.parentBlocks) && details.parentBlocks.includes(currentBlock.id);
            });

            if (linkedStylobateBlocks.length === 0) {
                if (!cancelled) setLinkedStylobateFloors([]);
                return;
            }

            try {
                const floorsByBlock = await Promise.all(linkedStylobateBlocks.map((block) => ApiService.getFloors(block.id)));
                const stylobateFloors = floorsByBlock
                    .flat()
                    .filter((floor) => isLinkedStylobateFloor(floor));

                if (!cancelled) setLinkedStylobateFloors(stylobateFloors);
            } catch (e) {
                console.error('Failed to load linked stylobate floors', e);
                if (!cancelled) setLinkedStylobateFloors([]);
            }
        };

        loadLinkedStylobateFloors();

        return () => {
            cancelled = true;
        };
    }, [building, buildingDetails, currentBlock]);

    const floors = useMemo(() => {
        const residentialFloors = rawFloors.filter((f) => !(f.isStylobate || f.flags?.isStylobate));
        const map = new Map();

        [...residentialFloors, ...linkedStylobateFloors].forEach((floor) => {
            if (!floor?.id) return;
            map.set(floor.id, floor);
        });

        return Array.from(map.values()).sort((a, b) => (Number(a.index) || 0) - (Number(b.index) || 0));
    }, [rawFloors, linkedStylobateFloors]);

    const { entrances, matrixMap, updateCell, syncEntrances } = useDirectMatrix(currentBlock?.id);

    // Локальный стейт UI
    const [_openMenuId, setOpenMenuId] = useState(null);
    const [_menuPosition, _setMenuPosition] = useState({ top: 0, left: 0 });
    const _inputsRef = useRef({});
    const menuRef = useRef(null);

    // Авто-создание подъездов, если их нет в БД, но они есть в конфиге (если нужно)
    // В идеале это делается в Configurator, но здесь можно подстраховать
    useEffect(() => {
        if (!currentBlock || isReadOnly) return;
        const targetCount = parseInt(currentBlock.entrances || currentBlock.inputs || 0, 10);
        if (entrances.length === 0 && Number.isFinite(targetCount) && targetCount > 0) {
            syncEntrances(targetCount).catch((e) => console.error('Sync entrances failed', e));
        }
    }, [entrances.length, currentBlock, isReadOnly, syncEntrances]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // --- Helpers ---
    
    const getCellValue = (floorId, entNum, field) => {
        const key = `${floorId}_${entNum}`;
        return matrixMap[key]?.[field] || '';
    };

    const handleCellChange = (floorId, entNum, field, val) => {
        updateCell({ floorId, entranceNumber: entNum, values: { [field]: val } });
    };

    const isFieldEnabled = (floor, field) => {
        return Validators.checkFieldAvailability(floor, field, isUnderground);
    };

    const toggleDuplex = (floorId, currentVal) => {
        if (isReadOnly) return;
        updateFloor({ id: floorId, updates: { isDuplex: !currentVal } });
    };

    // --- Bulk Actions ---

    const autoFill = async () => {
        if (isReadOnly) return;
        if (!confirm("Заполнить матрицу типовыми значениями (4 кв. на этаж)?")) return;
        
        const promises = [];
        floors.forEach(f => {
            entrances.forEach(e => {
                let apts = 0;
                if (['residential', 'attic'].includes(f.type)) apts = 4;
                if (f.type === 'mixed') apts = 3;
                
                // Пишем только если есть что писать
                if (apts > 0 || f.isCommercial) {
                     promises.push(updateCell({
                        floorId: f.id,
                        entranceNumber: e.number,
                        values: {
                            apts,
                            mopQty: 1,
                            units: f.isCommercial ? 1 : 0
                        }
                    }));
                }
            });
        });
        await Promise.all(promises);
    };

    const fillColumnBelow = async (entNum, field) => {
        if (isReadOnly || floors.length < 2) return;
        const sourceVal = getCellValue(floors[0].id, entNum, field);
        const promises = [];
        for (let i = 1; i < floors.length; i++) {
            const f = floors[i];
            if (isFieldEnabled(f, field)) {
                promises.push(updateCell({
                    floorId: f.id,
                    entranceNumber: entNum,
                    values: { [field]: sourceVal }
                }));
            }
        }
        await Promise.all(promises);
    };
    
    const fillEntrancesRow = async (floorId, srcEntNum) => {
        if (isReadOnly) return;
        // Получаем полные данные исходной ячейки
        const srcData = matrixMap[`${floorId}_${srcEntNum}`] || {};
        const promises = [];
        
        entrances.forEach(e => {
            if (e.number !== srcEntNum) {
                promises.push(updateCell({
                    floorId: floorId,
                    entranceNumber: e.number,
                    values: {
                        apts: srcData.apts,
                        units: srcData.units,
                        mopQty: srcData.mopQty
                    }
                }));
            }
        });
        await Promise.all(promises);
    };

    // --- Render ---

    if (!building) return <div className="p-12 text-center text-slate-500">Загрузка...</div>;
    if (residentialBlocks.length === 0) return <div className="p-12 text-center text-slate-500">Нет жилых блоков для инвентаризации подъездов</div>;
    if (!currentBlock) return <div className="p-12 text-center text-slate-500">Загрузка...</div>;

    const showEditor = true;

    const renderBadge = (type) => {
        const map = {
            residential: { color: 'bg-blue-50 text-blue-600 border-blue-100', label: 'Жилой' },
            mixed: { color: 'bg-violet-50 text-violet-600 border-violet-100', label: 'Смеш.' },
            technical: { color: 'bg-amber-50 text-amber-600 border-amber-100', label: 'Тех.' },
            basement: { color: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Подвал' },
            attic: { color: 'bg-teal-50 text-teal-600 border-teal-100', label: 'Манс.' },
            office: { color: 'bg-emerald-50 text-emerald-600 border-emerald-100', label: 'Нежилой' },
            parking_floor: { color: 'bg-indigo-50 text-indigo-600 border-indigo-100', label: 'Паркинг' },
        };
        const style = map[type] || map.residential;
        return <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase border ${style.color}`}>{style.label}</span>
    };

    return (
        <div className="space-y-6 pb-24 w-full px-4 md:px-6 2xl:px-8 max-w-[2400px] mx-auto animate-in fade-in duration-500 relative">
            <ConfigHeader 
                building={building} 
                isParking={isParking} 
                isInfrastructure={false} 
                isUnderground={isUnderground} 
                onBack={onBack} 
                isSticky={false}
            />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                 <div className="flex items-center gap-1.5 p-1.5 bg-slate-800 rounded-xl w-max overflow-x-auto max-w-full shadow-inner border border-slate-700 custom-scrollbar">
                    {residentialBlocks.map((b,i) => (
                        <DarkTabButton 
                            key={b.id} 
                            active={activeBlockIndex===i} 
                            onClick={()=>setActiveBlockIndex(i)} 
                            icon={getBlockIcon(b.type)}
                        >
                            {formatBlockSwitcherLabel({ building, block: b, buildingDetails })}
                        </DarkTabButton>
                    ))}
                </div>

                <div className="flex items-center gap-3">
                     <button 
                        onClick={autoFill} 
                        disabled={isReadOnly} 
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border shadow-sm ${isReadOnly ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' : 'bg-white text-indigo-600 border-indigo-100 hover:bg-indigo-50 hover:border-indigo-200'}`}
                     >
                        <Wand2 size={16}/> Заполнить типовыми
                     </button>
                </div>
            </div>

            {showEditor ? (
                <Card className="overflow-hidden shadow-lg border border-slate-300 rounded-2xl bg-white">
                    <div className="overflow-x-auto max-h-[70vh] scrollbar-thin">
                        <table className="w-max border-collapse table-fixed">
                            <thead className="sticky top-0 z-30 shadow-md">
                                <tr className="bg-slate-100 border-b-2 border-slate-300">
                                    <th className="p-3 text-left w-[140px] min-w-[140px] sticky left-0 z-40 bg-slate-100 border-r border-slate-300 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider pl-1">Этаж</span>
                                    </th>
                                    {entrances.map(e => (
                                        <th key={e.id} className="p-2 w-[180px] min-w-[180px] border-r border-slate-300 bg-slate-100">
                                            <div className="flex flex-col items-center">
                                                <span className="text-blue-700 mb-2 font-bold text-xs bg-blue-50 px-3 py-1 rounded-md border border-blue-200 shadow-sm">
                                                    {isUnderground ? `Вход ${e.number}` : `Подъезд ${e.number}`}
                                                </span>
                                                <div className="grid grid-cols-3 gap-0.5 w-full text-center">
                                                    {['apts', 'units', 'mopQty'].map(col => (
                                                        <div 
                                                            key={col}
                                                            className={`group/col-header flex flex-col items-center gap-0.5 p-1 rounded-lg transition-colors relative ${isReadOnly ? 'cursor-default opacity-50' : 'cursor-pointer hover:bg-slate-200'}`}
                                                            onClick={() => !isReadOnly && fillColumnBelow(e.number, col)}
                                                            title={isReadOnly ? "" : "Заполнить колонку вниз"}
                                                        >
                                                            <span className="text-[9px] font-bold text-slate-500 group-hover/col-header:text-blue-700 uppercase">
                                                                {col === 'apts' ? 'Кв' : col === 'units' ? 'Оф' : 'МОП'}
                                                            </span>
                                                            {!isReadOnly && <ArrowDown size={10} className="absolute -bottom-1.5 text-blue-600 opacity-0 group-hover/col-header:opacity-100 transition-opacity bg-white rounded-full shadow-sm border border-slate-200" />}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                                {floors.map((f, idx) => {
                                    const canHaveApts = isFieldEnabled(f, 'apts');
                                    const rowBg = idx % 2 === 0 ? "bg-slate-50/50" : "bg-white";

                                    return (
                                        <tr key={f.id} className={`${rowBg} hover:bg-blue-50/30 transition-colors group h-14`}>
                                            <td className="p-3 w-[140px] min-w-[140px] sticky left-0 z-20 bg-inherit border-r border-slate-300 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] relative group/cell">
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center justify-between h-full px-1">
                                                        <div className="flex items-center gap-2">
                                                            {canHaveApts && (
                                                                <input 
                                                                    type="checkbox" 
                                                                    title="Сделать дуплексом"
                                                                    checked={f.isDuplex || false} 
                                                                    onChange={() => toggleDuplex(f.id, f.isDuplex)} 
                                                                    disabled={isReadOnly} 
                                                                    className={`rounded w-4 h-4 transition-all flex-shrink-0 border-slate-300 cursor-pointer text-purple-600 focus:ring-purple-500 hover:border-purple-400`}
                                                                />
                                                            )}
                                                            <span className="text-sm font-bold text-slate-800">{f.label}</span>
                                                        </div>
                                                        {renderBadge(f.type)}
                                                    </div>
                                                </div>
                                            </td>

                                            {entrances.map(e => (
                                                <td key={e.id} className={`p-2 w-[180px] min-w-[180px] border-r border-slate-200 relative group/cell align-middle ${f.isDuplex ? 'bg-purple-50/10' : ''}`}>
                                                    <div className="grid grid-cols-3 gap-2 h-full">
                                                        {['apts', 'units', 'mopQty'].map(field => {
                                                            const canEdit = isFieldEnabled(f, field) && !isReadOnly;
                                                            const val = getCellValue(f.id, e.number, field);

                                                            let bgClass = "bg-white";
                                                            let textClass = "text-slate-700";
                                                            let borderClass = "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
                                                            
                                                            if (!isFieldEnabled(f, field)) { 
                                                                bgClass = "bg-slate-50";
                                                                textClass = "text-slate-300 cursor-not-allowed";
                                                                borderClass = "border-transparent";
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
                                                                        type="number" 
                                                                        min="0"
                                                                        disabled={!canEdit} 
                                                                        className={`w-full h-full text-center text-xs rounded-lg outline-none transition-all border ${bgClass} ${borderClass} ${textClass} ${isReadOnly ? 'cursor-default' : ''}`} 
                                                                        value={val} 
                                                                        onChange={v => handleCellChange(f.id, e.number, field, v)} 
                                                                        placeholder={canEdit ? "-" : ""}
                                                                    />
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    {!isReadOnly && (
                                                        <div className="absolute top-1/2 -translate-y-1/2 right-0 pr-1 opacity-0 group-hover/cell:opacity-100 transition-opacity z-10 pointer-events-none">
                                                            <div className="flex flex-col gap-1 pointer-events-auto bg-white/95 backdrop-blur-sm shadow-md border border-slate-200 rounded-md p-0.5">
                                                                <button onClick={()=>fillEntrancesRow(f.id, e.number)} title="Заполнить ряд вправо" className="p-1 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><ChevronsRight size={10}/></button>
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
                    <p className="text-slate-500 max-w-md">Матрица подъездов заполняется только для жилых блоков и подземных паркингов.</p>
                </div>
            )}
        </div>
    );
}
