import React, { useMemo } from 'react';
import { 
  Building2, Home, Briefcase, 
  Car, Layers, TrendingUp, AlertTriangle, ArrowRight,
  Calculator, CheckCircle2, PieChart as PieIcon, BarChart as BarChartIcon
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend 
} from 'recharts';
import { useProject } from '../../context/ProjectContext';
import { Card, SectionTitle } from '../ui/UIKit';
import { calculateTEP, getChartData } from '../../lib/calculations';

// Кастомный тултип для графиков
// ИСПРАВЛЕНО: Принимаем props целиком, чтобы избежать ошибки TS о пропущенных аргументах при вызове <CustomTooltip />
const CustomTooltip = (props) => {
    const { active, payload, label } = props;
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-800 text-white text-xs p-2 rounded shadow-xl border border-slate-700">
                <p className="font-bold mb-1">{label || payload[0].name}</p>
                {payload.map((entry, index) => (
                    <p key={index} style={{ color: entry.color || entry.fill }}>
                        {entry.name}: {entry.value.toLocaleString()} м²
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

// Компонент KPI карточки
const StatCard = ({ icon: Icon, label, value, subValue, color = "blue" }) => {
    const colorClasses = {
        blue: "bg-blue-50 text-blue-600 border-blue-100",
        emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
        purple: "bg-purple-50 text-purple-600 border-purple-100",
        amber: "bg-amber-50 text-amber-600 border-amber-100",
        slate: "bg-slate-100 text-slate-600 border-slate-200",
    };
    const activeColor = colorClasses[color] || colorClasses.blue;

    return (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between group hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{label}</p>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">{value}</h3>
                {subValue && <p className="text-xs font-medium text-slate-500 mt-1">{subValue}</p>}
            </div>
            <div className={`p-3 rounded-xl border ${activeColor} transition-transform duration-300 group-hover:scale-110`}>
                <Icon size={24} />
            </div>
        </div>
    );
};

export default function SummaryDashboard() {
    const projectContext = useProject();
    const stats = useMemo(() => calculateTEP(projectContext), [projectContext]);
    const chartData = useMemo(() => getChartData(projectContext), [projectContext]);

    // Проверка на пустоту данных
    const isEmpty = stats.totalAreaProj === 0 && stats.flatsCount === 0;

    if (isEmpty) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4 animate-in fade-in">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400"><Calculator size={40} /></div>
                <h3 className="text-xl font-bold text-slate-700">Нет данных для анализа</h3>
                <p className="text-slate-500 max-w-md">Заполните данные о зданиях, этажах и квартирах, чтобы увидеть сводную статистику и ТЭП.</p>
            </div>
        );
    }

    // Подготовка данных для BarChart (сравнение)
    const comparisonData = [
        {
            name: 'Площади',
            Проект: stats.totalAreaProj,
            Факт: stats.totalAreaFact || 0
        }
    ];

    return (
        <div className="max-w-full mx-auto pb-20 space-y-6 animate-in fade-in duration-500">
            
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-lg shadow-indigo-200"><TrendingUp size={24}/></div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Сводные показатели (ТЭП)</h1>
                    <p className="text-sm text-slate-500">Аналитика по всему жилому комплексу</p>
                </div>
            </div>

            {/* KPI Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <StatCard 
                    icon={Building2} 
                    label="Общая площадь (S)" 
                    value={stats.totalAreaProj.toLocaleString(undefined, {maximumFractionDigits: 0})} 
                    subValue={stats.totalAreaFact > 0 ? `Факт: ${stats.totalAreaFact.toLocaleString()} м²` : "Обмеры не завершены"}
                    color="blue"
                />
                <StatCard 
                    icon={Home} 
                    label="Жилой фонд" 
                    value={stats.livingAreaProj.toLocaleString(undefined, {maximumFractionDigits: 0})} 
                    subValue={`${stats.flatsCount} квартир`}
                    color="emerald"
                />
                <StatCard 
                    icon={Briefcase} 
                    label="Коммерция" 
                    value={stats.commercialArea.toLocaleString(undefined, {maximumFractionDigits: 0})} 
                    subValue={`${stats.officesCount} помещений`}
                    color="purple"
                />
                <StatCard 
                    icon={Car} 
                    label="Паркинг" 
                    value={stats.parkingCount} 
                    subValue="Машиномест"
                    color="slate"
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* Левая колонка: График распределения */}
                <div className="xl:col-span-2">
                    <Card className="p-6 shadow-sm h-full flex flex-col border-0 ring-1 ring-slate-200">
                        <div className="flex justify-between items-center mb-6">
                            <SectionTitle icon={PieIcon} className="mb-0">Структура площадей</SectionTitle>
                            <div className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                                К-полезн: {stats.totalAreaProj > 0 ? ((stats.livingAreaProj + stats.commercialArea) / stats.totalAreaProj).toFixed(2) : '0.00'}
                            </div>
                        </div>
                        
                        <div className="flex flex-col md:flex-row items-center gap-8 flex-1">
                            {/* PIE CHART */}
                            <div className="h-[300px] w-full md:w-1/2 relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={chartData.areaDistribution}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={80}
                                            outerRadius={110}
                                            paddingAngle={5}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {chartData.areaDistribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip content={<CustomTooltip />} />
                                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                    </PieChart>
                                </ResponsiveContainer>
                                {/* Центр бублика */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                                    <span className="text-xs text-slate-400 uppercase font-bold">Всего</span>
                                    <span className="text-2xl font-black text-slate-800">{stats.totalAreaProj.toLocaleString()}</span>
                                    <span className="text-xs text-slate-400">м²</span>
                                </div>
                            </div>

                            {/* Легенда и детали */}
                            <div className="w-full md:w-1/2 space-y-4">
                                {chartData.areaDistribution.map((item, idx) => (
                                    <div key={idx} className="group flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                                            <div>
                                                <div className="text-xs font-bold text-slate-500 uppercase">{item.name}</div>
                                                <div className="text-sm font-bold text-slate-800">{item.value.toLocaleString()} м²</div>
                                            </div>
                                        </div>
                                        <div className="text-xs font-mono text-slate-400">
                                            {stats.totalAreaProj > 0 ? ((item.value / stats.totalAreaProj) * 100).toFixed(1) : 0}%
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Правая колонка: Проект vs Факт + Статус */}
                <div className="space-y-6 flex flex-col">
                    <Card className={`p-6 shadow-sm border-l-4 ${Math.abs(parseFloat(String(stats.diffPercent))) > 3 ? 'border-l-red-500' : 'border-l-emerald-500'} flex-1`}>
                        <SectionTitle icon={BarChartIcon}>Проект vs Факт</SectionTitle>
                        
                        <div className="h-[200px] mt-4 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={comparisonData} layout="vertical" barSize={30}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0"/>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" hide />
                                    <RechartsTooltip cursor={{fill: '#f1f5f9'}} content={<CustomTooltip />} />
                                    <Legend />
                                    <Bar dataKey="Проект" fill="#94a3b8" radius={[0, 4, 4, 0]} />
                                    <Bar dataKey="Факт" fill={stats.diff > 0 ? "#ef4444" : "#10b981"} radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-100">
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-xs text-slate-500">Отклонение</span>
                                <span className={`text-lg font-bold ${stats.diff > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {stats.diff > 0 ? '+' : ''}{stats.diff.toLocaleString()} м²
                                </span>
                            </div>
                            <div className={`text-xs px-3 py-2 rounded-lg border ${Math.abs(parseFloat(String(stats.diffPercent))) > 3 ? 'bg-red-50 border-red-100 text-red-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
                                {Math.abs(parseFloat(String(stats.diffPercent))) > 3 ? <AlertTriangle size={14} className="inline mr-1"/> : <CheckCircle2 size={14} className="inline mr-1"/>}
                                Разница составляет <b>{stats.diffPercent}%</b> {Math.abs(parseFloat(String(stats.diffPercent))) > 3 ? '(Критично)' : '(В норме)'}
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6 shadow-sm bg-slate-900 text-white border-0">
                        <SectionTitle icon={CheckCircle2} className="text-white border-white/20">Готовность данных</SectionTitle>
                        <div className="mt-4 space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-400">Корпусов</span>
                                <span className="font-bold bg-white/10 px-2 py-0.5 rounded">{stats.buildingsCount}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-400">Всего этажей</span>
                                <span className="font-bold bg-white/10 px-2 py-0.5 rounded">{stats.floorsTotal}</span>
                            </div>
                            <div className="h-px bg-white/10 w-full my-2"></div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-400">Объектов недвижимости</span>
                                <span className="font-bold text-emerald-400 text-lg">{stats.flatsCount + stats.officesCount + stats.parkingCount}</span>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}