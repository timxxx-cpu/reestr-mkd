import React, { useMemo } from 'react';
import { 
  ScrollText, Building2, Warehouse, Car, Printer 
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card } from '../ui/UIKit';
import { getBuildingStats, calculateTEP } from '../../lib/calculations';

/**
 * Компонент строки таблицы
 */
const RegistryRow = ({ stats, index }) => {
    const diff = stats.areaFact > 0 ? stats.areaFact - stats.areaProj : 0;
    const diffPercent = stats.areaProj > 0 ? (diff / stats.areaProj) * 100 : 0;
    const hasCriticalDiff = Math.abs(diffPercent) > 5; 

    return (
        <tr className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 text-sm">
            <td className="p-4 text-slate-500 text-center w-12">{index + 1}</td>
            <td className="p-4 font-bold text-slate-700">{stats.label}</td>
            <td className="p-4 text-center">{stats.floors > 0 ? stats.floors : '-'}</td>
            
            <td className="p-4 text-right font-mono text-slate-600">{stats.areaProj.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})}</td>
            <td className="p-4 text-right font-mono">
                {stats.areaFact > 0 ? (
                    <span className={hasCriticalDiff ? 'text-red-600 font-bold' : 'text-slate-600'}>
                        {stats.areaFact.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})}
                    </span>
                ) : <span className="text-slate-300">-</span>}
            </td>
            
            <td className="p-4 text-center text-slate-600">{stats.flats > 0 ? stats.flats : '-'}</td>
            <td className="p-4 text-center text-slate-600">{stats.offices > 0 ? stats.offices : '-'}</td>
            <td className="p-4 text-center text-slate-600">{stats.parking > 0 ? stats.parking : '-'}</td>
            <td className="p-4 text-right text-slate-500 text-xs">{stats.mopArea > 0 ? stats.mopArea.toFixed(1) : '-'}</td>
        </tr>
    );
};

/**
 * @param {{ mode?: 'res' | 'nonres' | 'all' }} props 
 */
export default function RegistryView({ mode = 'all' }) {
    const projectContext = useProject();
    const { composition } = projectContext;

    // Группировка для отображения
    const groupedData = useMemo(() => {
        const groups = {
            residential: { id: 'residential', title: 'Жилые объекты', icon: Building2, items: [] },
            parking: { id: 'parking', title: 'Паркинги', icon: Car, items: [] },
            infrastructure: { id: 'infrastructure', title: 'Инфраструктура', icon: Warehouse, items: [] },
        };

        composition.forEach(building => {
            const stats = getBuildingStats(building, projectContext);
            if (building.category.includes('residential')) groups.residential.items.push(stats);
            else if (building.category === 'parking_separate') groups.parking.items.push(stats);
            else groups.infrastructure.items.push(stats);
        });

        return groups;
    }, [composition, projectContext]);

    // ФИЛЬТРАЦИЯ ПО РЕЖИМУ
    const visibleGroups = useMemo(() => {
        const allGroups = Object.values(groupedData);
        
        if (mode === 'res') {
            return allGroups.filter(g => ['residential', 'parking'].includes(g.id));
        }
        if (mode === 'nonres') {
            return allGroups.filter(g => ['infrastructure'].includes(g.id));
        }
        
        return allGroups;
    }, [groupedData, mode]);

    const handlePrint = () => {
        window.print();
    };

    if (composition.length === 0) {
        return <div className="p-12 text-center text-slate-400">Список объектов пуст</div>;
    }

    const hasItems = visibleGroups.some(g => g.items.length > 0);
    const pageTitle = mode === 'nonres' ? 'Реестр инфраструктуры' : mode === 'res' ? 'Реестр жилищного фонда' : 'Сводный реестр';

    return (
        <div className="max-w-7xl mx-auto pb-20 space-y-8 animate-in fade-in duration-500">
            
            <div className="flex justify-between items-center print:hidden">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-900 text-white rounded-lg"><ScrollText size={20}/></div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">{pageTitle}</h1>
                        <p className="text-xs text-slate-500">Детальная ведомость по корпусам</p>
                    </div>
                </div>
                
                <button onClick={handlePrint} className="px-4 py-2 bg-white border border-slate-200 shadow-sm rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors flex items-center gap-2 text-slate-700">
                    <Printer size={16}/> Печать
                </button>
            </div>

            {!hasItems && (
                <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                    <p className="text-slate-400 font-medium">В этой категории пока нет объектов.</p>
                    <p className="text-slate-400 text-xs mt-1">Добавьте здания соответствующего типа в разделе "Состав комплекса".</p>
                </div>
            )}

            {visibleGroups.map((group) => {
                if (group.items.length === 0) return null;
                const Icon = group.icon;

                const totalProj = group.items.reduce((sum, i) => sum + i.areaProj, 0);
                const totalFact = group.items.reduce((sum, i) => sum + i.areaFact, 0);
                const totalFlats = group.items.reduce((sum, i) => sum + i.flats, 0);

                return (
                    <Card key={group.id} className="p-0 overflow-hidden shadow-sm print:shadow-none print:border-0">
                        <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2">
                            <Icon size={18} className="text-slate-400"/>
                            <h3 className="font-bold text-slate-700">{group.title}</h3>
                            <span className="ml-2 px-2 py-0.5 bg-slate-200 rounded-full text-[10px] font-bold text-slate-600">{group.items.length}</span>
                        </div>
                        
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500">
                                    <tr>
                                        <th className="p-3 text-center">№</th>
                                        <th className="p-3 text-left">Наименование</th>
                                        <th className="p-3 text-center">Этажей</th>
                                        <th className="p-3 text-right">S Проект (м²)</th>
                                        <th className="p-3 text-right">S Факт (м²)</th>
                                        <th className="p-3 text-center">Кв.</th>
                                        <th className="p-3 text-center">Оф.</th>
                                        <th className="p-3 text-center">М/М</th>
                                        <th className="p-3 text-right">S МОП</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {group.items.map((stats, idx) => (
                                        <RegistryRow key={stats.id} stats={stats} index={idx} />
                                    ))}
                                    <tr className="bg-slate-100/50 font-bold text-xs text-slate-800 border-t border-slate-200">
                                        <td colSpan={3} className="p-3 text-right uppercase tracking-wider">Итого {group.title}:</td>
                                        <td className="p-3 text-right">{totalProj.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                                        <td className="p-3 text-right">{totalFact > 0 ? totalFact.toLocaleString(undefined, {maximumFractionDigits: 0}) : '-'}</td>
                                        <td className="p-3 text-center">{totalFlats > 0 ? totalFlats : '-'}</td>
                                        <td className="p-3 text-center">-</td>
                                        <td className="p-3 text-center">-</td>
                                        <td className="p-3 text-right">-</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </Card>
                );
            })}
        </div>
    );
}