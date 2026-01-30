import React, { useMemo, useState } from 'react';
import { 
  Table2, Search, Home, Briefcase, 
  Layers, MapPin, Car, Building2,
  FileText, LayoutGrid, Filter, School, Edit2, Loader2, CheckCircle2,
  Sofa, BedDouble, Bath, Utensils
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, useReadOnly } from '../ui/UIKit';
import SaveFloatingBar from '../ui/SaveFloatingBar'; 
import { getBlocksList } from '../../lib/utils';
import UnitInventoryModal from './UnitInventoryModal'; 
import ParkingEditModal from './ParkingEditModal'; 

// Конфигурация режимов
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
        case 'flat': return { label: 'Квартира', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200/20', icon: Home };
        case 'duplex_up': return { label: 'Дуплекс (В)', color: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200/20', icon: Layers };
        case 'duplex_down': return { label: 'Дуплекс (Н)', color: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200/20', icon: Layers };
        case 'office': return { label: 'Офис', color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200/20', icon: Briefcase };
        case 'office_inventory': return { label: 'Нежилое (Инв.)', color: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-200/20', icon: FileText };
        case 'non_res_block': return { label: 'Нежилой блок', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200/20', icon: Building2 };
        case 'infrastructure': return { label: 'Инфраструктура', color: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-200/20', icon: School };
        case 'parking_place': return { label: 'М/М', color: 'bg-secondary text-secondary-foreground border-border', icon: Car };
        default: return { label: type, color: 'bg-muted text-muted-foreground', icon: FileText };
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
    <div className={`p-4 rounded-xl border flex items-center justify-between shadow-sm bg-card text-card-foreground ${colorClass}`}>
        <div>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
            <p className="text-2xl font-black mt-1">{value}</p>
        </div>
        <div className={`p-2 rounded-lg ${iconBgClass || 'bg-muted'}`}>
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

            // 1. СБОР ИЗ FLAT MATRIX
            if (mode === 'apartments' || mode === 'commercial') {
                Object.keys(flatMatrix).forEach(key => {
                    if (!key.startsWith(building.id)) return;
                    const unit = flatMatrix[key];
                    if (!unit || !unit.num) return; 

                    const isLiving = ['flat', 'duplex_up', 'duplex_down'].includes(unit.type);
                    const isCommercialType = ['office', 'office_inventory', 'non_res_block', 'infrastructure'].includes(unit.type);

                    if (mode === 'apartments' && !isLiving) return;
                    if (mode === 'commercial' && !isCommercialType) return;

                    const regex = /^(.*)_e(\d+)_f(.+)_i(\d+)$/;
                    let blockLabel = 'Секция'; 
                    let floorLabel = '-';
                    let entranceIndex = unit.entrance || '-';

                    const match = key.match(regex);
                    if (match) {
                        const [, blockFullId, entIdx, floorId] = match;
                        const blockConfig = blocks.find(b => b.fullId === blockFullId);
                        const floorInfo = floorData[`${blockFullId}_${floorId}`];
                        
                        blockLabel = blockConfig ? blockConfig.tabLabel : 'Секция';
                        floorLabel = floorInfo?.label || formatRawFloorId(floorId);
                        entranceIndex = entIdx;
                    } else {
                        if (unit.blockLabel) blockLabel = unit.blockLabel;
                        if (unit.floorLabel) floorLabel = unit.floorLabel;
                    }

                    list.push({
                        id: key,
                        buildingId: building.id,
                        houseNumber: building.houseNumber,
                        buildingLabel: building.label,
                        address: complexInfo.street,
                        
                        number: unit.num,
                        type: unit.type,
                        area: unit.area || '0',
                        
                        livingArea: unit.livingArea,
                        usefulArea: unit.usefulArea,
                        mainArea: unit.mainArea,
                        auxArea: unit.auxArea,
                        
                        rooms: unit.rooms || '-',
                        roomsList: unit.roomsList || [], 
                        
                        blockLabel: blockLabel,
                        floorLabel: floorLabel,
                        entrance: entranceIndex,
                        
                        isSaved: true 
                    });
                });
            }

            // 2. ГЕНЕРАЦИЯ ВИРТУАЛЬНЫХ ОБЪЕКТОВ (Только для Commercial)
            if (mode === 'commercial') {
                // А. Нежилые из инвентаризации
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
                                    const virtualId = `${entKey}_unit_${i}`;
                                    if (list.find(item => item.id === virtualId)) continue;

                                    list.push({
                                        id: virtualId, 
                                        buildingId: building.id,
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
                                        isSaved: false
                                    });
                                }
                            }
                        }
                    });
                });

                // Б. Блоки целиком
                const nonResBlocks = blocks.filter(b => b.type === 'Н');
                nonResBlocks.forEach(block => {
                    const virtualId = `${building.id}_${block.id}_whole`;
                    if (list.find(item => item.id === virtualId)) return;

                    let totalArea = 0;
                    Object.entries(floorData).forEach(([k, v]) => {
                        if (k.startsWith(`${building.id}_${block.id}`)) {
                            totalArea += (parseFloat(v.areaProj) || 0);
                        }
                    });
                    
                    list.push({
                        id: virtualId,
                        buildingId: building.id,
                        houseNumber: building.houseNumber,
                        buildingLabel: building.label,
                        address: complexInfo.street,
                        number: block.tabLabel, 
                        type: 'non_res_block',
                        area: totalArea.toFixed(2), 
                        rooms: '-',
                        blockLabel: 'Целый блок',
                        floorLabel: 'Все этажи',
                        entrance: '-',
                        isSaved: false
                    });
                });

                // В. Инфраструктура
                if (building.category === 'infrastructure') {
                    const virtualId = building.id; 
                    const exists = list.find(item => item.id === virtualId);
                    
                    if (!exists) {
                        let infraArea = 0;
                        Object.entries(floorData).forEach(([k, v]) => {
                            if (k.startsWith(`${building.id}_main`)) {
                                infraArea += (parseFloat(v.areaProj) || 0);
                            }
                        });
                        list.push({
                            id: virtualId,
                            buildingId: building.id,
                            houseNumber: building.houseNumber,
                            buildingLabel: building.label, 
                            address: complexInfo.street,
                            number: building.houseNumber, 
                            type: 'infrastructure',
                            area: infraArea.toFixed(2),
                            rooms: '-',
                            blockLabel: building.infraType || 'Инфраструктура',
                            floorLabel: 'Все этажи',
                            entrance: '-',
                            isSaved: false
                        });
                    }
                }
            }

            // 3. ПАРКИНГ
            else if (mode === 'parking') {
                Object.keys(parkingPlaces).forEach(key => {
                    if (!key.startsWith(building.id)) return;
                    if (!key.includes('_place')) return;
                    const place = parkingPlaces[key];
                    
                    let floorLabel = "Паркинг";
                    if (key.includes('level_minus_')) floorLabel = `Уровень -${key.match(/level_minus_(\d+)/)?.[1]}`;
                    else if (key.includes('_base_')) floorLabel = `Подвал -${key.match(/_L(\d+)/)?.[1]}`;
                    else if (key.includes('floor_')) floorLabel = `${key.match(/floor_(\d+)/)?.[1]} этаж`;

                    list.push({
                        id: key,
                        buildingId: building.id,
                        houseNumber: building.houseNumber,
                        buildingLabel: building.label,
                        address: complexInfo.street,
                        number: place.number,
                        type: 'parking_place',
                        area: place.area || '—',
                        rooms: '-',
                        blockLabel: building.category === 'parking_separate' ? 'Паркинг' : 'Подземная часть',
                        floorLabel: floorLabel,
                        entrance: '-'
                    });
                });
            }
        });

        return list.sort((a, b) => {
            const houseA = a.houseNumber.replace(/\D/g, '');
            const houseB = b.houseNumber.replace(/\D/g, '');
            if (houseA !== houseB) return houseA.localeCompare(houseB);
            const numA = parseInt(a.number.replace(/\D/g, ''));
            const numB = parseInt(b.number.replace(/\D/g, ''));
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.number.localeCompare(b.number);
        });
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

    // Обработчик сохранения отдельного юнита
    const handleSaveUnit = async (updatedUnit) => {
        if (!updatedUnit.id || isReadOnly) return;
        
        if (mode !== 'parking') {
            const existingData = flatMatrix[updatedUnit.id] || {};
            const payload = {
                ...existingData,
                id: updatedUnit.id,
                buildingId: updatedUnit.buildingId,
                num: updatedUnit.number,
                type: updatedUnit.type,
                area: updatedUnit.area || '0',
                livingArea: updatedUnit.livingArea || '0',
                usefulArea: updatedUnit.usefulArea || '0',
                mainArea: updatedUnit.mainArea || '0',
                auxArea: updatedUnit.auxArea || '0',
                rooms: updatedUnit.rooms || 0,
                roomsList: updatedUnit.roomsList || [],
                blockLabel: updatedUnit.blockLabel || '',
                floorLabel: updatedUnit.floorLabel || '',
                entrance: updatedUnit.entrance || '-'
            };
            setFlatMatrix(prev => ({ ...prev, [updatedUnit.id]: payload }));
        } else {
            const payload = {
                ...parkingPlaces[updatedUnit.id],
                number: updatedUnit.number,
                area: updatedUnit.area || '0'
            };
            setParkingPlaces(prev => ({ ...prev, [updatedUnit.id]: payload }));
        }
        setEditingUnit(null);
    };

    // Глобальное сохранение
    const handleSave = async () => {
        if (isReadOnly) return;
        setIsSaving(true);
        try {
            for (const building of composition) {
                const bId = building.id;
                const bApartments = {};
                const bParking = {};
                
                Object.keys(flatMatrix).forEach(k => {
                     if (k.startsWith(bId)) bApartments[k] = flatMatrix[k];
                });
                
                Object.keys(parkingPlaces).forEach(k => {
                     if (k.startsWith(bId)) bParking[k] = parkingPlaces[k];
                });
                
                if (Object.keys(bApartments).length > 0) {
                    await saveBuildingData(bId, 'apartmentsData', bApartments);
                }
                if (Object.keys(bParking).length > 0) {
                    await saveBuildingData(bId, 'parkingData', bParking);
                }
            }
            await saveData({}, true);
        } catch (e) {
            console.error(e);
            alert("Ошибка сохранения");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto pb-20 animate-in fade-in duration-500 space-y-6">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-border pb-6">
                <div>
                    <h1 className={`text-2xl font-bold flex items-center gap-3 ${modeConfig.colorClass}`}>
                        <ModeIcon /> {modeConfig.title}
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">{modeConfig.description}</p>
                </div>
                {isSaving && <div className="flex items-center gap-2 text-primary text-sm font-bold"><Loader2 className="animate-spin" size={16}/> Сохранение...</div>}
            </div>

            {/* Статистика */}
            <div className="grid grid-cols-2 gap-4">
                <StatCard 
                    label={`Всего объектов`} 
                    value={stats.total} 
                    icon={LayoutGrid} 
                    colorClass="border-border text-foreground" 
                    iconBgClass="bg-secondary"
                />
                <StatCard 
                    label="Общая площадь (м²)" 
                    value={stats.totalArea.toLocaleString(undefined, {maximumFractionDigits: 1})} 
                    icon={FileText} 
                    colorClass="border-blue-200/50 bg-blue-500/5 text-blue-700 dark:text-blue-300"
                    iconBgClass="bg-blue-500/20"
                />
            </div>

            {/* Фильтры */}
            <div className="flex flex-wrap gap-3 items-center bg-muted/50 p-3 rounded-2xl border border-border">
                <div className="flex items-center gap-2 px-2 text-muted-foreground border-r border-border mr-2">
                    <Filter size={16}/> <span className="text-xs font-bold uppercase">Фильтры</span>
                </div>
                <div className="flex flex-col gap-1 min-w-[200px]">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase ml-1">Выбор дома</span>
                    <select 
                        value={filterBuilding} 
                        onChange={e => setFilterBuilding(e.target.value)} 
                        className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-background px-3 py-2 text-xs font-bold text-foreground ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 appearance-none cursor-pointer transition-all shadow-sm"
                    >
                        <option value="all">Все здания комплекса</option>
                        {composition.map(b => (<option key={b.id} value={b.id}>{b.label} (Дом {b.houseNumber})</option>))}
                    </select>
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase ml-1">Поиск</span>
                    <input 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        placeholder="Номер..." 
                        className="flex h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2 text-xs shadow-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                    />
                </div>
            </div>

            {/* Таблица */}
            <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-border rounded-xl">
                <div className="overflow-x-auto max-h-[60vh]">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-muted/50 border-b border-border text-[10px] uppercase font-bold text-muted-foreground sticky top-0 z-10 shadow-sm backdrop-blur-md">
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
                        <tbody className="divide-y divide-border bg-card">
                            {filteredData.length > 0 ? (
                                filteredData.map((item, idx) => {
                                    const typeConf = getTypeConfig(item.type);
                                    const TypeIcon = typeConf.icon;
                                    const isFilled = parseFloat(item.area) > 0;
                                    const isClickable = true; // Теперь всегда true, чтобы можно было открыть модалку на просмотр
                                    
                                    const rowClass = `transition-colors group text-sm border-b border-border last:border-0 
                                        ${isFilled ? 'bg-emerald-500/5 dark:bg-emerald-500/10' : 'hover:bg-accent'}
                                        ${isClickable ? 'cursor-pointer' : ''}`;

                                    return (
                                        <tr 
                                            key={item.id} 
                                            onClick={() => isClickable && setEditingUnit(item)}
                                            className={rowClass}
                                        >
                                            <td className="p-4 text-xs text-muted-foreground text-center font-mono">{idx + 1}</td>
                                            <td className="p-4 text-center">
                                                <div className="inline-flex items-center justify-center w-8 h-8 rounded bg-background border border-border font-bold text-foreground text-xs shadow-sm">
                                                    {item.houseNumber}
                                                </div>
                                            </td>
                                            
                                            <td className="p-4 text-center relative">
                                                <span className="font-black text-foreground text-base">{item.number}</span>
                                                {isFilled && <CheckCircle2 size={16} className="text-emerald-500 absolute top-1/2 right-2 -translate-y-1/2" />}
                                            </td>

                                            <td className="p-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border ${typeConf.color}`}>
                                                    <TypeIcon size={12}/> {typeConf.label}
                                                </span>
                                            </td>
                                            <td className="p-4 text-xs text-muted-foreground">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-foreground">{item.blockLabel}</span>
                                                    {item.entrance && item.entrance !== '-' && (
                                                        <span className="text-[10px] opacity-70">Подъезд {item.entrance}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 text-center font-medium text-foreground">{item.floorLabel}</td>
                                            {mode === 'apartments' && <td className="p-4 text-center text-muted-foreground font-medium">{item.rooms}</td>}
                                            <td className="p-4 text-right font-mono font-bold text-foreground">
                                                {parseFloat(item.area).toFixed(2)} <span className="text-[10px] font-normal text-muted-foreground">м²</span>
                                            </td>
                                            <td className="p-4 text-center">
                                                {isFilled ? (
                                                    <div className="inline-flex items-center gap-1 bg-background text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm">
                                                        <CheckCircle2 size={12}/> Готов
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground/30">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr><td colSpan={10} className="p-12 text-center text-muted-foreground">Нет объектов</td></tr>
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

            {/* [NEW] Глобальная панель сохранения */}
            <SaveFloatingBar onSave={handleSave} />
        </div>
    );
}