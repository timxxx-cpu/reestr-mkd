import React, { useMemo, useState } from 'react';
import { 
  Building2, ArrowRight, FileText, BarChart3, 
  Printer, Download, Filter, Search, Maximize2
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, Input, Button, TabButton, Badge } from '../ui/UIKit';
import { getStageColor } from '../../lib/utils';

/**
 * @param {{ mode?: 'res'|'nonres' }} props
 */
export default function RegistryView({ mode = 'res' }) {
    const { composition, floorData, buildingDetails } = useProject();
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState('table'); // table, cards

    const filteredItems = useMemo(() => {
        return composition.filter(item => {
            const matchesMode = mode === 'res' 
                ? item.category.includes('residential') 
                : !item.category.includes('residential');
            
            const matchesSearch = item.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  item.houseNumber.toLowerCase().includes(searchTerm.toLowerCase());
            
            return matchesMode && matchesSearch;
        });
    }, [composition, mode, searchTerm]);

    // --- РАСЧЕТ СТАТИСТИКИ ---
    const stats = useMemo(() => {
        // @ts-ignore
        return filteredItems.reduce((acc, item) => {
            // Считаем площади по этажам
            let projArea = 0;
            let factArea = 0;

            // Находим все ключи floorData, относящиеся к этому зданию
            Object.keys(floorData).forEach(key => {
                if (key.startsWith(`${item.id}_`)) {
                    // @ts-ignore
                    const floor = floorData[key];
                    if (floor) {
                        projArea += parseFloat(floor.areaProj || '0');
                        factArea += parseFloat(floor.areaFact || '0');
                    }
                }
            });
            
            return {
                totalObjects: acc.totalObjects + 1,
                totalProj: acc.totalProj + projArea,
                totalFact: acc.totalFact + factArea,
                completed: acc.completed + (item.stage === 'Введенный' ? 1 : 0),
                underConstruction: acc.underConstruction + (item.stage === 'Строящийся' ? 1 : 0)
            };
        }, { totalObjects: 0, totalProj: 0, totalFact: 0, completed: 0, underConstruction: 0 });
    }, [filteredItems, floorData, buildingDetails]);

    /** @param {string} itemId */
    const getBuildingStats = (itemId) => {
        let sProj = 0;
        let sFact = 0;
        Object.keys(floorData).forEach(key => {
            if (key.startsWith(`${itemId}_`)) {
                // @ts-ignore
                const f = floorData[key];
                sProj += parseFloat(f?.areaProj || '0');
                sFact += parseFloat(f?.areaFact || '0');
            }
        });
        return { sProj, sFact, diff: sFact - sProj };
    };

    return (
        <div className="w-full px-6 pb-20 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-6 gap-4 border-b border-slate-200">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Building2 className="text-slate-400"/> 
                        {mode === 'res' ? 'Реестр жилого фонда' : 'Реестр инфраструктуры'}
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Сводные технико-экономические показатели</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary"><Printer size={16} /> Печать</Button>
                    <Button variant="secondary"><Download size={16} /> Excel</Button>
                </div>
            </div>

            {/* Dashboard Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <Card className="p-4 flex items-center gap-4 shadow-sm border-l-4 border-l-blue-500">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-full"><Building2 size={20}/></div>
                    <div>
                        <p className="text-xs text-slate-400 font-bold uppercase">Объектов</p>
                        <p className="text-2xl font-bold text-slate-800">{stats.totalObjects}</p>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-4 shadow-sm border-l-4 border-l-emerald-500">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full"><FileText size={20}/></div>
                    <div>
                        <p className="text-xs text-slate-400 font-bold uppercase">S Проектная</p>
                        <p className="text-2xl font-bold text-slate-800">{stats.totalProj.toLocaleString('ru-RU')} м²</p>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-4 shadow-sm border-l-4 border-l-indigo-500">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full"><Maximize2 size={20}/></div>
                    <div>
                        <p className="text-xs text-slate-400 font-bold uppercase">S Фактическая</p>
                        <p className="text-2xl font-bold text-slate-800">{stats.totalFact.toLocaleString('ru-RU')} м²</p>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-4 shadow-sm border-l-4 border-l-amber-500">
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-full"><BarChart3 size={20}/></div>
                    <div>
                        <p className="text-xs text-slate-400 font-bold uppercase">В стройке</p>
                        <p className="text-2xl font-bold text-slate-800">{stats.underConstruction}</p>
                    </div>
                </Card>
            </div>

            {/* Toolbar */}
            <div className="flex justify-between items-center mb-4">
                <div className="flex gap-2 w-full max-w-md relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                    <Input 
                        placeholder="Поиск по названию или номеру..." 
                        className="pl-9 bg-white" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}><FileText size={16}/></button>
                    <button onClick={() => setViewMode('cards')} className={`p-1.5 rounded-md transition-all ${viewMode === 'cards' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}><Filter size={16}/></button>
                </div>
            </div>

            {/* Content */}
            <Card className="overflow-hidden shadow-sm border border-slate-200">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                                <th className="p-4">№</th>
                                <th className="p-4">Объект</th>
                                <th className="p-4">Статус</th>
                                <th className="p-4 text-right">S Проект (м²)</th>
                                <th className="p-4 text-right">S Факт (м²)</th>
                                <th className="p-4 text-right">Разница</th>
                                <th className="p-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-400 text-sm">Объекты не найдены</td>
                                </tr>
                            ) : (
                                filteredItems.map((item, idx) => {
                                    const itemStats = getBuildingStats(item.id);
                                    const diffPercent = itemStats.sProj > 0 ? (itemStats.diff / itemStats.sProj) * 100 : 0;
                                    const diffColor = Math.abs(diffPercent) > 5 ? 'text-red-600 font-bold' : (itemStats.diff > 0 ? 'text-emerald-600' : 'text-slate-500');

                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="p-4 text-xs font-bold text-slate-400">{idx + 1}</td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-600 border border-slate-200">{item.houseNumber}</div>
                                                    <div>
                                                        <div className="font-bold text-sm text-slate-800">{item.label}</div>
                                                        <div className="text-[10px] text-slate-400">{item.type}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <Badge className={getStageColor(item.stage)}>{item.stage || 'Проект'}</Badge>
                                            </td>
                                            <td className="p-4 text-right font-mono text-sm text-slate-600">
                                                {itemStats.sProj.toFixed(2)}
                                            </td>
                                            <td className="p-4 text-right font-mono text-sm font-bold text-slate-800">
                                                {itemStats.sFact.toFixed(2)}
                                            </td>
                                            <td className={`p-4 text-right font-mono text-xs ${diffColor}`}>
                                                {itemStats.diff > 0 ? '+' : ''}{itemStats.diff.toFixed(2)}
                                            </td>
                                            <td className="p-4 text-right">
                                                <button className="p-2 text-slate-300 hover:text-blue-600 transition-colors">
                                                    <ArrowRight size={16}/>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t border-slate-200">
                            <tr>
                                <td colSpan={3} className="p-4 text-right font-bold text-sm text-slate-600 uppercase">Итого:</td>
                                <td className="p-4 text-right font-bold text-sm font-mono">{stats.totalProj.toFixed(2)}</td>
                                <td className="p-4 text-right font-bold text-sm font-mono">{stats.totalFact.toFixed(2)}</td>
                                <td colSpan={2}></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </Card>
        </div>
    );
}