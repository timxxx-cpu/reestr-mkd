import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, Save, Wand2, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, DebouncedInput, TabButton, Button } from '../ui/UIKit';
import { getBlocksList } from '../../lib/utils'; // <--- Импорт

const TYPE_COLORS = {
    flat: 'bg-white border-slate-200 hover:border-blue-300',
    duplex_up: 'bg-purple-50 border-purple-200 text-purple-700',
    duplex_down: 'bg-orange-50 border-orange-200 text-orange-700'
};

export default function FlatMatrixEditor({ buildingId, onBack }) {
    // ВАЖНО: Добавили saveBuildingData
    const { 
        composition = [], 
        buildingDetails = {}, 
        entrancesData = {}, 
        flatMatrix = {}, 
        setFlatMatrix, 
        floorData = {}, 
        saveBuildingData, 
        saveData 
    } = useProject();
    
    const [activeBlockIndex, setActiveBlockIndex] = useState(0);
    const [startNum, setStartNum] = useState(1);

    const building = composition?.find(c => c.id === buildingId);
    
    // Используем общую функцию
    const blocksList = useMemo(() => getBlocksList(building), [building]);
    const currentBlock = blocksList[activeBlockIndex];

    const blockKey = (building && currentBlock) ? `${building.id}_${currentBlock.id}` : null;
    const blockDetails = blockKey ? (buildingDetails[blockKey] || {}) : {};
    const featureKey = building ? `${building.id}_features` : null;
    const currentBasements = featureKey ? (buildingDetails[featureKey]?.basements?.filter(b => b.blocks?.includes(currentBlock?.id)) || []) : [];
    const hasBasement = currentBasements.length > 0;
    const entrances = Array.from({ length: blockDetails.entrances || 1 }, (_, i) => i + 1);

    const floorList = useMemo(() => {
        if (!currentBlock) return [];
        let list = [];
        currentBasements.forEach(b => { for(let d=b.depth; d>=1; d--) list.push({ id: `base_${b.id}_L${d}`, label: `-${d}`, type: 'basement', sortOrder: -100-d }); });
        if(blockDetails.hasBasementFloor) list.push({ id: 'floor_0', label: '0', index: 0, type: 'basement_floor', sortOrder: 0 });
        const start = blockDetails.floorsFrom || 1;
        const end = blockDetails.floorsTo || 1;
        for(let i=start; i<=end; i++) list.push({ id: `floor_${i}`, label: `${i}`, index: i, type: 'res', sortOrder: i });

        return list.filter(f => entrances.some(e => parseInt(entrancesData[`${currentBlock.fullId}_ent${e}_${f.id}`]?.apts || 0) > 0))
                   .sort((a,b) => a.sortOrder - b.sortOrder);
    }, [currentBlock, blockDetails, currentBasements, entrancesData, entrances]);

    const getApt = (ent, floorId, idx) => {
        if (!currentBlock) return { num: '', type: 'flat' };
        return flatMatrix[`${currentBlock.fullId}_e${ent}_f${floorId}_i${idx}`] || { num: '', type: 'flat' };
    };

    const updateApt = (ent, floorId, idx, field, val) => {
        if (!currentBlock) return;
        if (field === 'num' && val !== '' && !/^\d/.test(val)) return;

        setFlatMatrix(prev => ({
            ...prev,
            [`${currentBlock.fullId}_e${ent}_f${floorId}_i${idx}`]: { 
                ...(prev[`${currentBlock.fullId}_e${ent}_f${floorId}_i${idx}`] || { type: 'flat' }), 
                [field]: val 
            }
        }));
    };

    const isFloorDuplexValid = (floorId) => {
        if (!currentBlock) return true;
        const isDuplexFloor = floorData[`${currentBlock.fullId}_${floorId}`]?.isDuplex;
        if (!isDuplexFloor) return true;
        return entrances.some(e => {
            const count = parseInt(entrancesData[`${currentBlock.fullId}_ent${e}_${floorId}`]?.apts || 0);
            for(let i=0; i<count; i++) {
                if (getApt(e, floorId, i).type !== 'flat') return true;
            }
            return false;
        });
    };

    const autoNumber = () => {
        if (!currentBlock) return;
        let n = startNum;
        const updates = {};
        entrances.forEach(e => {
            floorList.forEach(f => {
                const count = parseInt(entrancesData[`${currentBlock.fullId}_ent${e}_${f.id}`]?.apts || 0);
                for(let i=0; i<count; i++) {
                    const key = `${currentBlock.fullId}_e${e}_f${f.id}_i${i}`;
                    updates[key] = { ...(flatMatrix[key] || {}), num: String(n++), type: flatMatrix[key]?.type || 'flat' };
                }
            });
        });
        setFlatMatrix(p => ({...p, ...updates})); 
    };

    if (!building || !currentBlock) return <div className="p-12 text-center text-slate-500">Загрузка данных...</div>;

    return (
        <div className="space-y-6 pb-20 w-full animate-in fade-in duration-500">
            <div className="flex items-center justify-between border-b border-slate-200 pb-6 mb-4">
                <div className="flex gap-4 items-center">
                    <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><ArrowLeft size={24}/></button>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">{building.label}</h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Нумерация квартир</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <div className="flex items-center gap-2 bg-slate-100 px-3 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Старт №:</span>
                        <input type="number" className="w-12 bg-transparent font-bold text-xs text-slate-700 outline-none text-center" value={startNum} onChange={e=>setStartNum(parseInt(e.target.value)||1)} />
                    </div>
                    <button onClick={autoNumber} className="px-4 py-2 bg-purple-50 text-purple-600 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-purple-100 transition-colors"><Wand2 size={14}/> Авто-нум.</button>
                    
                    {/* ОБНОВЛЕНО: Используем saveBuildingData */}
                    <Button onClick={async () => { 
                        const specificData = {};
                        Object.keys(flatMatrix).forEach(k => {
                            if (k.startsWith(building.id)) {
                                specificData[k] = flatMatrix[k];
                            }
                        });

                        await saveBuildingData(building.id, 'apartmentsData', specificData);
                        await saveData(); 
                        
                        onBack(); 
                    }}><Save size={14}/> Готово</Button>
                </div>
            </div>

            <div className="flex gap-2 p-1 bg-slate-200/50 rounded-xl w-max mb-4">
                 {blocksList.map((b,i) => (<TabButton key={b.id} active={activeBlockIndex===i} onClick={()=>setActiveBlockIndex(i)}>Блок {i+1}</TabButton>))}
            </div>

            <Card className="shadow-lg border-0 ring-1 ring-slate-200 rounded-xl overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto relative w-full max-w-[calc(100vw-64px)]" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                    <table className="border-collapse bg-white" style={{ width: 'max-content' }}>
                        <thead className="bg-slate-50 border-b text-[10px] uppercase font-bold text-slate-500 sticky top-0 z-30 shadow-sm">
                            <tr>
                                <th className="p-4 sticky left-0 bg-slate-50 z-40 border-r-2 border-slate-300 w-20 min-w-[80px] text-center">Этаж</th>
                                {entrances.map(e => (
                                    <th key={e} className={`p-4 border-r-2 border-slate-200 min-w-[220px] backdrop-blur ${e % 2 === 0 ? 'bg-slate-50/95' : 'bg-blue-50/50 text-blue-800'}`}>
                                        Подъезд {e}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {floorList.map(f => {
                                const isDuplexFloor = floorData[`${currentBlock.fullId}_${f.id}`]?.isDuplex;
                                const isValid = isFloorDuplexValid(f.id);

                                return (
                                    <tr key={f.id} className={`${isDuplexFloor ? 'bg-purple-50/5' : ''} transition-colors h-10`}>
                                        <td className={`p-2 font-bold text-xs sticky left-0 border-r-2 border-slate-300 text-center z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] ${!isValid ? 'bg-red-50 text-red-600' : 'bg-white text-slate-700'}`}>
                                            <div className="flex flex-col items-center gap-0.5">
                                                {f.label}
                                                {isDuplexFloor && (
                                                    <div title={!isValid ? "На дуплексном этаже должна быть хоть одна дуплексная квартира" : ""} className="cursor-help">
                                                        {!isValid ? <AlertTriangle size={12} className="text-red-500" /> : <CheckCircle2 size={12} className="text-emerald-500" />}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        {entrances.map(e => {
                                            const count = parseInt(entrancesData[`${currentBlock.fullId}_ent${e}_${f.id}`]?.apts || 0);
                                            const isEvenCol = e % 2 === 0;
                                            if (count === 0) return <td key={e} className={`p-2 border-r-2 border-slate-100 ${isEvenCol ? 'bg-slate-50/30' : 'bg-blue-50/10'}`}></td>;
                                            return (
                                                <td key={e} className={`p-2 border-r-2 border-slate-100 align-top min-w-[220px] ${isEvenCol ? 'bg-slate-50/20' : 'bg-blue-50/5'}`}>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {Array.from({length: count}).map((_, i) => {
                                                            const a = getApt(e, f.id, i);
                                                            const isMissingNum = !a.num || String(a.num).trim() === '';
                                                            return (
                                                                <div key={i} className={`flex flex-col gap-0.5 p-1.5 border rounded-lg w-[64px] text-center transition-all shadow-sm ${TYPE_COLORS[a.type] || TYPE_COLORS.flat} ${isMissingNum ? 'border-red-300 ring-2 ring-red-50' : ''}`}>
                                                                    <DebouncedInput type="text" className="w-full text-center font-black text-xs outline-none bg-transparent" value={a.num} onChange={val=>updateApt(e,f.id,i,'num',val)} placeholder="№"/>
                                                                    {isDuplexFloor && (<select className="w-full text-[8px] bg-transparent outline-none font-bold cursor-pointer text-center appearance-none border-t border-black/5 mt-0.5 pt-0.5" value={a.type} onChange={ev=>updateApt(e,f.id,i,'type',ev.target.value)}><option value="flat">—</option><option value="duplex_up">Вверх</option>{(f.label === '1' && hasBasement) && <option value="duplex_down">Вниз</option>}</select>)}
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