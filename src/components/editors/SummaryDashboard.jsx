import React, { useMemo } from 'react';
import { 
  Building2, Home, Briefcase, 
  Car, TrendingUp, AlertTriangle,
  CheckCircle2, PieChart as PieIcon, BarChart as BarChartIcon,
  School, MapPin, ArrowUpRight, Globe 
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend 
} from 'recharts';
import { useProject } from '../../context/ProjectContext';
import { Card, SectionTitle, Badge } from '../ui/UIKit';
import { getBlocksList, calculateProgress } from '../../lib/utils';

// --- ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ ---

const CustomTooltip = ({ active = false, payload = [], label = "" }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900 text-white text-xs p-3 rounded-xl shadow-xl border border-slate-700 animate-in fade-in zoom-in-95 duration-200 z-50">
                <p className="font-bold mb-1 opacity-70">{label || payload[0].name}</p>
                {payload.map((entry, index) => (
                    <p key={index} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }}/>
                        <span>{entry.name}:</span>
                        <span className="font-mono font-bold">{entry.value.toLocaleString()} м²</span>
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

// Карточка с двумя показателями
const StatCard = ({ icon: Icon, label, color = "blue", mainMetric, subMetric, warning = false }) => {
    const styles = {
        blue: "bg-blue-50 text-blue-600 border-blue-100",
        emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
        purple: "bg-purple-50 text-purple-600 border-purple-100",
        amber: "bg-amber-50 text-amber-600 border-amber-100",
        indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
        slate: "bg-slate-100 text-slate-600 border-slate-200",
    };
    const activeStyle = styles[color] || styles.blue;

    return (
        <div className={`relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md ${warning ? 'border-red-300 ring-2 ring-red-50' : 'border-slate-200'} group`}>
            
            {/* Заголовок и иконка */}
            <div className="flex items-start justify-between mb-4">
                 <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</h3>
                 <div className={`p-2.5 rounded-xl ${activeStyle} transition-transform group-hover:scale-110`}>
                     <Icon size={20} />
                 </div>
            </div>

            <div className="flex flex-col gap-3">
                 {/* Основной показатель (обычно Площадь) */}
                 <div>
                     <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">{mainMetric.label}</p>
                     <div className="flex items-baseline gap-1">
                         <span className="text-2xl font-black text-slate-800 tracking-tight leading-none">{mainMetric.value}</span>
                         <span className="text-xs font-bold text-slate-500">{mainMetric.unit}</span>
                     </div>
                 </div>

                 {/* Разделитель */}
                 <div className="h-px w-full bg-slate-100" />

                 {/* Второстепенный показатель (обычно Количество) */}
                 {subMetric && (
                     <div className="flex items-center justify-between">
                         <span className="text-xs font-bold text-slate-500">{subMetric.label}</span>
                         <span className={`text-sm font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1 ${warning ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-700 border-slate-100'}`}>
                             {subMetric.value} <span className="text-[10px] text-slate-400 ml-0.5">{subMetric.unit}</span>
                         </span>
                     </div>
                 )}
            </div>
        </div>
    );
};

export default function SummaryDashboard() {
    const { composition, floorData, flatMatrix, parkingPlaces, complexInfo } = useProject();

    // --- АГРЕГАЦИЯ ДАННЫХ ---
    const stats = useMemo(() => {
        const result = {
            totalAreaProj: 0,
            totalAreaFact: 0,
            living: { area: 0, count: 0 },
            commercial: { area: 0, count: 0 },
            infrastructure: { area: 0, count: 0 },
            parking: { area: 0, count: 0 },
            mop: { area: 0 },
            cadastreReadyCount: 0,
            totalObjectsCount: 0,
            avgProgress: 0
        };

        let totalProgressSum = 0;
        let itemsCount = 0;

        composition.forEach(building => {
            const buildingPrefix = building.id;

            // Прогресс
            const progress = calculateProgress(building.dateStart, building.dateEnd);
            totalProgressSum += progress;
            itemsCount++;

            // 1. Площади (FloorData)
            Object.keys(floorData).forEach(key => {
                if (key.startsWith(buildingPrefix)) {
                    const f = floorData[key];
                    result.totalAreaProj += parseFloat(f.areaProj || 0);
                    result.totalAreaFact += parseFloat(f.areaFact || 0);
                }
            });

            // 2. Юниты (FlatMatrix)
            Object.keys(flatMatrix).forEach(key => {
                if (key.startsWith(buildingPrefix)) {
                    const u = flatMatrix[key];
                    const area = parseFloat(u.area || 0);
                    
                    result.totalObjectsCount++;
                    if (u.cadastreNumber) result.cadastreReadyCount++;

                    if (['flat', 'duplex_up', 'duplex_down'].includes(u.type)) {
                        result.living.area += area;
                        result.living.count++;
                    } else if (['office', 'office_inventory', 'non_res_block'].includes(u.type)) {
                        result.commercial.area += area;
                        result.commercial.count++;
                    } else if (u.type === 'infrastructure') {
                        result.infrastructure.area += area;
                        result.infrastructure.count++;
                    }
                }
            });

            // 3. Инфраструктура (как здания)
            if (building.category === 'infrastructure') {
                const hasUnits = Object.keys(flatMatrix).some(k => k.startsWith(buildingPrefix));
                if (!hasUnits) {
                    let infraArea = 0;
                    Object.keys(floorData).forEach(k => {
                        if (k.startsWith(buildingPrefix)) infraArea += parseFloat(floorData[k].areaProj || 0);
                    });
                    if (infraArea > 0) {
                        result.infrastructure.area += infraArea;
                        result.infrastructure.count++;
                        result.totalObjectsCount++;
                        if (building.cadastreNumber) result.cadastreReadyCount++;
                    }
                }
            }

            // 4. Паркинги
            Object.keys(parkingPlaces).forEach(key => {
                if (key.startsWith(buildingPrefix) && key.includes('_place')) {
                    const p = parkingPlaces[key];
                    const area = parseFloat(p.area || 0);
                    result.parking.area += area;
                    result.parking.count++;
                    result.totalObjectsCount++;
                    if (p.cadastreNumber) result.cadastreReadyCount++;
                }
            });
        });

        // МОП
        const usefulArea = result.living.area + result.commercial.area + result.infrastructure.area + result.parking.area;
        result.mop.area = Math.max(0, result.totalAreaProj - usefulArea);

        if (itemsCount > 0) {
            result.avgProgress = totalProgressSum / itemsCount;
        }

        return result;
    }, [composition, floorData, flatMatrix, parkingPlaces]);

    // Проверка на пустоту
    const isEmpty = stats.totalAreaProj === 0 && stats.totalObjectsCount === 0;

    if (isEmpty) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4 animate-in fade-in">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400"><BarChartIcon size={40} /></div>
                <h3 className="text-xl font-bold text-slate-700">Нет данных для анализа</h3>
                <p className="text-slate-500 max-w-md">Заполните данные о зданиях, этажах и помещениях, чтобы сформировать ТЭП.</p>
            </div>
        );
    }

    const chartData = [
        { name: 'Жилая', value: stats.living.area, color: '#3b82f6' },
        { name: 'Коммерция', value: stats.commercial.area, color: '#10b981' },
        { name: 'Инфраструктура', value: stats.infrastructure.area, color: '#f59e0b' },
        { name: 'Паркинг', value: stats.parking.area, color: '#6366f1' },
        { name: 'МОП / Тех.', value: stats.mop.area, color: '#94a3b8' },
    ].filter(i => i.value > 0);

    const diff = stats.totalAreaFact - stats.totalAreaProj;
    const diffPercent = stats.totalAreaProj > 0 ? (diff / stats.totalAreaProj) * 100 : 0;
    const isDiffCritical = Math.abs(diffPercent) > 5;

    const barData = [
        { name: 'Площади', Проект: stats.totalAreaProj, Факт: stats.totalAreaFact }
    ];

    const cadastrePercent = stats.totalObjectsCount > 0 ? (stats.cadastreReadyCount / stats.totalObjectsCount) * 100 : 0;

    return (
        <div className="w-full pb-20 space-y-6 animate-in fade-in duration-500 px-6">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 border-b border-slate-200 pb-6 gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-900 text-white rounded-xl shadow-lg shadow-slate-200">
                        <TrendingUp size={24}/>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">ТЭП: {complexInfo?.name}</h1>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                            <MapPin size={12}/>
                            <span>{complexInfo?.street || 'Адрес не указан'}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs px-3 py-1">
                        Строительная готовность: {Math.round(stats.avgProgress)}%
                    </Badge>
                </div>
            </div>

            {/* --- KPI CARDS GRID --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* 1. Общая площадь */}
                <StatCard 
                    icon={Building2} 
                    label="Общая площадь (S)" 
                    color="slate"
                    warning={isDiffCritical}
                    mainMetric={{ 
                        label: "Проектная", 
                        value: stats.totalAreaProj.toLocaleString(undefined, {maximumFractionDigits: 0}), 
                        unit: "м²" 
                    }}
                    subMetric={{ 
                        label: "Факт по Кадастру", // [CHANGED]
                        value: stats.totalAreaFact > 0 ? stats.totalAreaFact.toLocaleString(undefined, {maximumFractionDigits: 0}) : '-', 
                        unit: "м²" 
                    }}
                />

                {/* 2. Жилой фонд */}
                <StatCard 
                    icon={Home} 
                    label="Жилой фонд" 
                    color="blue"
                    mainMetric={{ 
                        label: "Площадь", 
                        value: stats.living.area.toLocaleString(undefined, {maximumFractionDigits: 0}), 
                        unit: "м²" 
                    }}
                    subMetric={{ 
                        label: "Квартир", 
                        value: stats.living.count, 
                        unit: "шт." 
                    }}
                />

                {/* 3. Коммерция */}
                <StatCard 
                    icon={Briefcase} 
                    label="Коммерция" 
                    color="emerald"
                    mainMetric={{ 
                        label: "Площадь", 
                        value: stats.commercial.area.toLocaleString(undefined, {maximumFractionDigits: 0}), 
                        unit: "м²" 
                    }}
                    subMetric={{ 
                        label: "Помещений", 
                        value: stats.commercial.count, 
                        unit: "шт." 
                    }}
                />

                {/* 4. Соц. объекты */}
                <StatCard 
                    icon={School} 
                    label="Соц. объекты" 
                    color="amber"
                    mainMetric={{ 
                        label: "Площадь", 
                        value: stats.infrastructure.area.toLocaleString(undefined, {maximumFractionDigits: 0}), 
                        unit: "м²" 
                    }}
                    subMetric={{ 
                        label: "Объектов", 
                        value: stats.infrastructure.count, 
                        unit: "ед." 
                    }}
                />

                {/* 5. Паркинг */}
                <StatCard 
                    icon={Car} 
                    label="Паркинг" 
                    color="indigo"
                    mainMetric={{ 
                        label: "Площадь", 
                        value: stats.parking.area.toLocaleString(undefined, {maximumFractionDigits: 0}), 
                        unit: "м²" 
                    }}
                    subMetric={{ 
                        label: "Машиномест", 
                        value: stats.parking.count, 
                        unit: "мм" 
                    }}
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* Левая колонка: График распределения */}
                <Card className="xl:col-span-2 p-6 shadow-sm flex flex-col min-h-[400px]">
                    <div className="flex justify-between items-center mb-6">
                        <SectionTitle icon={PieIcon} className="mb-0">Структура площадей</SectionTitle>
                        <div className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-full border border-slate-200">
                            Коэффициент полезных площадей: {stats.totalAreaProj > 0 ? ((stats.living.area + stats.commercial.area) / stats.totalAreaProj).toFixed(2) : '0.00'}
                        </div>
                    </div>
                    
                    <div className="flex flex-col md:flex-row items-center gap-8 flex-1">
                        <div className="h-[300px] w-full md:w-1/2 relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={80}
                                        outerRadius={110}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip content={<CustomTooltip />} />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                                <span className="text-xs text-slate-400 uppercase font-bold">Всего</span>
                                <span className="text-2xl font-black text-slate-800">{stats.totalAreaProj.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                                <span className="text-xs text-slate-400">м²</span>
                            </div>
                        </div>

                        <div className="w-full md:w-1/2 space-y-3">
                            {chartData.map((item, idx) => (
                                <div key={idx} className="group flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                                        <div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase">{item.name}</div>
                                            <div className="text-sm font-bold text-slate-700">{item.value.toLocaleString(undefined, {maximumFractionDigits: 1})} м²</div>
                                        </div>
                                    </div>
                                    <div className="text-xs font-mono font-bold text-slate-400">
                                        {stats.totalAreaProj > 0 ? ((item.value / stats.totalAreaProj) * 100).toFixed(1) : 0}%
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>

                {/* Правая колонка: Проект/Факт и Интеграция */}
                <div className="space-y-6 flex flex-col">
                    
                    {/* Проект vs Факт */}
                    <Card className={`p-6 shadow-sm border-l-4 ${isDiffCritical ? 'border-l-red-500' : 'border-l-emerald-500'}`}>
                        <SectionTitle icon={BarChartIcon}>Проект vs Факт</SectionTitle>
                        <div className="h-[180px] mt-4 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={barData} layout="vertical" barSize={24}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" hide />
                                    <RechartsTooltip content={<CustomTooltip />} cursor={{fill: '#f1f5f9'}} />
                                    <Legend wrapperStyle={{fontSize: '10px'}}/>
                                    <Bar dataKey="Проект" fill="#94a3b8" radius={[0, 4, 4, 0]} />
                                    <Bar dataKey="Факт" fill={diff > 0 ? "#ef4444" : "#10b981"} radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-2 pt-3 border-t border-slate-100 flex justify-between items-center">
                            <span className="text-xs text-slate-500">Отклонение:</span>
                            <span className={`text-sm font-bold ${diff > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                {diff > 0 ? '+' : ''}{diff.toLocaleString(undefined, {maximumFractionDigits: 1})} м² ({diffPercent.toFixed(2)}%)
                            </span>
                        </div>
                    </Card>

                    {/* Кадастровая готовность */}
                    <Card className="p-6 shadow-sm bg-slate-900 text-white border-0 flex-1 flex flex-col justify-center">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-300">
                                    <Globe size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-sm uppercase tracking-wide">Кадастр (УЗКАД)</h3>
                                    <p className="text-[10px] text-slate-400">Синхронизация</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-black">{stats.cadastreReadyCount}</div>
                                <div className="text-[9px] text-slate-400">из {stats.totalObjectsCount}</div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-indigo-500 transition-all duration-1000" 
                                    style={{ width: `${cadastrePercent}%` }}
                                ></div>
                            </div>

                            <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-400">Готовность данных</span>
                                <span className="font-bold text-indigo-300">{Math.round(cadastrePercent)}%</span>
                            </div>

                            <button onClick={() => document.getElementById('root').scrollIntoView()} className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2">
                                <ArrowUpRight size={14}/> Перейти к интеграции
                            </button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}