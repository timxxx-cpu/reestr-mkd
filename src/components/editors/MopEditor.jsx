import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, Save, Wand2, Plus, X, ArrowDown, ArrowRight as ArrowRightIcon, Armchair 
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, DebouncedInput, TabButton, Button, Select } from '../ui/UIKit';

// Справочник типов
const MOP_TYPES = [
    'Лестничная клетка', 'Межквартирный коридор', 'Лифтовой холл', 'Тамбур', 'Вестибюль', 
    'Колясочная', 'Комната охраны', 'Санузел', 'ПУИ (Уборочная)', 'Электрощитовая', 
    'Слаботочная ниша', 'Мусорокамера', 'Техническое подполье', 'Технический этаж', 
    'Венткамера', 'ИТП', 'Насосная', 'Машинное отделение лифтов', 'Кровля', 
    'Паркинг (зона проезда)', 'Рампа', 'Другое'
];

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
    }
    // Если блоков нет, но это жилой дом
    if (list.length === 0 && building.category.includes('residential')) {
        list.push({ id: 'main', type: 'Основной', index: 0, fullId: `${building.id}_main` });
    }
    return list;
}

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

export default function MopEditor({ buildingId, onBack }) {
    const { composition, buildingDetails, mopData, setMopData, saveData } = useProject();
    const [activeBlockIndex, setActiveBlockIndex] = useState(0);

    // 1. Получаем здание
    const building = composition.find(c => c.id === buildingId);
    if (!building) return <div className="p-8 text-center text-slate-500">Здание не найдено</div>;

    // 2. Блоки
    const blocksList = useMemo(() => getBlocksList(building), [building]);
    const currentBlock = blocksList[activeBlockIndex];

    if (!currentBlock) return <div className="p-8 text-center text-slate-500">Нет блоков для настройки МОП</div>;

    // 3. Детали и этажи
    const blockDetails = buildingDetails[`${building.id}_${currentBlock.id}`] || {};
    const isParking = currentBlock.type === 'Паркинг';
    const entrances = isParking ? [0] : Array.from({length: blockDetails.entrances||1}, (_, i) => i+1);
    const basements = buildingDetails[`${building.id}_features`]?.basements || [];

    const floorList = useMemo(() => { 
        const list = []; 
        // Подвалы
        basements.filter(b => b.blocks?.includes(currentBlock.id)).forEach(b => { 
            for(let d=b.depth; d>=1; d--) {
                list.push({ id: `base_${b.id}_L${d}`, label: `Подвал -${d}`, type: 'basement', sortOrder: -100-d }); 
            }
        });
        // Наземные
        const from = blockDetails.floorsFrom || 1;
        const to = blockDetails.floorsTo || 1;
        
        // Цоколь если есть
        if (blockDetails.hasBasementFloor) list.push({ id: 'floor_0', label: 'Цоколь', type: 'basement_floor', sortOrder: 0 });

        for(let i=from; i<=to; i++) {
             list.push({ id: `floor_${i}`, label: `${i} этаж`, type: 'floor', sortOrder: i });
        }
        return list.sort((a,b)=>a.sortOrder-b.sortOrder); 
    }, [currentBlock, blockDetails, basements, building]);

    // --- Логика данных (Динамический список) ---

    const getMops = (ent, floorId) => {
        const key = `${currentBlock.fullId}_e${ent}_f${floorId}_mops`;
        return mopData[key] || [];
    };

    const setMops = (ent, floorId, newMops) => {
        const key = `${currentBlock.fullId}_e${ent}_f${floorId}_mops`;
        setMopData(prev => ({ ...prev, [key]: newMops }));
    };

    const addMop = (ent, floorId) => {
        const current = getMops(ent, floorId);
        // Добавляем новый элемент. По умолчанию - первый тип из списка
        const newMop = { id: generateId(), type: MOP_TYPES[0], area: '' };
        setMops(ent, floorId, [...current, newMop]);
    };

    const removeMop = (ent, floorId, mopId) => {
        const current = getMops(ent, floorId);
        setMops(ent, floorId, current.filter(m => m.id !== mopId));
    };

    const updateMop = (ent, floorId, mopId, field, val) => {
        const current = getMops(ent, floorId);
        const updated = current.map(m => m.id === mopId ? { ...m, [field]: val } : m);
        setMops(ent, floorId, updated);
    };

    // --- Функции копирования ---

    // Копировать ВНИЗ (на все этажи ниже текущего)
    const copyDown = (ent, startIdx) => { 
        const srcFloorId = floorList[startIdx].id; 
        const src = getMops(ent, srcFloorId); 
        const updates = {}; 
        
        for(let i=startIdx+1; i<floorList.length; i++) { 
            const targetFloorId = floorList[i].id;
            // Генерируем новые ID для скопированных элементов, чтобы они были независимы
            updates[`${currentBlock.fullId}_e${ent}_f${targetFloorId}_mops`] = src.map(m=>({...m, id: generateId()})); 
        } 
        setMopData(p=>({...p, ...updates})); 
    };
    
    // Копировать ВПРАВО (в другие подъезды на том же этаже)
    const copyRight = (floorId, srcEnt) => { 
        const src = getMops(srcEnt, floorId); 
        const updates = {}; 
        entrances.forEach(e => { 
            if(e !== srcEnt) {
                updates[`${currentBlock.fullId}_e${e}_f${floorId}_mops`] = src.map(m=>({...m, id: generateId()})); 
            }
        }); 
        setMopData(p=>({...p, ...updates})); 
    };
    
    // Авто-генерация (Типовой этаж)
    const autoFillMops = () => { 
        const updates = {}; 
        floorList.forEach(f => { 
            entrances.forEach(e => { 
                const types = isParking 
                    ? ['Паркинг (зона проезда)', 'Рампа'] 
                    : ['Лифтовой холл', 'Лестничная клетка', 'Межквартирный коридор']; 
                
                const mops = types.map((t, i) => ({ 
                    id: generateId(), 
                    type: t, 
                    area: (15 + i*10).toString() 
                })); 
                updates[`${currentBlock.fullId}_e${e}_f${f.id}_mops`] = mops; 
            }); 
        }); 
        setMopData(p => ({...p, ...updates})); 
    };

    return (
        <div className="space-y-6 pb-20 max-w-full mx-auto animate-in fade-in duration-500">
            <div className="flex items-center justify-between border-b border-slate-200 pb-6 mb-4">
                <div className="flex gap-4 items-center">
                    <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><ArrowLeft size={24}/></button>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">{building.label}</h2>
                        <p className="text-slate-400 text-xs font-bold uppercase">Инвентаризация МОП</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={autoFillMops} className="px-4 py-2 bg-purple-50 text-purple-600 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-purple-100 transition-colors">
                        <Wand2 size={14}/> Авто-генерация
                    </button>
                    <Button onClick={() => { saveData(); onBack(); }}>
                        <Save size={14}/> Готово
                    </Button>
                </div>
            </div>

            <div className="flex gap-2 mb-4">
                 {blocksList.map((b,i) => (
                     <TabButton key={b.id} active={activeBlockIndex===i} onClick={()=>setActiveBlockIndex(i)}>
                         {b.type==='Паркинг'?'Паркинг':`Блок ${i+1}`}
                     </TabButton>
                 ))}
            </div>

            <Card className="overflow-x-auto shadow-lg border-0 ring-1 ring-slate-200">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 font-bold uppercase">
                        <tr>
                            <th className="p-4 w-32 sticky left-0 bg-slate-50 border-r z-10">Этаж</th>
                            {entrances.map(e => (
                                <th key={e} className="p-4 min-w-[320px] border-r">
                                    {isParking ? 'Зона паркинга' : `Подъезд ${e}`}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {floorList.map((f, floorIdx) => (
                            <tr key={f.id} className="group hover:bg-slate-50/50">
                                {/* Колонка этажа */}
                                <td className="p-4 font-bold text-xs sticky left-0 bg-white border-r align-top relative z-10">
                                    {f.label}
                                </td>

                                {/* Колонки подъездов */}
                                {entrances.map(e => {
                                    const mops = getMops(e, f.id);
                                    
                                    return (
                                        <td key={e} className="p-3 align-top border-r relative group/cell">
                                            <div className="flex flex-col gap-2 mb-2">
                                                {mops.map((m) => (
                                                    <div key={m.id} className="flex gap-1 items-center bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                                                        {/* Выбор типа */}
                                                        <select 
                                                            className="bg-transparent text-[10px] font-bold w-40 outline-none truncate cursor-pointer" 
                                                            value={m.type} 
                                                            onChange={ev=>updateMop(e, f.id, m.id, 'type', ev.target.value)}
                                                            title={m.type}
                                                        >
                                                            {MOP_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                                                        </select>
                                                        
                                                        {/* Ввод площади */}
                                                        <DebouncedInput 
                                                            type="number" 
                                                            className="w-16 bg-slate-50 border border-slate-100 rounded px-1 py-0.5 text-[10px] font-medium text-center focus:bg-blue-50 focus:border-blue-200 outline-none transition-colors" 
                                                            placeholder="S м²" 
                                                            value={m.area} 
                                                            onChange={val=>updateMop(e, f.id, m.id, 'area', val)} 
                                                        />
                                                        
                                                        {/* Удалить */}
                                                        <button 
                                                            onClick={()=>removeMop(e, f.id, m.id)} 
                                                            className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                        >
                                                            <X size={12}/>
                                                        </button>
                                                    </div>
                                                ))}
                                                
                                                {/* Кнопка Добавить */}
                                                <button 
                                                    onClick={() => addMop(e, f.id)} 
                                                    className="self-start px-2 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-bold border border-transparent hover:border-blue-200 hover:text-blue-600 hover:bg-white transition-all flex items-center gap-1"
                                                >
                                                    <Plus size={10}/> Добавить
                                                </button>
                                            </div>

                                            {/* Кнопки копирования (появляются при наведении) */}
                                            <div className="flex gap-1 opacity-0 group-hover/cell:opacity-100 transition-opacity absolute top-2 right-2">
                                                <button 
                                                    onClick={()=>copyDown(e, floorIdx)} 
                                                    title="Скопировать вниз на все этажи" 
                                                    className="p-1 bg-white border shadow-sm rounded hover:text-blue-600"
                                                >
                                                    <ArrowDown size={12}/>
                                                </button>
                                                {!isParking && (
                                                    <button 
                                                        onClick={()=>copyRight(f.id, e)} 
                                                        title="Скопировать в другие подъезды" 
                                                        className="p-1 bg-white border shadow-sm rounded hover:text-blue-600"
                                                    >
                                                        <ArrowRightIcon size={12}/>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
        </div>
    );
}