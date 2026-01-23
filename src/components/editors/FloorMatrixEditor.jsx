import React, { useState, useMemo, useCallback } from 'react';
import { 
  ArrowLeft, Save, Wand2, ArrowUp, ChevronsDown, 
  Layers, Ruler, Maximize2, FileText, ArrowUpFromLine, AlertCircle,
  Building2, Store, Car, Box, Warehouse, Tent
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, DebouncedInput, TabButton, Button } from '../ui/UIKit';
import { getBlocksList } from '../../lib/utils';

const PARKING_TYPE_LABELS = {
    capital: "Капитальный",
    light: "Легкие конструкции",
    open: "Открытый"
};

/**
 * @param {{ buildingId: string, onBack: () => void }} props
 */
export default function FloorMatrixEditor({ buildingId, onBack }) {
    const { composition, buildingDetails, floorData, setFloorData, saveBuildingData, saveData } = useProject();
    const [activeBlockIndex, setActiveBlockIndex] = useState(0);

    const building = composition.find(c => c.id === buildingId);

    // --- ПРОВЕРКА НА ТИП ПАРКИНГА ---
    const isParking = building?.category === 'parking_separate';
    const isInfrastructure = building?.category === 'infrastructure';
    const isUndergroundParking = isParking && building?.parkingType === 'underground';
    
    const isExcludedType = isParking && (building.constructionType === 'open' || building.constructionType === 'light');

    const blocksList = useMemo(() => getBlocksList(building), [building]);
    const currentBlock = blocksList[activeBlockIndex];

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
    
    const detailsKey = `${building.id}_${currentBlock.id}`;
    // @ts-ignore
    const blockDetails = buildingDetails[detailsKey] || {};
    // @ts-ignore
    const basements = buildingDetails[`${building.id}_features`]?.basements || [];

    const stylobateHeight = useMemo(() => {
        if (currentBlock.type !== 'Ж') return 0;
        let maxH = 0;
        blocksList.forEach(b => {
            if (b.type === 'Н') {
                const key = `${building.id}_${b.id}`;
                // @ts-ignore
                const details = buildingDetails[key];
                if (details?.parentBlocks?.includes(currentBlock.id)) {
                    const h = details.floorsTo || 0;
                    if (h > maxH) maxH = h;
                }
            }
        });
        return maxH;
    }, [blocksList, buildingDetails, currentBlock, building.id]);
    
    const floorList = useMemo(() => { 
        const list = []; 
        
        if (isUndergroundParking) {
            const depth = blockDetails.levelsDepth || 1;
            for (let i = 1; i <= depth; i++) {
                list.push({ id: `level_minus_${i}`, label: `Уровень -${i}`, type: 'basement', index: -i, sortOrder: -i });
            }
            return list.sort((a,b) => b.sortOrder - a.sortOrder); 
        }

        // @ts-ignore
        const currentBlockBasements = basements.filter(b => b.blocks?.includes(currentBlock.id));
        const hasMultipleBasements = currentBlockBasements.length > 1;

        // @ts-ignore
        currentBlockBasements.forEach((b, bIdx) => { 
            const depth = parseInt(String(b.depth || '1'), 10);
            for(let d = depth; d >= 1; d--) {
                let label = `Подвал (этаж -${d})`;
                if (hasMultipleBasements) label = `Подвал ${bIdx + 1} (этаж -${d})`;
                
                // ИСПРАВЛЕНИЕ: Принудительное приведение к Number для сортировки
                const sortVal = -1000 - Number(d) + (Number(bIdx) * 0.1);
                
                list.push({ id: `base_${b.id}_L${d}`, label: label, type: 'basement', isSeparator: d === 1, sortOrder: sortVal }); 
            }
        }); 
        
        if(blockDetails.hasBasementFloor) {
            list.push({ id: 'tsokol', label: 'Цокольный этаж', type: 'tsokol', isSeparator: true, sortOrder: -100 }); 
        }
        
        let start = 1;
        let end = 1;

        if (building.category === 'parking_separate' || building.category === 'infrastructure') {
            start = 1;
            end = blockDetails.floorsCount || 1;
        } else {
            start = blockDetails.floorsFrom || 1;
            end = blockDetails.floorsTo || 1;
        }
        
        for(let i = start; i <= end; i++) { 
            if (currentBlock.type === 'Ж' && i <= stylobateHeight) continue;

            let type = 'residential'; 
            if (currentBlock.type === 'Н') type = 'office'; 
            if (building.category === 'parking_separate') type = 'parking_floor';
            if (building.category === 'infrastructure') type = 'office';
            // @ts-ignore
            if (currentBlock.type === 'Ж' && blockDetails.commercialFloors?.includes(i)) type = 'mixed';

            // ИСПРАВЛЕНИЕ: Принудительное приведение к Number
            list.push({ id: `floor_${i}`, label: `${i} этаж`, index: i, type: type, sortOrder: Number(i) * 10 }); 
            
            // @ts-ignore
            if (blockDetails.technicalFloors?.includes(i)) {
                // ИСПРАВЛЕНИЕ: Принудительное приведение к Number
                list.push({ id: `floor_${i}_tech`, label: `${i}-Т (Технический)`, index: i, type: 'technical', isInserted: true, sortOrder: (Number(i) * 10) + 5 });
            }
        } 
        
        if(blockDetails.hasAttic) list.push({ id: 'attic', label: 'Мансарда', type: 'attic', sortOrder: 50000 }); 
        if(blockDetails.hasLoft) list.push({ id: 'loft', label: 'Чердак', type: 'loft', sortOrder: 55000 }); 
        if(blockDetails.hasExploitableRoof) list.push({ id: 'roof', label: 'Эксплуатируемая кровля', type: 'roof', sortOrder: 60000 }); 

        return list.sort((a,b) => a.sortOrder - b.sortOrder); 
    }, [currentBlock, blockDetails, basements, building, isUndergroundParking, stylobateHeight]);
    
    /** @type {(floorId: string, field: string, value: any) => void} */
    const handleInput = useCallback((floorId, field, value) => { 
        const key = `${currentBlock.fullId}_${floorId}`; 
        // @ts-ignore
        setFloorData(p => ({...p, [key]: { ...(p[key]||{}), [field]: value } })); 
    }, [currentBlock.fullId, setFloorData]);

    /** @type {(floorType: string, field: string, value: any, allValues: any) => string | null} */
    const getValidationError = (floorType, field, value, allValues) => {
        const numVal = parseFloat(String(value));
        if (isNaN(numVal) && value !== '') return null;
        if (value === '') return null; 

        if (field === 'height') {
            if (floorType === 'roof') { if (numVal < 0) return "Не меньше 0"; } else { if (numVal < 1.8) return "Мин. 1.8 м"; }
            if (numVal > 6.0) return "Макс. 6.0 м"; 
        }
        if (field === 'areaProj' || field === 'areaFact') { if (numVal <= 0) return "> 0"; }
        if (field === 'areaFact' || field === 'areaProj') {
            const proj = field === 'areaProj' ? numVal : parseFloat(allValues?.areaProj);
            const fact = field === 'areaFact' ? numVal : parseFloat(allValues?.areaFact);
            if (proj > 0 && fact > 0) {
                const diffPercent = Math.abs(proj - fact) / proj * 100;
                if (diffPercent > 15) return "warning_diff";
            }
        }
        return null;
    };

    const hasCriticalErrors = useMemo(() => {
        for (const f of floorList) {
            const key = `${currentBlock.fullId}_${f.id}`;
            // @ts-ignore
            const val = floorData[key] || {};
            // @ts-ignore
            if (getValidationError(f.type, 'height', val.height, val) && getValidationError(f.type, 'height', val.height, val) !== 'warning_diff') return true;
            // @ts-ignore
            if (getValidationError(f.type, 'areaProj', val.areaProj, val) && getValidationError(f.type, 'areaProj', val.areaProj, val) !== 'warning_diff') return true;
            // @ts-ignore
            if (getValidationError(f.type, 'areaFact', val.areaFact, val) && getValidationError(f.type, 'areaFact', val.areaFact, val) !== 'warning_diff') return true;
        }
        return false;
    }, [floorList, floorData, currentBlock.fullId]);

    // @ts-ignore
    const copyFromPrev = (idx) => { 
        if (idx <= 0) return; 
        const currentFloor = floorList[idx]; 
        const prevFloor = floorList[idx - 1]; 
        const currentKey = `${currentBlock.fullId}_${currentFloor.id}`; 
        const prevKey = `${currentBlock.fullId}_${prevFloor.id}`; 
        // @ts-ignore
        const dataToCopy = floorData[prevKey] || {}; 
        // @ts-ignore
        setFloorData(prev => ({...prev, [currentKey]: { ...prev[currentKey], ...dataToCopy }})); 
    };

    // @ts-ignore
    const fillRest = (idx) => { 
        const sourceFloor = floorList[idx]; 
        const sourceKey = `${currentBlock.fullId}_${sourceFloor.id}`; 
        // @ts-ignore
        const sourceData = floorData[sourceKey] || {}; 
        const updates = {}; 
        for(let i = idx + 1; i < floorList.length; i++) { 
            const targetFloor = floorList[i]; 
            // @ts-ignore
            updates[`${currentBlock.fullId}_${targetFloor.id}`] = { ...sourceData }; 
        } 
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
        <div className="space-y-6 pb-20 max-w-7xl mx-auto animate-in fade-in duration-500">
             <div className="flex items-center justify-between border-b border-slate-200 pb-6 mb-4">
                 <div className="flex gap-4 items-center">
                     <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><ArrowLeft size={24}/></button>
                     <div>
                         <h2 className="text-2xl font-bold text-slate-800 leading-tight">{building.label}</h2>
                         <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 items-center">
                             <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Внешняя инвентаризация</p>
                             <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded text-xs text-slate-600"><span className="font-bold text-slate-400 uppercase text-[9px]">Дом</span><span className="font-bold">{building.houseNumber}</span></div>
                             <div className="flex items-center gap-1.5 text-xs text-slate-600 pl-2 border-l border-slate-200"><span className="font-bold text-slate-400 uppercase text-[9px]">Тип</span><span className="font-medium">{building.type}</span></div>
                             {isParking && (<div className="flex items-center gap-1.5 text-xs text-slate-600 pl-2 border-l border-slate-200"><span className="font-bold text-slate-400 uppercase text-[9px]">Вид</span><span className="font-medium">{isUndergroundParking ? 'Подземный' : 'Наземный'}{building.constructionType && ` • ${PARKING_TYPE_LABELS[building.constructionType] || building.constructionType}`}</span></div>)}
                             {isInfrastructure && (<div className="flex items-center gap-1.5 text-xs text-slate-600 pl-2 border-l border-slate-200"><span className="font-bold text-slate-400 uppercase text-[9px]">Вид</span><span className="font-medium">{building.infraType || 'Не указан'}</span></div>)}
                         </div>
                     </div>
                 </div>
                 <div className="flex gap-2">
                     <button onClick={autoFill} className="px-4 py-2 bg-purple-50 text-purple-600 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-purple-100 transition-colors shadow-sm"><Wand2 size={14}/> Автозаполнение</button>
                     
                     {/* ОБНОВЛЕНО: Используем async/await и saveBuildingData */}
                     <Button 
                        onClick={async () => { 
                            const specificData = {};
                            Object.keys(floorData).forEach(k => {
                                if (k.startsWith(building.id)) {
                                    // @ts-ignore
                                    specificData[k] = floorData[k];
                                }
                            });

                            await saveBuildingData(building.id, 'floorData', specificData);
                            await saveData(); 
                            
                            onBack(); 
                        }} 
                        disabled={hasCriticalErrors} 
                        className={`shadow-lg ${hasCriticalErrors ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' : 'shadow-blue-200'}`}
                     >
                        <Save size={14}/> {hasCriticalErrors ? 'Исправьте ошибки' : 'Готово'}
                     </Button>
                 </div>
             </div>

             <div className="space-y-6">
                <div className="flex gap-2 p-1 bg-slate-100/80 backdrop-blur rounded-xl w-max overflow-x-auto">
                    {blocksList.map((b,i) => (
                        <TabButton key={b.id} active={activeBlockIndex===i} onClick={()=>setActiveBlockIndex(i)}>{b.icon && <b.icon size={14} className="mr-1.5 opacity-70"/>}{b.tabLabel}</TabButton>
                    ))}
                </div>

                <Card className="overflow-hidden shadow-xl border-0 ring-1 ring-slate-200 rounded-2xl">
                    <div className="overflow-x-auto"> 
                        <table className="w-full relative border-collapse">
                            <thead>
                                <tr className="text-[10px] text-slate-500 font-bold uppercase tracking-wider bg-slate-50 border-b border-slate-200">
                                    <th className="p-4 text-left w-64">Уровень / Этаж</th>
                                    <th className="p-4 w-48 text-center"><div className="flex items-center justify-center gap-1"><Ruler size={14}/> Высота (м)</div></th>
                                    <th className="p-4 w-48 text-center"><div className="flex items-center justify-center gap-1"><FileText size={14}/> S Проект (м²)</div></th>
                                    <th className="p-4 w-48 text-center"><div className="flex items-center justify-center gap-1"><Maximize2 size={14}/> S Факт (м²)</div></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {floorList.map((f, idx) => {
                                    const key = `${currentBlock.fullId}_${f.id}`; 
                                    // @ts-ignore
                                    const val = floorData[key] || {};
                                    // @ts-ignore
                                    const borderClass = f.isSeparator ? "border-b-[4px] border-slate-100" : "border-b border-slate-50";
                                    // @ts-ignore
                                    const rowBg = f.isInserted ? "bg-amber-50/30" : "hover:bg-slate-50";

                                    return (
                                        <tr key={f.id} className={`${rowBg} transition-colors group ${borderClass}`}>
                                            <td className="p-4 border-r border-slate-100 relative group/cell">
                                                <div className="flex flex-col gap-1.5 items-start">
                                                    <div className="flex items-center gap-2">
                                                        {/* @ts-ignore */}
                                                        {f.isInserted && <ArrowUpFromLine size={12} className="text-amber-500"/>}
                                                        {/* @ts-ignore */}
                                                        <span className={`font-bold text-sm ${f.isInserted ? 'text-amber-700' : 'text-slate-700'}`}>{f.label}</span>
                                                    </div>
                                                    {renderTypeBadge(f.type)}
                                                </div>
                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/cell:opacity-100 flex flex-col gap-1 z-10">
                                                    {idx > 0 && <button onClick={() => copyFromPrev(idx)} title="Скопировать выше" className="p-1 bg-white border border-slate-200 rounded shadow-sm text-slate-400 hover:text-blue-600"><ArrowUp size={12}/></button>}
                                                    <button onClick={() => fillRest(idx)} title="Применить ниже" className="p-1 bg-white border border-slate-200 rounded shadow-sm text-slate-400 hover:text-blue-600"><ChevronsDown size={12}/></button>
                                                </div>
                                            </td>
                                            {[{ id: 'height', ph: '0.00' }, { id: 'areaProj', ph: '0.00' }, { id: 'areaFact', ph: '0.00' }].map(field => {
                                                // @ts-ignore
                                                const error = getValidationError(f.type, field.id, val[field.id], val);
                                                const isWarning = error === "warning_diff";
                                                const isCritical = error && !isWarning;
                                                let inputClass = "bg-transparent border-transparent text-slate-400 focus:bg-white focus:border-blue-500";
                                                if (val[field.id]) inputClass = "bg-white border-slate-200 text-slate-800 focus:border-blue-500";
                                                if (isWarning) inputClass = "bg-yellow-50 border-yellow-300 text-yellow-800 focus:border-yellow-500";
                                                if (isCritical) inputClass = "bg-red-50 border-red-300 text-red-800 focus:border-red-500";
                                                return (
                                                    <td key={field.id} className="p-2 border-r border-slate-100 relative h-16 group/input">
                                                        <DebouncedInput type="number" step="0.01" className={`w-full h-12 text-center rounded-xl font-bold text-sm outline-none transition-all border-2 ${inputClass}`} placeholder={field.ph} value={val[field.id]} onChange={v => handleInput(f.id, field.id, v)} />
                                                        {error && error !== "warning_diff" && (<div className="absolute bottom-1 left-0 right-0 text-[9px] text-center text-red-500 font-bold pointer-events-none animate-in fade-in slide-in-from-top-1">{error}</div>)}
                                                        {isWarning && (<div className="absolute top-1 right-1 text-yellow-500" title="Расхождение > 15%"><AlertCircle size={12}/></div>)}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    );
}