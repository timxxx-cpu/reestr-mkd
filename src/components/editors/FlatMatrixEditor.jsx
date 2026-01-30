import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ArrowLeft, Save, Wand2, AlertTriangle, CheckCircle2, 
  MousePointer2, CheckSquare, Square, X, Layers, AlertCircle
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, DebouncedInput, TabButton, Button, useReadOnly } from '../ui/UIKit';
import SaveFloatingBar from '../ui/SaveFloatingBar'; 
import { getBlocksList } from '../../lib/utils';
import { useBuildingFloors } from '../../hooks/useBuildingFloors';
import { UnitSchema } from '../../lib/schemas';

const TYPE_COLORS = {
    flat: 'bg-white border-slate-200 hover:border-blue-300',
    office: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    pantry: 'bg-slate-50 border-slate-200 text-slate-500',
    duplex_up: 'bg-purple-50 border-purple-200 text-purple-700',
    duplex_down: 'bg-orange-50 border-orange-200 text-orange-700'
};

/**
 * @param {{ buildingId: string, onBack: () => void }} props
 */
export default function FlatMatrixEditor({ buildingId, onBack }) {
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
    
    const isReadOnly = useReadOnly();
    const [activeBlockIndex, setActiveBlockIndex] = useState(0);
    const [startNum, setStartNum] = useState(1);
    
    // --- НОВОЕ: Режим выделения и навигация ---
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const inputsRef = useRef({});

    const building = composition?.find(c => c.id === buildingId);
    const blocksList = useMemo(() => getBlocksList(building), [building]);
    
    const { floorList: rawFloorList, currentBlock } = useBuildingFloors(buildingId, activeBlockIndex);

    // Сброс при смене блока
    useEffect(() => {
        setSelectedIds(new Set());
        inputsRef.current = {};
    }, [activeBlockIndex]);

    const blockKey = (building && currentBlock) ? `${building.id}_${currentBlock.id}` : null;
    // @ts-ignore
    const blockDetails = blockKey ? (buildingDetails[blockKey] || {}) : {};
    
    const entrances = useMemo(() => 
        Array.from({ length: blockDetails.entrances || 1 }, (_, i) => i + 1),
    [blockDetails.entrances]);

    // Фильтруем этажи, где есть квартиры
    const floorList = useMemo(() => {
        if (!rawFloorList) return [];
        return rawFloorList.filter(f => {
            return entrances.some(e => {
                // @ts-ignore
                const key = `${currentBlock.fullId}_ent${e}_${f.id}`;
                const aptsCount = Number(entrancesData[key]?.apts || 0);
                return aptsCount > 0;
            });
        });
    }, [rawFloorList, entrances, entrancesData, currentBlock]);

    // --- ЛОГИКА ДУБЛИКАТОВ ---
    const duplicateSet = useMemo(() => {
        const counts = {};
        const dups = new Set();
        if (currentBlock) {
            Object.keys(flatMatrix).forEach(k => {
                if (k.startsWith(currentBlock.fullId)) {
                    // @ts-ignore
                    const num = flatMatrix[k]?.num;
                    if (num && String(num).trim() !== '') {
                        counts[num] = (counts[num] || 0) + 1;
                    }
                }
            });
        }
        Object.entries(counts).forEach(([num, count]) => {
            // @ts-ignore
            if (count > 1) dups.add(num);
        });
        return dups;
    }, [flatMatrix, currentBlock]);

    /** @type {(ent: number, floorId: string, idx: number) => { num: string, type: string }} */
    const getApt = (ent, floorId, idx) => {
        if (!currentBlock) return { num: '', type: 'flat' };
        // @ts-ignore
        return flatMatrix[`${currentBlock.fullId}_e${ent}_f${floorId}_i${idx}`] || { num: '', type: 'flat' };
    };

    /** @type {(ent: number, floorId: string, idx: number, field: string, val: string) => void} */
    const updateApt = (ent, floorId, idx, field, val) => {
        if (isReadOnly) return;
        if (!currentBlock) return;
        const key = `${currentBlock.fullId}_e${ent}_f${floorId}_i${idx}`;
        
        setFlatMatrix(prev => ({
            ...prev,
            [key]: { 
                // @ts-ignore
                ...(prev[key] || { type: 'flat' }), 
                [field]: val 
            }
        }));
    };

    const handleKeyDown = (e, fIdx, ent, idx) => {
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        e.preventDefault();

        let nextFIdx = fIdx;
        let nextEnt = ent;
        let nextIdx = idx;

        if (e.key === 'ArrowUp') nextFIdx = Math.max(0, fIdx - 1);
        if (e.key === 'ArrowDown') nextFIdx = Math.min(floorList.length - 1, fIdx + 1);

        if (e.key === 'ArrowLeft') {
            if (nextIdx > 0) {
                nextIdx--;
            } else {
                if (nextEnt > 1) {
                    nextEnt--;
                    // @ts-ignore
                    const prevCount = Number(entrancesData[`${currentBlock.fullId}_ent${nextEnt}_${floorList[nextFIdx].id}`]?.apts || 0);
                    nextIdx = Math.max(0, prevCount - 1);
                }
            }
        }
        if (e.key === 'ArrowRight') {
            // @ts-ignore
            const currentCount = Number(entrancesData[`${currentBlock.fullId}_ent${nextEnt}_${floorList[nextFIdx].id}`]?.apts || 0);
            if (nextIdx < currentCount - 1) {
                nextIdx++;
            } else {
                if (nextEnt < entrances.length) {
                    nextEnt++;
                    nextIdx = 0;
                }
            }
        }

        const nextFloorId = floorList[nextFIdx].id;
        const refKey = `${nextEnt}-${nextFloorId}-${nextIdx}`;
        // @ts-ignore
        if (inputsRef.current[refKey]) {
            // @ts-ignore
            inputsRef.current[refKey].focus();
        }
    };

    const toggleSelection = (key) => {
        if (isReadOnly) return;
        const newSet = new Set(selectedIds);
        if (newSet.has(key)) newSet.delete(key);
        else newSet.add(key);
        setSelectedIds(newSet);
    };

    const applyBulkType = (type) => {
        if (isReadOnly) return;
        const updates = {};
        selectedIds.forEach(key => {
            // @ts-ignore
            updates[key] = { ...(flatMatrix[key] || {}), type };
        });
        setFlatMatrix(prev => ({ ...prev, ...updates }));
        setSelectedIds(new Set());
        setIsSelectionMode(false);
    };

    const isFloorDuplexValid = (floorId) => {
        if (!currentBlock) return true;
        // @ts-ignore
        const isDuplexFloor = floorData[`${currentBlock.fullId}_${floorId}`]?.isDuplex;
        if (!isDuplexFloor) return true;
        return entrances.some(e => {
            // @ts-ignore
            const count = parseInt(entrancesData[`${currentBlock.fullId}_ent${e}_${floorId}`]?.apts || 0);
            for(let i=0; i<count; i++) {
                if (getApt(e, floorId, i).type !== 'flat') return true;
            }
            return false;
        });
    };

    const autoNumber = () => {
        if (isReadOnly) return;
        if (!currentBlock) return;
        let n = startNum;
        const updates = {};
        
        entrances.forEach(e => {
            floorList.forEach(f => {
                // @ts-ignore
                const count = parseInt(entrancesData[`${currentBlock.fullId}_ent${e}_${f.id}`]?.apts || 0);
                for(let i=0; i<count; i++) {
                    const key = `${currentBlock.fullId}_e${e}_f${f.id}_i${i}`;
                    
                    const existing = /** @type {import('../../lib/types').UnitData} */ (flatMatrix[key] || {});
                    
                    if (existing.type === 'office' || existing.type === 'pantry') continue;
                    
                    updates[key] = { ...existing, num: String(n++), type: existing.type || 'flat' };
                }
            });
        });
        // @ts-ignore
        setFlatMatrix(p => ({...p, ...updates})); 
    };

    // [NEW] Функция сохранения
    const handleSave = async () => { 
        const specificData = {};
        Object.keys(flatMatrix).forEach(k => {
            if (k.startsWith(building.id)) {
                // @ts-ignore
                specificData[k] = flatMatrix[k];
            }
        });

        await saveBuildingData(building.id, 'apartmentsData', specificData);
        await saveData({}, true); 
    };

    if (!building || !currentBlock) return <div className="p-12 text-center text-slate-500">Загрузка данных...</div>;

    const hasBasement = rawFloorList?.some(f => f.type === 'basement');

    return (
        <div className="space-y-6 pb-20 w-full animate-in fade-in duration-500 relative">
            <div className="flex items-center justify-between border-b border-slate-200 pb-6 mb-4">
                <div className="flex gap-4 items-center">
                    <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><ArrowLeft size={24}/></button>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">{building.label}</h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Шахматка квартир</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <div className="flex items-center gap-2 bg-slate-100 px-3 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Старт №:</span>
                        <input disabled={isReadOnly} type="number" className={`w-12 bg-transparent font-bold text-xs text-slate-700 outline-none text-center ${isReadOnly ? 'opacity-50' : ''}`} value={startNum} onChange={e=>setStartNum(parseInt(e.target.value)||1)} />
                    </div>
                    <button disabled={isReadOnly} onClick={autoNumber} className={`px-4 py-2 bg-purple-50 text-purple-600 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${isReadOnly ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-100'}`}><Wand2 size={14}/> Авто-нум.</button>
                    
                    <button 
                        disabled={isReadOnly}
                        onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds(new Set()); }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border ${isSelectionMode ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'} ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {isSelectionMode ? <CheckSquare size={14}/> : <MousePointer2 size={14}/>}
                        {isSelectionMode ? 'Режим выделения' : 'Выделение'}
                    </button>

                    <Button variant="secondary" onClick={onBack}>Закрыть</Button>
                </div>
            </div>

            <div className="flex gap-2 p-1 bg-slate-200/50 rounded-xl w-max mb-4">
                 {blocksList.map((b,i) => (<TabButton key={b.id} active={activeBlockIndex===i} onClick={()=>setActiveBlockIndex(i)}>Блок {i+1}</TabButton>))}
            </div>

            {selectedIds.size > 0 && !isReadOnly && (
                <div className="sticky top-4 z-50 mb-4 mx-auto max-w-xl animate-in slide-in-from-top-4 fade-in duration-300">
                    <div className="bg-slate-900 text-white p-2 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700">
                        <div className="bg-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 flex items-center gap-2">
                            <CheckCircle2 size={14} className="text-emerald-400"/>
                            {selectedIds.size}
                        </div>
                        <div className="h-6 w-px bg-slate-700"></div>
                        <div className="flex gap-1">
                            <button onClick={() => applyBulkType('duplex_up')} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-xs font-bold transition-colors">Дуплекс</button>
                            <button onClick={() => applyBulkType('office')} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold transition-colors">Офис</button>
                            <button onClick={() => applyBulkType('flat')} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-bold transition-colors">Квартира</button>
                        </div>
                        <button onClick={() => setSelectedIds(new Set())} className="ml-auto p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"><X size={16}/></button>
                    </div>
                </div>
            )}

            <Card className="shadow-lg border-0 ring-1 ring-slate-200 rounded-xl overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto relative w-full max-w-[calc(100vw-64px)]" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                    <table className="border-collapse bg-white" style={{ width: 'max-content' }}>
                        <thead className="bg-slate-50 border-b text-[10px] uppercase font-bold text-slate-500 sticky top-0 z-30 shadow-md">
                            <tr>
                                <th className="p-4 sticky left-0 bg-slate-50 z-40 border-r border-slate-300 w-20 min-w-[80px] text-center shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">Этаж</th>
                                {entrances.map(e => (
                                    <th key={e} className={`p-4 border-r border-slate-200 min-w-[220px] backdrop-blur ${e % 2 === 0 ? 'bg-slate-50/95' : 'bg-blue-50/50 text-blue-800'}`}>
                                        Подъезд {e}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {floorList.slice().map(f => {
                                // @ts-ignore
                                const isDuplexFloor = floorData[`${currentBlock.fullId}_${f.id}`]?.isDuplex;
                                const isValid = isFloorDuplexValid(f.id);

                                return (
                                    <tr key={f.id} className={`${isDuplexFloor ? 'bg-purple-50/5' : ''} transition-colors h-14`}>
                                        <td className={`p-2 font-bold text-xs sticky left-0 border-r border-slate-300 text-center z-20 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] ${!isValid ? 'bg-red-50 text-red-600' : 'bg-white text-slate-700'}`}>
                                            <div className="flex flex-col items-center gap-0.5">
                                                {f.label}
                                                {isDuplexFloor && (
                                                    <div title={!isValid ? "На дуплексном этаже должна быть хоть одна дуплексная квартира" : ""} className="cursor-help">
                                                        {!isValid ? <AlertTriangle size={12} className="text-red-500" /> : <Layers size={12} className="text-purple-500" />}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        {entrances.map(e => {
                                            // @ts-ignore
                                            const count = parseInt(entrancesData[`${currentBlock.fullId}_ent${e}_${f.id}`]?.apts || 0);
                                            const isEvenCol = e % 2 === 0;
                                            
                                            if (count === 0) return <td key={e} className={`p-2 border-r border-slate-100 ${isEvenCol ? 'bg-slate-50/30' : 'bg-blue-50/10'}`}></td>;
                                            
                                            return (
                                                <td key={e} className={`p-2 border-r border-slate-100 align-top min-w-[220px] ${isEvenCol ? 'bg-slate-50/20' : 'bg-blue-50/5'}`}>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {Array.from({length: count}).map((_, i) => {
                                                            const a = getApt(e, f.id, i);
                                                            const cellKey = `${currentBlock.fullId}_e${e}_f${f.id}_i${i}`;
                                                            const isSelected = selectedIds.has(cellKey);
                                                            // @ts-ignore
                                                            const isDuplicate = duplicateSet.has(a.num);
                                                            
                                                            // ZOD Check для отдельной ячейки
                                                            const result = UnitSchema.safeParse(a);
                                                            const isInvalidSchema = !result.success && a.num !== ''; // Пустой номер - это отдельная проверка ниже
                                                            const isMissingNum = !a.num || String(a.num).trim() === '';

                                                            // Цвет границы
                                                            let borderColorClass = '';
                                                            if (isSelected) borderColorClass = 'border-blue-500 ring-2 ring-blue-200';
                                                            else if (isDuplicate) borderColorClass = 'border-red-500 bg-red-50';
                                                            else if (isInvalidSchema || isMissingNum) borderColorClass = 'border-red-300 border-dashed'; // Пунктир если невалидно
                                                            else borderColorClass = TYPE_COLORS[a.type] || TYPE_COLORS.flat;

                                                            return (
                                                                <div 
                                                                    key={i} 
                                                                    onClick={() => isSelectionMode && !isReadOnly && toggleSelection(cellKey)}
                                                                    className={`
                                                                        flex flex-col gap-0.5 p-1.5 border-2 rounded-lg w-[64px] text-center transition-all shadow-sm relative group
                                                                        ${borderColorClass}
                                                                        ${isSelectionMode && !isReadOnly ? 'cursor-pointer hover:border-blue-400' : ''}
                                                                    `}
                                                                >
                                                                    <div className={`h-1 w-full rounded-full mb-0.5 ${a.type === 'office' ? 'bg-emerald-400' : a.type.includes('duplex') ? 'bg-purple-400' : 'bg-slate-200'}`}></div>
                                                                    
                                                                    {isSelectionMode ? (
                                                                        <div className={`font-black text-xs py-1 ${isDuplicate ? 'text-red-600' : 'text-slate-700'}`}>
                                                                            {a.num || '-'}
                                                                        </div>
                                                                    ) : (
                                                                        <DebouncedInput 
                                                                            // @ts-ignore
                                                                            ref={el => inputsRef.current[`${e}-${f.id}-${i}`] = el}
                                                                            onKeyDown={(ev) => handleKeyDown(ev, floorList.indexOf(f), e, i)}
                                                                            type="text" 
                                                                            className={`w-full text-center font-black text-xs outline-none bg-transparent ${isDuplicate ? 'text-red-600' : 'text-slate-700'} ${isReadOnly ? 'cursor-default' : ''}`} 
                                                                            value={a.num} 
                                                                            onChange={val=>updateApt(e,f.id,i,'num',val)} 
                                                                            placeholder="№"
                                                                            disabled={isReadOnly}
                                                                        />
                                                                    )}

                                                                    {isDuplicate && <div className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 z-20 shadow-sm"><AlertCircle size={8}/></div>}
                                                                    
                                                                    {isDuplexFloor && !isSelectionMode && (
                                                                        <select 
                                                                            disabled={isReadOnly}
                                                                            className={`w-full text-[8px] bg-transparent outline-none font-bold text-center appearance-none border-t border-black/5 mt-0.5 pt-0.5 text-slate-500 ${isReadOnly ? 'cursor-default' : 'cursor-pointer hover:text-blue-600'}`} 
                                                                            value={a.type} 
                                                                            onChange={ev=>updateApt(e,f.id,i,'type',ev.target.value)}
                                                                        >
                                                                            <option value="flat">Кв.</option>
                                                                            <option value="duplex_up">Верх</option>
                                                                            {(f.label === '1' && hasBasement) && <option value="duplex_down">Низ</option>}
                                                                        </select>
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

            {/* [NEW] Новая панель сохранения */}
            <SaveFloatingBar onSave={handleSave} />
        </div>
    );
}