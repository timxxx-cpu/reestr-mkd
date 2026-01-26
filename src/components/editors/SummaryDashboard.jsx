import React, { useMemo } from 'react';
import { 
  Home, Car, Layers, PieChart as PieIcon, 
  TrendingUp, Store
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { useProject } from '../../context/ProjectContext';
import { Card, SectionTitle } from '../ui/UIKit';

// Цветовая палитра для графиков
const COLORS = {
    living: '#3b82f6', // blue-500
    commercial: '#8b5cf6', // violet-500
    parking: '#6366f1', // indigo-500
    mop: '#f59e0b', // amber-500
    proj: '#94a3b8', // slate-400
    fact: '#10b981', // emerald-500
};

// Форматирование чисел
const fmt = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(n || 0));
const fmtFloat = (n) => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n || 0);

export default function SummaryDashboard() {
    const { 
        complexInfo, composition, 
        flatMatrix, parkingPlaces, mopData, floorData
    } = useProject();

    // --- 1. АГРЕГАЦИЯ ДАННЫХ ---
    const stats = useMemo(() => {
        const data = {
            living: { count: 0, area: 0 },
            commercial: { count: 0, area: 0 },
            pantry: { count: 0, area: 0 },
            parking: { count: 0, area: 0 },
            mop: { area: 0 }
        };

        // Квартиры и помещения (FlatMatrix)
        if (flatMatrix) {
            Object.values(flatMatrix).forEach(unit => {
                if (!unit || !unit.area) return;
                const area = parseFloat(String(unit.area));
                
                if (unit.type === 'office') {
                    data.commercial.count++;
                    data.commercial.area += area;
                } else if (unit.type === 'pantry') {
                    data.pantry.count++;
                    data.pantry.area += area;
                } else {
                    // flat, duplex_up, duplex_down
                    data.living.count++;
                    data.living.area += area;
                }
            });
        }

        // Паркинг (ParkingPlaces)
        if (parkingPlaces) {
            Object.keys(parkingPlaces).forEach(key => {
                if (key.includes('_place')) {
                    // @ts-ignore
                    const place = parkingPlaces[key];
                    if (place) {
                        data.parking.count++;
                        data.parking.area += parseFloat(String(place.area || '0'));
                    }
                }
            });
        }

        // МОП (MopData)
        if (mopData) {
            Object.values(mopData).forEach(floorMops => {
                if (Array.isArray(floorMops)) {
                    floorMops.forEach(mop => {
                        if (mop && mop.area) data.mop.area += parseFloat(String(mop.area));
                    });
                }
            });
        }

        return data;
    }, [flatMatrix, parkingPlaces, mopData]);

    // --- 2. ПОДГОТОВКА ДАННЫХ ДЛЯ ГРАФИКОВ ---
    
    // A. План / Факт по корпусам (Bar Chart)
    const chartDataBuildings = useMemo(() => {
        return composition.map(b => {
            let areaProj = 0;
            let areaFact = 0;
            
            // Суммируем площади этажей для каждого здания
            Object.keys(floorData).forEach(key => {
                if (key.startsWith(`${b.id}_`)) {
                    // @ts-ignore
                    const f = floorData[key];
                    if (f) {
                        areaProj += parseFloat(f.areaProj || '0');
                        areaFact += parseFloat(f.areaFact || '0');
                    }
                }
            });

            return {
                name: b.houseNumber ? `Дом ${b.houseNumber}` : b.label,
                Проект: parseFloat(areaProj.toFixed(1)),
                Факт: parseFloat(areaFact.toFixed(1)),
                // Для тултипа
                fullLabel: b.label
            };
        }).filter(d => d.Проект > 0 || d.Факт > 0);
    }, [composition, floorData]);

    // B. Структура площадей (Pie Chart)
    const chartDataStructure = [
        { name: 'Жилая', value: stats.living.area, color: COLORS.living },
        { name: 'Коммерция', value: stats.commercial.area, color: COLORS.commercial },
        { name: 'Паркинг', value: stats.parking.area, color: COLORS.parking },
        { name: 'МОП', value: stats.mop.area, color: COLORS.mop },
    ].filter(d => d.value > 0);

    // Общая полезная площадь (без МОП)
    const totalUsefulArea = stats.living.area + stats.commercial.area + stats.parking.area + stats.pantry.area;

    return (
        <div className="max-w-7xl mx-auto pb-20 animate-in fade-in duration-700 space-y-8">
            
            {/* --- ЗАГОЛОВОК --- */}
            <div className="border-b border-slate-200 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">{complexInfo.name || "Новый проект"}</h1>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border border-emerald-200">
                            {complexInfo.status}
                        </span>
                        <span className="text-slate-400 text-sm">
                            • {composition.length} строений
                        </span>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">Полезная площадь</div>
                    <div className="text-3xl font-bold text-blue-600">{fmtFloat(totalUsefulArea)} <span className="text-lg text-slate-400">м²</span></div>
                </div>
            </div>

            {/* --- KPI КАРТОЧКИ --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* 1. Жилье */}
                <Card className="p-6 border-l-4 border-l-blue-500 hover:shadow-md transition-all cursor-default group">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="text-xs font-bold text-slate-400 uppercase mb-1">Жилой фонд</div>
                            <div className="text-3xl font-bold text-slate-800">{fmt(stats.living.count)} <span className="text-sm text-slate-400 font-medium">кв.</span></div>
                        </div>
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform"><Home size={24}/></div>
                    </div>
                    <div className="text-sm font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg inline-block">
                        {fmtFloat(stats.living.area)} м²
                    </div>
                </Card>

                {/* 2. Коммерция */}
                <Card className="p-6 border-l-4 border-l-violet-500 hover:shadow-md transition-all cursor-default group">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="text-xs font-bold text-slate-400 uppercase mb-1">Коммерция</div>
                            <div className="text-3xl font-bold text-slate-800">{fmt(stats.commercial.count)} <span className="text-sm text-slate-400 font-medium">пом.</span></div>
                        </div>
                        <div className="p-3 bg-violet-50 text-violet-600 rounded-xl group-hover:scale-110 transition-transform"><Store size={24}/></div>
                    </div>
                    <div className="text-sm font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg inline-block">
                        {fmtFloat(stats.commercial.area)} м²
                    </div>
                </Card>

                {/* 3. Паркинг */}
                <Card className="p-6 border-l-4 border-l-indigo-500 hover:shadow-md transition-all cursor-default group">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="text-xs font-bold text-slate-400 uppercase mb-1">Паркинг</div>
                            <div className="text-3xl font-bold text-slate-800">{fmt(stats.parking.count)} <span className="text-sm text-slate-400 font-medium">мест</span></div>
                        </div>
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform"><Car size={24}/></div>
                    </div>
                    <div className="text-sm font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg inline-block">
                        {fmtFloat(stats.parking.area)} м²
                    </div>
                </Card>

                {/* 4. МОП */}
                <Card className="p-6 border-l-4 border-l-amber-500 hover:shadow-md transition-all cursor-default group">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="text-xs font-bold text-slate-400 uppercase mb-1">МОП</div>
                            <div className="text-3xl font-bold text-slate-800">—</div>
                        </div>
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform"><Layers size={24}/></div>
                    </div>
                    <div className="text-sm font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg inline-block">
                        {fmtFloat(stats.mop.area)} м²
                    </div>
                </Card>
            </div>

            {/* --- ГРАФИКИ --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[450px]">
                
                {/* 1. ГРАФИК ПЛАН / ФАКТ (Bar Chart) */}
                <Card className="col-span-2 p-6 flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <SectionTitle icon={TrendingUp} className="mb-0">Динамика площадей (План / Факт)</SectionTitle>
                        <div className="flex gap-4 text-xs font-bold">
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-400"></div> Проект</div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Факт</div>
                        </div>
                    </div>
                    
                    {chartDataBuildings.length > 0 ? (
                        <div className="flex-1 w-full min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartDataBuildings} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} barGap={2}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
                                    <XAxis 
                                        dataKey="name" 
                                        tick={{fontSize: 11, fill: '#64748b'}} 
                                        axisLine={false} 
                                        tickLine={false}
                                        interval={0}
                                    />
                                    <YAxis 
                                        tick={{fontSize: 11, fill: '#64748b'}} 
                                        axisLine={false} 
                                        tickLine={false}
                                        tickFormatter={(val) => `${(val/1000).toFixed(0)}k`}
                                    />
                                    <Tooltip 
                                        cursor={{fill: '#f1f5f9'}}
                                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                    />
                                    <Bar dataKey="Проект" fill={COLORS.proj} radius={[4, 4, 0, 0]} barSize={20} animationDuration={1000}/>
                                    <Bar dataKey="Факт" fill={COLORS.fact} radius={[4, 4, 0, 0]} barSize={20} animationDuration={1000}/>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm bg-slate-50 rounded-xl border border-dashed">Нет данных по этажам</div>
                    )}
                </Card>

                {/* 2. КРУГОВАЯ ДИАГРАММА (Pie Chart) */}
                <Card className="p-6 flex flex-col">
                    <SectionTitle icon={PieIcon} className="mb-2">Структура площадей</SectionTitle>
                    
                    {chartDataStructure.length > 0 ? (
                        <div className="flex-1 relative min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartDataStructure}
                                        innerRadius="60%"
                                        outerRadius="80%"
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {chartDataStructure.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}/>
                                </PieChart>
                            </ResponsiveContainer>
                            {/* Легенда по центру */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-slate-800">{fmtFloat(totalUsefulArea + stats.mop.area)}</div>
                                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Всего м²</div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm bg-slate-50 rounded-xl border border-dashed">Нет данных</div>
                    )}

                    <div className="mt-4 space-y-2">
                        {chartDataStructure.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs border-b border-slate-50 pb-1 last:border-0">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{backgroundColor: item.color}}></div>
                                    <span className="font-bold text-slate-600">{item.name}</span>
                                </div>
                                <span className="font-mono font-medium text-slate-500">{fmtFloat(item.value)} м²</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
}