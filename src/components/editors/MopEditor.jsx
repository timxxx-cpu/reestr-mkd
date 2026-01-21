import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, Save, Wand2, Plus, X, ArrowDown, ArrowRight as ArrowRightIcon 
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, DebouncedInput, TabButton, Button } from '../ui/UIKit';

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
    if (list.length === 0 && building.category.includes('residential')) {
        list.push({ id: 'main', type: 'Основной', index: 0, fullId: `${building.id}_main` });
    }
    return list;
}

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

export default function MopEditor({ buildingId, onBack }) {
    const { composition, buildingDetails, mopData, setMopData, saveData } = useProject();
    const [activeBlockIndex, setActiveBlockIndex] = useState(0);

    const building = composition.find(c => c.id === buildingId);
    const blocksList = useMemo(() => getBlocksList(building), [building]);
    const currentBlock = blocksList[activeBlockIndex];

    if (!building || !currentBlock) return <div className="p-8 text-center text-slate-500">Нет данных</div>;

    const blockDetails = buildingDetails[`${building.id}_${currentBlock.id}`] || {};
    const isParking = currentBlock.type === 'Паркинг';
    const entrances = isParking ? [0] : Array.from({length: blockDetails.entrances||1}, (_, i) => i+1);
    const basements = buildingDetails[`${building.id}_features`]?.basements || [];

    const floorList = useMemo(() => { 
        const list = []; 
        const currentBlockBasements = basements.filter(b => b.blocks?.includes(currentBlock.id));
        
        currentBlockBasements.forEach((b, bIdx) => { 
            for(let d = b.depth; d >= 1; d--) {
                list.push({ id: `base_${b.id}_L${d}`, label: `Подвал -${d}`, type: 'basement', sortOrder: -1000 - d + (bIdx * 0.1) }); 
            }
        });
        
        if(blockDetails.hasBasementFloor) { 
            list.push({ id: 'floor_0', label: 'Цоколь', type: 'tsokol', sortOrder: 0 }); 
        }
        
        const start = blockDetails.floorsFrom || 1;
        const end = blockDetails.floorsTo || 1;
        
        for(let i=start; i<=end; i++) { 
            const isMixed = blockDetails.commercialFloors?.includes(i);
            list.push({ id: `floor_${i}`, label: `${i} этаж`, type: isMixed ? 'mixed' : 'residential', sortOrder: i * 10 }); 

            if (blockDetails.technicalFloors?.includes(i)) {
                list.push({ id: `floor_${i}_tech`, label: `${i}-Т (Тех)`, type: 'technical', sortOrder: (i * 10) + 5 });
            }
        }
        
        const extraTechs = (blockDetails.technicalFloors || []).filter(f => f > end);
        extraTechs.forEach(f => {
             list.push({ id: `floor_${f}_tech_extra`, label: `${f} (Тех)`, type: 'technical', sortOrder: (f * 10) });
        });

        if(blockDetails.hasAttic) list.push({ id: 'attic', label: 'Мансарда', type: 'attic', sortOrder: 50000 }); 
        if(blockDetails.hasLoft) list.push({ id: 'loft', label: 'Чердак', type: 'loft', sortOrder: 55000 }); 
        if(blockDetails.hasExploitableRoof) list.push({ id: 'roof', label: 'Кровля', type: 'roof', sortOrder: 60000 }); 

        return list.sort((a,b) => a.sortOrder - b.sortOrder); 
    }, [currentBlock, blockDetails, basements, building]);

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
        let defaultType = MOP_TYPES[0];
        const floorType = floorList.find(f => f.id === floorId)?.type;
        
        if (floorType === 'basement') defaultType = 'Техническое подполье';
        if (floorType === 'technical' || floorType === 'loft') defaultType = 'Технический этаж';
        if (floorType === 'roof') defaultType = 'Кровля';

        const newMop = { id: generateId(), type: defaultType, area: '' };
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

    const copyDown = (ent, startIdx) => { 
        const srcFloorId = floorList[startIdx].id; 
        const src = getMops(ent, srcFloorId); 
        const updates = {}; 
        
        for(let i=startIdx+1; i<floorList.length; i++) { 
            const targetFloorId = floorList[i].id;
            updates[`${currentBlock.fullId}_e${ent}_f${targetFloorId}_mops`] = src.map(m=>({...m, id: generateId()})); 
        } 
        setMopData(p=>({...p, ...updates})); 
    };
    
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
    
    const autoFillMops = () => { 
        const updates = {}; 
        floorList.forEach(f => { 
            entrances.forEach(e => { 
                let types = [];
                if (isParking) {
                    types = ['Паркинг (зона проезда)', 'Рампа'];
                } else if (f.type === 'basement') {
                    types = ['Техническое подполье', 'ИТП', 'Насосная'];
                } else if (f.type === 'technical' || f.type === 'loft') {
                    types = ['Технический этаж', 'Машинное отделение лифтов'];
                } else if (f.type === 'roof') {
                    types = ['Кровля'];
                } else {
                    types = ['Лестничная клетка', 'Лифтовой холл', 'Межквартирный коридор'];
                    if (f.id === 'floor_1') types.push('Вестибюль', 'Тамбур');
                }
                const mops = types.map((t) => ({ id: generateId(), type: t, area: '15' })); 
                updates[`${currentBlock.fullId}_e${e}_f${f.id}_mops`] = mops; 
            }); 
        }); 
        setMopData(p => ({...p, ...updates})); 
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
            roof: { color: 'bg-sky-100 text-sky-700', label: 'Кровля' }
        };
        const style = map[type] || map.residential;
        return <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${style.color}`}>{style.label}</span>
    }

    return (
        <div className="space-y-6 pb-20 w-full animate-in fade-in duration-500">
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

            <Card className="shadow-lg border-0 ring-1 ring-slate-200 rounded-xl overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto relative w-full" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                    <table className="border-collapse w-full">
                        <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 font-bold uppercase sticky top-0 z-30 shadow-sm">
                            <tr>
                                {/* Минимальная ширина 120px */}
                                <th className="p-4 min-w-[120px] sticky left-0 bg-slate-50 z-40 border-r border-slate-200 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">Этаж</th>
                                
                                {entrances.map(e => (
                                    /* Минимальная ширина 320px */
                                    <th key={e} className="p-4 min-w-[320px] border-r">
                                        {isParking ? 'Зона паркинга' : `Подъезд ${e}`}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {floorList.map((f, floorIdx) => (
                                <tr key={f.id} className="group hover:bg-blue-50/20 focus-within:bg-blue-50 transition-colors duration-200">
                                    <td className="p-3 min-w-[120px] sticky left-0 bg-white group-focus-within:bg-blue-50/20 transition-colors duration-200 border-r align-top relative z-20 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)]">
                                        <div className="flex flex-col gap-1.5">
                                            <span className="font-bold text-sm text-slate-700">{f.label}</span>
                                            {renderBadge(f.type)}
                                        </div>
                                    </td>

                                    {entrances.map(e => {
                                        const mops = getMops(e, f.id);
                                        
                                        return (
                                            <td key={e} className="p-3 min-w-[320px] align-top border-r relative group/cell">
                                                <div className="flex flex-col gap-2 mb-2">
                                                    {mops.map((m) => (
                                                        <div key={m.id} className="flex gap-1 items-center bg-white border border-slate-200 rounded-lg p-1 shadow-sm animate-in fade-in zoom-in-95 duration-200 focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-300">
                                                            <select 
                                                                className="bg-transparent text-[10px] font-bold w-40 outline-none truncate cursor-pointer hover:text-blue-600 focus:text-blue-700" 
                                                                value={m.type} 
                                                                onChange={ev=>updateMop(e, f.id, m.id, 'type', ev.target.value)}
                                                                title={m.type}
                                                            >
                                                                {MOP_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                                                            </select>
                                                            <DebouncedInput 
                                                                type="number" 
                                                                className="w-14 bg-slate-50 border border-slate-100 rounded px-1 py-0.5 text-[10px] font-medium text-center focus:bg-white focus:border-blue-300 outline-none transition-all" 
                                                                placeholder="S м²" 
                                                                value={m.area} 
                                                                onChange={val=>updateMop(e, f.id, m.id, 'area', val)} 
                                                            />
                                                            <button 
                                                                onClick={()=>removeMop(e, f.id, m.id)} 
                                                                className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                            >
                                                                <X size={12}/>
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <button 
                                                        onClick={() => addMop(e, f.id)} 
                                                        className="self-start px-2 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-bold border border-transparent hover:border-blue-200 hover:text-blue-600 hover:bg-white transition-all flex items-center gap-1"
                                                    >
                                                        <Plus size={12}/> Добавить МОП
                                                    </button>
                                                </div>

                                                <div className="flex gap-1 opacity-0 group-hover/cell:opacity-100 transition-opacity absolute top-2 right-2 z-10">
                                                    <button 
                                                        onClick={()=>copyDown(e, floorIdx)} 
                                                        title="Скопировать этот набор на все этажи ниже" 
                                                        className="p-1.5 bg-white border shadow-sm rounded hover:text-blue-600 hover:border-blue-200"
                                                    >
                                                        <ArrowDown size={14}/>
                                                    </button>
                                                    {!isParking && (
                                                        <button 
                                                            onClick={()=>copyRight(f.id, e)} 
                                                            title="Скопировать в другие подъезды этого этажа" 
                                                            className="p-1.5 bg-white border shadow-sm rounded hover:text-blue-600 hover:border-blue-200"
                                                        >
                                                            <ArrowRightIcon size={14}/>
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
                </div>
            </Card>
        </div>
    );
}