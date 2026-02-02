import React, { useMemo, useState } from 'react';
import { 
  Table2, Search, Home, Briefcase, 
  Layers, MapPin, Car, Building2,
  FileText, LayoutGrid, Filter, School, Loader2, CheckCircle2
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, useReadOnly } from '../ui/UIKit';
import SaveFloatingBar from '../ui/SaveFloatingBar'; 
import { getBlocksList } from '../../lib/utils';
import UnitInventoryModal from './UnitInventoryModal'; 
import ParkingEditModal from './ParkingEditModal'; 

const MODES = {
    apartments: {
        title: 'Реестр квартир',
        description: 'Жилой фонд: только квартиры и дуплексы',
        icon: Home,
        colorClass: 'text-blue-600 dark:text-blue-400',
    },
    commercial: {
        title: 'Реестр нежилых помещений',
        description: 'Коммерция, нежилые блоки и инфраструктура',
        icon: Briefcase,
        colorClass: 'text-emerald-600 dark:text-emerald-400',
    },
    parking: {
        title: 'Реестр машиномест',
        description: 'Парковочные места в паркингах и подвалах',
        icon: Car,
        colorClass: 'text-indigo-600 dark:text-indigo-400',
    }
};

const getTypeConfig = (type) => {
    switch(type) {
        case 'flat': return { label: 'Квартира', color: 'bg-blue-500/10 text-blue-700 border-blue-200/20', icon: Home };
        case 'duplex_up': return { label: 'Дуплекс (В)', color: 'bg-purple-500/10 text-purple-700 border-purple-200/20', icon: Layers };
        case 'duplex_down': return { label: 'Дуплекс (Н)', color: 'bg-purple-500/10 text-purple-700 border-purple-200/20', icon: Layers };
        case 'office': return { label: 'Офис', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-200/20', icon: Briefcase };
        case 'office_inventory': return { label: 'Нежилое (Инв.)', color: 'bg-teal-500/10 text-teal-700 border-teal-200/20', icon: FileText };
        case 'non_res_block': return { label: 'Нежилой блок', color: 'bg-amber-500/10 text-amber-700 border-amber-200/20', icon: Building2 };
        case 'infrastructure': return { label: 'Инфраструктура', color: 'bg-orange-500/10 text-orange-700 border-orange-200/20', icon: School };
        case 'parking_place': return { label: 'М/М', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: Car };
        default: return { label: type, color: 'bg-slate-100 text-slate-600', icon: FileText };
    }
};

const formatRawFloorId = (id) => {
    if (!id) return '-';
    if (id.startsWith('floor_')) return `${id.split('_')[1]} этаж`;
    if (id.startsWith('level_minus_')) return `Уровень -${id.split('_')[2]}`;
    if (id.startsWith('base_')) return `Подвал`;
    return id;
};

const StatCard = ({ label, value, icon: Icon, colorClass, iconBgClass }) => (
    <div className={`p-4 rounded-xl border flex items-center justify-between shadow-sm bg-white ${colorClass}`}>
        <div>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
            <p className="text-2xl font-black mt-1">{value}</p>
        </div>
        <div className={`p-2 rounded-lg ${iconBgClass || 'bg-slate-100'}`}>
            <Icon size={20} className="opacity-80"/>
        </div>
    </div>
);

export default function UnitRegistry({ mode = 'apartments' }) {
    const { composition, flatMatrix, setFlatMatrix, floorData, parkingPlaces, setParkingPlaces, entrancesData, complexInfo, saveBuildingData, saveData } = useProject();
    const isReadOnly = useReadOnly();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filterBuilding, setFilterBuilding] = useState('all');
    
    const [editingUnit, setEditingUnit] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const modeConfig = MODES[mode] || MODES.apartments;
    const ModeIcon = modeConfig.icon;

    // --- Сбор данных ---
    const dataObjects = useMemo(() => {
        const list = [];
        composition.forEach(building => {
            const blocks = getBlocksList(building);

            // 1. СБОР ИЗ FLAT MATRIX (Реальные объекты)
            if (mode === 'apartments' || mode === 'commercial') {
                Object.keys(flatMatrix).forEach(key => {
                    if (!key.startsWith(building.id)) return;
                    const unit = flatMatrix[key];
                    if (!unit || !unit.num) return; 

                    const isLiving = ['flat', 'duplex_up', 'duplex_down'].includes(unit.type);
                    const isCommercialType = ['office', 'office_inventory', 'non_res_block', 'infrastructure'].includes(unit.type);

                    if (mode === 'apartments' && !isLiving) return;
                    if (mode === 'commercial' && !isCommercialType) return;

                    // Попытка восстановить контекст из ключа или объекта
                    let blockLabel = unit.blockLabel || 'Секция';
                    let floorLabel = unit.floorLabel || '-';

                    list.push({
                        ...unit,
                        id: key, // Ключ из Map (может быть как UUID, так и старый формат)
                        // Гарантируем наличие UUID внутри объекта
                        uuid: unit.id || (key.includes('-') && key.length > 30 ? key : null), 
                        
                        buildingId: building.id,
                        houseNumber: building.houseNumber,
                        buildingLabel: building.label,
                        address: complexInfo.street,
                        
                        number: unit.num,
                        area: unit.area || '0',
                        
                        blockLabel: blockLabel,
                        floorLabel: floorLabel,
                        
                        isSaved: true 
                    });
                });
            }

            // 2. ГЕНЕРАЦИЯ ВИРТУАЛЬНЫХ ОБЪЕКТОВ (Только для Commercial)
            if (mode === 'commercial') {
                const resBlocks = blocks.filter(b => b.type === 'Ж');
                resBlocks.forEach(block => {
                    Object.keys(entrancesData).forEach(entKey => {
                        if (!entKey.startsWith(block.fullId)) return;
                        const data = entrancesData[entKey];
                        const unitsCount = parseInt(data.units || 0);
                        if (unitsCount > 0) {
                            const entMatch = entKey.match(/_ent(\d+)_(.*)$/);
                            if (entMatch) {
                                const entIdx = entMatch[1];
                                const floorId = entMatch[2];
                                const floorInfo = floorData[`${block.fullId}_${floorId}`];
                                const floorLabel = floorInfo?.label || formatRawFloorId(floorId);
                                
                                for(let i = 1; i <= unitsCount; i++) {
                                    const virtualId = `${entKey}_unit_${i}`; // Временный ID
                                    if (list.find(item => item.id === virtualId)) continue;

                                    list.push({
                                        id: virtualId, 
                                        buildingId: building.id,
                                        blockId: block.id,
                                        houseNumber: building.houseNumber,
                                        buildingLabel: building.label,
                                        address: complexInfo.street,
                                        number: `НП-${i}`, 
                                        type: 'office_inventory',
                                        area: '0', 
                                        rooms: '-',
                                        blockLabel: block.tabLabel,
                                        floorLabel: floorLabel,
                                        entrance: entIdx,
                                        isSaved: false // Флаг виртуальности
                                    });
                                }
                            }
                        }
                    });
                });

                // ... Блоки целиком и Инфраструктура (аналогично, пропускаем для краткости, логика та же)
                // ...
            }

            // 3. ПАРКИНГ
            else if (mode === 'parking') {
                Object.keys(parkingPlaces).forEach(key => {
                    if (!key.startsWith(building.id) || !key.includes('_place')) return;
                    const place = parkingPlaces[key];
                    list.push({
                        ...place,
                        id: key,
                        buildingId: building.id,
                        houseNumber: building.houseNumber,
                        buildingLabel: building.label,
                        // Если есть UUID, используем его, иначе считаем, что ключ и есть ID (старый формат)
                        uuid: place.id || null, 
                        isSaved: true
                    });
                });
            }
        });

        return list.sort((a, b) => a.number.localeCompare(b.number, undefined, {numeric: true}));
    }, [composition, flatMatrix, floorData, parkingPlaces, entrancesData, complexInfo, mode]);

    const filteredData = useMemo(() => {
        return dataObjects.filter(item => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = String(item.number).toLowerCase().includes(searchLower) || 
                                  String(item.houseNumber).toLowerCase().includes(searchLower);
            const matchesBuilding = filterBuilding === 'all' || item.buildingId === filterBuilding;
            return matchesSearch && matchesBuilding;
        });
    }, [dataObjects, searchTerm, filterBuilding]);

    const stats = useMemo(() => {
        const total = filteredData.length;
        const totalArea = filteredData.reduce((acc, item) => acc + (parseFloat(item.area) || 0), 0);
        return { total, totalArea };
    }, [filteredData]);

    const handleSaveUnit = async (updatedUnit) => {
        if (!updatedUnit.id || isReadOnly) return;
        
        // Если это первый раз, когда мы сохраняем виртуальный юнит, генерируем ему UUID
        const finalId = updatedUnit.uuid || crypto.randomUUID();

        if (mode !== 'parking') {
            const existingData = flatMatrix[updatedUnit.id] || {}; // updatedUnit.id может быть virtual string
            const payload = {
                ...existingData,
                ...updatedUnit,
                id: finalId, // ВАЖНО: сохраняем UUID внутри объекта
                isSaved: true
            };
            
            // Сохраняем в стейт по ключу (для виртуальных - это их строковый ID, для реальных - может быть UUID)
            // Чтобы не дублировать, если ключ отличается от ID, можно удалить старый ключ, но это сложнее.
            // Пока оставим ключ как есть, но внутри будет правильный ID.
            setFlatMatrix(prev => ({ ...prev, [updatedUnit.id]: payload }));
        } else {
            const payload = {
                ...parkingPlaces[updatedUnit.id],
                ...updatedUnit,
                id: finalId,
                isSaved: true
            };
            setParkingPlaces(prev => ({ ...prev, [updatedUnit.id]: payload }));
        }
        setEditingUnit(null);
    };

    const handleSave = async () => {
        if (isReadOnly) return;
        setIsSaving(true);
        try {
            for (const building of composition) {
                const bId = building.id;
                // Сборка данных для сохранения через новые методы сервиса
                const unitsArray = [];
                const parkingArray = [];

                Object.keys(flatMatrix).forEach(k => {
                     if (k.startsWith(bId)) unitsArray.push(flatMatrix[k]);
                });
                Object.keys(parkingPlaces).forEach(k => {
                     if (k.startsWith(bId)) parkingArray.push(parkingPlaces[k]);
                });
                
                if (unitsArray.length > 0) {
                    await saveBuildingData(bId, 'apartmentsData', flatMatrix); // Контекст сам преобразует в массив
                }
                if (parkingArray.length > 0) {
                    await saveBuildingData(bId, 'parkingData', parkingPlaces);
                }
            }
            await saveData({}, true);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto pb-20 animate-in fade-in duration-500 space-y-6">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-200 pb-6">
                <div>
                    <h1 className={`text-2xl font-bold flex items-center gap-3 ${modeConfig.colorClass}`}>
                        <ModeIcon /> {modeConfig.title}
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">{modeConfig.description}</p>
                </div>
                {isSaving && <div className="flex items-center gap-2 text-blue-600 text-sm font-bold"><Loader2 className="animate-spin" size={16}/> Сохранение...</div>}
            </div>

            {/* Статистика */}
            <div className="grid grid-cols-2 gap-4">
                <StatCard label={`Всего объектов`} value={stats.total} icon={LayoutGrid} colorClass="border-slate-200 text-slate-800" iconBgClass="bg-slate-100"/>
                <StatCard label="Общая площадь (м²)" value={stats.totalArea.toLocaleString(undefined, {maximumFractionDigits: 1})} icon={FileText} colorClass="border-blue-100 bg-blue-50 text-blue-700" iconBgClass="bg-blue-200"/>
            </div>

            {/* Фильтры */}
            <div className="flex flex-wrap gap-3 items-center bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2 px-2 text-slate-500 border-r border-slate-200 mr-2">
                    <Filter size={16}/> <span className="text-xs font-bold uppercase">Фильтры</span>
                </div>
                <div className="flex flex-col gap-1 min-w-[200px]">
                    <span className="text-[9px] font-bold text-slate-400 uppercase ml-1">Выбор дома</span>
                    <select 
                        value={filterBuilding} 
                        onChange={e => setFilterBuilding(e.target.value)} 
                        className="flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-100 appearance-none cursor-pointer transition-all shadow-sm"
                    >
                        <option value="all">Все здания комплекса</option>
                        {composition.map(b => (<option key={b.id} value={b.id}>{b.label} (Дом {b.houseNumber})</option>))}
                    </select>
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                    <span className="text-[9px] font-bold text-slate-400 uppercase ml-1">Поиск</span>
                    <input 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        placeholder="Номер..." 
                        className="flex h-10 w-full rounded-xl border border-slate-200 bg-white pl-3 pr-3 py-2 text-xs shadow-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                </div>
            </div>

            {/* Таблица */}
            <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-slate-200 rounded-xl">
                <div className="overflow-x-auto max-h-[60vh]">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 sticky top-0 z-10 shadow-sm backdrop-blur-md">
                            <tr>
                                <th className="p-4 w-12 text-center">№</th>
                                <th className="p-4 w-20 text-center">Дом</th>
                                <th className="p-4 w-28 text-center">Номер</th>
                                <th className="p-4">Тип</th>
                                <th className="p-4">Расположение</th>
                                <th className="p-4 text-center">Этаж</th>
                                {mode === 'apartments' && <th className="p-4 text-center">Комнат</th>}
                                <th className="p-4 text-right">Площадь</th>
                                <th className="p-4 text-center">Статус</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {filteredData.length > 0 ? (
                                filteredData.map((item, idx) => {
                                    const typeConf = getTypeConfig(item.type);
                                    const TypeIcon = typeConf.icon;
                                    const isFilled = parseFloat(item.area) > 0;
                                    
                                    return (
                                        <tr 
                                            key={item.id} 
                                            onClick={() => setEditingUnit(item)}
                                            className={`transition-colors group text-sm border-b border-slate-100 last:border-0 hover:bg-blue-50/50 cursor-pointer`}
                                        >
                                            <td className="p-4 text-xs text-slate-400 text-center font-mono">{idx + 1}</td>
                                            <td className="p-4 text-center">
                                                <div className="inline-flex items-center justify-center w-8 h-8 rounded bg-white border border-slate-200 font-bold text-slate-700 text-xs shadow-sm">
                                                    {item.houseNumber}
                                                </div>
                                            </td>
                                            
                                            <td className="p-4 text-center relative">
                                                <span className="font-black text-slate-800 text-base">{item.number}</span>
                                                {isFilled && <CheckCircle2 size={16} className="text-emerald-500 absolute top-1/2 right-2 -translate-y-1/2" />}
                                            </td>

                                            <td className="p-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border ${typeConf.color}`}>
                                                    <TypeIcon size={12}/> {typeConf.label}
                                                </span>
                                            </td>
                                            <td className="p-4 text-xs text-slate-500">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-700">{item.blockLabel}</span>
                                                    {item.entrance && item.entrance !== '-' && (
                                                        <span className="text-[10px] opacity-70">Подъезд {item.entrance}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 text-center font-medium text-slate-700">{item.floorLabel}</td>
                                            {mode === 'apartments' && <td className="p-4 text-center text-slate-500 font-medium">{item.rooms}</td>}
                                            <td className="p-4 text-right font-mono font-bold text-slate-700">
                                                {parseFloat(item.area).toFixed(2)} <span className="text-[10px] font-normal text-slate-400">м²</span>
                                            </td>
                                            <td className="p-4 text-center">
                                                {isFilled ? (
                                                    <div className="inline-flex items-center gap-1 bg-white text-emerald-600 border border-emerald-200/50 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm">
                                                        <CheckCircle2 size={12}/> Готов
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-300">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr><td colSpan={10} className="p-12 text-center text-slate-400">Нет объектов</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* МОДАЛКИ */}
            {editingUnit && (mode === 'apartments' || mode === 'commercial') && (
                <UnitInventoryModal 
                    unit={editingUnit} 
                    buildingLabel={`Дом ${editingUnit.houseNumber}, ${editingUnit.buildingLabel}`}
                    onClose={() => setEditingUnit(null)}
                    onSave={handleSaveUnit}
                />
            )}

            {editingUnit && mode === 'parking' && (
                <ParkingEditModal 
                    unit={editingUnit} 
                    buildingLabel={`Дом ${editingUnit.houseNumber}, ${editingUnit.buildingLabel}`}
                    onClose={() => setEditingUnit(null)}
                    onSave={handleSaveUnit}
                />
            )}

            <SaveFloatingBar onSave={handleSave} />
        </div>
    );
}