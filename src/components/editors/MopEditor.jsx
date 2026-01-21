import React, { useState, useMemo, useEffect } from 'react';
import { 
  ArrowLeft, Save, Wand2, Hash, Layers, 
  Search, Filter, ArrowDown01, RefreshCw, AlertCircle, Building, DoorOpen
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, DebouncedInput, TabButton, Button } from '../ui/UIKit';

// --- Хелперы ---
function getBlocksList(building) {
    if (!building) return [];
    const list = [];
    if (building.category && building.category.includes('residential')) {
        for(let i=0; i<(building.resBlocks || 0); i++) {
            list.push({ id: `res_${i}`, type: 'Ж', index: i, fullId: `${building.id}_res_${i}`, label: `Блок ${i+1}` });
        }
    }
    if (list.length === 0 && building.category.includes('residential')) {
        list.push({ id: 'main', type: 'Основной', index: 0, fullId: `${building.id}_main`, label: 'Основной блок' });
    }
    return list;
}

export default function FlatMatrixEditor({ buildingId, onBack }) {
    const { composition, buildingDetails, entrancesData, floorData, flatsData, setFlatsData, saveData } = useProject();
    const [activeBlockId, setActiveBlockId] = useState(null);
    const [activeEntrance, setActiveEntrance] = useState(1);
    const [startNumber, setStartNumber] = useState(1); // Начальный номер для пересчета

    const building = composition.find(c => c.id === buildingId);
    const blocksList = useMemo(() => getBlocksList(building), [building]);

    // Инициализация активного таба
    useEffect(() => {
        if (blocksList.length > 0 && !activeBlockId) {
            setActiveBlockId(blocksList[0].id);
        }
    }, [blocksList, activeBlockId]);

    const currentBlock = blocksList.find(b => b.id === activeBlockId);

    // Безопасный выход, если данных нет
    if (!building || !currentBlock) return <div className="p-12 text-center text-slate-400">Нет данных для формирования реестра</div>;

    const blockDetails = buildingDetails[`${building.id}_${currentBlock.id}`] || {};
    const entrancesCount = blockDetails.entrances || 1;
    const entrancesList = Array.from({ length: entrancesCount }, (_, i) => i + 1);

    // --- ГЕНЕРАЦИЯ РЕЕСТРА ---
    const generateRegistry = () => {
        if (Object.keys(flatsData || {}).length > 0 && !window.confirm("Внимание! Это действие полностью пересоздаст список помещений на основе Матрицы подъездов. Все ручные изменения (площади, комнатность) будут потеряны. Продолжить?")) {
            return;
        }

        let currentNumber = startNumber;
        const newFlats = {};

        // 1. Проходим по всем блокам
        blocksList.forEach(blk => {
            const bDetails = buildingDetails[`${building.id}_${blk.id}`] || {};
            const bEntrances = bDetails.entrances || 1;
            const bEntList = Array.from({ length: bEntrances }, (_, i) => i + 1);
            
            // Генерируем список этажей
            const startF = bDetails.floorsFrom || 1;
            const endF = bDetails.floorsTo || 1;
            
            const floorIds = [];
            // Порядок генерации номеров: Снизу вверх (Цоколь -> 1 -> ... -> Мансарда)
            if (bDetails.hasBasementFloor) floorIds.push({id: 'floor_0', label: 'Цоколь', sort: 0});
            for(let i=startF; i<=endF; i++) floorIds.push({id: `floor_${i}`, label: `${i}`, sort: i});
            if(bDetails.hasAttic) floorIds.push({id: 'attic', label: 'Мансарда', sort: 1000});
            
            floorIds.sort((a,b) => a.sort - b.sort);

            // 2. Идем по подъездам
            bEntList.forEach(ent => {
                // 3. Идем по этажам
                floorIds.forEach(f => {
                    const matrixKey = `${blk.fullId}_ent${ent}_${f.id}`;
                    const matrixInfo = entrancesData[matrixKey];

                    if (matrixInfo) {
                        const aptsCount = parseInt(matrixInfo.apts || 0);
                        const unitsCount = parseInt(matrixInfo.units || 0); 

                        // Генерируем квартиры
                        for (let k = 0; k < aptsCount; k++) {
                            const flatId = `${blk.fullId}_ent${ent}_${f.id}_apt_${k+1}`;
                            const height = floorData[`${blk.fullId}_${f.id}`]?.height || ''; 
                            
                            newFlats[flatId] = {
                                id: flatId,
                                number: currentNumber.toString(),
                                type: 'flat', 
                                blockId: blk.id,
                                entrance: ent,
                                floor: f.label,
                                floorId: f.id,
                                rooms: 1, // Дефолт
                                areaProj: '', 
                                areaFact: '',
                                height: height
                            };
                            currentNumber++;
                        }

                        // Генерируем нежилые (офисы)
                        for (let u = 0; u < unitsCount; u++) {
                            const unitId = `${blk.fullId}_ent${ent}_${f.id}_unit_${u+1}`;
                            const height = floorData[`${blk.fullId}_${f.id}`]?.height || '';
                            
                            newFlats[unitId] = {
                                id: unitId,
                                number: `Н-${ent}-${u+1}`, // Временный номер
                                type: 'commercial',
                                blockId: blk.id,
                                entrance: ent,
                                floor: f.label,
                                floorId: f.id,
                                rooms: 0,
                                areaProj: '',
                                areaFact: '',
                                height: height
                            };
                        }
                    }
                });
            });
        });

        setFlatsData(newFlats);
    };

    // Получаем список квартир для текущего вида (фильтрация)
    const visibleFlats = useMemo(() => {
        if (!flatsData) return [];
        return Object.values(flatsData)
            .filter(f => f.blockId === currentBlock.id && f.entrance === activeEntrance)
            .sort((a,b) => {
                // Сортировка: Этаж (числовой), затем Номер
                const floorA = isNaN(parseInt(a.floor)) ? (a.floor==='Цоколь'?-1:100) : parseInt(a.floor);
                const floorB = isNaN(parseInt(b.floor)) ? (b.floor==='Цоколь'?-1:100) : parseInt(b.floor);
                if (floorA !== floorB) return floorA - floorB; 
                
                // Внутри этажа по номеру (пробуем числовое сравнение, иначе строковое)
                const numA = parseInt(a.number);
                const numB = parseInt(b.number);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return a.number.localeCompare(b.number);
            });
    }, [flatsData, currentBlock.id, activeEntrance]);

    const updateFlat = (id, field, value) => {
        setFlatsData(prev => ({
            ...prev,
            [id]: { ...prev[id], [field]: value }
        }));
    };

    // Статистика
    const stats = useMemo(() => {
        const flats = visibleFlats.filter(f => f.type === 'flat');
        const comms = visibleFlats.filter(f => f.type === 'commercial');
        return { flats: flats.length, comms: comms.length };
    }, [visibleFlats]);

    return (
        <div className="space-y-6 pb-20 max-w-7xl mx-auto animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-6 mb-4">
                <div className="flex gap-4 items-center">
                    <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><ArrowLeft size={24}/></button>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">{building.label}</h2>
                        <p className="text-slate-400 text-xs font-bold uppercase">Реестр помещений</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => { saveData(); onBack(); }} className="shadow-lg shadow-blue-200"><Save size={14}/> Сохранить</Button>
                </div>
            </div>

            {/* Панель генерации */}
            <div className="bg-gradient-to-r from-indigo-50 to-white border border-indigo-100 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 mb-6 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
                        <Wand2 size={20}/>
                    </div>
                    <div>
                        <h3 className="font-bold text-indigo-900 text-sm">Авто-генерация реестра</h3>
                        <p className="text-xs text-indigo-600/70">Создать список на основе матрицы подъездов</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                        <label className="text-[9px] uppercase font-bold text-indigo-400 ml-1 mb-0.5">Начать нумерацию с</label>
                        <div className="relative">
                            <Hash size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-indigo-300"/>
                            <input 
                                type="number" 
                                value={startNumber} 
                                onChange={(e)=>setStartNumber(parseInt(e.target.value)||1)}
                                className="w-24 pl-6 pr-2 h-9 rounded-lg border border-indigo-200 text-sm font-bold text-indigo-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                            />
                        </div>
                    </div>
                    <button 
                        onClick={generateRegistry}
                        className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-indigo-200 active:scale-95 flex items-center gap-2"
                    >
                        <RefreshCw size={14}/> Сформировать
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Сайдбар навигации */}
                <div className="lg:col-span-1 space-y-4">
                    {/* Блоки */}
                    <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1">
                        {blocksList.map(b => (
                            <button
                                key={b.id}
                                onClick={() => { setActiveBlockId(b.id); setActiveEntrance(1); }}
                                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeBlockId === b.id ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                <Building size={14} className={activeBlockId === b.id ? 'text-slate-400' : 'text-slate-300'}/>
                                {b.label}
                            </button>
                        ))}
                    </div>

                    {/* Подъезды */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                            <DoorOpen size={14} className="text-slate-400"/>
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase">Подъезды</h3>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {entrancesList.map(e => (
                                <button 
                                    key={e}
                                    onClick={() => setActiveEntrance(e)}
                                    className={`h-9 rounded-lg text-xs font-bold border transition-all ${activeEntrance === e ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'}`}
                                >
                                    № {e}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Статистика */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase">В этом подъезде</h3>
                        <div className="flex justify-between items-center text-xs p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                            <span className="text-emerald-800 font-medium">Жилые</span>
                            <span className="font-bold text-emerald-700 bg-white px-2 py-0.5 rounded shadow-sm">{stats.flats}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs p-2 bg-amber-50 rounded-lg border border-amber-100">
                            <span className="text-amber-800 font-medium">Нежилые</span>
                            <span className="font-bold text-amber-700 bg-white px-2 py-0.5 rounded shadow-sm">{stats.comms}</span>
                        </div>
                    </div>
                </div>

                {/* Таблица */}
                <div className="lg:col-span-3">
                    <Card className="overflow-hidden shadow-xl border-0 ring-1 ring-slate-200 rounded-xl h-full flex flex-col">
                        {visibleFlats.length === 0 ? (
                            <div className="flex-1 min-h-[400px] flex flex-col items-center justify-center text-slate-400 p-8">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                    <ArrowDown01 size={32} className="opacity-30"/>
                                </div>
                                <p className="text-sm font-medium mb-2">Список помещений пуст</p>
                                <p className="text-xs text-center max-w-xs opacity-70">Нажмите кнопку «Сформировать» вверху, чтобы создать реестр на основе введенных ранее данных.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto max-h-[calc(100vh-250px)]">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50 sticky top-0 z-20 shadow-sm border-b border-slate-200 text-[10px] text-slate-500 font-bold uppercase">
                                        <tr>
                                            <th className="p-3 w-20 text-center sticky left-0 bg-slate-50 z-30 border-r border-slate-200">Номер</th>
                                            <th className="p-3 w-20 text-center sticky left-20 bg-slate-50 z-30 border-r border-slate-200 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">Тип</th>
                                            <th className="p-3 w-24 text-center">Этаж</th>
                                            <th className="p-3 w-20 text-center">Комнат</th>
                                            <th className="p-3 w-28 text-center">S Проект (м²)</th>
                                            <th className="p-3 w-28 text-center">S Факт (м²)</th>
                                            <th className="p-3 w-24 text-center">Высота (м)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {visibleFlats.map((flat) => (
                                            <tr key={flat.id} className="hover:bg-slate-50 group focus-within:bg-blue-50/60 transition-colors duration-200">
                                                {/* Номер (Sticky) */}
                                                <td className="p-1 sticky left-0 bg-white group-hover:bg-slate-50 group-focus-within:bg-blue-50/60 transition-colors duration-200 z-10 border-r border-slate-200">
                                                    <input 
                                                        type="text" 
                                                        className="w-full text-center text-sm font-bold text-slate-700 bg-transparent outline-none focus:text-blue-600 h-9"
                                                        value={flat.number}
                                                        onChange={(e) => updateFlat(flat.id, 'number', e.target.value)}
                                                    />
                                                </td>
                                                {/* Тип (Sticky) */}
                                                <td className="p-2 text-center sticky left-20 bg-white group-hover:bg-slate-50 group-focus-within:bg-blue-50/60 transition-colors duration-200 z-10 border-r border-slate-200 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)]">
                                                    {flat.type === 'flat' ? (
                                                        <span className="text-[9px] bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-bold">КВ</span>
                                                    ) : (
                                                        <span className="text-[9px] bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-bold">НЖ</span>
                                                    )}
                                                </td>
                                                
                                                {/* Этаж */}
                                                <td className="p-3 text-center text-xs font-bold text-slate-600">
                                                    {flat.floor}
                                                </td>
                                                
                                                {/* Комнат */}
                                                <td className="p-1">
                                                    <DebouncedInput 
                                                        type="number"
                                                        className="w-full text-center bg-slate-50 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg h-9 text-xs font-bold focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                                        value={flat.rooms}
                                                        onChange={(v) => updateFlat(flat.id, 'rooms', v)}
                                                    />
                                                </td>
                                                
                                                {/* S Проект */}
                                                <td className="p-1">
                                                    <DebouncedInput 
                                                        type="number"
                                                        step="0.01"
                                                        className="w-full text-center bg-slate-50 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg h-9 text-xs font-bold focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all placeholder:text-slate-300"
                                                        placeholder="0.00"
                                                        value={flat.areaProj}
                                                        onChange={(v) => updateFlat(flat.id, 'areaProj', v)}
                                                    />
                                                </td>
                                                
                                                {/* S Факт */}
                                                <td className="p-1">
                                                    <DebouncedInput 
                                                        type="number"
                                                        step="0.01"
                                                        className="w-full text-center bg-slate-50 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg h-9 text-xs font-bold focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all placeholder:text-slate-300"
                                                        placeholder="0.00"
                                                        value={flat.areaFact}
                                                        onChange={(v) => updateFlat(flat.id, 'areaFact', v)}
                                                    />
                                                </td>
                                                
                                                {/* Высота (из обмеров) */}
                                                <td className="p-3 text-center text-xs text-slate-400 font-medium">
                                                    {flat.height ? `${flat.height} м` : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}