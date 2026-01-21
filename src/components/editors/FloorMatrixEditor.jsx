import React, { useState, useMemo, useCallback } from 'react';
import { 
  ArrowLeft, Save, Wand2, ArrowUp, ChevronsDown 
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, DebouncedInput, TabButton, Button } from '../ui/UIKit';

// Утилита для получения списка блоков
function getBlocksList(building) {
    if (!building) return [];
    const list = [];
    if (building.category && building.category.includes('residential')) {
        for(let i=0; i<(building.resBlocks || 0); i++) {
            list.push({ id: `res_${i}`, type: 'Ж', index: i, fullId: `${building.id}_res_${i}` });
        }
    }
    if (building.category === 'parking_separate') {
         list.push({ id: 'main', type: 'Паркинг', index: 0, fullId: `${building.id}_main` });
    } else if (building.category === 'infrastructure') {
         list.push({ id: 'main', type: 'Инфра', index: 0, fullId: `${building.id}_main` });
    } else {
         for(let i=0; i<(building.nonResBlocks || 0); i++) {
             list.push({ id: `non_${i}`, type: 'Н', index: i, fullId: `${building.id}_non_${i}` });
         }
    }
    // Если блоков нет (fallback), создаем основной
    if (list.length === 0) {
        list.push({ id: 'main', type: 'Основной', index: 0, fullId: `${building.id}_main` });
    }
    return list;
}

