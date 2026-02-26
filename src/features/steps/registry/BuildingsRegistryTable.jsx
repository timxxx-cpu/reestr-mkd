import React, { useEffect, useState, useMemo } from 'react';
import { 
  Building2, 
  Layers, 
  AlertCircle, 
  Home, 
  Briefcase, 
  Car, 
  Filter,
  Box,
  School,
  MapPin
} from 'lucide-react';
import { ApiService } from '@lib/api-service';
import { TableSkeleton } from '@components/ui/UIKit';

const BuildingsRegistryTable = ({ onSelectBuilding }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    fetchBuildings();
  }, []);

  const fetchBuildings = async () => {
    try {
      setLoading(true);
      const buildings = await ApiService.getBuildingsRegistrySummary();
      setData(buildings || []);
    } catch (err) {
      console.error('Ошибка загрузки реестра зданий:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Логика фильтрации
  const filteredData = useMemo(() => {
    if (activeFilter === 'all') return data;
    
    // Группируем МКД (односекционные и многосекционные)
    if (activeFilter === 'residential_group') {
        return data.filter(item => ['residential', 'residential_multiblock'].includes(item.category));
    }

    // Остальные по точному совпадению
    return data.filter(item => item.category === activeFilter);
  }, [data, activeFilter]);

  const formatArea = (val) => val?.toLocaleString('ru-RU', { maximumFractionDigits: 0 });

  // Конфигурация кнопок фильтров
  const filters = [
    { id: 'all', label: 'Все объекты', icon: Box },
    { id: 'residential_group', label: 'МКД (Жилье)', icon: Building2 }, // Объединенный фильтр
    { id: 'parking', label: 'Паркинги', icon: Car },
    { id: 'infrastructure', label: 'Соц. объекты', icon: School },
  ];

  if (loading) return <TableSkeleton rows={10} cols={8} />;
  
  if (error) return (
    <div className="p-10 flex flex-col items-center justify-center text-red-500 gap-2">
        <AlertCircle size={24} />
        <span>Ошибка загрузки данных: {error}</span>
    </div>
  );

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-white rounded-t-2xl shadow-[0_0_15px_rgba(0,0,0,0.05)] border border-slate-200/60">
      
      {/* ПАНЕЛЬ ФИЛЬТРОВ */}
      <div className="px-4 py-3 border-b border-slate-100 bg-white flex items-center gap-2 overflow-x-auto no-scrollbar">
        <div className="mr-2 text-slate-400">
            <Filter size={16} />
        </div>
        {filters.map(f => {
            const isActive = activeFilter === f.id;
            const Icon = f.icon;
            
            // Подсчет количества для бейджика
            let count = 0;
            if (!loading && data.length > 0) {
                if (f.id === 'all') count = data.length;
                else if (f.id === 'residential_group') count = data.filter(d => ['residential', 'residential_multiblock'].includes(d.category)).length;
                else count = data.filter(d => d.category === f.id).length;
            }

            return (
                <button
                    key={f.id}
                    onClick={() => setActiveFilter(f.id)}
                    className={`
                        flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap
                        ${isActive 
                            ? 'bg-slate-800 text-white shadow-md shadow-slate-200' 
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/50'}
                    `}
                >
                    <Icon size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
                    {f.label}
                    {count > 0 && (
                        <span className={`ml-1 px-1.5 rounded-md text-[9px] ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                            {count}
                        </span>
                    )}
                </button>
            );
        })}
      </div>

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Building2 size={48} className="mb-4 opacity-20" />
            <p>Нет данных о зданиях в реестре</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-sm border-collapse relative">
            <thead className="bg-slate-900 text-slate-300 sticky top-0 z-20 shadow-lg">
                <tr>
                <th className="px-3 py-4 text-center text-[10px] font-bold uppercase tracking-wider w-12">Код</th>
                <th className="px-3 py-4 text-center text-[10px] font-bold uppercase tracking-wider w-20">Дом №</th>
                <th className="px-3 py-4 text-left text-[10px] font-bold uppercase tracking-wider">Жилой Комплекс</th>
                <th className="px-3 py-4 text-center text-[10px] font-bold uppercase tracking-wider w-16">Этажи</th>
                
                {/* Группа Квартиры */}
                <th className="px-3 py-4 text-right text-[10px] font-bold uppercase tracking-wider bg-slate-800/50 w-28">
                    <div className="flex items-center justify-end gap-1 text-emerald-400"><Home size={12}/> Жилье</div>
                </th>
                
                {/* Группа Коммерция */}
                <th className="px-3 py-4 text-right text-[10px] font-bold uppercase tracking-wider w-24">
                    <div className="flex items-center justify-end gap-1 text-blue-400"><Briefcase size={12}/> Офисы</div>
                </th>

                {/* Группа Паркинг */}
                <th className="px-3 py-4 text-right text-[10px] font-bold uppercase tracking-wider bg-slate-800/50 w-24">
                    <div className="flex items-center justify-end gap-1 text-indigo-400"><Car size={12}/> Паркинг</div>
                </th>

                <th className="px-3 py-4 text-right text-[10px] font-bold uppercase tracking-wider w-28">Площадь</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {filteredData.map((row) => (
                <tr 
                    key={row.building_id} 
                    onClick={() => onSelectBuilding && onSelectBuilding(row.building_id)}
                    className="group hover:bg-blue-50/40 transition-colors border-l-[3px] border-l-transparent hover:border-l-blue-500 cursor-pointer"
                >
                    {/* Код (UJ Code здания для справки) */}
                    <td className="px-3 py-3 align-middle text-center">
                         <span className="font-mono text-[10px] text-slate-400 opacity-60">
                            {row.building_code}
                         </span>
                    </td>

                    {/* Номер дома (Акцент) */}
                    <td className="px-3 py-3 align-middle text-center">
                        <div className="flex justify-center">
                            <span className="font-bold text-slate-800 text-sm bg-white border border-slate-200 shadow-sm px-2 py-1 min-w-[32px] rounded-lg">
                                {row.house_number || '—'}
                            </span>
                        </div>
                    </td>

                    {/* Название ЖК (Описательная часть - ТОЛЬКО ЖК) */}
                    <td className="px-3 py-3 align-middle">
                        <div className="font-bold text-slate-800 text-sm group-hover:text-blue-700 transition-colors flex items-center gap-2">
                            {row.project_name}
                        </div>
                    </td>

                    {/* Этажность */}
                    <td className="px-3 py-3 align-middle text-center">
                        <div className="inline-flex items-center gap-1 text-slate-600">
                            <span className="font-bold text-sm">{row.floors_count}</span>
                        </div>
                    </td>

                    {/* ЖИЛЬЕ */}
                    <td className="px-3 py-3 align-middle text-right bg-emerald-50/30 group-hover:bg-emerald-100/30 transition-colors">
                        <div className="flex flex-col">
                            {row.count_living > 0 ? (
                                <>
                                    <span className="font-bold text-slate-800 text-sm">
                                        {row.count_living}
                                    </span>
                                    <span className="text-[10px] text-emerald-600 font-mono font-bold">
                                        {formatArea(row.area_living_total)}
                                    </span>
                                </>
                            ) : <span className="text-slate-200 text-xs">—</span>}
                        </div>
                    </td>

                    {/* КОММЕРЦИЯ */}
                    <td className="px-3 py-3 align-middle text-right">
                        <div className="flex flex-col">
                             {row.count_commercial > 0 ? (
                                <>
                                    <span className="font-bold text-slate-800 text-sm">
                                        {row.count_commercial}
                                    </span>
                                    <span className="text-[10px] text-blue-600 font-mono font-bold">
                                        {formatArea(row.area_commercial)}
                                    </span>
                                </>
                            ) : <span className="text-slate-200 text-xs">—</span>}
                        </div>
                    </td>

                    {/* ПАРКИНГ */}
                    <td className="px-3 py-3 align-middle text-right bg-indigo-50/30 group-hover:bg-indigo-100/30 transition-colors">
                        <div className="flex flex-col">
                            {row.count_parking > 0 ? (
                                <>
                                    <span className="font-bold text-slate-800 text-sm">
                                        {row.count_parking}
                                    </span>
                                    <span className="text-[10px] text-indigo-600 font-mono font-bold">
                                        {formatArea(row.area_parking)}
                                    </span>
                                </>
                            ) : <span className="text-slate-200 text-xs">—</span>}
                        </div>
                    </td>

                    {/* ВСЕГО ПЛОЩАДЬ */}
                    <td className="px-3 py-3 align-middle text-right">
                        <span className="font-mono font-black text-slate-700 text-xs">
                            {formatArea(row.area_total_sum)} м²
                        </span>
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
      )}
    </div>
  );
};

export default BuildingsRegistryTable;