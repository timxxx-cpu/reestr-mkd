import React, { useState } from 'react';
import { Plus, Building2, Search, Calendar, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { Button } from './ui/UIKit'; // Убедитесь, что Button импортируется корректно

export default function ProjectsDashboard({ projects, onSelect, onCreate, onDelete }) {
    const [searchTerm, setSearchTerm] = useState('');

    // Фильтрация проектов
    const filteredProjects = projects.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-50">
            {/* --- ШАПКА --- */}
            <header className="bg-white border-b border-slate-200 px-8 py-6 sticky top-0 z-10 shadow-sm">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                            <Building2 size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800 leading-tight">
                                Реестр Жилых Комплексов
                            </h1>
                            <p className="text-xs text-slate-500 font-mono bg-slate-100 inline-block px-2 py-0.5 rounded mt-1 border border-slate-200">
                                ПРОТОТИП v1.0
                            </p>
                        </div>
                    </div>
                    
                    <Button onClick={onCreate} className="shadow-lg shadow-blue-200 hover:shadow-blue-300 transition-all">
                        <Plus size={18} />
                        Регистрация объекта
                    </Button>
                </div>
            </header>

            {/* --- КОНТЕНТ --- */}
            <main className="max-w-7xl mx-auto px-8 py-10">
                
                {/* Поиск */}
                <div className="flex items-center gap-4 mb-8">
                    <div className="relative flex-1 max-w-lg">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input 
                            type="text"
                            placeholder="Поиск объекта..."
                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="text-sm text-slate-500 font-medium">
                        Найдено объектов: <span className="text-slate-900">{filteredProjects.length}</span>
                    </div>
                </div>

                {/* Сетка карточек */}
                {filteredProjects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-slate-300 mb-4 shadow-sm">
                            <FileSpreadsheet size={32} />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900">Список пуст</h3>
                        <p className="text-slate-500 max-w-md mt-2 mb-6">
                            Нет объектов, соответствующих вашему запросу.
                        </p>
                        {projects.length === 0 && (
                            <Button variant="secondary" onClick={onCreate}>
                                Создать первый объект
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredProjects.map((project) => (
                            <div 
                                key={project.id}
                                onClick={() => onSelect(project.id)}
                                className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-blue-900/5 hover:border-blue-300 transition-all cursor-pointer relative overflow-hidden"
                            >
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                        <Building2 size={24} />
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
                                        className="text-slate-300 hover:text-red-500 p-1.5 rounded-md hover:bg-red-50 transition-colors z-10"
                                        title="Удалить"
                                    >
                                        &times;
                                    </button>
                                </div>

                                <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-blue-700 transition-colors line-clamp-1">
                                    {project.name}
                                </h3>
                                <p className="text-sm text-slate-500 mb-6">
                                    Жилой Комплекс
                                </p>

                                <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs text-slate-400">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar size={14} />
                                        <span>{new Date(project.lastModified).toLocaleDateString('ru-RU')}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-blue-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                                        Открыть <ChevronRight size={14} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}