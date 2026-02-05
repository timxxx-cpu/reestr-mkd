import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Trash2, Copy, AlertCircle, Wand2, DoorOpen, Ban,
  Building2, Car, Box, Store, LayoutGrid
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useDirectBuildings } from '../../hooks/api/useDirectBuildings';
import { useDirectFloors } from '../../hooks/api/useDirectFloors';
import { useDirectMatrix } from '../../hooks/api/useDirectMatrix';
import { useDirectCommonAreas } from '../../hooks/api/useDirectCommonAreas';
import { useBuildingType } from '../../hooks/useBuildingType';
import { Card, DebouncedInput, useReadOnly } from '../ui/UIKit';
import ConfigHeader from './configurator/ConfigHeader';
import { useCatalog } from '../../hooks/useCatalogs';
import { MopItemSchema } from '../../lib/schemas';

const MOP_TYPES_FALLBACK = [
    'Лестничная клетка', 'Межквартирный коридор', 'Лифтовой холл', 'Тамбур', 'Вестибюль',
    'Колясочная', 'Комната охраны', 'Санузел', 'ПУИ (Уборочная)', 'Электрощитовая',
    'Слаботочная ниша', 'Мусорокамера', 'Техническое подполье', 'Технический этаж',
    'Венткамера', 'ИТП', 'Насосная', 'Машинное отделение лифтов', 'Кровля',
    'Паркинг (зона проезда)', 'Рампа', 'Кладовая', 'Техническое помещение', 'Другое'
];

const DarkTabButton = ({ active, onClick, children, icon: Icon }) => (
    <button
        onClick={onClick}
        className={`
            px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2
            ${active 
                ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50 ring-1 ring-blue-400" 
                : "text-slate-400 hover:text-white hover:bg-slate-700"
            }
        `}
    >
        {Icon && <Icon size={14} className={active ? "text-blue-200" : "opacity-70"}/>}
        {children}
    </button>
);

const getBlockIcon = (type) => {
    if (type === 'residential') return Building2;
    if (type === 'parking') return Car;
    if (type === 'infrastructure') return Box;
    if (type === 'non_residential') return Store;
    return LayoutGrid;
};

