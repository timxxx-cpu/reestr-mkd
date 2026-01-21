import React, { useRef } from 'react';
import { 
  Building2, Plus, Upload, FolderOpen, Trash2, ArrowRight, FileJson 
} from 'lucide-react';
import { Card, Button, SectionTitle } from './ui/UIKit';

export default function ProjectsDashboard({ projects, onCreate, onOpen, onDelete, onImport }) {
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        onImport(file);
        e.target.value = '';
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8 font-sans text-slate-900 animate-in fade-in duration-500">
            <div className="max-w-7xl mx-auto">
                {/* Заголовок и кнопки */}
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Реестр МКД</h1>
                        <p className="text-slate-500 mt-2 text-sm">Управление проектами жилых комплексов</p>
                    </div>
                    <div className="flex gap-3">
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileChange} 
                            className="hidden" 
                            accept=".json" 
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()} 
                            className="px-5 py-2.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm shadow-sm flex items-center gap-2 transition-all active:scale-95"
                        >
                            <Upload size={18} /> Импорт
                        </button>
                        <button 
                            onClick={onCreate} 
                            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm shadow-lg shadow-slate-200 flex items-center gap-2 transition-all active:scale-95"
                        >
                            <Plus size={18} /> Новый проект
                        </button>
                    </div>
                </div>

                {/* Таблица проектов */}
                <Card className="border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                <th className="p-5 text-xs font-bold text-slate-400 uppercase tracking-wider w-16 text-center">#</th>
                                <th className="p-5 text-xs font-bold text-slate-400 uppercase tracking-wider">Название объекта</th>
                                <th className="p-5 text-xs font-bold text-slate-400 uppercase tracking-wider w-40">Статус</th>
                                <th className="p-5 text-xs font-bold text-slate-400 uppercase tracking-wider w-48">Обновлено</th>
                                <th className="p-5 text-xs font-bold text-slate-400 uppercase tracking-wider w-32 text-right">Действия</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {projects.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-12 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                                                <FolderOpen size={32} />
                                            </div>
                                            <p className="text-slate-500 font-medium">Список проектов пуст</p>
                                            <p className="text-slate-400 text-xs mt-1 mb-4">Создайте новый проект или импортируйте существующий</p>
                                            <Button onClick={onCreate}>Создать проект</Button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                projects.map((project, idx) => (
                                    <tr 
                                        key={project.id} 
                                        onClick={() => onOpen(project.id)} 
                                        className="group hover:bg-slate-50 transition-colors cursor-pointer"
                                    >
                                        <td className="p-5 text-xs font-bold text-slate-400 text-center">{idx + 1}</td>
                                        <td className="p-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 font-bold">
                                                    <Building2 size={18} />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-sm text-slate-800 group-hover:text-blue-600 transition-colors">
                                                        {project.name}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                                                        ID: {project.id}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border ${ 
                                                project.status === 'Проектный' ? 'bg-slate-100 text-slate-500 border-slate-200' : 
                                                project.status === 'Строящийся' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                                                'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                            }`}>
                                                {project.status}
                                            </span>
                                        </td>
                                        <td className="p-5 text-xs font-medium text-slate-500">
                                            {new Date(project.lastModified).toLocaleDateString()}
                                        </td>
                                        <td className="p-5 text-right">
                                            <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                                                <button 
                                                    onClick={() => onOpen(project.id)} 
                                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-200" 
                                                    title="Открыть"
                                                >
                                                    <ArrowRight size={16} />
                                                </button>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); onDelete(project.id); }} 
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-200" 
                                                    title="Удалить"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </Card>
            </div>
        </div>
    );
}