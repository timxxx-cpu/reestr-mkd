import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiService } from '../lib/api-service';
import { Plus, FolderOpen, Trash2, MapPin, Loader2, Building2 } from 'lucide-react';
import { Card, Button, Input } from './ui/UIKit'; 
import { useToast } from '../context/ToastContext';

export default function ProjectsPage({ onSelectProject }) {
    const queryClient = useQueryClient();
    const toast = useToast();
    const [isCreating, setIsCreating] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');

    // Чтение списка
    /** @type {Array<any>} */
    const emptyProjects = [];
    const { data: projects = emptyProjects, isLoading } = useQuery({
        queryKey: ['projects-list'],
        queryFn: ApiService.getProjectsList
    });
    const projectsList = Array.isArray(projects) ? projects : emptyProjects;

    // Создание
    const createMutation = useMutation({
        /**
         * @param {string} name
         */
        mutationFn: (name) => ApiService.createProject(name),
        onSuccess: (newProject) => {
            queryClient.invalidateQueries({ queryKey: ['projects-list'] });
            toast.success("Проект создан");
            setIsCreating(false);
            setNewProjectName('');
            // Можно сразу переходить в него
            if (onSelectProject && newProject && typeof newProject === 'object' && 'id' in newProject) {
                // @ts-ignore
                onSelectProject(newProject.id);
            }
        },
        onError: () => toast.error("Ошибка создания")
    });

    // Удаление
    const deleteMutation = useMutation({
        /**
         * @param {string} id
         */
        mutationFn: (id) => ApiService.deleteProject(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects-list'] });
            toast.success("Проект удален");
        }
    });

    const handleCreate = (e) => {
        e.preventDefault();
        if (!newProjectName.trim()) return;
        createMutation.mutate(newProjectName);
    };

    const handleDelete = (e, id) => {
        e.stopPropagation();
        if(confirm("Удалить проект и ВСЕ его данные? Это действие необратимо.")) {
            deleteMutation.mutate(id);
        }
    };

    if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600"/></div>;

    return (
        <div className="max-w-5xl mx-auto p-8 space-y-8 animate-in fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Мои проекты</h1>
                    <p className="text-slate-500 mt-1">Управление портфелем недвижимости</p>
                </div>
                <Button onClick={() => setIsCreating(true)} className="bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200">
                    <Plus size={18} className="mr-2"/> Новый проект
                </Button>
            </div>

            {isCreating && (
                <Card className="p-6 bg-blue-50 border-blue-100 animate-in slide-in-from-top-2">
                    <form onSubmit={handleCreate} className="flex gap-4 items-end">
                        <div className="flex-1 space-y-2">
                            <label className="text-xs font-bold uppercase text-blue-700">Название проекта</label>
                            <Input 
                                autoFocus
                                value={newProjectName}
                                onChange={e => setNewProjectName(e.target.value)}
                                placeholder="Например: ЖК 'Солнечный квартал'"
                                className="bg-white"
                            />
                        </div>
                        <Button type="submit" disabled={createMutation.isPending} className="bg-blue-600 text-white">
                            {createMutation.isPending ? <Loader2 className="animate-spin"/> : 'Создать'}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setIsCreating(false)}>Отмена</Button>
                    </form>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projectsList.length === 0 && !isCreating && (
                    <div className="col-span-full py-20 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                        <FolderOpen size={48} className="mx-auto mb-4 opacity-50"/>
                        <p>Список проектов пуст</p>
                    </div>
                )}

                {projectsList.map(project => (
                    <div 
                        key={project.id}
                        onClick={() => onSelectProject && onSelectProject(project.id)}
                        className="group relative bg-white border border-slate-200 rounded-2xl p-6 hover:border-blue-300 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-slate-50 rounded-xl text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                <Building2 size={24}/>
                            </div>
                            <div className="px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-slate-100 text-slate-500">
                                {project.status || 'Проект'}
                            </div>
                        </div>
                        
                        <h3 className="text-lg font-bold text-slate-800 mb-1 line-clamp-1">{project.name}</h3>
                        
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-6 h-5">
                            <MapPin size={12}/>
                            <span className="truncate">{project.address || 'Адрес не указан'}</span>
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                            <span className="text-[10px] text-slate-400">
                                Обновлено: {new Date(project.updated_at).toLocaleDateString()}
                            </span>
                            <button 
                                onClick={(e) => handleDelete(e, project.id)}
                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                title="Удалить проект"
                            >
                                <Trash2 size={16}/>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