export default function FloorMatrixEditor({ buildingId, onBack }) {
    const { composition, buildingDetails, floorData, setFloorData, saveData } = useProject();
    const [activeBlockIndex, setActiveBlockIndex] = useState(0);

    // 1. Ищем здание
    const building = composition.find(c => c.id === buildingId);
    
    // --- ЗАЩИТА ОТ КРАША (ЕСЛИ ЗДАНИЕ НЕ НАЙДЕНО) ---
    if (!building) {
        return (
            <div className="p-12 text-center text-slate-500">
                <p>Здание не найдено или удалено.</p>
                <button onClick={onBack} className="text-blue-600 font-bold mt-2 hover:underline">Вернуться назад</button>
            </div>
        );
    }

    // 2. Получаем список блоков
    const blocksList = useMemo(() => getBlocksList(building), [building]);
    const currentBlock = blocksList[activeBlockIndex];

    // --- ЗАЩИТА ОТ КРАША (ЕСЛИ БЛОКИ НЕ СГЕНЕРИРОВАЛИСЬ) ---
    if (!currentBlock) {
        return (
            <div className="p-12 text-center text-slate-500">
                <p>Нет блоков для настройки.</p>
                <button onClick={onBack} className="text-blue-600 font-bold mt-2 hover:underline">Вернуться назад</button>
            </div>
        );
    }
    
    // 3. Теперь безопасно получаем детали
    const blockDetails = buildingDetails[`${building.id}_${currentBlock.id}`] || {};
    const basements = buildingDetails[`${building.id}_features`]?.basements || [];
    
    // Генерируем список этажей для таблицы
    const floorList = useMemo(() => { 
        const list = []; 
        
        // Подвалы
        basements.filter(b => b.blocks?.includes(currentBlock.id)).forEach(b => { 
            for(let d=b.depth; d>=1; d--) list.push({ id: `base_${b.id}_L${d}`, label: `Подвал -${d}`, type: 'basement', sortOrder: -100-d }); 
        }); 
        
        // Цоколь
        if(blockDetails.hasBasementFloor) list.push({ id: 'floor_0', label: 'Цоколь', type: 'basement_floor', sortOrder: 0 }); 
        
        // Наземные этажи
        const isResidential = currentBlock.type === 'Ж' || (currentBlock.type === 'Основной' && building.category.includes('residential'));
        const startFloor = blockDetails.floorsFrom || 1;
        const endFloor = blockDetails.floorsTo || 1;
        
        for(let i=startFloor; i<=endFloor; i++) { 
            const isTech = blockDetails.technicalFloors?.includes(i); 
            const isComm = blockDetails.commercialFloors?.includes(i); 
            const floorType = (!isResidential || isComm) ? 'comm' : 'res';
            
            list.push({ id: `floor_${i}`, label: `${i} этаж`, index: i, type: floorType, sortOrder: i }); 
        } 
        
        if(blockDetails.hasAttic) list.push({id:'attic', label:'Мансарда', type:'attic', sortOrder: 1000}); 
        if(blockDetails.hasTechnicalFloor && blockDetails.technicalFloors?.includes(endFloor + 1)) {
             list.push({id:`floor_${endFloor+1}_tech`, label:`${endFloor+1} (Тех)`, type:'tech', sortOrder: 1001});
        }

        return list.sort((a,b)=>a.sortOrder-b.sortOrder); 
    }, [currentBlock, blockDetails, basements, building]);
    
    const handleInput = useCallback((floorId, field, value) => { 
        const key = `${currentBlock.fullId}_${floorId}`; 
        setFloorData(p => ({...p, [key]: { ...(p[key]||{}), [field]: value } })); 
    }, [currentBlock.fullId, setFloorData]);

    const copyFromPrev = (idx) => { 
        if (idx <= 0) return; 
        const currentFloor = floorList[idx]; 
        const prevFloor = floorList[idx - 1]; 
        const currentKey = `${currentBlock.fullId}_${currentFloor.id}`; 
        const prevKey = `${currentBlock.fullId}_${prevFloor.id}`; 
        const dataToCopy = floorData[prevKey] || {}; 
        setFloorData(prev => ({...prev, [currentKey]: { ...dataToCopy }})); 
    };

    const fillRest = (idx) => { 
        const sourceFloor = floorList[idx]; 
        const sourceKey = `${currentBlock.fullId}_${sourceFloor.id}`; 
        const sourceData = floorData[sourceKey] || {}; 
        const updates = {}; 
        for(let i = idx + 1; i < floorList.length; i++) { 
            const targetFloor = floorList[i]; 
            updates[`${currentBlock.fullId}_${targetFloor.id}`] = { ...sourceData }; 
        } 
        setFloorData(prev => ({ ...prev, ...updates })); 
    };

    const autoFill = () => { 
        const updates = {}; 
        floorList.forEach(f => { 
            const key = `${currentBlock.fullId}_${f.id}`; 
            updates[key] = { 
                height: f.type === 'res' ? '3.0' : '3.6', 
                areaProj: (Math.random()*50+400).toFixed(2), 
                areaFact: (Math.random()*50+400).toFixed(2) 
            }; 
        }); 
        setFloorData(p => ({...p, ...updates})); 
    };
    
    return (
        <div className="space-y-6 pb-20 max-w-7xl mx-auto animate-in fade-in duration-500">
             <div className="flex items-center justify-between border-b border-slate-200 pb-6 mb-4">
                 <div className="flex gap-4 items-center">
                     <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><ArrowLeft size={24}/></button>
                     <div>
                         <h2 className="text-2xl font-bold text-slate-800">{building.label}</h2>
                         <p className="text-slate-400 text-xs font-bold uppercase">Внешняя инвентаризация блоков</p>
                     </div>
                 </div>
                 <div className="flex gap-2">
                     <button onClick={autoFill} className="px-4 py-2 bg-purple-50 text-purple-600 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-purple-100 transition-colors">
                         <Wand2 size={14}/> Автозаполнение
                     </button>
                     <Button onClick={() => { saveData(); onBack(); }}>
                         <Save size={14}/> Готово
                     </Button>
                 </div>
             </div>

             <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex gap-2 p-1 bg-slate-100/80 backdrop-blur rounded-xl w-max overflow-x-auto">
                        {blocksList.map((b,i) => (
                            <TabButton key={b.id} active={activeBlockIndex===i} onClick={()=>setActiveBlockIndex(i)}>
                                Блок {i+1} ({b.type})
                            </TabButton>
                        ))}
                    </div>
                </div>

                <Card className="overflow-hidden shadow-lg border-0 ring-1 ring-slate-200">
                    <div className="overflow-x-auto max-h-[calc(100vh-300px)]"> 
                        <table className="w-full relative border-collapse">
                            <thead className="sticky top-0 z-20 bg-white shadow-sm ring-1 ring-slate-100">
                                <tr className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                    <th className="p-4 text-left w-48 bg-slate-50/95 backdrop-blur">Этаж</th>
                                    <th className="p-4 w-40 bg-slate-50/95 backdrop-blur text-center">Высота (м)</th>
                                    <th className="p-4 w-40 bg-slate-50/95 backdrop-blur text-center">S Проект (м²)</th>
                                    <th className="p-4 w-40 bg-slate-50/95 backdrop-blur text-center">S Факт (м²)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {floorList.map((f, idx) => {
                                    const key = `${currentBlock.fullId}_${f.id}`; 
                                    let badgeColor = "text-slate-400 bg-slate-100";
                                    let labelText = f.type;
                                    if(f.type === 'res') { badgeColor = "text-blue-500 bg-blue-50"; labelText = "Жилой"; }
                                    if(f.type === 'comm') { badgeColor = "text-amber-600 bg-amber-50"; labelText = "Коммерция"; }
                                    if(f.type === 'tech') { badgeColor = "text-slate-500 bg-slate-200"; labelText = "Технический"; }
                                    if(f.type === 'basement') { badgeColor = "text-indigo-500 bg-indigo-50"; labelText = "Подвал"; }

                                    return (
                                        <tr key={f.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="p-4 font-bold text-sm text-slate-700 border-r relative group/cell">
                                                <div className="flex flex-col">
                                                    <span>{f.label}</span>
                                                    <span className={`text-[9px] font-bold uppercase tracking-wide w-fit px-1.5 py-0.5 rounded mt-1 ${badgeColor}`}>
                                                        {labelText}
                                                    </span>
                                                </div>
                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/cell:opacity-100 flex gap-1 bg-white shadow-sm border border-slate-200 rounded-lg p-0.5 transition-all z-10">
                                                    {idx > 0 && (
                                                        <button onClick={() => copyFromPrev(idx)} title="Копировать с предыдущего" className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600 transition-colors">
                                                            <ArrowUp size={14}/>
                                                        </button>
                                                    )}
                                                    <button onClick={() => fillRest(idx)} title="Применить ко всем ниже" className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600 transition-colors">
                                                        <ChevronsDown size={14}/>
                                                    </button>
                                                </div>
                                            </td>
                                            {['height', 'areaProj', 'areaFact'].map(field => (
                                                <td key={field} className="p-0 border-r relative h-14">
                                                    <div className="absolute inset-1">
                                                        <DebouncedInput 
                                                            type="number" 
                                                            step="0.01" 
                                                            className="w-full h-full text-center bg-slate-50 hover:bg-white focus:bg-white border-transparent focus:border-blue-500 rounded-lg text-sm font-semibold transition-all outline-none border-2 placeholder:text-slate-300" 
                                                            placeholder="0.00" 
                                                            value={floorData[key]?.[field]} 
                                                            onChange={val=>handleInput(f.id, field, val)}
                                                        />
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
            </div>
        </div>
    );
}