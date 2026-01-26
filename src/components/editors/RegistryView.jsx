import React, { useMemo, useState } from 'react';
import { 
  Building2, ArrowRight, FileText, BarChart3, 
  Printer, Download, Search, Maximize2,
  LayoutGrid, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, Input, Button, Badge, Select } from '../ui/UIKit';
import { getStageColor, calculateProgress } from '../../lib/utils';

/**
 * @param {{ mode?: 'res'|'nonres' }} props
 */
export default function RegistryView({ mode = 'res' }) {
    const { complexInfo, composition, floorData } = useProject();
    
    // Состояние UI
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortConfig, setSortConfig] = useState({ key: 'label', direction: 'asc' });

    // 1. ПОДГОТОВКА ДАННЫХ
    const preparedData = useMemo(() => {
        return composition.map(item => {
            let sProj = 0;
            let sFact = 0;
            
            // Суммируем площади по этажам
            Object.keys(floorData).forEach(key => {
                if (key.startsWith(`${item.id}_`)) {
                    // @ts-ignore
                    const f = floorData[key];
                    if (f) {
                        sProj += parseFloat(f.areaProj || '0');
                        sFact += parseFloat(f.areaFact || '0');
                    }
                }
            });

            return {
                ...item,
                sProj,
                sFact,
                diff: sFact - sProj,
                progress: calculateProgress(item.dateStart, item.dateEnd)
            };
        });
    }, [composition, floorData]);

    // 2. ФИЛЬТРАЦИЯ
    const filteredItems = useMemo(() => {
        return preparedData.filter(item => {
            const matchesMode = mode === 'res' 
                ? item.category.includes('residential') 
                : !item.category.includes('residential');
            
            const matchesSearch = item.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  item.houseNumber.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesStatus = statusFilter === 'all' || item.stage === statusFilter;
            
            return matchesMode && matchesSearch && matchesStatus;
        });
    }, [preparedData, mode, searchTerm, statusFilter]);

    // 3. СОРТИРОВКА
    const sortedItems = useMemo(() => {
        return [...filteredItems].sort((a, b) => {
            // @ts-ignore
            const aValue = a[sortConfig.key];
            // @ts-ignore
            const bValue = b[sortConfig.key];

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredItems, sortConfig]);

    // --- СТАТИСТИКА ---
    const stats = useMemo(() => {
        return sortedItems.reduce((acc, item) => {
            return {
                totalObjects: acc.totalObjects + 1,
                totalProj: acc.totalProj + item.sProj,
                totalFact: acc.totalFact + item.sFact,
                completed: acc.completed + (item.stage === 'Введенный' ? 1 : 0),
                underConstruction: acc.underConstruction + (item.stage === 'Строящийся' ? 1 : 0)
            };
        }, { totalObjects: 0, totalProj: 0, totalFact: 0, completed: 0, underConstruction: 0 });
    }, [sortedItems]);

    // --- ЭКСПОРТ В EXCEL (CSV) ---
    const handleExport = () => {
        const headers = ["№", "Дом", "Название", "Тип", "Статус", "Прогресс %", "S Проект", "S Факт", "Разница"];
        const rows = sortedItems.map((item, idx) => [
            idx + 1,
            item.houseNumber,
            item.label,
            item.type,
            item.stage,
            Math.round(item.progress),
            item.sProj.toFixed(2),
            item.sFact.toFixed(2),
            item.diff.toFixed(2)
        ]);

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
            + [headers, ...rows].map(e => e.join(";")).join("\n");
            
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${complexInfo.name || 'export'}_registry_${mode}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const SortIcon = ({ columnKey }) => {
        if (sortConfig.key !== columnKey) return <ArrowUpDown size={12} className="opacity-30 ml-1 inline"/>;
        return sortConfig.direction === 'asc' 
            ? <ArrowUp size={12} className="text-blue-600 ml-1 inline"/> 
            : <ArrowDown size={12} className="text-blue-600 ml-1 inline"/>;
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
                    <Button variant="secondary" onClick={() => window.print()}><Printer size={16} /> Печать</Button>
                    <Button variant="secondary" onClick={handleExport}><Download size={16} /> Excel</Button>
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
                        <p className="text-xs text-slate-400 font-bold uppercase">S Проект</p>
                        <p className="text-2xl font-bold text-slate-800">{stats.totalProj.toLocaleString('ru-RU')} м²</p>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-4 shadow-sm border-l-4 border-l-indigo-500">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full"><Maximize2 size={20}/></div>
                    <div>
                        <p className="text-xs text-slate-400 font-bold uppercase">S Факт</p>
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
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                        <Input 
                            placeholder="Поиск по названию..." 
                            className="pl-9 bg-white" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="w-full sm:w-48">
                        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-white">
                            <option value="all">Все статусы</option>
                            <option value="Проектный">Проектный</option>
                            <option value="Строящийся">Строящийся</option>
                            <option value="Введенный">Введенный</option>
                        </Select>
                    </div>
                </div>
                
                <div className="flex bg-slate-100 p-1 rounded-lg self-end lg:self-auto">
                    <button onClick={() => setViewMode('table')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'table' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                        <FileText size={14}/> Таблица
                    </button>
                    <button onClick={() => setViewMode('cards')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'cards' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                        <LayoutGrid size={14}/> Карточки
                    </button>
                </div>
            </div>

            {/* CONTENT: TABLE MODE */}
            {viewMode === 'table' && (
                <Card className="overflow-hidden shadow-sm border border-slate-200">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                                    <th className="p-4 w-12 text-center">#</th>
                                    <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('label')}>Объект <SortIcon columnKey="label"/></th>
                                    <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('stage')}>Статус <SortIcon columnKey="stage"/></th>
                                    {/* НОВОЕ: Колонка прогресса в таблице */}
                                    <th className="p-4 w-32 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('progress')}>Прогресс <SortIcon columnKey="progress"/></th>
                                    <th className="p-4 text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('sProj')}>S Проект <SortIcon columnKey="sProj"/></th>
                                    <th className="p-4 text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('sFact')}>S Факт <SortIcon columnKey="sFact"/></th>
                                    <th className="p-4 text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('diff')}>Разница <SortIcon columnKey="diff"/></th>
                                    <th className="p-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sortedItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-slate-400 text-sm">Объекты не найдены</td>
                                    </tr>
                                ) : (
                                    sortedItems.map((item, idx) => {
                                        const diffPercent = item.sProj > 0 ? (item.diff / item.sProj) * 100 : 0;
                                        const diffColor = Math.abs(diffPercent) > 5 ? 'text-red-600 font-bold' : (item.diff > 0 ? 'text-emerald-600' : 'text-slate-500');
                                        const progress = Math.round(item.progress || 0);

                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                                                <td className="p-4 text-xs font-bold text-slate-400 text-center">{idx + 1}</td>
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
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[60px]">
                                                            <div className="h-full bg-blue-500" style={{width: `${progress}%`}}></div>
                                                        </div>
                                                        <span className="text-[10px] font-bold text-slate-400">{progress}%</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right font-mono text-sm text-slate-600">
                                                    {item.sProj.toFixed(2)}
                                                </td>
                                                <td className="p-4 text-right font-mono text-sm font-bold text-slate-800">
                                                    {item.sFact.toFixed(2)}
                                                </td>
                                                <td className={`p-4 text-right font-mono text-xs ${diffColor}`}>
                                                    {item.diff > 0 ? '+' : ''}{item.diff.toFixed(2)}
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
                                    <td colSpan={4} className="p-4 text-right font-bold text-sm text-slate-600 uppercase">Итого:</td>
                                    <td className="p-4 text-right font-bold text-sm font-mono">{stats.totalProj.toFixed(2)}</td>
                                    <td className="p-4 text-right font-bold text-sm font-mono">{stats.totalFact.toFixed(2)}</td>
                                    <td colSpan={2}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </Card>
            )}

            {/* CONTENT: CARDS MODE */}
            {viewMode === 'cards' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {sortedItems.length === 0 ? (
                        <div className="col-span-full p-12 text-center text-slate-400 border-2 border-dashed rounded-xl">Объекты не найдены</div>
                    ) : (
                        sortedItems.map((item) => {
                            const progress = Math.round(item.progress || 0);
                            return (
                                <Card key={item.id} className="p-0 hover:shadow-lg transition-all group border-slate-200 hover:border-blue-300">
                                    <div className="p-5">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-sm text-slate-700 border border-slate-200 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                {item.houseNumber}
                                            </div>
                                            <Badge className={getStageColor(item.stage)}>{item.stage || 'Проект'}</Badge>
                                        </div>
                                        <h3 className="font-bold text-lg text-slate-800 mb-1 line-clamp-1" title={item.label}>{item.label}</h3>
                                        <p className="text-xs text-slate-400 line-clamp-1">{item.type}</p>
                                    </div>

                                    <div className="px-5 pb-5 space-y-3">
                                        <div className="flex justify-between items-end text-sm">
                                            <span className="text-slate-500 font-medium">Площадь</span>
                                            <span className="font-bold text-slate-800">{item.sProj.toLocaleString()} <span className="text-slate-400 font-normal">м²</span></span>
                                        </div>
                                        
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400">
                                                <span>Прогресс</span>
                                                <span>{progress}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500 rounded-full" style={{width: `${progress}%`}}></div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 border-t border-slate-100 px-5 py-3 flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.dateEnd ? `Сдача: ${new Date(item.dateEnd).getFullYear()}` : 'Без даты'}</span>
                                        <button className="p-1.5 text-slate-400 hover:text-blue-600 bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow transition-all">
                                            <ArrowRight size={14}/>
                                        </button>
                                    </div>
                                </Card>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}