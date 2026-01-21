import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, Save, Wand2, Table as TableIcon, Info 
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, DebouncedInput, TabButton, Button } from '../ui/UIKit';

// Цвета для разных типов квартир
const TYPE_COLORS = {
    flat: 'bg-white border-slate-200 hover:border-blue-300',
    duplex_up: 'bg-purple-50 border-purple-200 text-purple-700',
    duplex_down: 'bg-orange-50 border-orange-200 text-orange-700'
};

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
        composition = [], 
        buildingDetails = {}, 
        entrancesData = {}, 
        flatMatrix = {}, 
        setFlatMatrix, 
        floorData = {}, 
        saveData 
    } = useProject();
    
    const [activeBlockIndex, setActiveBlockIndex] = useState(0);
    const [startNum, setStartNum] = useState(1);

    // --- БЕЗОПАСНЫЕ ДАННЫЕ ---
    const building = composition?.find(c => c.id === buildingId);
    const blocksList = useMemo(() => getBlocksList(building), [building]);
    const currentBlock = blocksList[activeBlockIndex];

    const blockKey = building && currentBlock ? `${building.id}_${currentBlock.id}` : null;
    const blockDetails = blockKey ? (buildingDetails[blockKey] || {}) : {};
    
    const featureKey = building ? `${building.id}_features` : null;
    const allBasements = featureKey ? (buildingDetails[featureKey]?.basements || []) : [];
    // Проверяем наличие подвалов именно в этом блоке
    const currentBasements = allBasements.filter(b => b.blocks?.includes(currentBlock?.id));
    const hasBasement = currentBasements.length > 0;

    const entrancesCount = blockDetails.entrances || 1;
    const entrances = Array.from({ length: entrancesCount }, (_, i) => i + 1);

    // --- ГЕНЕРАЦИЯ ЭТАЖЕЙ ---
    const floorList = useMemo(() => {
        if (!currentBlock) return [];
        const list = [];
        
        // Подвалы
        currentBasements.forEach(b => { 
            for(let d=b.depth; d>=1; d--) {
                list.push({ id: `base_${b.id}_L${d}`, label: `-${d}`, type: 'basement', sortOrder: -100-d }); 
            }
        });
        // Цоколь
        if(blockDetails.hasBasementFloor) {
            list.push({ id: 'floor_0', label: '0', index: 0, type: 'basement_floor', sortOrder: 0 });
        }
        // Жилые
        const start = blockDetails.floorsFrom || 1;
        const end = blockDetails.floorsTo || 1;
        for(let i=start; i<=end; i++) {
             list.push({ id: `floor_${i}`, label: `${i}`, index: i, type: 'res', sortOrder: i });
        }
        // Сортировка по возрастанию (Подвал -> 1 -> 2 ...), как в EntranceMatrixEditor
        return list.sort((a,b)=>a.sortOrder-b.sortOrder);
    }, [currentBlock, blockDetails, currentBasements]);

    if (!building || !currentBlock) return <div className="p-12 text-center text-slate-500">Загрузка данных...</div>;

    // --- ХЕЛПЕРЫ ---
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

    const autoNumber = () => {
        let n = startNum;
        const updates = {};
        
        // Нумерация обычно идет с нижнего жилого этажа вверх
        // Так как floorList у нас отсортирован снизу-вверх, идем прямо по нему
        entrances.forEach(e => {
            floorList.forEach(f => {
                // Нумеруем только жилые этажи (обычно)
                // Если нужно нумеровать и подвалы, уберите проверку типа
                if (f.type !== 'res' && f.type !== 'basement_floor') return;

                const entKey = `${currentBlock.fullId}_ent${e}_${f.id}`;
                const count = parseInt(entrancesData[entKey]?.apts || 0);
                
                for(let i=0; i<count; i++) {
                    const aptKey = `${currentBlock.fullId}_e${e}_f${f.id}_i${i}`;
                    const currentType = flatMatrix[aptKey]?.type || 'flat';
                    
                    updates[aptKey] = { 
                        ...(flatMatrix[aptKey] || {}), 
                        num: n++, 
                        type: currentType 
                    };
                }
            });
        });
        setFlatMatrix(p => ({...p, ...updates})); 
    };

    // Опции дуплекса для конкретного этажа
    const getDuplexOptions = (floorId) => {
        const options = [
            { val: 'flat', label: '—' },
            { val: 'duplex_up', label: 'Вверх' }
        ];

        // Логика: Если 1 этаж И есть подвал -> можно вниз
        if (floorId === 'floor_1' && hasBasement) {
            options.push({ val: 'duplex_down', label: 'Вниз' });
        }

        return options;
    };

    return (
        <div className="space-y-6 pb-20 w-full animate-in fade-in duration-500">
            {/* Хедер */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-6 mb-4">
                <div className="flex gap-4 items-center">
                    <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><ArrowLeft size={24}/></button>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">{building.label}</h2>
                        <p className="text-slate-400 text-xs font-bold uppercase">Нумерация квартир</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <div className="flex items-center gap-2 bg-slate-100 px-3 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Старт №:</span>
                        <input className="w-12 bg-transparent font-bold text-xs text-slate-700 outline-none text-center" value={startNum} onChange={e=>setStartNum(parseInt(e.target.value)||1)} />
                    </div>

                    <button onClick={autoNumber} className="px-4 py-2 bg-purple-50 text-purple-600 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-purple-100 transition-colors">
                        <Wand2 size={14}/> Авто-нум.
                    </button>
                    <Button onClick={() => { saveData(); onBack(); }}><Save size={14}/> Готово</Button>
                </div>
            </div>

            <div className="flex gap-2 p-1 bg-slate-200/50 rounded-xl w-max mb-4">
                 {blocksList.map((b,i) => (<TabButton key={b.id} active={activeBlockIndex===i} onClick={()=>setActiveBlockIndex(i)}>Блок {i+1} ({b.type})</TabButton>))}
            </div>

            {/* ТАБЛИЦА */}
            <Card className="shadow-lg border-0 ring-1 ring-slate-200 rounded-xl overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto relative w-full max-w-[calc(100vw-64px)]" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                    
                    {/* w-max для скролла */}
                    <table className="border-collapse bg-white" style={{ width: 'max-content' }}>
                        <thead className="bg-slate-50 border-b text-[10px] uppercase font-bold text-slate-500 sticky top-0 z-30 shadow-sm">
                            <tr>
                                {/* Колонка Этаж */}
                                <th className="p-4 sticky left-0 bg-slate-50 border-r w-20 min-w-[80px] z-40 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">Этаж</th>
                                
                                {entrances.map(e => (
                                    <th key={e} className="p-4 border-r min-w-[320px] bg-slate-50/95 backdrop-blur">
                                        Подъезд {e}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {/* Рендерим этажи В ПРЯМОМ ПОРЯДКЕ (снизу вверх: Подвал -> 1 -> 2) */}
                            {floorList.map(f => {
                                // Проверяем флаг двухуровневого этажа
                                const isDuplexFloor = floorData[`${currentBlock.fullId}_${f.id}`]?.isDuplex;
                                const duplexOptions = getDuplexOptions(f.id);

                                return (
                                    <tr key={f.id} className={isDuplexFloor ? 'bg-purple-50/10' : 'hover:bg-slate-50 transition-colors'}>
                                        
                                        {/* Ячейка Этаж */}
                                        <td className="p-4 font-bold text-xs sticky left-0 bg-white border-r text-center z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                            {f.label}
                                            {isDuplexFloor && <div className="mt-1 text-[9px] text-purple-600 bg-purple-100 px-1 rounded">2 ур.</div>}
                                        </td>
                                        
                                        {entrances.map(e => {
                                            const entKey = `${currentBlock.fullId}_ent${e}_${f.id}`;
                                            const count = parseInt(entrancesData[entKey]?.apts || 0);
                                            
                                            // Если квартир 0
                                            if (count === 0) return <td key={e} className="p-2 border-r bg-slate-50/30"></td>;

                                            return (
                                                <td key={e} className="p-2 border-r align-top min-w-[320px]">
                                                    <div className="flex flex-wrap gap-2">
                                                        {Array.from({length: count}).map((_, i) => {
                                                            const a = getApt(e, f.id, i);
                                                            const cardColor = TYPE_COLORS[a.type] || TYPE_COLORS.flat;
                                                            
                                                            return (
                                                                <div 
                                                                    key={i} 
                                                                    className={`
                                                                        flex flex-col gap-1 p-2 border rounded-lg w-20 text-center transition-all shadow-sm
                                                                        ${cardColor}
                                                                    `}
                                                                >
                                                                    {/* Номер квартиры */}
                                                                    <div className="flex items-center justify-center">
                                                                        <span className="text-[9px] text-slate-400 mr-1">№</span>
                                                                        <DebouncedInput 
                                                                            className="w-full text-center font-bold text-sm outline-none bg-transparent" 
                                                                            value={a.num} 
                                                                            onChange={val=>updateApt(e,f.id,i,'num',val)} 
                                                                        />
                                                                    </div>

                                                                    {/* Выбор типа (только если этаж Дуплекс) */}
                                                                    {isDuplexFloor && (
                                                                        <div className="border-t border-black/5 pt-1 mt-1">
                                                                            <select 
                                                                                className="w-full text-[9px] bg-transparent outline-none font-bold cursor-pointer text-center appearance-none" 
                                                                                value={a.type} 
                                                                                onChange={ev=>updateApt(e,f.id,i,'type',ev.target.value)}
                                                                                title="Тип квартиры"
                                                                            >
                                                                                {duplexOptions.map(opt => (
                                                                                    <option key={opt.val} value={opt.val}>{opt.label}</option>
                                                                                ))}
                                                                            </select>
                                                                        </div>
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