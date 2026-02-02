import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { 
  ArrowLeft, Wand2, ArrowUp, ChevronsDown, 
  Ruler, Maximize2, FileText, ArrowUpFromLine, AlertCircle,
  CheckSquare, Square, MoreHorizontal, X, LayoutTemplate
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, DebouncedInput, TabButton, Button, Input, useReadOnly } from '../ui/UIKit';
import SaveFloatingBar from '../ui/SaveFloatingBar'; 
import { getBlocksList } from '../../lib/utils';
import { useBuildingFloors } from '../../hooks/useBuildingFloors';
import { FloorDataSchema } from '../../lib/schemas';
import { Validators } from '../../lib/validators';
import { useBuildingType } from '../../hooks/useBuildingType';

export default function FloorMatrixEditor({ buildingId, onBack }) {
    const { composition, floorData, setFloorData, saveBuildingData, saveData } = useProject();
    const isReadOnly = useReadOnly();
    const [activeBlockIndex, setActiveBlockIndex] = useState(0);
    
    const [selectedRows, setSelectedRows] = useState(new Set());
    const [bulkValue, setBulkValue] = useState('');
    const [openMenuId, setOpenMenuId] = useState(null); 
    const menuRef = useRef(null);
    const inputsRef = useRef({});

    const building = composition.find(c => c.id === buildingId);
    
    const { isGroundOpen, isGroundLight } = useBuildingType(building);
    const isExcludedType = isGroundOpen || isGroundLight;

    const blocksList = useMemo(() => getBlocksList(building), [building]);
    const { floorList, currentBlock } = useBuildingFloors(buildingId, activeBlockIndex);

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

    if (!building) return <div className="p-8 text-center">Объект не найден</div>;

    if (isExcludedType) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4 animate-in fade-in">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400"><Ruler size={40} /></div>
                <h3 className="text-xl font-bold text-slate-700">Внешняя инвентаризация не требуется</h3>
                <p className="text-slate-500 max-w-md">Для паркингов открытого типа или легких конструкций обмеры этажей не производятся.</p>
                <Button onClick={onBack} variant="secondary">Вернуться назад</Button>
            </div>
        );
    }

    if (!currentBlock) return <div className="p-8">Блоки не найдены</div>;
    
    const handleInput = useCallback((floorId, field, value) => { 
        if (isReadOnly) return;
        if (value !== '' && (parseFloat(value) < 0 || value.includes('-'))) return;
        const key = `${currentBlock.fullId}_${floorId}`; 
        setFloorData(p => ({
            ...p, 
            [key]: { 
                id: p[key]?.id || crypto.randomUUID(), // UUID
                ...(p[key]||{}), 
                [field]: value,
                // FKs
                buildingId: building.id,
                blockId: currentBlock.id,
                // floorId в данном случае это сам floorId из пропсов, но он строковый
            } 
        })); 
    }, [currentBlock.fullId, setFloorData, isReadOnly, building.id, currentBlock.id]);

    const copyRowFromPrev = (idx) => {
        if (isReadOnly || idx <= 0) return;
        const prevId = floorList[idx - 1].id;
        const currId = floorList[idx].id;
        const prevKey = `${currentBlock.fullId}_${prevId}`;
        const currKey = `${currentBlock.fullId}_${currId}`;
        
        const prevData = floorData[prevKey] || {};
        setFloorData(p => ({
            ...p,
            [currKey]: { 
                id: p[currKey]?.id || crypto.randomUUID(),
                ...(p[currKey] || {}), 
                height: prevData.height, 
                areaProj: prevData.areaProj, 
                areaFact: prevData.areaFact,
                buildingId: building.id,
                blockId: currentBlock.id
            }
        }));
        setOpenMenuId(null);
    };

    const fillRowsBelow = (idx) => {
        if (isReadOnly) return;
        const sourceId = floorList[idx].id;
        const sourceKey = `${currentBlock.fullId}_${sourceId}`;
        const sourceData = floorData[sourceKey] || {};
        
        const updates = {};
        for (let i = idx + 1; i < floorList.length; i++) {
            const targetId = floorList[i].id;
            const targetKey = `${currentBlock.fullId}_${targetId}`;
            updates[targetKey] = { 
                id: floorData[targetKey]?.id || crypto.randomUUID(),
                ...(floorData[targetKey] || {}), 
                height: sourceData.height, 
                areaProj: sourceData.areaProj, 
                areaFact: sourceData.areaFact,
                buildingId: building.id,
                blockId: currentBlock.id
            };
        }
        setFloorData(p => ({ ...p, ...updates }));
        setOpenMenuId(null);
    };

    const copyFieldFromPrev = (idx, field) => {
        if (isReadOnly || idx <= 0) return;
        const prevId = floorList[idx - 1].id;
        const currId = floorList[idx].id;
        const prevKey = `${currentBlock.fullId}_${prevId}`;
        const val = floorData[prevKey]?.[field];
        if (val !== undefined) handleInput(currId, field, val);
    };

    const fillFieldBelow = (idx, field) => {
        if (isReadOnly) return;
        const sourceId = floorList[idx].id;
        const sourceKey = `${currentBlock.fullId}_${sourceId}`;
        const val = floorData[sourceKey]?.[field];
        if (val === undefined) return;

        const updates = {};
        for (let i = idx + 1; i < floorList.length; i++) {
            const targetId = floorList[i].id;
            const targetKey = `${currentBlock.fullId}_${targetId}`;
            updates[targetKey] = { 
                id: floorData[targetKey]?.id || crypto.randomUUID(),
                ...(floorData[targetKey] || {}), 
                [field]: val,
                buildingId: building.id,
                blockId: currentBlock.id
            };
        }
        setFloorData(p => ({ ...p, ...updates }));
    };

    const hasCriticalErrors = useMemo(() => {
        for (const f of floorList) {
            const key = `${currentBlock.fullId}_${f.id}`;
            const val = (floorData[key] || {});
            
            const result = FloorDataSchema.safeParse(val);
            if (!result.success) return true;

            const heightError = Validators.floorHeight(f.type, val.height);
            if (heightError) return true;

            const areaError = Validators.checkPositive(val.areaProj);
            if (areaError) return true;

            const diffError = Validators.checkDiff(val.areaProj, val.areaFact);
            if (diffError) return true;
        }
        return false;
    }, [floorList, floorData, currentBlock.fullId]);

    const handleKeyDown = (e, rowIndex, colKey) => {
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        
        const colOrder = ['height', 'areaProj', 'areaFact'];
        let colIndex = colOrder.indexOf(colKey);
        let newRow = rowIndex;
        let newCol = colIndex;

        if (e.key === 'ArrowUp') newRow = Math.max(0, rowIndex - 1);
        if (e.key === 'ArrowDown') newRow = Math.min(floorList.length - 1, rowIndex + 1);
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
        if (selectedRows.size === floorList.length) setSelectedRows(new Set());
        else setSelectedRows(new Set(floorList.map(f => f.id)));
    };

    const applyBulk = (field) => {
        if (isReadOnly || !bulkValue) return;
        const updates = {};
        selectedRows.forEach(floorId => {
            const key = `${currentBlock.fullId}_${floorId}`;
            const currentData = floorData[key] || {};
            updates[key] = { 
                id: currentData.id || crypto.randomUUID(),
                ...currentData, 
                [field]: bulkValue,
                buildingId: building.id,
                blockId: currentBlock.id
            };
        });
        setFloorData(prev => ({ ...prev, ...updates }));
    };

    const autoFill = () => { 
        if (isReadOnly) return;
        const updates = {}; 
        floorList.forEach(f => { 
            const key = `${currentBlock.fullId}_${f.id}`; 
            let h = '3.00'; let s_proj = '500.00';
            if (f.type === 'basement') { h = '2.50'; s_proj = '450.00'; }
            if (f.type === 'parking_floor') { h = '2.70'; s_proj = '1000.00'; }
            if (f.type === 'technical') { h = '1.80'; s_proj = '480.00'; }
            if (f.type === 'attic') { h = '2.70'; s_proj = '350.00'; }
            if (f.type === 'roof') { h = '0.00'; s_proj = '400.00'; }
            if (f.type === 'mixed') { h = '3.60'; s_proj = '550.00'; } 
            if (f.type === 'office') { h = '3.30'; s_proj = '600.00'; }
            
            if (!floorData[key]) { 
                updates[key] = { 
                    id: crypto.randomUUID(),
                    height: h, 
                    areaProj: s_proj, 
                    areaFact: s_proj,
                    buildingId: building.id,
                    blockId: currentBlock.id
                }; 
            }
        }); 
        setFloorData(p => ({...p, ...updates})); 
    };

    const renderTypeBadge = (type) => {
        const styles = {
            residential: "bg-blue-50 text-blue-600 border-blue-100",
            mixed: "bg-violet-50 text-violet-600 border-violet-100", 
            technical: "bg-amber-50 text-amber-600 border-amber-100",
            basement: "bg-slate-100 text-slate-600 border-slate-200",
            tsokol: "bg-purple-50 text-purple-600 border-purple-100",
            attic: "bg-teal-50 text-teal-600 border-teal-100",
            roof: "bg-sky-50 text-sky-600 border-sky-100",
            office: "bg-emerald-50 text-emerald-600 border-emerald-100",
            parking_floor: "bg-indigo-50 text-indigo-600 border-indigo-100"
        };
        const labels = {
            residential: "Жилой", mixed: "Коммерция", technical: "Технический",
            basement: "Подвал", tsokol: "Цоколь", attic: "Мансарда",
            roof: "Кровля", office: "Нежилой", parking_floor: "Паркинг"
        };
        return <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${styles[type] || styles.residential}`}>{labels[type] || type}</span>;
    };

    const handleSave = async () => { 
        const specificData = {};
        Object.keys(floorData).forEach(k => { if (k.startsWith(building.id)) specificData[k] = floorData[k]; });
        // Используем сервис с трансформацией внутри
        await saveBuildingData(building.id, 'floorData', specificData);
        await saveData({}, true); 
    };
    
    return (
        <div className="space-y-6 pb-24 max-w-7xl mx-auto animate-in fade-in duration-500 relative">
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
                        disabled={isReadOnly}
                        className={`flex-1 md:flex-none h-10 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors border ${isReadOnly ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border-indigo-100'}`}
                     >
                        <Wand2 size={14}/> Авто-заполнение
                     </button>
                     <Button variant="secondary" onClick={onBack} className="h-10">Закрыть</Button>
                 </div>
             </div>

             <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {blocksList.map((b,i) => (
                    <TabButton key={b.id} active={activeBlockIndex===i} onClick={()=>setActiveBlockIndex(i)} className="shadow-sm border border-slate-200">
                        {b.icon && <b.icon size={14} className="mr-1.5 opacity-70"/>}{b.tabLabel}
                    </TabButton>
                ))}
            </div>

            {selectedRows.size > 0 && !isReadOnly && (
                <div className="sticky top-4 z-50 mx-auto max-w-2xl animate-in slide-in-from-top-4 fade-in duration-300">
                    <div className="bg-slate-900/95 backdrop-blur text-white p-2.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700/50 ring-1 ring-white/10">
                        <div className="bg-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-2 shadow-sm">
                            <CheckSquare size={14} className="text-white/80"/>
                            {selectedRows.size}
                        </div>
                        <div className="h-6 w-px bg-white/10"></div>
                        <Input 
                            value={bulkValue} 
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || (parseFloat(val) >= 0 && !val.includes('-'))) setBulkValue(val);
                            }}
                            placeholder="0.00" 
                            className="w-24 h-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 text-sm font-bold text-center focus:bg-slate-800 focus:border-blue-500 focus:ring-blue-500/20"
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

            <Card className="overflow-hidden shadow-sm border border-slate-200 rounded-2xl bg-white">
                <div className="overflow-x-auto max-h-[70vh] scrollbar-thin"> 
                    <table className="w-full relative border-collapse text-sm table-fixed">
                        <thead className="sticky top-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                            <tr className="bg-slate-50/90 backdrop-blur border-b border-slate-200">
                                <th className="p-0 w-12 text-center border-r border-slate-200 sticky left-0 z-40 bg-slate-50">
                                    <div className="h-full w-full flex items-center justify-center">
                                        <button disabled={isReadOnly} onClick={toggleAll} className={`text-slate-400 hover:text-blue-600 transition-colors p-2 ${isReadOnly ? 'cursor-not-allowed opacity-50' : ''}`}>
                                            {selectedRows.size === floorList.length && floorList.length > 0 ? <CheckSquare size={18} className="text-blue-600"/> : <Square size={18}/>}
                                        </button>
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-left w-64 border-r border-slate-200 sticky left-12 z-40 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] bg-slate-50">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Уровень / Этаж</span>
                                </th>
                                <th className="px-4 py-3 w-48 text-center border-r border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    <div className="flex items-center justify-center gap-1.5"><Ruler size={14} className="text-slate-400"/> Высота (м)</div>
                                </th>
                                <th className="px-4 py-3 w-48 text-center border-r border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    <div className="flex items-center justify-center gap-1.5"><FileText size={14} className="text-slate-400"/> S Проект (м²)</div>
                                </th>
                                <th className="px-4 py-3 w-48 text-center bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    <div className="flex items-center justify-center gap-1.5"><Maximize2 size={14} className="text-slate-400"/> S Факт (м²)</div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {floorList.map((f, idx) => {
                                const key = `${currentBlock.fullId}_${f.id}`; 
                                const val = (floorData[key] || {});
                                const isSelected = selectedRows.has(f.id);
                                
                                const validationResult = FloorDataSchema.safeParse(val);
                                const fieldErrors = validationResult.success ? {} : validationResult.error.flatten().fieldErrors;
                                
                                const diffErrorMsg = Validators.checkDiff(val.areaProj, val.areaFact);
                                const hasDiffError = !!diffErrorMsg;

                                const borderClass = f.isSeparator ? "border-b-[4px] border-slate-100" : "";
                                const rowBg = isSelected ? "bg-blue-50" : (idx % 2 === 0 ? "bg-slate-50/30" : "bg-white");

                                return (
                                    <tr key={f.id} className={`${rowBg} hover:bg-slate-50 transition-colors group ${borderClass}`}>
                                        
                                        <td className="p-0 text-center border-r border-slate-100 sticky left-0 z-20 bg-inherit">
                                            <div className="h-full w-full flex items-center justify-center backdrop-blur-sm">
                                                <button disabled={isReadOnly} onClick={() => toggleRow(f.id)} className={`text-slate-300 hover:text-blue-600 transition-colors p-2 ${isReadOnly ? 'cursor-not-allowed opacity-50' : ''}`}>
                                                    {isSelected ? <CheckSquare size={18} className="text-blue-600"/> : <Square size={18}/>}
                                                </button>
                                            </div>
                                        </td>

                                        <td className={`px-4 py-3 border-r border-slate-100 sticky left-12 z-20 bg-inherit shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] relative group/label ${openMenuId === f.id ? 'z-50' : ''}`}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        {f.isInserted && <ArrowUpFromLine size={14} className="text-amber-500"/>}
                                                        <span className={`font-bold text-sm ${f.isInserted ? 'text-amber-700' : 'text-slate-700'}`}>{f.label}</span>
                                                    </div>
                                                    {renderTypeBadge(f.type)}
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
                                                    <button onClick={() => fillRowsBelow(idx)} disabled={idx===floorList.length-1} className={`flex items-center gap-2 px-3 py-2.5 text-xs font-bold rounded-lg text-left transition-colors ${idx===floorList.length-1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-50 hover:text-blue-600'}`}>
                                                        <ChevronsDown size={14} className={idx===floorList.length-1 ? 'text-slate-300' : 'text-blue-500'}/> Заполнить все ниже
                                                    </button>
                                                </div>
                                            )}
                                        </td>

                                        {
                                            [
                                                { id: 'height', ph: '0.00', required: f.type !== 'roof' }, 
                                                { id: 'areaProj', ph: '0.00', required: true }, 
                                                { id: 'areaFact', ph: '0.00', required: false }
                                            ].map(field => {
                                                const zodError = fieldErrors[field.id];
                                                const isDiffErr = field.id === 'areaFact' && hasDiffError;
                                                const isEmpty = !val[field.id];
                                                
                                                let customError = null;
                                                if (field.id === 'height') customError = Validators.floorHeight(f.type, val[field.id]);
                                                if (field.id === 'areaProj') customError = Validators.checkPositive(val[field.id]);

                                                const finalError = (zodError && zodError[0]) || customError;
                                                const showRed = !!finalError || (field.required && isEmpty) || isDiffErr;

                                                let bgClass = "bg-transparent hover:bg-slate-50 focus:bg-white";
                                                let borderClass = "border-transparent focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
                                                let textClass = "text-slate-800";

                                                if (showRed) {
                                                    bgClass = "bg-red-50 hover:bg-red-50 focus:bg-white";
                                                    borderClass = "border-red-300 focus:border-red-500 focus:ring-red-100";
                                                    textClass = "text-red-700";
                                                } else if (val[field.id]) {
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
                                                    <td key={field.id} className="p-2 border-r border-slate-100 relative group/input">
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
                                                                value={val[field.id]} 
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
                                                                    {idx < floorList.length - 1 && (
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
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            <SaveFloatingBar onSave={handleSave} disabled={hasCriticalErrors} />
        </div>
    );
}