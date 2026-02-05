import React, { useState, useMemo } from 'react';
import { Home, Layers, CheckCircle2, Loader2, Search } from 'lucide-react';
import { Card, DebouncedInput } from '../../../ui/UIKit';
import RegistryStats from '../RegistryStats';
import { useDirectIntegration } from '../../../../hooks/api/useDirectIntegration';
import { useQueryClient } from '@tanstack/react-query';
import ApartmentInventoryModal from '../modals/ApartmentInventoryModal'; 

const getTypeConfig = (type) => {
    switch(type) {
        case 'flat': return { label: 'Квартира', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Home };
        case 'duplex_up': return { label: 'Дуплекс (В)', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: Layers };
        case 'duplex_down': return { label: 'Дуплекс (Н)', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: Layers };
        default: return { label: type, color: 'bg-slate-100 text-slate-600', icon: Home };
    }
};

export default function ApartmentsRegistry({ onSaveUnit, projectId }) {
    const queryClient = useQueryClient();
    
    // Загружаем данные из БД
    const { fullRegistry, loadingRegistry } = useDirectIntegration(projectId);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [editingUnit, setEditingUnit] = useState(null);

    // Подготовка данных
    const { data, stats } = useMemo(() => {
        if (!fullRegistry || !fullRegistry.units) return { data: [], stats: null };

        const { units, buildings, floors, blocks } = fullRegistry;
        
        // Хелперы для быстрого поиска имен
        const bMap = {}; buildings.forEach(b => bMap[b.id] = b);
        const blMap = {}; blocks.forEach(b => blMap[b.id] = b);
        const fMap = {}; floors.forEach(f => fMap[f.id] = f);

        // 1. Фильтруем только жилые
        const apartments = units.filter(u => ['flat', 'duplex_up', 'duplex_down'].includes(u.type));

        // 2. Обогащаем данными (имена зданий, этажей)
        const enriched = apartments.map(u => {
            const floor = fMap[u.floorId];
            const block = floor ? blMap[floor.blockId] : null;
            const building = block ? bMap[block.buildingId] : null; 
            
            return {
                ...u,
                floorLabel: floor?.label || '-',
                blockLabel: block?.tabLabel || block?.label || '-',
                buildingLabel: building?.label || '-',
                houseNumber: building?.houseNumber || '-',
                entrance: u.entranceId ? '?' : '-', 
            };
        });

        // 3. Поиск
        const filtered = enriched.filter(item => {
            if (!searchTerm) return true;
            const low = searchTerm.toLowerCase();
            return item.number.toLowerCase().includes(low);
        });

        // 4. Статистика
        const totalArea = filtered.reduce((sum, item) => sum + (parseFloat(item.area) || 0), 0);
        const totalLiving = filtered.reduce((sum, item) => sum + (parseFloat(item.livingArea) || 0), 0);
        
        return { 
            data: filtered.sort((a,b) => String(a.number).localeCompare(String(b.number))), 
            stats: {
                count: filtered.length,
                area: totalArea,
                livingArea: totalLiving
            }
        };
    }, [fullRegistry, searchTerm]);

    const handleSave = async (changes) => {
        // onSaveUnit возвращает true/false
        const success = await onSaveUnit(editingUnit, changes);
        if (success) {
            setEditingUnit(null);
            // [FIX] Исправлен синтаксис для React Query v5
            queryClient.invalidateQueries({ queryKey: ['project-registry'] });
        }
    };

    if (loadingRegistry) return <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto text-blue-600"/></div>;

    return (
        <div className="space-y-6">
            {/* Статистика */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-xs text-slate-500 font-bold uppercase">Всего квартир</div>
                    <div className="text-2xl font-black text-slate-800">{stats?.count || 0}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-xs text-slate-500 font-bold uppercase">Общая площадь</div>
                    <div className="text-2xl font-black text-blue-600">{stats?.area?.toFixed(1) || 0} <span className="text-sm text-slate-400">м²</span></div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-xs text-slate-500 font-bold uppercase">Жилая площадь</div>
                    <div className="text-2xl font-black text-emerald-600">{stats?.livingArea?.toFixed(1) || 0} <span className="text-sm text-slate-400">м²</span></div>
                </div>
            </div>
            
            {/* Поиск */}
            <div className="flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                    <DebouncedInput 
                        value={searchTerm} 
                        onChange={setSearchTerm} 
                        placeholder="Поиск по номеру квартиры..." 
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-blue-500 outline-none"
                    />
                </div>
            </div>

            {/* Таблица */}
            <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-slate-200 rounded-xl mx-4 md:mx-0">
                <div className="overflow-x-auto max-h-[60vh]">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-800 text-slate-200 border-b border-slate-700 text-[10px] uppercase font-bold sticky top-0 z-20 shadow-md">
                            <tr>
                                <th className="p-4 w-12 text-center text-slate-400">№</th>
                                <th className="p-4 w-20 text-center">Дом</th>
                                <th className="p-4 w-32 text-center border-l border-slate-700">Номер</th>
                                <th className="p-4 border-l border-slate-700">Тип</th>
                                <th className="p-4 text-xs">Секция / Этаж</th>
                                <th className="p-4 text-center">Комнат</th>
                                <th className="p-4 text-right bg-slate-700/50 text-emerald-300 border-l border-slate-700">Общая (м²)</th>
                                <th className="p-4 text-right border-l border-slate-700">Жилая (м²)</th>
                                <th className="p-4 text-center border-l border-slate-700">Статус</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white text-sm">
                            {data.length > 0 ? data.map((item, idx) => {
                                const typeConf = getTypeConfig(item.type);
                                const TypeIcon = typeConf.icon;
                                const isFilled = parseFloat(item.area) > 0;
                                
                                return (
                                    <tr key={item.id} onClick={() => setEditingUnit(item)} className="group cursor-pointer hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 even:bg-slate-50/50">
                                        <td className="p-4 text-xs text-slate-400 text-center font-mono">{idx + 1}</td>
                                        <td className="p-4 text-center"><div className="inline-flex items-center justify-center w-8 h-8 rounded bg-white border border-slate-200 font-bold text-slate-700 text-xs shadow-sm">{item.houseNumber}</div></td>
                                        <td className="p-4 text-center relative border-x border-blue-100 bg-blue-50/20 group-hover:bg-blue-100/50 transition-colors"><span className="font-black text-slate-800 text-lg">{item.number}</span></td>
                                        <td className="p-4"><span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border ${typeConf.color}`}><TypeIcon size={12}/> {typeConf.label}</span></td>
                                        
                                        <td className="p-4">
                                            <div className="flex flex-col text-xs">
                                                <span className="font-bold text-slate-700">{item.blockLabel}</span>
                                                <span className="text-slate-500">{item.floorLabel}</span>
                                            </div>
                                        </td>
                                        
                                        <td className="p-4 text-center text-slate-500 font-medium">{item.rooms}</td>
                                        <td className="p-4 text-right font-mono font-bold text-slate-800 bg-emerald-50/30 border-l border-emerald-100/50">{parseFloat(item.area).toFixed(2)}</td>
                                        <td className="p-4 text-right font-mono text-slate-600 border-l border-slate-100">{parseFloat(item.livingArea) > 0 ? parseFloat(item.livingArea).toFixed(2) : '-'}</td>
                                        
                                        <td className="p-4 text-center border-l border-slate-100">
                                            {isFilled ? (<div className="inline-flex items-center gap-1.5 text-emerald-600 px-2 py-0.5 rounded-full text-[10px] font-bold"><CheckCircle2 size={14} className="text-emerald-500"/><span>Готов</span></div>) : (<span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded">Не заполнен</span>)}
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr><td colSpan={12} className="p-12 text-center text-slate-400">Нет объектов</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {editingUnit && (
                <ApartmentInventoryModal 
                    unit={editingUnit}
                    // Передаем ВСЕ данные для функции "Копировать из"
                    unitsList={fullRegistry?.units || []} 
                    buildingLabel={`Дом ${editingUnit.houseNumber}, ${editingUnit.buildingLabel}`}
                    onClose={() => setEditingUnit(null)}
                    onSave={handleSave}
                />
            )}
        </div>
    );
}