export default function MopEditor({ buildingId, onBack }) {
    const { projectId } = useProject();
    const isReadOnly = useReadOnly();

    // 1. Context
    const { buildings } = useDirectBuildings(projectId);
    const building = useMemo(() => buildings.find(b => b.id === buildingId), [buildings, buildingId]);
    const typeInfo = useBuildingType(building);
    const { isUnderground, isParking, isInfrastructure } = typeInfo;

    const [activeBlockIndex, setActiveBlockIndex] = useState(0);
    const draftMopIdsRef = useRef({});
    const currentBlock = useMemo(() => building?.blocks?.[activeBlockIndex], [building, activeBlockIndex]);

    // 2. Data Hooks
    const { floors: rawFloors } = useDirectFloors(currentBlock?.id);
    const { entrances, matrixMap } = useDirectMatrix(currentBlock?.id);
    const { mops, upsertMop, clearAllMops } = useDirectCommonAreas(currentBlock?.id);
    const { options: mopTypeOptions } = useCatalog('dict_mop_types', MOP_TYPES_FALLBACK);

    useEffect(() => {
        draftMopIdsRef.current = {};
    }, [activeBlockIndex]);

    // 3. Logic
    const floors = useMemo(() => {
        // Фильтруем этажи, где есть МОПы по матрице
        if (!rawFloors) return [];
        return rawFloors.filter(f => !f.isStylobate).filter(f => {
            // Показываем этаж, если хотя бы в одном подъезде задано кол-во МОП > 0
            return entrances.some(e => {
                const key = `${f.id}_${e.number}`;
                const qty = parseInt(matrixMap[key]?.mopQty || 0);
                return qty > 0;
            });
        });
    }, [rawFloors, entrances, matrixMap]);

    // Группировка МОП для рендера [floorId][entranceId] -> Array<Mop>
    const mopGrid = useMemo(() => {
        const grid = {};
        mops.forEach(m => {
            if (!grid[m.floorId]) grid[m.floorId] = {};
            if (!grid[m.floorId][m.entranceId]) grid[m.floorId][m.entranceId] = [];
            grid[m.floorId][m.entranceId].push(m);
        });
        return grid;
    }, [mops]);

    // Actions
    const updateMop = (mopId, floorId, entranceId, slotIndex, field, val) => {
        if (isReadOnly) return;

        const slotKey = `${floorId}_${entranceId}_${slotIndex}`;
        const stableDraftId = draftMopIdsRef.current[slotKey] || crypto.randomUUID();
        draftMopIdsRef.current[slotKey] = stableDraftId;

        const currentMops = mopGrid[floorId]?.[entranceId] || [];
        const existingMop = (mopId && mops.find(m => m.id === mopId)) || currentMops[slotIndex];
        const payload = {
            id: existingMop?.id || stableDraftId,
            floorId,
            entranceId,
            type: existingMop?.type,
            area: existingMop?.area,
            [field]: val
        };
        upsertMop(payload);
    };

    const handleClearAll = async () => {
        if (isReadOnly) return;
        if (confirm("Удалить все данные МОП в этом блоке?")) {
            await clearAllMops();
        }
    };

    const autoFillMops = async () => {
        if (isReadOnly) return;
        if (!confirm("Сгенерировать записи для МОП?")) return;

        const promises = [];
        floors.forEach(f => {
            entrances.forEach(e => {
                const key = `${f.id}_${e.number}`;
                const targetQty = parseInt(matrixMap[key]?.mopQty || 0);
                const currentMops = mopGrid[f.id]?.[e.id] || [];
                const needed = targetQty - currentMops.length;

                let defaultType = 'Лестничная клетка';
                if (isUnderground) defaultType = 'Паркинг (зона проезда)';
                else if (f.type === 'basement') defaultType = 'Техническое подполье';
                else if (f.type === 'roof') defaultType = 'Кровля';

                for(let i=0; i<needed; i++) {
                    let type = defaultType;
                    // Простая логика типов для 2-го и 3-го МОП
                    const idx = currentMops.length + i;
                    if (!isUnderground && idx === 1) type = 'Лифтовой холл';
                    if (!isUnderground && idx === 2) type = 'Межквартирный коридор';

                    const slotKey = `${f.id}_${e.id}_${idx}`;
                    const stableDraftId = draftMopIdsRef.current[slotKey] || crypto.randomUUID();
                    draftMopIdsRef.current[slotKey] = stableDraftId;
                    promises.push(upsertMop({
                        id: stableDraftId,
                        floorId: f.id,
                        entranceId: e.id,
                        type,
                        area: '15'
                    }));
                }
            });
        });
        await Promise.all(promises);
    };
    
    // --- Validation State ---
    const validationState = useMemo(() => {
        let missing = 0;
        let valid = true;
        floors.forEach(f => {
            entrances.forEach(e => {
                const key = `${f.id}_${e.number}`;
                const target = parseInt(matrixMap[key]?.mopQty || 0);
                const current = (mopGrid[f.id]?.[e.id] || []).length;
                if (current < target) {
                    missing += (target - current);
                    valid = false;
                }
                // Проверка заполненности
                (mopGrid[f.id]?.[e.id] || []).forEach(m => {
                    if (!m.type || !m.area) valid = false;
                });
            });
        });
        return { isValid: valid, missingCount: missing };
    }, [floors, entrances, matrixMap, mopGrid]);

    if (!building || !currentBlock) return <div className="p-12 text-center text-slate-500">Загрузка...</div>;

    const showEditor = (currentBlock.type === 'residential') || isUnderground; // 'residential' matches API mapper

    const renderBadge = (type) => {
        const map = {
            residential: { color: 'bg-blue-50 text-blue-600 border-blue-100', label: 'Жилой' },
            mixed: { color: 'bg-violet-50 text-violet-600 border-violet-100', label: 'Смеш.' },
            technical: { color: 'bg-amber-50 text-amber-600 border-amber-100', label: 'Тех.' },
            basement: { color: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Подвал' },
            attic: { color: 'bg-teal-50 text-teal-600 border-teal-100', label: 'Манс.' },
            parking_floor: { color: 'bg-indigo-50 text-indigo-600 border-indigo-100', label: 'Паркинг' },
        };
        const style = map[type] || map.residential;
        return <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase border ${style.color}`}>{style.label}</span>
    }

    return (
        <div className="space-y-6 pb-24 w-full px-4 md:px-6 2xl:px-8 max-w-[2400px] mx-auto animate-in fade-in duration-500 relative">
            <ConfigHeader 
                building={building} 
                isParking={isParking} 
                isInfrastructure={isInfrastructure} 
                isUnderground={isUnderground} 
                onBack={onBack} 
                isSticky={false}
            />

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                 <div className="flex items-center gap-1.5 p-1.5 bg-slate-800 rounded-xl w-max overflow-x-auto max-w-full shadow-inner border border-slate-700 custom-scrollbar">
                    {building.blocks.map((b,i) => (
                        <DarkTabButton 
                            key={b.id} 
                            active={activeBlockIndex===i} 
                            onClick={()=>setActiveBlockIndex(i)} 
                            icon={getBlockIcon(b.type)}
                        >
                            {b.label}
                        </DarkTabButton>
                    ))}
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={handleClearAll} disabled={!showEditor || isReadOnly} className={`px-4 py-2.5 bg-red-50 text-red-600 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors border border-red-100 shadow-sm ${isReadOnly ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-100'}`}>
                        <Trash2 size={14}/> Очистить
                    </button>
                    
                    <button onClick={autoFillMops} disabled={!showEditor || isReadOnly} className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors border shadow-sm ${showEditor && !isReadOnly ? 'bg-white text-purple-600 border-purple-100 hover:bg-purple-50' : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'}`}>
                        <Wand2 size={14}/> Авто-генерация
                    </button>
                </div>
            </div>

            {/* Content */}
            {showEditor ? (
                <>
                    {(!validationState.isValid && !isReadOnly) && (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-xs text-red-600 animate-in slide-in-from-top-2">
                            <AlertCircle size={16}/>
                            <span className="font-bold">Внимание!</span>
                            <span>Заполните данные для всех {validationState.missingCount} помещений. Используйте "Авто-генерацию".</span>
                        </div>
                    )}
                    <Card className="shadow-lg border-0 ring-1 ring-slate-200 rounded-xl overflow-hidden flex flex-col">
                        <div className="flex-1 overflow-auto relative w-full max-w-[calc(100vw-64px)]" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                            <table className="w-max min-w-full border-collapse table-fixed">
                                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 font-bold uppercase sticky top-0 z-30 shadow-md">
                                    <tr>
                                        <th className="p-4 w-36 min-w-[140px] sticky left-0 bg-slate-50 z-40 border-r border-slate-200 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">Этаж</th>
                                        {entrances.map(e => (
                                            <th key={e.id} className="p-4 w-[340px] min-w-[340px] border-r border-slate-200 bg-slate-50/95 backdrop-blur">{isUnderground ? `Вход ${e.number}` : `Подъезд ${e.number}`}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {floors.map((f) => (
                                        <tr key={f.id} className="group hover:bg-slate-50/50 focus-within:bg-blue-50/50 transition-colors duration-200">
                                            <td className="p-3 w-36 min-w-[140px] sticky left-0 bg-white group-focus-within:bg-blue-50 transition-colors duration-200 border-r align-top relative z-20 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)]">
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center justify-between h-full px-1">
                                                        <span className="font-bold text-sm text-slate-700">{f.label}</span>
                                                        {renderBadge(f.type)}
                                                    </div>
                                                </div>
                                            </td>
                                            {entrances.map((e) => {
                                                const matrixKey = `${f.id}_${e.number}`;
                                                const targetQty = parseInt(matrixMap[matrixKey]?.mopQty || 0);
                                                const currentMops = mopGrid[f.id]?.[e.id] || [];
                                                
                                                return (
                                                    <td key={e.id} className="p-3 w-[340px] min-w-[340px] align-top border-r relative group/cell">
                                                        {targetQty > 0 ? (
                                                            <div className="flex flex-col gap-2">
                                                                {/* Рендерим слоты на основе targetQty. Если данных в БД нет - показываем пустые поля для создания */}
                                                                {Array.from({ length: targetQty }).map((_, mIdx) => {
                                                                    const mop = currentMops[mIdx] || {};
                                                                    // ID есть только у существующих. Для новых передаем undefined в updateMop
                                                                    const isValid = mop.type && mop.area;
                                                                    
                                                                    return (
                                                                        <div key={mop.id || mIdx} className={`flex gap-1 items-center bg-white border rounded-lg p-1 shadow-sm transition-all focus-within:ring-2 focus-within:ring-blue-100 ${isValid ? 'border-slate-200' : 'border-red-300 bg-red-50/20'}`}>
                                                                            <div className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-500 shrink-0">{mIdx + 1}</div>
                                                                            <select 
                                                                                className={`bg-transparent text-[10px] font-bold w-full outline-none truncate ${isReadOnly ? 'cursor-default text-slate-700 appearance-none' : 'cursor-pointer hover:text-blue-600 focus:text-blue-700'}`} 
                                                                                value={mop.type || ''} 
                                                                                onChange={ev => updateMop(mop.id, f.id, e.id, mIdx, 'type', ev.target.value)} 
                                                                                title={mop.type}
                                                                                disabled={isReadOnly}
                                                                            >
                                                                                <option value="" disabled>Выберите тип</option>
                                                                                {mopTypeOptions.map(t => <option key={t.code} value={t.label}>{t.label}</option>)}
                                                                            </select>
                                                                            <div className="w-px h-4 bg-slate-200 shrink-0"/>
                                                                            <div className="relative w-16 shrink-0">
                                                                                <DebouncedInput 
                                                                                    type="number" 
                                                                                    min="0"
                                                                                    className={`w-full bg-slate-50 border rounded px-1 py-0.5 text-[10px] font-medium text-center focus:bg-white focus:border-blue-300 outline-none transition-all ${!mop.area ? 'border-red-200' : 'border-slate-100'} ${isReadOnly ? 'cursor-default bg-transparent border-transparent' : ''}`} 
                                                                                    placeholder="м²" 
                                                                                    value={mop.area || ''} 
                                                                                    onChange={val => updateMop(mop.id, f.id, e.id, mIdx, 'area', val)} 
                                                                                    disabled={isReadOnly}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (<div className="h-full flex items-center justify-center text-slate-300 text-[10px] font-medium italic">Нет МОП</div>)}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4 animate-in fade-in">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400"><DoorOpen size={40} /><div className="absolute"><Ban size={20} className="text-slate-400 translate-x-4 translate-y-4"/></div></div>
                    <h3 className="text-xl font-bold text-slate-700">Настройка МОП недоступна</h3>
                    <p className="text-slate-500 max-w-md">Инвентаризация МОП производится только для жилых блоков и подземных паркингов.</p>
                </div>
            )}
        </div>
    );
}