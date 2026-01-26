import React, { useMemo, useState } from 'react';
import { 
  Table2, Search, Home, Briefcase, 
  Layers, MapPin, Car, Building2,
  FileText, LayoutGrid, Filter, School, Edit2, Loader2, CheckCircle2,
  Sofa, BedDouble, Bath, Utensils
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, Input, Select } from '../ui/UIKit';
import { getBlocksList } from '../../lib/utils';
import UnitInventoryModal from './UnitInventoryModal'; 
import ParkingEditModal from './ParkingEditModal'; 

// Конфигурация режимов
const MODES = {
    apartments: {
        title: 'Реестр квартир',
        description: 'Жилой фонд: только квартиры и дуплексы',
        icon: Home,
        colorClass: 'text-blue-600',
    },
    commercial: {
        title: 'Реестр нежилых помещений',
        description: 'Коммерция, нежилые блоки и инфраструктура',
        icon: Briefcase,
        colorClass: 'text-emerald-600',
    },
    parking: {
        title: 'Реестр машиномест',
        description: 'Парковочные места в паркингах и подвалах',
        icon: Car,
        colorClass: 'text-indigo-600',
    }
};

const getTypeConfig = (type) => {
    switch(type) {
        case 'flat': return { label: 'Квартира', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Home };
        case 'duplex_up': return { label: 'Дуплекс (В)', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: Layers };
        case 'duplex_down': return { label: 'Дуплекс (Н)', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: Layers };
        case 'office': return { label: 'Офис', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Briefcase };
        case 'office_inventory': return { label: 'Нежилое (Инв.)', color: 'bg-teal-50 text-teal-700 border-teal-200', icon: FileText };
        case 'non_res_block': return { label: 'Нежилой блок', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Building2 };
        case 'infrastructure': return { label: 'Инфраструктура', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: School };
        case 'parking_place': return { label: 'М/М', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: Car };
        default: return { label: type, color: 'bg-gray-50 text-gray-600', icon: FileText };
    }
};

const formatRawFloorId = (id) => {
    if (!id) return '-';
    if (id.startsWith('floor_')) return `${id.split('_')[1]} этаж`;
    if (id.startsWith('level_minus_')) return `Уровень -${id.split('_')[2]}`;
    if (id.startsWith('base_')) return `Подвал`;
    return id;
};

const StatCard = ({ label, value, icon: Icon, colorClass }) => (
    <div className={`p-4 rounded-xl border flex items-center justify-between shadow-sm bg-white ${colorClass}`}>
        <div>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
            <p className="text-2xl font-black mt-1">{value}</p>
        </div>
        <div className="p-2 rounded-lg bg-white/50">
            <Icon size={20} className="opacity-80"/>
        </div>
    </div>
);

