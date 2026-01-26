import React, { useMemo } from 'react';
import { 
  Building2, Home, Briefcase, 
  Car, Layers, TrendingUp, AlertTriangle, ArrowRight,
  Calculator, CheckCircle2
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, SectionTitle } from '../ui/UIKit';
import { calculateTEP, getChartData } from '../../lib/calculations';

// Простые компоненты визуализации (без тяжелых библиотек)
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
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between group hover:shadow-md transition-all">
            <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{label}</p>
                <h3 className="text-2xl font-black text-slate-800">{value}</h3>
                {subValue && <p className="text-xs font-medium text-slate-500 mt-1">{subValue}</p>}
            </div>
            <div className={`p-3 rounded-xl border ${activeColor} group-hover:scale-110 transition-transform`}>
                <Icon size={24} />
            </div>
        </div>
    );
};

const ProgressBar = ({ label, value, max, color = "bg-blue-500" }) => {
    const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-600">{label}</span>
                <span className="text-slate-900 font-bold">{value.toLocaleString()} м²</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color} transition-all duration-1000`} style={{ width: `${percent}%` }}></div>
            </div>
        </div>
    );
};

export default function SummaryDashboard() {
    const projectContext = useProject();
    const stats = useMemo(() => calculateTEP(projectContext), [projectContext]);
    // const chartData = useMemo(() => getChartData(projectContext), [projectContext]); // Пока не используется в UI

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

    return (
        <div className="max-w-7xl mx-auto pb-20 space-y-6 animate-in fade-in duration-500">
            
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-slate-900 text-white rounded-lg"><TrendingUp size={20}/></div>
                <h1 className="text-2xl font-bold text-slate-800">Сводные показатели (ТЭП)</h1>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    icon={Building2} 
                    label="Общая площадь (S)" 
                    value={stats.totalAreaProj.toLocaleString(undefined, {maximumFractionDigits: 0})} 
                    subValue={stats.totalAreaFact > 0 ? `Факт: ${stats.totalAreaFact.toLocaleString()} м²` : "Факт не заполнен"}
                    color="blue"
                />
                <StatCard 
                    icon={Home} 
                    label="Жилая площадь" 
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Левая колонка: Детализация площадей */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="p-6 shadow-sm h-full">
                        <SectionTitle icon={Layers}>Структура площадей</SectionTitle>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                            {/* График распределения (Визуальный бар) */}
                            <div className="bg-slate-50 rounded-2xl p-6 flex flex-col justify-center items-center">
                                <div className="w-48 h-48 rounded-full border-[16px] border-slate-200 relative flex items-center justify-center">
                                    <div className="text-center">
                                        <div className="text-xs font-bold text-slate-400 uppercase">Всего</div>
                                        <div className="text-xl font-black text-slate-800">{stats.totalAreaProj.toLocaleString()}</div>
                                        <div className="text-[10px] text-slate-400">м²</div>
                                    </div>
                                    {/* SVG Ring Segment (Упрощенная имитация) */}
                                    <svg className="absolute inset-0 -m-4 w-[calc(100%+32px)] h-[calc(100%+32px)] -rotate-90 pointer-events-none">
                                        <circle r="96" cx="50%" cy="50%" fill="transparent" stroke="#3b82f6" strokeWidth="16" strokeDasharray={`${(stats.livingAreaProj/stats.totalAreaProj)*600} 600`} className="opacity-80"/>
                                    </svg>
                                </div>
                                <div className="flex gap-4 mt-6">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600"><div className="w-3 h-3 rounded-full bg-blue-500"></div>Жилая</div>
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600"><div className="w-3 h-3 rounded-full bg-slate-200"></div>Прочее</div>
                                </div>
                            </div>

                            {/* Список прогресс-баров */}
                            <div className="space-y-6 flex flex-col justify-center">
                                <ProgressBar label="Жилые помещения" value={stats.livingAreaProj} max={stats.totalAreaProj} color="bg-blue-500" />
                                <ProgressBar label="Коммерческие площади" value={stats.commercialArea} max={stats.totalAreaProj} color="bg-emerald-500" />
                                <ProgressBar label="Места общего пользования (МОП)" value={stats.mopArea} max={stats.totalAreaProj} color="bg-slate-400" />
                                
                                <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-500">Коэфф. полезной площади (K)</span>
                                    <span className="text-lg font-black text-slate-800">
                                        {stats.totalAreaProj > 0 
                                            ? ((stats.livingAreaProj + stats.commercialArea) / stats.totalAreaProj).toFixed(2) 
                                            : '0.00'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Правая колонка: Проект vs Факт */}
                <div className="space-y-6">
                    <Card className="p-6 shadow-sm border-l-4 border-l-amber-400">
                        <SectionTitle icon={AlertTriangle}>Анализ расхождений</SectionTitle>
                        <div className="mt-4 space-y-4">
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-xs text-slate-400 mb-1">Проектная площадь</p>
                                    <p className="text-lg font-bold text-slate-700">{stats.totalAreaProj.toLocaleString()} м²</p>
                                </div>
                                <ArrowRight size={20} className="text-slate-300 mb-1.5"/>
                                <div className="text-right">
                                    <p className="text-xs text-slate-400 mb-1">Фактическая площадь</p>
                                    <p className={`text-lg font-bold ${stats.diff > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                        {stats.totalAreaFact > 0 ? stats.totalAreaFact.toLocaleString() : "—"} м²
                                    </p>
                                </div>
                            </div>

                            {stats.totalAreaFact > 0 && (
                                <div className={`p-3 rounded-xl border flex items-center gap-3 ${Math.abs(parseFloat(String(stats.diffPercent))) > 3 ? 'bg-red-50 border-red-100 text-red-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
                                    <AlertTriangle size={18}/>
                                    <div>
                                        <p className="text-xs font-bold uppercase opacity-70">Отклонение</p>
                                        <p className="font-bold text-sm">
                                            {stats.diff > 0 ? '+' : ''}{stats.diff.toFixed(2)} м² ({stats.diffPercent}%)
                                        </p>
                                    </div>
                                </div>
                            )}
                            
                            <p className="text-[10px] text-slate-400 italic leading-tight">
                                * Расхождение более 3% считается критическим и требует согласования с ГАП.
                            </p>
                        </div>
                    </Card>

                    <Card className="p-6 shadow-sm bg-slate-900 text-white border-0">
                        <SectionTitle icon={CheckCircle2} className="text-white border-white/20">Готовность данных</SectionTitle>
                        <div className="mt-4 space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-400">Корпусов</span>
                                <span className="font-bold">{stats.buildingsCount}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-400">Всего этажей</span>
                                <span className="font-bold">{stats.floorsTotal}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-400">Объектов недвижимости</span>
                                <span className="font-bold">{stats.flatsCount + stats.officesCount + stats.parkingCount}</span>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}