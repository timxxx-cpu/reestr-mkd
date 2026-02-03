import React, { useState } from 'react';
import { Briefcase, FileText, Building2, School, CheckCircle2 } from 'lucide-react';
import { Card } from '../../../ui/UIKit';
import RegistryStats from '../RegistryStats';
import RegistryFilters from '../RegistryFilters';
import { useCommercialData } from '../../../../hooks/registry/useCommercialData';
// ИМПОРТ НОВОЙ МОДАЛКИ
import CommercialInventoryModal from '../modals/CommercialInventoryModal';

const getTypeConfig = (type) => {
    switch(type) {
        case 'office': return { label: 'Офис', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Briefcase };
        case 'office_inventory': return { label: 'Нежилое (Инв.)', color: 'bg-teal-50 text-teal-700 border-teal-200', icon: FileText };
        case 'non_res_block': return { label: 'Нежилой блок', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Building2 };
        case 'infrastructure': return { label: 'Инфраструктура', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: School };
        default: return { label: type, color: 'bg-slate-100 text-slate-600', icon: FileText };
    }
};

export default function CommercialRegistry({ onSaveUnit }) {
    const { 
        data, stats, options, 
        filters, setFilters, 
        searchTerm, setSearchTerm 
    } = useCommercialData();

    const [editingUnit, setEditingUnit] = useState(null);

    return (
        <div className="space-y-6">
            <RegistryStats stats={stats} />
            
            <RegistryFilters 
                filters={filters} 
                setFilters={setFilters} 
                options={options} 
                searchTerm={searchTerm} 
                setSearchTerm={setSearchTerm} 
            />

            <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-slate-200 rounded-xl mx-4 md:mx-0">
                <div className="overflow-x-auto max-h-[60vh]">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-800 text-slate-200 border-b border-slate-700 text-[10px] uppercase font-bold sticky top-0 z-20 shadow-md">
                            <tr>
                                <th className="p-4 w-12 text-center text-slate-400">№</th>
                                <th className="p-4 w-20 text-center">Дом</th>
                                <th className="p-4 w-20 text-center border-l border-slate-700">Подъезд</th>
                                <th className="p-4 w-32 text-center border-l border-slate-700">Номер</th>
                                <th className="p-4 border-l border-slate-700">Тип</th>
                                <th className="p-4">Секция</th>
                                <th className="p-4 text-center">Этаж</th>
                                <th className="p-4 text-right bg-slate-700/50 text-emerald-300 border-l border-slate-700">Общая (м²)</th>
                                <th className="p-4 text-right border-l border-slate-700">Основная (м²)</th>
                                <th className="p-4 text-center border-l border-slate-700">Статус</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white text-sm">
                            {data.length > 0 ? data.map((item, idx) => {
                                const typeConf = getTypeConfig(item.type);
                                const TypeIcon = typeConf.icon;
                                const isFilled = parseFloat(item.area) > 0;
                                const isVirtual = !item.isSaved;
                                
                                return (
                                    <tr key={item.id} onClick={() => setEditingUnit(item)} className={`group cursor-pointer hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 even:bg-slate-50/50 ${isVirtual ? 'opacity-80' : ''}`}>
                                        <td className="p-4 text-xs text-slate-400 text-center font-mono">{idx + 1}</td>
                                        <td className="p-4 text-center"><div className="inline-flex items-center justify-center w-8 h-8 rounded bg-white border border-slate-200 font-bold text-slate-700 text-xs shadow-sm">{item.houseNumber}</div></td>
                                        <td className="p-4 text-center font-bold text-slate-500 border-l border-slate-100">{item.entrance}</td>
                                        <td className="p-4 text-center relative border-x border-blue-100 bg-blue-50/20 group-hover:bg-blue-100/50 transition-colors">
                                            <span className={`font-black text-lg ${isVirtual ? 'text-slate-500 italic' : 'text-slate-800'}`}>{item.number}</span>
                                        </td>
                                        <td className="p-4"><span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border ${typeConf.color}`}><TypeIcon size={12}/> {typeConf.label}</span></td>
                                        <td className="p-4 text-xs text-slate-500"><span className="font-bold text-slate-700">{item.blockLabel}</span></td>
                                        <td className="p-4 text-center font-medium text-slate-700">{item.floorLabel}</td>
                                        <td className="p-4 text-right font-mono font-bold text-slate-800 bg-emerald-50/30 border-l border-emerald-100/50">{parseFloat(item.area).toFixed(2)}</td>
                                        <td className="p-4 text-right font-mono text-slate-600 border-l border-slate-100">{item.mainArea ? parseFloat(item.mainArea).toFixed(2) : '-'}</td>
                                        <td className="p-4 text-center border-l border-slate-100">
                                            {isFilled ? (<div className="inline-flex items-center gap-1.5 text-emerald-600 px-2 py-0.5 rounded-full text-[10px] font-bold"><CheckCircle2 size={14} className="text-emerald-500"/><span>Готов</span></div>) : (<span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded">Не заполнен</span>)}
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr><td colSpan={10} className="p-12 text-center text-slate-400">Нет объектов</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {editingUnit && (
                <CommercialInventoryModal 
                    unit={editingUnit} 
                    buildingLabel={`Дом ${editingUnit.houseNumber}, ${editingUnit.buildingLabel}`}
                    onClose={() => setEditingUnit(null)}
                    onSave={(changes) => {
                        onSaveUnit(editingUnit, changes, 'commercial');
                        setEditingUnit(null);
                    }}
                />
            )}
        </div>
    );
}