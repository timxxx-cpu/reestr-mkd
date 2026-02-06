import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ArrowUp, ChevronsDown, Ruler, Maximize2, FileText, 
  ArrowUpFromLine, CheckSquare, Square, 
  MoreHorizontal, Wand2, Loader2, AlertCircle, X,
  Building2, Car, Box, Store, LayoutGrid 
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useDirectBuildings } from '../../hooks/api/useDirectBuildings';
import { useDirectFloors } from '../../hooks/api/useDirectFloors';
import { useBuildingType } from '../../hooks/useBuildingType';
import { Card, DebouncedInput, useReadOnly } from '../ui/UIKit';
import { Validators } from '../../lib/validators';
import ConfigHeader from './configurator/ConfigHeader';

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

const getBlockIcon = (type) => {
    if (type === 'residential') return Building2;
    if (type === 'parking') return Car;
    if (type === 'infrastructure') return Box;
    if (type === 'non_residential') return Store;
    return LayoutGrid;
};

export default function FloorMatrixEditor({ buildingId, onBack }) {
    const { projectId } = useProject();
    const isReadOnly = useReadOnly();
    
    // 1. Получаем список зданий
    const { buildings } = useDirectBuildings(projectId);
    const building = useMemo(() => buildings.find(b => b.id === buildingId), [buildings, buildingId]);

    // 2. Тип здания
    const typeInfo = useBuildingType(building);
    const { isParking, isInfrastructure, isUnderground } = typeInfo;

    // 3. Управление блоками
    const [activeBlockIndex, setActiveBlockIndex] = useState(0);
    const currentBlock = useMemo(() => {
        if (!building?.blocks?.length) return null;
        return building.blocks[activeBlockIndex];
    }, [building, activeBlockIndex]);

    // 4. Этажи из БД
    const { floors, isLoading, updateFloor, generateFloors, isMutating } = useDirectFloors(currentBlock?.id);

    const hiddenStylobateFloorsCount = useMemo(() => {
        if (currentBlock?.type !== 'residential') return 0;
        return floors.filter(f => f?.isStylobate || f?.type === 'stylobate').length;
    }, [floors, currentBlock?.type]);

    const visibleFloors = useMemo(() => {
        if (currentBlock?.type !== 'residential') return floors;
        return floors.filter(f => !(f?.isStylobate || f?.type === 'stylobate'));
    }, [floors, currentBlock?.type]);

    const [selectedRows, setSelectedRows] = useState(new Set());
    const [bulkValue, setBulkValue] = useState('');
    const [openMenuId, setOpenMenuId] = useState(null); 
    const menuRef = useRef(null);
    const inputsRef = useRef({});

    useEffect(() => {
        setSelectedRows(new Set());
        setOpenMenuId(null);
        inputsRef.current = {};
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

    const handleGenerateMissing = async () => {
        if (!currentBlock) return;
        if (confirm("Сгенерировать сетку этажей на основе настроек блока?")) {
            await generateFloors({ floorsFrom: 1, floorsTo: 9, defaultType: currentBlock.type === 'residential' ? 'residential' : 'office' });
        }
    };

    const handleInput = (id, field, value) => {
        if (isReadOnly) return;
        updateFloor({ id, updates: { [field]: value } });
    };

    const copyRowFromPrev = async (idx) => {
        if (isReadOnly || idx <= 0) return;
        const prevFloor = visibleFloors[idx - 1];
        const currFloor = visibleFloors[idx];
        
        await updateFloor({ 
            id: currFloor.id, 
            updates: { 
                height: prevFloor.height, 
                areaProj: prevFloor.areaProj, 
                areaFact: prevFloor.areaFact 
            } 
        });
        setOpenMenuId(null);
    };

    const fillRowsBelow = async (idx) => {
        if (isReadOnly) return;
        const sourceFloor = visibleFloors[idx];
        const updates = {
            height: sourceFloor.height,
            areaProj: sourceFloor.areaProj,
            areaFact: sourceFloor.areaFact
        };

        const promises = [];
        for (let i = idx + 1; i < visibleFloors.length; i++) {
            promises.push(updateFloor({ id: visibleFloors[i].id, updates }));
        }
        await Promise.all(promises);
        setOpenMenuId(null);
    };

    const copyFieldFromPrev = (idx, field) => {
        if (isReadOnly || idx <= 0) return;
        const val = visibleFloors[idx - 1][field];
        if (val !== undefined) handleInput(visibleFloors[idx].id, field, val);
    };

    const fillFieldBelow = async (idx, field) => {
        if (isReadOnly) return;
        const val = visibleFloors[idx][field];
        const promises = [];
        for (let i = idx + 1; i < visibleFloors.length; i++) {
            promises.push(updateFloor({ id: visibleFloors[i].id, updates: { [field]: val } }));
        }
        await Promise.all(promises);
    };

    const handleKeyDown = (e, rowIndex, colKey) => {
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        
        const colOrder = ['height', 'areaProj', 'areaFact'];
        let colIndex = colOrder.indexOf(colKey);
        let newRow = rowIndex;
        let newCol = colIndex;

        if (e.key === 'ArrowUp') newRow = Math.max(0, rowIndex - 1);
        if (e.key === 'ArrowDown') newRow = Math.min(visibleFloors.length - 1, rowIndex + 1);
        if (e.key === 'ArrowLeft') newCol = Math.max(0, colIndex - 1);
        if (e.key === 'ArrowRight') newCol = Math.min(colOrder.length - 1, colIndex + 1);

        if (newRow !== rowIndex || newCol !== colIndex) {
            e.preventDefault();
            const targetRef = inputsRef.current[`${newRow}-${colOrder[newCol]}`];
            if (targetRef) targetRef.focus();
        }
    };

    const toggleRow = (id) => {
        if (isReadOnly) return;
        const newSet = new Set(selectedRows);
        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
        setSelectedRows(newSet);
    };

    const toggleAll = () => {
        if (isReadOnly) return;
        if (selectedRows.size === visibleFloors.length) setSelectedRows(new Set());
        else setSelectedRows(new Set(visibleFloors.map(f => f.id)));
    };

    const applyBulk = async (field) => {
        if (isReadOnly || !bulkValue) return;
        const promises = [];
        selectedRows.forEach(id => {
            promises.push(updateFloor({ id, updates: { [field]: bulkValue } }));
        });
        await Promise.all(promises);
    };

    const autoFill = async () => { 
        if (isReadOnly) return;
        if (!confirm("Заполнить пустые значения типовыми данными?")) return;

        const promises = [];
        visibleFloors.forEach(f => {
            const isEmpty = !f.areaProj || parseFloat(f.areaProj) === 0;
            if (isEmpty) {
                let h = '3.00'; let s_proj = '500.00';
                if (f.type === 'basement') { h = '2.50'; s_proj = '450.00'; }
                if (f.type === 'parking_floor') { h = '2.70'; s_proj = '1000.00'; }
                if (f.type === 'technical') { h = '1.80'; s_proj = '480.00'; }
                if (f.type === 'attic') { h = '2.70'; s_proj = '350.00'; }
                if (f.type === 'roof') { h = '0.00'; s_proj = '400.00'; }
                
                promises.push(updateFloor({ 
                    id: f.id, 
                    updates: { height: h, areaProj: s_proj, areaFact: s_proj } 
                }));
            }
        });
        await Promise.all(promises);
    };

    const renderTypeBadge = (type) => {
        const styles = {
            residential: "bg-blue-50 text-blue-600 border-blue-100",
            mixed: "bg-violet-50 text-violet-600 border-violet-100", 
            technical: "bg-amber-50 text-amber-600 border-amber-100",
            basement: "bg-slate-100 text-slate-600 border-slate-200",
            attic: "bg-teal-50 text-teal-600 border-teal-100",
            office: "bg-emerald-50 text-emerald-600 border-emerald-100",
            parking_floor: "bg-indigo-50 text-indigo-600 border-indigo-100"
        };
        const labels = {
            residential: "Жилой", mixed: "Коммерция", technical: "Технический",
            basement: "Подвал", attic: "Мансарда", office: "Нежилой", parking_floor: "Паркинг"
        };
        return <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${styles[type] || styles.residential}`}>{labels[type] || type}</span>;
    };

    if (!building) return <div className="p-8 text-center text-slate-400">Объект не найден</div>;
    if (!currentBlock) return <div className="p-8 text-center text-slate-400">Блоки не найдены</div>;

    if (visibleFloors.length === 0 && hiddenStylobateFloorsCount > 0 && !isLoading) {
        return (
            <div className="space-y-6 pb-20 w-full px-6 animate-in fade-in">
                <ConfigHeader
                    building={building}
                    isParking={isParking}
                    isInfrastructure={isInfrastructure}
                    isUnderground={isUnderground}
                    onBack={onBack}
                    isSticky={false}
                />

                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <p className="text-sm leading-6">
                        В этом жилом блоке этажи стилобата скрыты на шаге «Внешняя инвентаризация».
                        Заполняйте данные по ним в связанном нежилом блоке.
                    </p>
                </div>
            </div>
        );
    }

    if (visibleFloors.length === 0 && !isLoading) {
        return (
            <div className="space-y-6 pb-20 w-full px-6 animate-in fade-in">
                <ConfigHeader 
                    building={building} 
                    isParking={isParking}
                    isInfrastructure={isInfrastructure}
                    isUnderground={isUnderground}
                    onBack={onBack} 
                    isSticky={false} 
                />
                <div className="flex flex-col items-center justify-center h-[40vh] text-center space-y-4 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400"><FileText size={40} /></div>
                    <h3 className="text-xl font-bold text-slate-700">Сетка этажей пуста</h3>
                    <p className="text-slate-500 max-w-md text-sm">Этажи еще не созданы в базе данных. Вы можете сгенерировать их сейчас.</p>
                    <button 
                        onClick={handleGenerateMissing} 
                        disabled={isMutating} 
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                    >
                        {isMutating ? <Loader2 className="animate-spin" /> : "Сгенерировать этажи"}
                    </button>
                </div>
            </div>
        );
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

             {/* TABS & TOOLS */}
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                 <div className="flex items-center gap-1.5 p-1.5 bg-slate-800 rounded-xl w-max overflow-x-auto max-w-full shadow-inner border border-slate-700 custom-scrollbar">
                    {building.blocks.map((b,i) => (
                        <DarkTabButton 
                            key={b.id} 
                            active={activeBlockIndex === i} 
                            onClick={()=>setActiveBlockIndex(i)} 
                            icon={getBlockIcon(b.type)}
                        >
                            {b.label}
                        </DarkTabButton>
                    ))}
                </div>

                <div className="flex items-center gap-3">
                    {isMutating && <span className="text-xs text-blue-600 font-bold animate-pulse flex items-center gap-1"><Loader2 size={12} className="animate-spin"/> Сохранение...</span>}
                    <button 
                        onClick={autoFill} 
                        disabled={isReadOnly || isMutating}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border shadow-sm ${isReadOnly ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' : 'bg-white text-indigo-600 border-indigo-100 hover:bg-indigo-50 hover:border-indigo-200'}`}
                    >
                        <Wand2 size={16}/> Авто-заполнение
                    </button>
                </div>
             </div>

            {/* SELECTION TOOLBAR */}
            {selectedRows.size > 0 && !isReadOnly && (
                <div className="sticky top-4 z-50 mx-auto max-w-2xl animate-in slide-in-from-top-4 fade-in duration-300">
                    <div className="bg-slate-900/95 backdrop-blur text-white p-2.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700/50 ring-1 ring-white/10">
                        <div className="bg-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-2 shadow-sm">
                            <CheckSquare size={14} className="text-white/80"/>
                            {selectedRows.size}
                        </div>
                        <div className="h-6 w-px bg-white/10"></div>
                        <input 
                            value={bulkValue} 
                            onChange={(e) => setBulkValue(e.target.value)}
                            placeholder="0.00" 
                            className="w-24 h-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 text-sm font-bold text-center focus:bg-slate-800 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg outline-none"
                        />
                        <div className="flex gap-1.5">
                            <button onClick={() => applyBulk('height')} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold transition-colors border border-white/10">Высота</button>
                            <button onClick={() => applyBulk('areaProj')} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold transition-colors border border-white/10">Проект</button>
                            <button onClick={() => applyBulk('areaFact')} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold transition-colors border border-white/10">Факт</button>
                        </div>
                        <button onClick={() => setSelectedRows(new Set())} className="ml-auto p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"><X size={16}/></button>
                    </div>
                </div>
            )}

            {/* TABLE */}
            <Card className="overflow-hidden shadow-lg border border-slate-300 rounded-2xl bg-white">
                <div className="overflow-x-auto max-h-[70vh] scrollbar-thin"> 
                    <table className="w-full relative border-collapse text-sm table-fixed">
                        <thead className="sticky top-0 z-30 shadow-md">
                            <tr className="bg-slate-100 border-b-2 border-slate-300">
                                <th className="p-0 w-12 text-center border-r border-slate-300 sticky left-0 z-40 bg-slate-100">
                                    <div className="h-full w-full flex items-center justify-center">
                                        <button disabled={isReadOnly} onClick={toggleAll} className={`text-slate-500 hover:text-blue-600 transition-colors p-2 ${isReadOnly ? 'cursor-not-allowed opacity-50' : ''}`}>
                                                {selectedRows.size === visibleFloors.length && visibleFloors.length > 0 ? <CheckSquare size={18} className="text-blue-600"/> : <Square size={18}/>}
                                        </button>
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-left w-36 border-r border-slate-300 sticky left-12 z-40 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] bg-slate-100">
                                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Этаж</span>
                                </th>
                                <th className="px-4 py-3 text-left w-48 border-r border-slate-300 bg-slate-100">
                                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Тип этажа</span>
                                </th>
                                <th className="px-4 py-3 w-48 text-center border-r border-slate-300 bg-slate-100 text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    <div className="flex items-center justify-center gap-1.5"><Ruler size={14} className="text-slate-500"/> Высота (м)</div>
                                </th>
                                <th className="px-4 py-3 w-48 text-center border-r border-slate-300 bg-slate-100 text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    <div className="flex items-center justify-center gap-1.5"><FileText size={14} className="text-slate-500"/> Площадь по проекту (м²)</div>
                                </th>
                                <th className="px-4 py-3 w-48 text-center bg-slate-100 text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    <div className="flex items-center justify-center gap-1.5"><Maximize2 size={14} className="text-slate-500"/> Площадь по обмерам (м²)</div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {visibleFloors.map((f, idx) => {
                                const isSelected = selectedRows.has(f.id);
                                const diffErrorMsg = Validators.checkDiff(f.areaProj, f.areaFact);
                                const hasDiffError = !!diffErrorMsg;
                                const rowBg = isSelected ? "bg-blue-50" : (idx % 2 === 0 ? "bg-slate-50/50" : "bg-white");

                                return (
                                    <tr key={f.id} className={`${rowBg} hover:bg-blue-50/30 transition-colors group`}>
                                        
                                        <td className="p-0 text-center border-r border-slate-200 sticky left-0 z-20 bg-inherit">
                                            <div className="h-full w-full flex items-center justify-center backdrop-blur-sm">
                                                <button disabled={isReadOnly} onClick={() => toggleRow(f.id)} className={`text-slate-300 hover:text-blue-600 transition-colors p-2 ${isReadOnly ? 'cursor-not-allowed opacity-50' : ''}`}>
                                                    {isSelected ? <CheckSquare size={18} className="text-blue-600"/> : <Square size={18}/>}
                                                </button>
                                            </div>
                                        </td>

                                        <td className={`px-4 py-3 border-r border-slate-200 sticky left-12 z-20 bg-inherit shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] relative group/label ${openMenuId === f.id ? 'z-50' : ''}`}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    {f.isTechnical && <ArrowUpFromLine size={14} className="text-amber-500"/>}
                                                    <span className="font-bold text-sm text-slate-700">{f.label}</span>
                                                </div>
                                                
                                                {!isReadOnly && (
                                                    <div className={`opacity-0 group-hover/label:opacity-100 transition-opacity ${openMenuId === f.id ? 'opacity-100' : ''}`}>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === f.id ? null : f.id); }}
                                                            className={`p-1.5 rounded-lg hover:bg-slate-200 transition-colors ${openMenuId === f.id ? 'bg-slate-200 text-slate-800' : 'text-slate-400'}`}
                                                        >
                                                            <MoreHorizontal size={16}/>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {openMenuId === f.id && !isReadOnly && (
                                                <div ref={menuRef} className="absolute left-[85%] top-8 w-52 bg-white rounded-xl shadow-xl border border-slate-200 z-[100] p-1.5 flex flex-col animate-in fade-in zoom-in-95 duration-200 origin-top-left">
                                                    <button onClick={() => copyRowFromPrev(idx)} disabled={idx===0} className={`flex items-center gap-2 px-3 py-2.5 text-xs font-bold rounded-lg text-left transition-colors ${idx===0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-50 hover:text-blue-600'}`}>
                                                        <ArrowUp size={14} className={idx===0 ? 'text-slate-300' : 'text-blue-500'}/> Скопировать с пред.
                                                    </button>
                                                    <div className="h-px bg-slate-100 my-1"/>
                                                    <button onClick={() => fillRowsBelow(idx)} disabled={idx===visibleFloors.length-1} className={`flex items-center gap-2 px-3 py-2.5 text-xs font-bold rounded-lg text-left transition-colors ${idx===visibleFloors.length-1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-50 hover:text-blue-600'}`}>
                                                        <ChevronsDown size={14} className={idx===visibleFloors.length-1 ? 'text-slate-300' : 'text-blue-500'}/> Заполнить все ниже
                                                    </button>
                                                </div>
                                            )}
                                        </td>

                                        <td className="px-4 py-3 border-r border-slate-200 bg-inherit">
                                            {renderTypeBadge(f.type)}
                                        </td>

                                        {
                                            [
                                                { id: 'height', ph: '0.00', required: f.type !== 'roof' }, 
                                                { id: 'areaProj', ph: '0.00', required: true }, 
                                                { id: 'areaFact', ph: '0.00', required: false }
                                            ].map(field => {
                                                const val = f[field.id];
                                                const isDiffErr = field.id === 'areaFact' && hasDiffError;
                                                const isEmpty = !val;
                                                
                                                let customError = null;
                                                if (field.id === 'height') customError = Validators.floorHeight(f.type, val);
                                                if (field.id === 'areaProj') customError = Validators.checkPositive(val);

                                                const finalError = customError;
                                                const showRed = !!finalError || (field.required && isEmpty) || isDiffErr;

                                                let bgClass = "bg-transparent hover:bg-slate-50 focus:bg-white";
                                                let borderClass = "border-transparent focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
                                                let textClass = "text-slate-800";

                                                if (showRed) {
                                                    bgClass = "bg-red-50 hover:bg-red-50 focus:bg-white";
                                                    borderClass = "border-red-300 focus:border-red-500 focus:ring-red-100";
                                                    textClass = "text-red-700";
                                                } else if (val) {
                                                    textClass = "text-slate-900 font-bold";
                                                } else {
                                                    textClass = "text-slate-400";
                                                }
                                                
                                                if (isReadOnly) {
                                                    bgClass = "bg-transparent";
                                                    borderClass = "border-transparent";
                                                    textClass = "text-slate-600";
                                                }

                                                return (
                                                    <td key={field.id} className="p-2 border-r border-slate-200 relative group/input">
                                                        <div className="relative h-10">
                                                            <DebouncedInput 
                                                                ref={el => inputsRef.current[`${idx}-${field.id}`] = el}
                                                                onKeyDown={(e) => handleKeyDown(e, idx, field.id)}
                                                                type="number" 
                                                                min="0"
                                                                step="0.01" 
                                                                disabled={isReadOnly}
                                                                className={`w-full h-full text-center rounded-xl text-sm outline-none transition-all border pr-7 ${bgClass} ${borderClass} ${textClass} ${isReadOnly ? 'cursor-default' : ''}`} 
                                                                placeholder={field.ph} 
                                                                value={val || ''} 
                                                                onChange={v => handleInput(f.id, field.id, v)} 
                                                            />
                                                            
                                                            {(finalError || isDiffErr) && !isReadOnly && (
                                                                <div className="absolute top-1/2 -translate-y-1/2 right-2 pointer-events-none">
                                                                    <AlertCircle size={14} className="text-red-500"/>
                                                                </div>
                                                            )}

                                                            {!isReadOnly && (
                                                                <div className="absolute inset-y-0 right-1 flex flex-col justify-center gap-0.5 opacity-0 group-hover/input:opacity-100 transition-opacity z-10">
                                                                    {idx > 0 && (
                                                                        <button onClick={() => copyFieldFromPrev(idx, field.id)} className="p-0.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded bg-white/80 shadow-sm border border-slate-200" title="Копировать верх">
                                                                            <ArrowUp size={10}/>
                                                                        </button>
                                                                    )}
                                                                    {idx < visibleFloors.length - 1 && (
                                                                        <button onClick={() => fillFieldBelow(idx, field.id)} className="p-0.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded bg-white/80 shadow-sm border border-slate-200" title="Заполнить низ">
                                                                            <ChevronsDown size={10}/>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                        
                                                        {finalError && !isReadOnly && (
                                                            <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded shadow-lg pointer-events-none opacity-0 group-focus-within/input:opacity-100 transition-opacity whitespace-nowrap">
                                                                {finalError}
                                                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-red-600"></div>
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })
                                        }
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
