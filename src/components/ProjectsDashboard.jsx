import React, { useState, useMemo } from 'react';
import { 
  Plus, Building2, Search, ChevronRight, 
  LayoutGrid, List as ListIcon, MapPin, HardHat, FileText, 
  Archive, Trash2, Lock, User
} from 'lucide-react';
import { getStageColor } from '../lib/utils'; 

export default function ProjectsDashboard({ projects = [], onSelect, _onCreate, onDelete }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState('grid');
    const [statusFilter, setStatusFilter] = useState('all');

    const demoProjects = useMemo(() => [
        { id: 'demo_1', isDemo: true, name: 'ЖК "Солнечная Долина"', status: 'Строящийся', address: 'ул. Ленина, 45', lastModified: '2023-10-15', author: 'Система' },
        { id: 'demo_2', isDemo: true, name: 'Квартал "Новая Эра"', status: 'Проектный', address: 'пр. Мира, уч. 12', lastModified: '2023-11-02', author: 'Менеджер' },
        { id: 'demo_3', isDemo: true, name: 'ЖК "Акварель"', status: 'Введенный', address: 'Набережная реки, 8', lastModified: '2023-09-20', author: 'Админ' },
        { id: 'demo_4', isDemo: true, name: 'Резиденция "Монарх"', status: 'Строящийся', address: 'Исторический центр, 1', lastModified: '2023-10-28', author: 'Архитектор' },
        { id: 'demo_5', isDemo: true, name: 'МФК "Технопарк"', status: 'Проектный', address: 'Индустриальная зона, 5', lastModified: '2023-11-05', author: 'Система' },
        { id: 'demo_6', isDemo: true, name: 'ЖК "Зеленый квартал"', status: 'Архив', address: 'Пригородное шоссе, 10 км', lastModified: '2022-12-10', author: 'Архив' },
        { id: 'demo_7', isDemo: true, name: 'ЖК "Олимпия"', status: 'Строящийся', address: 'ул. Спортивная, 88', lastModified: '2023-10-01', author: 'Менеджер' },
        { id: 'demo_8', isDemo: true, name: 'Дом на Набережной', status: 'Введенный', address: 'ул. Береговая, 3', lastModified: '2023-08-15', author: 'Система' },
        { id: 'demo_9', isDemo: true, name: 'ЖК "Панорама Сити"', status: 'Проектный', address: 'Высотный проезд, 21', lastModified: '2023-11-07', author: 'Архитектор' },
        { id: 'demo_10', isDemo: true, name: 'ЖК "Центральный"', status: 'Строящийся', address: 'Площадь Победы, 1', lastModified: '2023-10-30', author: 'Система' },
    ], []);

    const allProjects = useMemo(() => [...projects, ...demoProjects], [projects, demoProjects]);

    const stats = useMemo(() => {
        return {
            total: allProjects.length,
            inProgress: allProjects.filter(p => p.status === 'Строящийся').length,
            design: allProjects.filter(p => p.status === 'Проектный').length,
            done: allProjects.filter(p => ['Введенный', 'Архив'].includes(p.status)).length
        };
    }, [allProjects]);

    const filteredProjects = allProjects.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || 
                              (statusFilter === 'active' && ['Проектный', 'Строящийся'].includes(p.status)) ||
                              (statusFilter === 'archive' && ['Введенный', 'Архив'].includes(p.status));
        return matchesSearch && matchesStatus;
    });

    const handleProjectClick = (project) => {
        if (project.isDemo) {
            alert("Это демо-проект только для визуализации.");
            return;
        }
        onSelect(project.id);
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
            <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8">
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MetricCard label="Всего объектов" value={stats.total} icon={Building2} color="text-slate-600" />
                    <MetricCard label="В проектировании" value={stats.design} icon={FileText} color="text-purple-600" />
                    <MetricCard label="В стройке" value={stats.inProgress} icon={HardHat} color="text-blue-600" />
                    <MetricCard label="Введены / Архив" value={stats.done} icon={Archive} color="text-emerald-600" />
                </div>

                <div className="flex flex-col md:flex-row gap-4 justify-between items-end md:items-center">
                    <div className="flex p-1 bg-white border border-slate-200 rounded-xl shadow-sm">
                        <FilterTab label="Все проекты" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
                        <FilterTab label="В работе" active={statusFilter === 'active'} onClick={() => setStatusFilter('active')} />
                        <FilterTab label="Архив" active={statusFilter === 'archive'} onClick={() => setStatusFilter('archive')} />
                    </div>

                    <div className="flex gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64 group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                            <input 
                                type="text"
                                placeholder="Поиск по названию..."
                                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-slate-100 text-slate-900 shadow-inner' : 'text-slate-400 hover:text-slate-600'}`}>
                                <LayoutGrid size={18} />
                            </button>
                            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-slate-100 text-slate-900 shadow-inner' : 'text-slate-400 hover:text-slate-600'}`}>
                                <ListIcon size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                {filteredProjects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-slate-300 mb-4 shadow-sm">
                            <Search size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Объекты не найдены</h3>
                        <p className="text-slate-500 text-sm mt-1">Попробуйте изменить параметры поиска</p>
                    </div>
                ) : (
                    <>
                        {viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {filteredProjects.map((project) => (
                                    <div 
                                        key={project.id}
                                        onClick={() => handleProjectClick(project)}
                                        className={`group bg-white rounded-2xl p-6 border border-slate-200 shadow-sm transition-all relative overflow-hidden
                                            ${project.isDemo ? 'cursor-default opacity-90' : 'hover:shadow-xl hover:shadow-blue-900/5 hover:border-blue-300 cursor-pointer hover:-translate-y-1'}
                                        `}
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider border ${getStageColor(project.status)}`}>
                                                {project.status}
                                            </span>
                                            {!project.isDemo ? (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
                                                    className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            ) : (
                                                <span title="Демонстрационный режим">
                                                    <Lock size={14} className="text-slate-300" />
                                                </span>
                                            )}
                                        </div>

                                        <div className="mb-4">
                                            <h3 className={`text-lg font-bold text-slate-800 mb-1 transition-colors line-clamp-1 ${!project.isDemo && 'group-hover:text-blue-600'}`}>
                                                {project.name}
                                            </h3>
                                            <div className="flex items-center gap-1 text-xs text-slate-400 mt-2">
                                                <MapPin size={12} />
                                                <span className="truncate">{project.address || 'Адрес не указан'}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 mb-4 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                            <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                                                <User size={12} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] text-slate-400 uppercase font-bold leading-none">Автор</span>
                                                <span className="text-xs font-semibold text-slate-700 leading-none mt-0.5">{project.author || 'Неизвестен'}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs">
                                            <div className="text-slate-400 font-medium">
                                                <span className="block text-[9px] uppercase tracking-wider mb-0.5 opacity-70">Обновлено</span>
                                                {new Date(project.lastModified).toLocaleDateString('ru-RU')}
                                            </div>
                                            {!project.isDemo && (
                                                <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                                    <ChevronRight size={16} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm animate-in fade-in duration-500">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-bold text-slate-500">
                                        <tr>
                                            <th className="px-6 py-4">Название объекта</th>
                                            <th className="px-6 py-4">Автор</th>
                                            <th className="px-6 py-4">Статус</th>
                                            <th className="px-6 py-4">Адрес</th>
                                            <th className="px-6 py-4 text-right">Обновлено</th>
                                            <th className="px-6 py-4 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredProjects.map((project) => (
                                            <tr 
                                                key={project.id} 
                                                onClick={() => handleProjectClick(project)}
                                                className={`transition-colors group ${project.isDemo ? 'bg-slate-50/30' : 'hover:bg-blue-50/30 cursor-pointer'}`}
                                            >
                                                <td className={`px-6 py-4 font-bold text-slate-800 ${!project.isDemo && 'group-hover:text-blue-600'}`}>
                                                    {project.name}
                                                    {project.isDemo && <span className="ml-2 text-[9px] text-slate-400 font-normal uppercase border px-1 rounded">Демо</span>}
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    <div className="flex items-center gap-2">
                                                        <User size={12} className="text-slate-400"/>
                                                        {project.author || '—'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wide border ${getStageColor(project.status)}`}>
                                                        {project.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-slate-500">
                                                    {project.address || '—'}
                                                </td>
                                                <td className="px-6 py-4 text-right text-slate-400 font-mono text-xs">
                                                    {new Date(project.lastModified).toLocaleDateString('ru-RU')}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {!project.isDemo && (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
                                                            className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Trash2 size={16}/>
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}

function MetricCard({ label, value, icon: _Icon, color }) {
    return (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-28 relative overflow-hidden group hover:border-blue-300 transition-colors">
            <div className={`absolute top-0 right-0 p-4 opacity-10 ${color} transform scale-150 group-hover:scale-125 transition-transform`}>
                <_Icon size={64} />
            </div>
            <div className={`text-slate-400 mb-2 ${color}`}>
                <_Icon size={24} />
            </div>
            <div>
                <div className="text-2xl font-bold text-slate-800">{value}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</div>
            </div>
        </div>
    );
}

function FilterTab({ label, active, onClick }) {
    return (
        <button 
            onClick={onClick}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                active 
                    ? 'bg-slate-900 text-white shadow-md' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
        >
            {label}
        </button>
    );
}