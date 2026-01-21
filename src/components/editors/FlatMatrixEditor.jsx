import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, Save, Wand2, Key, Table as TableIcon, Grid3X3 
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, DebouncedInput, TabButton, Button } from '../ui/UIKit';

function getBlocksList(building) {
    if (!building) return [];
    const list = [];
    if (building.category && building.category.includes('residential')) {
        for(let i=0; i<(building.resBlocks || 0); i++) {
            list.push({ id: `res_${i}`, type: 'Ж', index: i, fullId: `${building.id}_res_${i}` });
        }
    }
    if (list.length === 0 && building.category.includes('residential')) {
        list.push({ id: 'main', type: 'Основной', index: 0, fullId: `${building.id}_main` });
    }
    return list;
}

export default function FlatMatrixEditor({ buildingId, onBack }) {
    const { 
        composition, buildingDetails, entrancesData, 
        flatMatrix, setFlatMatrix, floorData, saveData 
    } = useProject();
    
    const [activeBlockIndex, setActiveBlockIndex] = useState(0);
    const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'
    const [startNum, setStartNum] = useState(1); // Начальный номер для авто-нумерации

    // 1. Получаем здание и блоки
    const building = composition.find(c => c.id === buildingId);
    if (!building) return <div className="p-8 text-center text-slate-500">Здание не найдено</div>;

    const blocksList = useMemo(() => getBlocksList(building), [building]);
    const currentBlock = blocksList[activeBlockIndex];

    if (!currentBlock) return <div className="p-8 text-center text-slate-500">Нет жилых блоков</div>;

    // 2. Детали блока
    const blockDetails = buildingDetails[`${building.id}_${currentBlock.id}`] || {};
    const basements = buildingDetails[`${building.id}_features`]?.basements || [];
    const entrancesCount = blockDetails.entrances || 1;
    const entrances = Array.from({ length: entrancesCount }, (_, i) => i + 1);

    // 3. Список этажей (включая цоколь и подвалы, если там вдруг есть квартиры)
    const floorList = useMemo(() => {
        const list = [];
        
        // Подвалы
        basements.filter(b => b.blocks?.includes(currentBlock.id)).forEach(b => { 
            for(let d=b.depth; d>=1; d--) {
                list.push({ id: `base_${b.id}_L${d}`, label: `Подвал -${d}`, type: 'basement', sortOrder: -100-d }); 
            }
        });

        // Цоколь
        if(blockDetails.hasBasementFloor) {
            list.push({ id: 'floor_0', label: 'Цоколь', index: 0, type: 'basement_floor', sortOrder: 0 });
        }

        // Наземные этажи
        const start = blockDetails.floorsFrom || 1;
        const end = blockDetails.floorsTo || 1;
        for(let i=start; i<=end; i++) {
             list.push({ id: `floor_${i}`, label: `${i}`, index: i, type: 'res', sortOrder: i });
        }
        
        // Сортируем снизу вверх (для таблицы это логичнее, как в шахматке)
        return list.sort((a,b)=>a.sortOrder-b.sortOrder);
    }, [currentBlock, blockDetails, basements, building]);

    // --- Хелперы данных ---

    const getApt = (ent, floorId, idx) => {
        const key = `${currentBlock.fullId}_e${ent}_f${floorId}_i${idx}`;
        return flatMatrix[key] || { num: '', type: 'flat' };
    };

    const updateApt = (ent, floorId, idx, field, val) => {
        const key = `${currentBlock.fullId}_e${ent}_f${floorId}_i${idx}`;
        setFlatMatrix(prev => ({
            ...prev,
            [key]: { ...(prev[key] || { type: 'flat' }), [field]: val }
        }));
    };

    // Авто-нумерация
    const autoNumber = () => {
        let n = startNum;
        const updates = {};
        
        // Проходим по подъездам (1..N)
        entrances.forEach(e => {
            // Проходим по этажам (снизу вверх)
            floorList.forEach(f => {
                const entKey = `${currentBlock.fullId}_ent${e}_${f.id}`;
                const count = parseInt(entrancesData[entKey]?.apts || 0);
                
                for(let i=0; i<count; i++) {
                    const aptKey = `${currentBlock.fullId}_e${e}_f${f.id}_i${i}`;
                    // Если номер уже есть - не трогаем? Или перезаписываем? 
                    // В исходнике перезаписываем.
                    updates[aptKey] = { 
                        ...(flatMatrix[aptKey] || {}), 
                        num: n++, 
                        type: flatMatrix[aptKey]?.type || 'flat' 
                    };
                }
            });
        });
        setFlatMatrix(p => ({...p, ...updates}));
    };

    return (
        <div className="space-y-6 pb-20 max-w-full mx-auto animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-6 mb-4">
                <div className="flex gap-4 items-center">
                    <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><ArrowLeft size={24}/></button>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">{building.label}</h2>
                        <p className="text-slate-400 text-xs font-bold uppercase">Квартирография</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {/* Переключатель вида */}
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button onClick={()=>setViewMode('table')} className={`p-2 rounded-lg transition-all ${viewMode==='table'?'bg-white shadow text-blue-600':'text-slate-400'}`} title="Таблица"><TableIcon size={16}/></button>
                        <button onClick={()=>setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode==='grid'?'bg-white shadow text-blue-600':'text-slate-400'}`} title="Сетка"><Grid3X3 size={16}/></button>
                    </div>
                    
                    {/* Настройка старта нумерации */}
                    <div className="flex items-center gap-2 bg-slate-100 px-3 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Старт №:</span>
                        <input 
                            className="w-12 bg-transparent font-bold text-xs text-slate-700 outline-none text-center" 
                            value={startNum} 
                            onChange={e=>setStartNum(parseInt(e.target.value)||1)} 
                        />
                    </div>

                    <button onClick={autoNumber} className="px-4 py-2 bg-purple-50 text-purple-600 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-purple-100 transition-colors">
                        <Wand2 size={14}/> Авто-нумерация
                    </button>
                    <Button onClick={() => { saveData(); onBack(); }}>
                        <Save size={14}/> Готово
                    </Button>
                </div>
            </div>

            {/* Вкладки блоков */}
            <div className="flex gap-2 mb-4">
                 {blocksList.map((b,i) => (
                     <TabButton key={b.id} active={activeBlockIndex===i} onClick={()=>setActiveBlockIndex(i)}>
                         Блок {i+1} ({b.type})
                     </TabButton>
                 ))}
            </div>

            {/* Контент */}
            {viewMode === 'table' ? (
                // --- РЕЖИМ ТАБЛИЦЫ ---
                <Card className="overflow-x-auto shadow-lg border-0 ring-1 ring-slate-200">
                    <table className="w-full border-collapse">
                        <thead className="bg-slate-50 border-b text-[10px] uppercase font-bold text-slate-500">
                            <tr>
                                <th className="p-4 sticky left-0 bg-slate-50 border-r w-24">Этаж</th>
                                {entrances.map(e => <th key={e} className="p-4 border-r min-w-[200px]">Подъезд {e}</th>)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {[...floorList].reverse().map(f => { // Отображаем сверху вниз (reverse)
                                const isDuplex = floorData[`${currentBlock.fullId}_${f.id}`]?.isDuplex;
                                return (
                                    <tr key={f.id} className={isDuplex ? 'bg-purple-50/30' : 'hover:bg-slate-50'}>
                                        <td className="p-4 font-bold text-xs sticky left-0 bg-white border-r relative group">
                                            {f.label}
                                            {isDuplex && <span className="absolute top-1 right-1 text-[9px] text-purple-600 bg-purple-100 px-1 rounded font-bold">D</span>}
                                        </td>
                                        {entrances.map(e => {
                                            const entKey = `${currentBlock.fullId}_ent${e}_${f.id}`;
                                            const count = parseInt(entrancesData[entKey]?.apts || 0);
                                            
                                            return (
                                                <td key={e} className="p-2 border-r align-top">
                                                    <div className="flex flex-wrap gap-2">
                                                        {Array.from({length: count}).map((_, i) => {
                                                            const a = getApt(e, f.id, i);
                                                            const isDuplexType = a.type?.includes('duplex');
                                                            
                                                            return (
                                                                <div key={i} className={`p-1.5 border rounded w-20 text-center transition-all ${isDuplexType ? 'bg-purple-50 border-purple-200 shadow-sm' : 'bg-white hover:border-blue-300'}`}>
                                                                    <div className="flex justify-between items-center mb-1">
                                                                        <div className="text-[9px] text-slate-400 font-bold">#{i+1}</div>
                                                                        {/* Выбор типа (Дуплекс) если этаж помечен как дуплекс */}
                                                                        {isDuplex && (
                                                                            <select 
                                                                                className="text-[9px] bg-transparent outline-none w-10 text-right font-bold text-purple-600 cursor-pointer" 
                                                                                value={a.type} 
                                                                                onChange={ev=>updateApt(e,f.id,i,'type',ev.target.value)}
                                                                            >
                                                                                <option value="flat">Ст</option>
                                                                                <option value="duplex_up">Вв</option>
                                                                                <option value="duplex_down">Нз</option>
                                                                            </select>
                                                                        )}
                                                                    </div>
                                                                    <DebouncedInput 
                                                                        className={`w-full text-center font-bold text-xs outline-none bg-transparent ${isDuplexType ? 'text-purple-700' : 'text-blue-600'}`}
                                                                        value={a.num} 
                                                                        onChange={val=>updateApt(e,f.id,i,'num',val)} 
                                                                        placeholder="№"
                                                                    />
                                                                </div>
                                                            );
                                                        })}
                                                        {count === 0 && <span className="text-[10px] text-slate-300 italic p-2">- нет квартир -</span>}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </Card>
            ) : (
                // --- РЕЖИМ СЕТКИ (GRID) ---
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {entrances.map(e => (
                        <div key={e} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="font-bold text-center mb-4 text-slate-600 uppercase text-xs tracking-wider bg-slate-50 py-2 rounded-lg border border-slate-100">
                                Подъезд {e}
                            </div>
                            <div className="flex flex-col gap-2">
                                {[...floorList].reverse().map(f => {
                                    const entKey = `${currentBlock.fullId}_ent${e}_${f.id}`;
                                    const count = parseInt(entrancesData[entKey]?.apts || 0);
                                    if (count === 0) return null;

                                    return (
                                        <div key={f.id} className="flex items-center gap-2">
                                            <div className="w-8 text-[10px] font-bold text-slate-400 text-right">{f.label}</div>
                                            <div className="flex gap-1 flex-1">
                                                {Array.from({length: count}).map((_, i) => {
                                                    const a = getApt(e, f.id, i);
                                                    const isDuplexType = a.type?.includes('duplex');
                                                    
                                                    return (
                                                        <div 
                                                            key={i} 
                                                            className={`
                                                                h-8 flex-1 flex items-center justify-center font-bold text-xs rounded border transition-colors
                                                                ${isDuplexType 
                                                                    ? 'bg-purple-100 text-purple-700 border-purple-200' 
                                                                    : 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100'}
                                                            `}
                                                            title={`Этаж ${f.label}, Кв ${i+1}`}
                                                        >
                                                            {a.num || '-'}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}