export default function UnitRegistry({ mode = 'apartments' }) {
    const { composition, flatMatrix, setFlatMatrix, floorData, parkingPlaces, setParkingPlaces, entrancesData, complexInfo, saveBuildingData } = useProject();
    
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

            // ===========================================
            // 1. СБОР ИЗ FLAT MATRIX (Уже сохраненные объекты)
            // ===========================================
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

            // ===========================================
            // 2. ГЕНЕРАЦИЯ ВИРТУАЛЬНЫХ ОБЪЕКТОВ (Только для Commercial)
            // ===========================================
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

            // ===========================================
            // 3. ПАРКИНГ
            // ===========================================
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

    const handleSaveUnit = async (updatedUnit) => {
        if (!updatedUnit.id) return;
        setIsSaving(true);
        const buildingId = updatedUnit.buildingId;

        try {
            // А. Сохранение КВАРТИР и ЛЮБОЙ КОММЕРЦИИ (из flatMatrix)
            if (mode !== 'parking') {
                const existingData = flatMatrix[updatedUnit.id] || {};
                
                // ИСПРАВЛЕНИЕ: Гарантируем отсутствие undefined в полях
                const payload = {
                    ...existingData,
                    
                    // Основные поля
                    id: updatedUnit.id,
                    buildingId: updatedUnit.buildingId,
                    num: updatedUnit.number,
                    type: updatedUnit.type,
                    
                    // Площади (защита от undefined - ставим '0')
                    area: updatedUnit.area || '0',
                    livingArea: updatedUnit.livingArea || '0',
                    usefulArea: updatedUnit.usefulArea || '0',
                    mainArea: updatedUnit.mainArea || '0',
                    auxArea: updatedUnit.auxArea || '0',
                    
                    // Структура
                    rooms: updatedUnit.rooms || 0,
                    roomsList: updatedUnit.roomsList || [],
                    
                    // Метаданные (чтобы виртуальные объекты не теряли лейблы после сохранения)
                    blockLabel: updatedUnit.blockLabel || '',
                    floorLabel: updatedUnit.floorLabel || '',
                    entrance: updatedUnit.entrance || '-'
                };

                setFlatMatrix(prev => ({ ...prev, [updatedUnit.id]: payload }));

                const buildingApartments = {};
                // Собираем существующие
                Object.keys(flatMatrix).forEach(k => {
                    if (k.startsWith(buildingId)) {
                        buildingApartments[k] = flatMatrix[k];
                    }
                });
                // Перезаписываем или добавляем новый
                buildingApartments[updatedUnit.id] = payload;

                await saveBuildingData(buildingId, 'apartmentsData', buildingApartments);
            }
            
            // Б. Сохранение ПАРКИНГА
            else {
                const payload = {
                    ...parkingPlaces[updatedUnit.id],
                    number: updatedUnit.number,
                    area: updatedUnit.area || '0'
                };

                setParkingPlaces(prev => ({ ...prev, [updatedUnit.id]: payload }));

                const buildingParking = {};
                Object.keys(parkingPlaces).forEach(k => {
                    if (k.startsWith(buildingId)) {
                        buildingParking[k] = (k === updatedUnit.id) ? payload : parkingPlaces[k];
                    }
                });
                await saveBuildingData(buildingId, 'parkingData', buildingParking);
            }

        } catch (error) {
            console.error("Ошибка сохранения:", error);
            alert("Ошибка сохранения! Проверьте консоль.");
        } finally {
            setIsSaving(false);
            setEditingUnit(null);
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
                <StatCard label={`Всего объектов`} value={stats.total} icon={LayoutGrid} colorClass="border-slate-200 text-slate-700" />
                <StatCard label="Общая площадь (м²)" value={stats.totalArea.toLocaleString(undefined, {maximumFractionDigits: 1})} icon={FileText} colorClass="border-blue-100 bg-blue-50/50 text-blue-700"/>
            </div>

            {/* Фильтры */}
            <div className="flex flex-wrap gap-3 items-center bg-slate-100 p-3 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2 px-2 text-slate-500 border-r border-slate-300 mr-2">
                    <Filter size={16}/> <span className="text-xs font-bold uppercase">Фильтры</span>
                </div>
                <div className="flex flex-col gap-1 min-w-[200px]">
                    <span className="text-[9px] font-bold text-slate-400 uppercase ml-1">Выбор дома</span>
                    <Select value={filterBuilding} onChange={e => setFilterBuilding(e.target.value)} className="h-10 text-xs shadow-sm bg-white border-slate-200 font-bold">
                        <option value="all">Все здания комплекса</option>
                        {composition.map(b => (<option key={b.id} value={b.id}>{b.label} (Дом {b.houseNumber})</option>))}
                    </Select>
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                    <span className="text-[9px] font-bold text-slate-400 uppercase ml-1">Поиск</span>
                    <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Номер..." className="pl-9 h-10 text-xs shadow-sm bg-white border-slate-200"/>
                </div>
            </div>

            {/* Таблица */}
            <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-slate-200 rounded-xl">
                <div className="overflow-x-auto max-h-[60vh]">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 sticky top-0 z-10 shadow-sm">
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
                                    const isClickable = true;
                                    
                                    const rowClass = `transition-colors group text-sm border-b border-slate-50 last:border-0 
                                        ${isFilled ? 'bg-emerald-50' : 'hover:bg-blue-50/30'}
                                        ${isClickable ? 'cursor-pointer' : ''}`;

                                    return (
                                        <tr 
                                            key={item.id} 
                                            onClick={() => isClickable && setEditingUnit(item)}
                                            className={rowClass}
                                        >
                                            <td className="p-4 text-xs text-slate-400 text-center font-mono">{idx + 1}</td>
                                            <td className="p-4 text-center"><div className="inline-flex items-center justify-center w-8 h-8 rounded bg-white border border-slate-200 font-bold text-slate-700 text-xs shadow-sm">{item.houseNumber}</div></td>
                                            
                                            <td className="p-4 text-center relative">
                                                <span className="font-black text-slate-800 text-base">{item.number}</span>
                                                {isFilled && <CheckCircle2 size={16} className="text-emerald-500 absolute top-1/2 right-2 -translate-y-1/2" />}
                                            </td>

                                            <td className="p-4"><span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border ${typeConf.color}`}><TypeIcon size={12}/> {typeConf.label}</span></td>
                                            <td className="p-4 text-xs text-slate-600"><div className="flex flex-col"><span className="font-bold text-slate-700">{item.blockLabel}</span>{item.entrance && item.entrance !== '-' && (<span className="text-[10px] opacity-70">Подъезд {item.entrance}</span>)}</div></td>
                                            <td className="p-4 text-center font-medium text-slate-700">{item.floorLabel}</td>
                                            {mode === 'apartments' && <td className="p-4 text-center text-slate-600 font-medium">{item.rooms}</td>}
                                            <td className="p-4 text-right font-mono font-bold text-slate-800">{parseFloat(item.area).toFixed(2)} <span className="text-[10px] font-normal text-slate-400">м²</span></td>
                                            <td className="p-4 text-center">
                                                {isFilled ? (
                                                    <div className="inline-flex items-center gap-1 bg-white text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm">
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
        </div>
    );
}