import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { 
  ArrowLeft, Save, Wand2, ArrowUp, ChevronsDown, 
  Ruler, Maximize2, FileText, ArrowUpFromLine, AlertCircle,
  CheckSquare, Square, MoreHorizontal, X
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, DebouncedInput, TabButton, Button, Input } from '../ui/UIKit';
import { getBlocksList } from '../../lib/utils';
import { useBuildingFloors } from '../../hooks/useBuildingFloors';
// ВАЛИДАЦИЯ
import { FloorDataSchema } from '../../lib/schemas';

const PARKING_TYPE_LABELS = {
    capital: "Капитальный",
    light: "Легкие конструкции",
    open: "Открытый"
};

/**
 * @param {{ buildingId: string, onBack: () => void }} props
 */
export default function FloorMatrixEditor({ buildingId, onBack }) {
    const { composition, floorData, setFloorData, saveBuildingData, saveData } = useProject();
    const [activeBlockIndex, setActiveBlockIndex] = useState(0);
    
    // Состояние выделения
    const [selectedRows, setSelectedRows] = useState(new Set());
    const [bulkValue, setBulkValue] = useState('');
    
    // Рефы для навигации
    const inputsRef = useRef({});

    const building = composition.find(c => c.id === buildingId);
    const isParking = building?.category === 'parking_separate';
    const isInfrastructure = building?.category === 'infrastructure';
    const isUndergroundParking = isParking && building?.parkingType === 'underground';
    const isExcludedType = isParking && (building.constructionType === 'open' || building.constructionType === 'light');

    const blocksList = useMemo(() => getBlocksList(building), [building]);
    const { floorList, currentBlock } = useBuildingFloors(buildingId, activeBlockIndex);

    // Сброс выделения при смене блока
    useEffect(() => {
        setSelectedRows(new Set());
        inputsRef.current = {};
    }, [activeBlockIndex]);

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
    
    // --- ЛОГИКА ДАННЫХ ---

    const handleInput = useCallback((floorId, field, value) => { 
        if (value !== '' && (parseFloat(value) < 0 || value.includes('-'))) return;

        const key = `${currentBlock.fullId}_${floorId}`; 
        // @ts-ignore
        setFloorData(p => ({...p, [key]: { ...(p[key]||{}), [field]: value } })); 
    }, [currentBlock.fullId, setFloorData]);

    const hasCriticalErrors = useMemo(() => {
        for (const f of floorList) {
            const key = `${currentBlock.fullId}_${f.id}`;
            const val = /** @type {import('../../lib/types').FloorData} */ (floorData[key] || {});
            
            const result = FloorDataSchema.safeParse(val);
            
            if (!result.success) {
                return false; 
            }
            
            if (f.type !== 'roof' && (val.height === undefined || Number(val.height) < 1.8)) return true;
            if (val.areaProj === undefined || Number(val.areaProj) <= 0) return true;
        }
        return false;
    }, [floorList, floorData, currentBlock.fullId]);

    // --- Навигация стрелками ---
    const handleKeyDown = (e, rowIndex, colKey) => {
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        e.preventDefault();

        const colOrder = ['height', 'areaProj', 'areaFact'];
        let colIndex = colOrder.indexOf(colKey);
        let newRow = rowIndex;
        let newCol = colIndex;

        if (e.key === 'ArrowUp') newRow = Math.max(0, rowIndex - 1);
        if (e.key === 'ArrowDown') newRow = Math.min(floorList.length - 1, rowIndex + 1);
        if (e.key === 'ArrowLeft') newCol = Math.max(0, colIndex - 1);
        if (e.key === 'ArrowRight') newCol = Math.min(colOrder.length - 1, colIndex + 1);

        // @ts-ignore
        const targetRef = inputsRef.current[`${newRow}-${colOrder[newCol]}`];
        if (targetRef) targetRef.focus();
    };

    // --- Выделение ---
    const toggleRow = (id) => {
        const newSet = new Set(selectedRows);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedRows(newSet);
    };

    const toggleAll = () => {
        if (selectedRows.size === floorList.length) setSelectedRows(new Set());
        else setSelectedRows(new Set(floorList.map(f => f.id)));
    };

    // --- Массовые операции ---
    const applyBulk = (field) => {
        if (!bulkValue) return;
        const updates = {};
        selectedRows.forEach(floorId => {
            const key = `${currentBlock.fullId}_${floorId}`;
            // @ts-ignore
            const currentData = floorData[key] || {};
            updates[key] = { ...currentData, [field]: bulkValue };
        });
        // @ts-ignore
        setFloorData(prev => ({ ...prev, ...updates }));
    };

    const autoFill = () => { 
        const updates = {}; 
        floorList.forEach(f => { 
            const key = `${currentBlock.fullId}_${f.id}`; 
            let h = '3.00'; let s_proj = '500.00';
            if (f.type === 'basement') { h = '2.50'; s_proj = '450.00'; }
            if (f.type === 'parking_floor') { h = '2.70'; s_proj = '1000.00'; }
            // @ts-ignore
            if (f.type === 'technical') { h = '1.80'; s_proj = '480.00'; }
            // @ts-ignore
            if (f.type === 'loft') { h = '1.80'; s_proj = '480.00'; } 
            // @ts-ignore
            if (f.type === 'attic') { h = '2.70'; s_proj = '350.00'; }
            // @ts-ignore
            if (f.type === 'roof') { h = '0.00'; s_proj = '400.00'; }
            // @ts-ignore
            if (f.type === 'mixed') { h = '3.60'; s_proj = '550.00'; } 
            if (f.type === 'office') { h = '3.30'; s_proj = '600.00'; }
            // @ts-ignore
            if (!floorData[key]) { updates[key] = { height: h, areaProj: s_proj, areaFact: s_proj }; }
        }); 
        // @ts-ignore
        setFloorData(p => ({...p, ...updates})); 
    };

    // @ts-ignore
    const renderTypeBadge = (type) => {
        const styles = {
            residential: "bg-blue-50 text-blue-600 border-blue-100",
            mixed: "bg-violet-50 text-violet-600 border-violet-100", 
            technical: "bg-amber-50 text-amber-600 border-amber-100",
            basement: "bg-slate-100 text-slate-600 border-slate-200",
            tsokol: "bg-purple-50 text-purple-600 border-purple-100",
            attic: "bg-teal-50 text-teal-600 border-teal-100",
            loft: "bg-gray-100 text-gray-600 border-gray-200", 
            roof: "bg-sky-50 text-sky-600 border-sky-100",
            office: "bg-emerald-50 text-emerald-600 border-emerald-100",
            parking_floor: "bg-indigo-50 text-indigo-600 border-indigo-100"
        };
        const labels = {
            residential: "Жилой", mixed: "Коммерция", technical: "Технический",
            basement: "Подвал", tsokol: "Цоколь", attic: "Мансарда",
            loft: "Чердак", roof: "Кровля", office: "Нежилой", parking_floor: "Паркинг"
        };
        // @ts-ignore
        return <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${styles[type] || styles.residential}`}>{labels[type] || type}</span>;
    };
    
    return (
        <div className="space-y-6 pb-20 max-w-7xl mx-auto animate-in fade-in duration-500 relative">
             {/* Хедер */}
             <div className="flex items-center justify-between border-b border-slate-200 pb-6 mb-4">
                 <div className="flex gap-4 items-center">
                     <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><ArrowLeft size={24}/></button>
                     <div>
                         <h2 className="text-2xl font-bold text-slate-800 leading-tight">{building.label}</h2>
                         <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 items-center">
                             <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Внешняя инвентаризация</p>
                             <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded text-xs text-slate-600"><span className="font-bold text-slate-400 uppercase text-[9px]">Дом</span><span className="font-bold">{building.houseNumber}</span></div>
                             <div className="flex items-center gap-1.5 text-xs text-slate-600 pl-2 border-l border-slate-200"><span className="font-bold text-slate-400 uppercase text-[9px]">Тип</span><span className="font-medium">{building.type}</span></div>
                         </div>
                     </div>
                 </div>
                 <div className="flex gap-2">
                     <button onClick={autoFill} className="px-4 py-2 bg-purple-50 text-purple-600 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-purple-100 transition-colors shadow-sm"><Wand2 size={14}/> Автозаполнение</button>
                     <Button 
                        onClick={async () => { 
                            const specificData = {};
                            Object.keys(floorData).forEach(k => { if (k.startsWith(building.id)) specificData[k] = floorData[k]; });
                            await saveBuildingData(building.id, 'floorData', specificData);
                            await saveData(); 
                            onBack(); 
                        }} 
                        disabled={hasCriticalErrors} 
                        className={`shadow-lg ${hasCriticalErrors ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' : 'shadow-blue-200'}`}
                     >
                        <Save size={14}/> {hasCriticalErrors ? 'Заполните поля' : 'Готово'}
                     </Button>
                 </div>
             </div>

             {/* Вкладки блоков */}
             <div className="flex gap-2 p-1 bg-slate-100/80 backdrop-blur rounded-xl w-max overflow-x-auto">
                {blocksList.map((b,i) => (
                    <TabButton key={b.id} active={activeBlockIndex===i} onClick={()=>setActiveBlockIndex(i)}>{b.icon && <b.icon size={14} className="mr-1.5 opacity-70"/>}{b.tabLabel}</TabButton>
                ))}
            </div>

            {/* Плавающая панель массовых действий */}
            {selectedRows.size > 0 && (
                <div className="sticky top-4 z-50 mb-4 mx-auto max-w-2xl animate-in slide-in-from-top-4 fade-in duration-300">
                    <div className="bg-slate-900 text-white p-2 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700">
                        <div className="bg-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 flex items-center gap-2">
                            <CheckSquare size={14} className="text-blue-400"/>
                            Выбрано: {selectedRows.size}
                        </div>
                        <div className="h-6 w-px bg-slate-700"></div>
                        <Input 
                            value={bulkValue} 
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || (parseFloat(val) >= 0 && !val.includes('-'))) {
                                    setBulkValue(val);
                                }
                            }}
                            placeholder="Значение..." 
                            className="w-24 h-8 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 text-xs text-center focus:bg-slate-800"
                        />
                        <div className="flex gap-1">
                            <button onClick={() => applyBulk('height')} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold transition-colors">Высота</button>
                            <button onClick={() => applyBulk('areaProj')} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-bold transition-colors">S Проект</button>
                            <button onClick={() => applyBulk('areaFact')} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold transition-colors">S Факт</button>
                        </div>
                        <button onClick={() => setSelectedRows(new Set())} className="ml-auto p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"><X size={16}/></button>
                    </div>
                </div>
            )}

            <Card className="overflow-hidden shadow-xl border-0 ring-1 ring-slate-200 rounded-2xl">
                <div className="overflow-x-auto max-h-[70vh]"> 
                    <table className="w-full relative border-collapse">
                        <thead className="sticky top-0 z-30 shadow-md">
                            <tr className="text-[10px] text-slate-500 font-bold uppercase tracking-wider bg-slate-50 border-b border-slate-200">
                                {/* Чекбокс "Выбрать все" */}
                                <th className="p-3 w-10 text-center bg-slate-50 border-r border-slate-200 sticky left-0 z-40">
                                    <button onClick={toggleAll} className="text-slate-400 hover:text-blue-600 transition-colors">
                                        {selectedRows.size === floorList.length && floorList.length > 0 ? <CheckSquare size={16} className="text-blue-600"/> : <Square size={16}/>}
                                    </button>
                                </th>
                                <th className="p-4 text-left w-64 bg-slate-50 border-r border-slate-200 sticky left-10 z-40 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)]">Уровень / Этаж</th>
                                <th className="p-4 w-48 text-center bg-slate-50"><div className="flex items-center justify-center gap-1"><Ruler size={14}/> Высота (м)</div></th>
                                <th className="p-4 w-48 text-center bg-slate-50"><div className="flex items-center justify-center gap-1"><FileText size={14}/> S Проект (м²)</div></th>
                                <th className="p-4 w-48 text-center bg-slate-50"><div className="flex items-center justify-center gap-1"><Maximize2 size={14}/> S Факт (м²)</div></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {floorList.map((f, idx) => {
                                const key = `${currentBlock.fullId}_${f.id}`; 
                                const val = /** @type {import('../../lib/types').FloorData} */ (floorData[key] || {});
                                const isSelected = selectedRows.has(f.id);
                                
                                // ВАЛИДАЦИЯ ZOD
                                const validationResult = FloorDataSchema.safeParse(val);
                                const fieldErrors = validationResult.success ? {} : validationResult.error.flatten().fieldErrors;
                                
                                // Проверка расхождений (ИСПРАВЛЕНО: явное приведение к числу)
                                const p = parseFloat(String(val.areaProj));
                                const fact = parseFloat(String(val.areaFact));
                                const hasDiffWarning = !isNaN(p) && !isNaN(fact) && p > 0 && Math.abs(p - fact) / p * 100 > 15;

                                // @ts-ignore
                                const borderClass = f.isSeparator ? "border-b-[4px] border-slate-100" : "";
                                // @ts-ignore
                                const rowBg = isSelected ? "bg-blue-50/60" : f.isInserted ? "bg-amber-50/30" : "hover:bg-slate-50";

                                return (
                                    <tr key={f.id} className={`${rowBg} transition-colors group ${borderClass}`}>
                                        <td className="p-3 text-center border-r border-slate-100 sticky left-0 z-20 bg-inherit backdrop-blur-sm">
                                            <button onClick={() => toggleRow(f.id)} className="text-slate-300 hover:text-blue-600 transition-colors">
                                                {isSelected ? <CheckSquare size={16} className="text-blue-600"/> : <Square size={16}/>}
                                            </button>
                                        </td>

                                        <td className="p-4 border-r border-slate-100 sticky left-10 z-20 bg-inherit shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)]">
                                            <div className="flex flex-col gap-1.5 items-start">
                                                <div className="flex items-center gap-2">
                                                    {/* @ts-ignore */}
                                                    {f.isInserted && <ArrowUpFromLine size={12} className="text-amber-500"/>}
                                                    {/* @ts-ignore */}
                                                    <span className={`font-bold text-sm ${f.isInserted ? 'text-amber-700' : 'text-slate-700'}`}>{f.label}</span>
                                                </div>
                                                {renderTypeBadge(f.type)}
                                            </div>
                                        </td>

                                        {
                                            [
                                                { id: 'height', ph: '0.00', required: f.type !== 'roof' }, 
                                                { id: 'areaProj', ph: '0.00', required: true }, 
                                                { id: 'areaFact', ph: '0.00', required: false }
                                            ].map(field => {
                                                // @ts-ignore
                                                const error = fieldErrors[field.id];
                                                const isWarning = field.id === 'areaFact' && hasDiffWarning;
                                                // @ts-ignore
                                                const isEmpty = !val[field.id];
                                                const showRed = error || (field.required && isEmpty);

                                                let inputClass = "bg-transparent border-transparent text-slate-400 focus:bg-white focus:border-blue-500";
                                                // @ts-ignore
                                                if (val[field.id]) inputClass = "bg-white border-slate-200 text-slate-800 focus:border-blue-500";
                                                
                                                if (isWarning) inputClass = "bg-yellow-50 border-yellow-300 text-yellow-800 focus:border-yellow-500";
                                                if (showRed) inputClass = "bg-red-50 border-red-300 text-red-800 focus:border-red-500";
                                                
                                                return (
                                                    <td key={field.id} className="p-2 border-r border-slate-100 relative h-16 group/input">
                                                        <DebouncedInput 
                                                            // @ts-ignore
                                                            ref={el => inputsRef.current[`${idx}-${field.id}`] = el}
                                                            onKeyDown={(e) => handleKeyDown(e, idx, field.id)}
                                                            type="number" 
                                                            min="0"
                                                            step="0.01" 
                                                            className={`w-full h-12 text-center rounded-xl font-bold text-sm outline-none transition-all border-2 focus:ring-4 focus:ring-blue-100 ${inputClass}`} 
                                                            placeholder={field.ph} 
                                                            // @ts-ignore
                                                            value={val[field.id]} 
                                                            onChange={v => handleInput(f.id, field.id, v)} 
                                                        />
                                                        {error && (<div className="absolute bottom-1 left-0 right-0 text-[9px] text-center text-red-500 font-bold pointer-events-none animate-in fade-in slide-in-from-top-1">{error}</div>)}
                                                        {isWarning && (<div className="absolute top-1 right-1 text-yellow-500" title="Расхождение > 15%"><AlertCircle size={12}/></div>)}
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
        </div>
    );
}