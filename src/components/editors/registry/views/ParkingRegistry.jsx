import React, { useState, useMemo } from 'react';
import { Car, CheckCircle2, Loader2, Search } from 'lucide-react';
import { Card, DebouncedInput } from '../../../ui/UIKit';
import { useDirectIntegration } from '../../../../hooks/api/useDirectIntegration';
import { useQueryClient } from '@tanstack/react-query';
import ParkingEditModal from '../../ParkingEditModal';

export default function ParkingRegistry({ onSaveUnit, projectId }) {
    const queryClient = useQueryClient();
    const { fullRegistry, loadingRegistry } = useDirectIntegration(projectId);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [editingUnit, setEditingUnit] = useState(null);

    const { data, stats } = useMemo(() => {
        if (!fullRegistry || !fullRegistry.units) return { data: [], stats: null };

        const { units, buildings, floors, blocks } = fullRegistry;
        const bMap = {}; buildings.forEach(b => bMap[b.id] = b);
        const blMap = {}; blocks.forEach(b => blMap[b.id] = b);
        const fMap = {}; floors.forEach(f => fMap[f.id] = f);

        // 1. Фильтруем только паркинг
        const parking = units.filter(u => u.type === 'parking_place');

        // 2. Обогащаем
        const enriched = parking.map(u => {
            const floor = fMap[u.floorId];
            const block = floor ? blMap[floor.blockId] : null;
            const building = block ? bMap[block.buildingId] : null; 
            
            return {
                ...u,
                floorLabel: floor?.label || '-',
                blockLabel: block?.tabLabel || block?.label || '-',
                buildingLabel: building?.label || '-',
                houseNumber: building?.houseNumber || '-',
            };
        });

        // 3. Поиск
        const filtered = enriched.filter(item => {
            if (!searchTerm) return true;
            return item.number.toLowerCase().includes(searchTerm.toLowerCase());
        });

        // 4. Статистика
        const totalArea = filtered.reduce((sum, item) => sum + (parseFloat(item.area) || 0), 0);
        const totalSold = filtered.filter(i => i.isSold).length;
        
        return { 
            data: filtered.sort((a,b) => parseInt(a.number) - parseInt(b.number)),
            stats: {
                count: filtered.length,
                area: totalArea,
                sold: totalSold
            }
        };
    }, [fullRegistry, searchTerm]);

    const handleSave = async (changes) => {
        const success = await onSaveUnit(editingUnit, changes);
        if (success) {
            setEditingUnit(null);
            queryClient.invalidateQueries({ queryKey: ['project-registry'] });
        }
    };

    if (loadingRegistry) return <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto text-blue-600"/></div>;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-xs text-slate-500 font-bold uppercase">Всего мест</div>
                    <div className="text-2xl font-black text-slate-800">{stats?.count || 0}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-xs text-slate-500 font-bold uppercase">Общая площадь</div>
                    <div className="text-2xl font-black text-blue-600">{stats?.area?.toFixed(1) || 0} <span className="text-sm text-slate-400">м²</span></div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-xs text-slate-500 font-bold uppercase">Продано</div>
                    <div className="text-2xl font-black text-red-600">{stats?.sold || 0}</div>
                </div>
            </div>
            
            <div className="flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                    <DebouncedInput 
                        value={searchTerm} 
                        onChange={setSearchTerm} 
                        placeholder="Поиск по номеру места..." 
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-blue-500 outline-none"
                    />
                </div>
            </div>

            <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-slate-200 rounded-xl mx-4 md:mx-0">
                <div className="overflow-x-auto max-h-[60vh]">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-800 text-slate-200 border-b border-slate-700 text-[10px] uppercase font-bold sticky top-0 z-20 shadow-md">
                            <tr>
                                <th className="p-4 w-12 text-center text-slate-400">№</th>
                                <th className="p-4 w-20 text-center">Дом</th>
                                <th className="p-4 w-32 text-center border-l border-slate-700">Номер места</th>
                                <th className="p-4 border-l border-slate-700">Тип</th>
                                <th className="p-4 text-center">Уровень</th>
                                <th className="p-4 text-right bg-slate-700/50 text-emerald-300 border-l border-slate-700">Площадь (м²)</th>
                                <th className="p-4 text-center border-l border-slate-700">Статус продажи</th>
                                <th className="p-4 text-center border-l border-slate-700">Заполнение</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white text-sm">
                            {data.length > 0 ? data.map((item, idx) => {
                                const isFilled = parseFloat(item.area) > 0;
                                return (
                                    <tr key={item.id} onClick={() => setEditingUnit(item)} className="group cursor-pointer hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 even:bg-slate-50/50">
                                        <td className="p-4 text-xs text-slate-400 text-center font-mono">{idx + 1}</td>
                                        <td className="p-4 text-center"><div className="inline-flex items-center justify-center w-8 h-8 rounded bg-white border border-slate-200 font-bold text-slate-700 text-xs shadow-sm">{item.houseNumber}</div></td>
                                        <td className="p-4 text-center relative border-x border-blue-100 bg-blue-50/20 group-hover:bg-blue-100/50 transition-colors">
                                            <span className="font-black text-slate-800 text-lg">{item.number}</span>
                                        </td>
                                        <td className="p-4"><span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border bg-slate-100 text-slate-700 border-slate-200"><Car size={12}/> М/М</span></td>
                                        <td className="p-4 text-center font-medium text-slate-700">{item.floorLabel}</td>
                                        <td className="p-4 text-right font-mono font-bold text-slate-800 bg-emerald-50/30 border-l border-emerald-100/50">{parseFloat(item.area).toFixed(2)}</td>
                                        <td className="p-4 text-center border-l border-slate-100">
                                            {item.isSold ? 
                                                <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-1 rounded border border-red-200">ПРОДАНО</span> : 
                                                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-600 px-2 py-1 rounded border border-emerald-200">СВОБОДНО</span>
                                            }
                                        </td>
                                        <td className="p-4 text-center border-l border-slate-100">
                                            {isFilled ? (<div className="inline-flex items-center gap-1.5 text-emerald-600 px-2 py-0.5 rounded-full text-[10px] font-bold"><CheckCircle2 size={14} className="text-emerald-500"/><span>Готов</span></div>) : (<span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded">Не заполнен</span>)}
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr><td colSpan={8} className="p-12 text-center text-slate-400">Нет машиномест</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {editingUnit && (
                <ParkingEditModal 
                    unit={editingUnit} 
                    buildingLabel={`Дом ${editingUnit.houseNumber}, ${editingUnit.buildingLabel}`}
                    onClose={() => setEditingUnit(null)}
                    onSave={handleSave}
                />
            )}
        </div>
    );
}