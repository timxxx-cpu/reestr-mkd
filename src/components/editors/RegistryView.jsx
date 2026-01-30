import React, { useMemo } from 'react';
import { 
  ScrollText, Building2, Warehouse, Car, Printer, 
  MapPin, AlertTriangle, CheckCircle2, Hash, Calendar,
  TrendingUp
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, Badge } from '../ui/UIKit';
import { getBlocksList, calculateProgress, getStageColor } from '../../lib/utils';

/**
 * Расчет статистики для конкретного Блока или Здания
 */
const calculateBlockStats = (building, block, floorData, flatMatrix, parkingPlaces) => {
    const blockPrefix = `${building.id}_${block.id}`;
    
    // Для инфраструктуры и паркингов часто используется 'main' как ID блока
    const searchPrefix = (building.category === 'infrastructure' || building.category === 'parking_separate') 
        ? `${building.id}_` 
        : blockPrefix;

    const stats = {
        label: block.tabLabel || building.label,
        type: block.type,
        floorsCount: 0,
        areaProj: 0,
        areaFact: 0,
        // Метаданные родительского здания
        cadastreNumber: building.cadastreNumber,
        dateStart: building.dateStart,
        dateEnd: building.dateEnd,
        stage: building.stage,
        
        units: {
            flats: 0,
            offices: 0,
            parking: 0,
            pantry: 0
        }
    };

    // 1. Площади и этажность (из floorData)
    Object.keys(floorData).forEach(key => {
        if (key.startsWith(searchPrefix)) {
            const floor = floorData[key];
            if (floor) {
                stats.areaProj += parseFloat(floor.areaProj || 0);
                stats.areaFact += parseFloat(floor.areaFact || 0);
                
                if (key.includes('_floor_')) {
                    const num = parseInt(key.split('_floor_')[1]);
                    if (!isNaN(num) && num > stats.floorsCount) stats.floorsCount = num;
                }
                if (key.includes('_level_minus_')) {
                     stats.floorsCount++; 
                }
            }
        }
    });

    // 2. Юниты (Квартиры/Офисы из flatMatrix)
    Object.keys(flatMatrix).forEach(key => {
        if (key.startsWith(searchPrefix)) {
            const u = flatMatrix[key];
            if (['flat', 'duplex_up', 'duplex_down'].includes(u.type)) stats.units.flats++;
            else if (['office', 'office_inventory'].includes(u.type)) stats.units.offices++;
            else if (u.type === 'pantry') stats.units.pantry++;
        }
    });

    // 3. Парковки (из parkingPlaces)
    Object.keys(parkingPlaces).forEach(key => {
        if (key.startsWith(searchPrefix) && key.includes('_place')) {
            stats.units.parking++;
        }
    });

    return stats;
};

const RegistryRow = ({ item, index }) => {
    const diff = item.areaFact - item.areaProj;
    const diffPercent = item.areaProj > 0 ? (diff / item.areaProj) * 100 : 0;
    const hasCriticalDiff = Math.abs(diffPercent) > 5; 
    
    const isEmpty = item.areaProj === 0;
    const progress = calculateProgress(item.dateStart, item.dateEnd);

    return (
        <tr className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0 text-sm group">
            <td className="p-4 text-slate-400 text-center w-12 font-mono text-xs">{index + 1}</td>
            
            {/* Наименование и Адрес */}
            <td className="p-4 min-w-[200px]">
                <div className="flex flex-col">
                    <span className="font-bold text-slate-800 text-sm">{item.label}</span>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold border border-slate-200">{item.parentBuildingLabel}</span>
                        {item.subLabel && <span>• {item.subLabel}</span>}
                    </div>
                </div>
            </td>

            {/* Кадастр и Статус */}
            <td className="p-4 w-[180px]">
                <div className="flex flex-col gap-1.5">
                    {item.cadastreNumber ? (
                        <div className="flex items-center gap-1.5 text-emerald-700 font-mono text-xs font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-100 w-fit">
                            <Hash size={10}/> {item.cadastreNumber}
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 text-slate-400 text-xs px-2 py-1">
                            <Hash size={10}/> <span>Не присвоен</span>
                        </div>
                    )}
                    <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase w-fit border ${getStageColor(item.stage)}`}>
                        {item.stage}
                    </span>
                </div>
            </td>

            {/* Сроки и Прогресс */}
            <td className="p-4 w-[140px]">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                        <span className="flex items-center gap-1"><Calendar size={10}/> Срок:</span>
                        <span>{item.dateEnd ? new Date(item.dateEnd).toLocaleDateString('ru-RU') : '-'}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-1">
                        <div className={`h-full rounded-full ${progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{width: `${progress}%`}}></div>
                    </div>
                    <div className="text-[9px] text-right font-bold text-slate-400">{Math.round(progress)}%</div>
                </div>
            </td>
            
            <td className="p-4 text-center">
                {isEmpty ? <span className="text-slate-300">-</span> : <span className="font-mono font-bold text-slate-600">{item.floorsCount}</span>}
            </td>
            
            {/* Площади */}
            <td className="p-4 text-right font-mono text-slate-600 bg-slate-50/30 border-l border-slate-100">
                {item.areaProj > 0 ? item.areaProj.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1}) : '-'}
            </td>
            <td className="p-4 text-right font-mono border-r border-slate-100">
                {item.areaFact > 0 ? (
                    <div className="flex flex-col items-end">
                        <span className={hasCriticalDiff ? 'text-red-600 font-bold' : 'text-slate-700 font-bold'}>
                            {item.areaFact.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})}
                        </span>
                        {hasCriticalDiff && (
                            <span className="text-[9px] text-red-500 flex items-center gap-1 bg-red-50 px-1 rounded mt-0.5">
                                {diff > 0 ? '+' : ''}{diffPercent.toFixed(1)}% <AlertTriangle size={8}/>
                            </span>
                        )}
                    </div>
                ) : <span className="text-slate-300">-</span>}
            </td>
            
            {/* Детализация юнитов */}
            <td className="p-4">
                <div className="flex flex-wrap gap-1.5 justify-start">
                    {item.units.flats > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100">{item.units.flats} кв</span>}
                    {item.units.offices > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-100">{item.units.offices} оф</span>}
                    {item.units.parking > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-100">{item.units.parking} мм</span>}
                    {item.units.pantry > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200">{item.units.pantry} кл</span>}
                    {Object.values(item.units).every(v => v === 0) && <span className="text-slate-300 text-xs">-</span>}
                </div>
            </td>

            <td className="p-4 text-center">
                {!isEmpty ? (
                    <div className="inline-flex items-center gap-1 text-[9px] font-bold uppercase text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                        <CheckCircle2 size={10}/> Готов
                    </div>
                ) : (
                    <div className="inline-flex items-center gap-1 text-[9px] font-bold uppercase text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-100">
                        <AlertTriangle size={10}/> Пусто
                    </div>
                )}
            </td>
        </tr>
    );
};

export default function RegistryView({ mode = 'all' }) {
    const { composition, floorData, flatMatrix, parkingPlaces, complexInfo } = useProject();

    // Сбор данных
    const registryItems = useMemo(() => {
        const items = [];

        composition.forEach(building => {
            const blocks = getBlocksList(building);
            
            // Если режим "НЕЖИЛЫЕ"
            if (mode === 'nonres') {
                if (building.category === 'infrastructure') {
                    const mainBlock = blocks[0]; 
                    if (mainBlock) {
                        const stats = calculateBlockStats(building, mainBlock, floorData, flatMatrix, parkingPlaces);
                        items.push({
                            ...stats,
                            id: `${building.id}_infra`,
                            parentBuildingLabel: building.label,
                            category: 'infrastructure',
                            subLabel: building.infraType
                        });
                    }
                }
                else if (building.category.includes('residential')) {
                    blocks.forEach(block => {
                        if (block.type === 'Н') { 
                            const stats = calculateBlockStats(building, block, floorData, flatMatrix, parkingPlaces);
                            items.push({
                                ...stats,
                                id: `${building.id}_${block.id}`,
                                parentBuildingLabel: building.label,
                                category: 'non_res_block',
                                subLabel: 'Нежилой блок'
                            });
                        }
                    });
                }
            } 
            // Если режим "ЖИЛЫЕ"
            else if (mode === 'res') {
                if (building.category.includes('residential')) {
                    blocks.forEach(block => {
                        if (block.type === 'Ж') {
                            const stats = calculateBlockStats(building, block, floorData, flatMatrix, parkingPlaces);
                            items.push({
                                ...stats,
                                id: `${building.id}_${block.id}`,
                                parentBuildingLabel: building.label,
                                category: 'residential_block',
                                subLabel: 'Жилая секция'
                            });
                        }
                    });
                }
                else if (building.category === 'parking_separate') {
                    const mainBlock = blocks[0];
                    if (mainBlock) {
                        const stats = calculateBlockStats(building, mainBlock, floorData, flatMatrix, parkingPlaces);
                        items.push({
                            ...stats,
                            id: `${building.id}_parking`,
                            parentBuildingLabel: building.label,
                            category: 'parking',
                            subLabel: building.parkingType === 'underground' ? 'Подземный' : 'Наземный'
                        });
                    }
                }
            }
        });

        return items;
    }, [composition, floorData, flatMatrix, parkingPlaces, mode]);

    const handlePrint = () => {
        window.print();
    };

    if (composition.length === 0) {
        return <div className="p-12 text-center text-slate-400">Список объектов пуст</div>;
    }

    const title = mode === 'nonres' ? 'Сводная по нежилым блокам и инфраструктуре' : 'Сводная по жилому фонду';
    const subTitle = mode === 'nonres' ? 'Реестр социальных объектов и коммерческих блоков' : 'Реестр жилых корпусов и паркингов';
    const Icon = mode === 'nonres' ? Warehouse : Building2;

    // Итоговые суммы
    const totalProj = registryItems.reduce((acc, i) => acc + i.areaProj, 0);
    const totalFact = registryItems.reduce((acc, i) => acc + i.areaFact, 0);

    return (
        <div className="w-full pb-20 space-y-6 animate-in fade-in duration-500 px-6">
            
            {/* Header */}
            <div className="flex justify-between items-start md:items-center print:hidden border-b border-slate-200 pb-6">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl shadow-lg ${mode === 'nonres' ? 'bg-amber-500 text-white shadow-amber-200' : 'bg-blue-600 text-white shadow-blue-200'}`}>
                        <Icon size={24}/>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
                        <p className="text-sm text-slate-500">{subTitle}</p>
                    </div>
                </div>
                
                <button onClick={handlePrint} className="px-4 py-2 bg-white border border-slate-200 shadow-sm rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors flex items-center gap-2 text-slate-700">
                    <Printer size={16}/> Печать
                </button>
            </div>

            {/* Info Banner */}
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200">
                <MapPin size={14}/>
                <span>Объект:</span>
                <span className="font-bold text-slate-700">{complexInfo?.name || 'Без названия'}</span>
                <span className="mx-1">•</span>
                <span>{complexInfo?.street || 'Адрес не указан'}</span>
            </div>

            {/* Empty State */}
            {registryItems.length === 0 && (
                <div className="p-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-slate-300 mx-auto mb-4 shadow-sm">
                        <Icon size={32}/>
                    </div>
                    <p className="text-slate-600 font-bold">Нет объектов для отображения</p>
                    <p className="text-slate-400 text-xs mt-1">В составе комплекса отсутствуют объекты данной категории.</p>
                </div>
            )}

            {/* Table */}
            {registryItems.length > 0 && (
                <Card className="p-0 overflow-hidden shadow-sm border border-slate-200 print:shadow-none print:border-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                                <tr>
                                    <th className="p-4 text-center">№</th>
                                    <th className="p-4">Наименование</th>
                                    <th className="p-4 w-[180px]">Кадастр / Статус</th>
                                    <th className="p-4 w-[140px]">Сроки</th>
                                    <th className="p-4 text-center">Этажность</th>
                                    <th className="p-4 text-right border-l border-slate-100">S Проект (м²)</th>
                                    <th className="p-4 text-right border-r border-slate-100">S Факт (м²)</th>
                                    <th className="p-4">Состав</th>
                                    <th className="p-4 text-center">Готовность</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {registryItems.map((item, idx) => (
                                    <RegistryRow key={item.id} item={item} index={idx} />
                                ))}
                                
                                {/* Footer Row */}
                                <tr className="bg-slate-100/50 font-bold text-sm text-slate-800 border-t-2 border-slate-200">
                                    <td colSpan={5} className="p-4 text-right uppercase tracking-wider text-xs text-slate-500">Общий итог по реестру:</td>
                                    <td className="p-4 text-right font-mono border-l border-slate-200 bg-white/50">{totalProj.toLocaleString(undefined, {maximumFractionDigits: 1})}</td>
                                    <td className="p-4 text-right font-mono text-emerald-700 border-r border-slate-200 bg-white/50">{totalFact.toLocaleString(undefined, {maximumFractionDigits: 1})}</td>
                                    <td colSpan={2}></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
}