import React, { useState, useEffect, useMemo } from 'react';
import { 
  Inbox, Briefcase, Search, Filter, RefreshCw, 
  MapPin, Calendar, ArrowRight, Building, User,
  FileText, CheckCircle2, Clock, AlertCircle, Hash, Zap, Database, Trash2, Lock, 
  ListTodo, ShieldCheck
} from 'lucide-react';
import { RegistryService } from '../lib/registry-service';
import { ROLES, APP_STATUS, EXTERNAL_SYSTEMS, APP_STATUS_LABELS } from '../lib/constants';
import { Button, Input, Badge, Card, SectionTitle } from './ui/UIKit';
import { useToast } from '../context/ToastContext';
import { getStageColor } from '../lib/utils';

export default function ApplicationsDashboard({ user, projects, dbScope, onSelectProject }) {
    const [activeTab, setActiveTab] = useState('my_tasks'); 
    const [taskFilter, setTaskFilter] = useState('work'); // 'work' | 'review'
    
    const [incomingApps, setIncomingApps] = useState([]);
    const [isLoadingApps, setIsLoadingApps] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    const toast = useToast();

    // 1. Авто-выбор подвкладки
    useEffect(() => {
        if (user.role === ROLES.CONTROLLER) {
            setTaskFilter('review');
        } else {
            setTaskFilter('work');
        }
    }, [user.role]);

    // Загрузка входящих
    useEffect(() => {
        if (activeTab === 'inbox' && (user.role === ROLES.TECHNICIAN || user.role === ROLES.ADMIN)) {
            loadInbox();
        }
    }, [activeTab, user.role]);

    const loadInbox = async () => {
        setIsLoadingApps(true);
        try {
            const data = await RegistryService.getExternalApplications();
            setIncomingApps(data);
        } catch (e) {
            console.error(e);
            toast.error("Ошибка подключения к внешним системам");
        } finally {
            setIsLoadingApps(false);
        }
    };

    const handleEmulateIncoming = () => {
        setIsLoadingApps(true);
        setTimeout(() => {
            const randomId = Math.floor(1000 + Math.random() * 9000);
            const sources = Object.values(EXTERNAL_SYSTEMS);
            const randomSource = sources[Math.floor(Math.random() * sources.length)];
            
            const newApp = {
                id: `APP-${Date.now()}`,
                externalId: `${randomSource.id}-${randomId}`,
                source: randomSource.id,
                applicant: `ООО "Входящий-${Math.floor(Math.random() * 100)}"`,
                submissionDate: new Date().toISOString(),
                cadastre: `11:05:04:02:${Math.floor(10000 + Math.random() * 90000)}`,
                address: `г. Ташкент, Входящий р-н, кв-л ${Math.floor(Math.random() * 20)}`,
                status: APP_STATUS.NEW
            };

            setIncomingApps(prev => [newApp, ...prev]);
            setIsLoadingApps(false);
            toast.success("Получена новая заявка");
        }, 400);
    };

    const handleTakeToWork = async (app) => {
        const toastId = toast.loading("Принятие в работу...");
        try {
            await RegistryService.createProjectFromApplication(dbScope, app, user);
            setIncomingApps(prev => prev.filter(a => a.id !== app.id));
            toast.dismiss(toastId);
            toast.success("Перемещено в 'Мои задачи'");
            setActiveTab('my_tasks');
            setTaskFilter('work'); 
        } catch (e) {
            console.error(e);
            toast.dismiss(toastId);
            toast.error("Ошибка при создании проекта");
        }
    };

    // Удаление ВХОДЯЩЕЙ заявки (еще не проекта)
    const handleDeleteApplication = (appId) => {
        if (!window.confirm('Вы уверены, что хотите удалить эту входящую заявку?')) return;
        
        // Так как это локальный стейт (или мок), удаляем локально
        setIncomingApps(prev => prev.filter(a => a.id !== appId));
        toast.success("Заявка удалена из списка");
    };

    // Удаление ПРОЕКТА (из реестра)
    const handleDeleteProject = async (projectId) => {
        if (!window.confirm('Вы уверены, что хотите безвозвратно удалить этот проект и все данные?')) return;
        const toastId = toast.loading("Удаление...");
        try {
            await RegistryService.deleteProject(dbScope, projectId);
            toast.dismiss(toastId);
            toast.success("Удалено");
        } catch (e) {
            toast.dismiss(toastId);
            toast.error("Ошибка удаления");
        }
    };

    // --- ФИЛЬТРЫ ---

    // 1. ЛОГИКА "МОИ ЗАДАЧИ"
    const myTasks = useMemo(() => {
        let filtered = projects;

        if (taskFilter === 'work') {
            // В РАБОТЕ: New, Draft, Rejected (видят все техники и админы)
            filtered = filtered.filter(p => [APP_STATUS.NEW, APP_STATUS.DRAFT, APP_STATUS.REJECTED].includes(p.applicationInfo?.status));
        } else {
            // НА ПРОВЕРКЕ: Review
            filtered = filtered.filter(p => p.applicationInfo?.status === APP_STATUS.REVIEW);
        }

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            filtered = filtered.filter(p => 
                p.name.toLowerCase().includes(lower) ||
                p.applicationInfo?.internalNumber?.toLowerCase().includes(lower) ||
                p.applicationInfo?.applicant?.toLowerCase().includes(lower)
            );
        }

        return filtered.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
    }, [projects, user, searchTerm, taskFilter]);

    // Подсчет количества
    const counts = useMemo(() => {
        const workCount = projects.filter(p => 
            [APP_STATUS.NEW, APP_STATUS.DRAFT, APP_STATUS.REJECTED].includes(p.applicationInfo?.status)
        ).length;

        const reviewCount = projects.filter(p => 
            p.applicationInfo?.status === APP_STATUS.REVIEW
        ).length;
        
        return { work: workCount, review: reviewCount };
    }, [projects]);

    // 2. Все проекты (Реестр)
    const allProjects = useMemo(() => {
        let filtered = projects;
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            filtered = filtered.filter(p => p.name.toLowerCase().includes(lower));
        }
        return filtered.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
    }, [projects, searchTerm]);

    const canViewInbox = user.role === ROLES.TECHNICIAN || user.role === ROLES.ADMIN;
    const canSeeWorkTab = user.role === ROLES.TECHNICIAN || user.role === ROLES.ADMIN;
    const canSeeReviewTab = user.role === ROLES.CONTROLLER || user.role === ROLES.ADMIN;

    return (
        <div className="max-w-[1600px] mx-auto px-6 py-8 animate-in fade-in duration-500">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Рабочий стол</h1>
                    <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                        <User size={14}/>
                        <span>{user.name}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300 mx-1"></span>
                        <span className="font-medium bg-slate-100 px-2 py-0.5 rounded text-slate-600 text-xs uppercase">
                            {user.role === ROLES.TECHNICIAN ? 'Техник' : user.role === ROLES.CONTROLLER ? 'Бригадир' : 'Админ'}
                        </span>
                    </div>
                </div>

                <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200 overflow-x-auto">
                    <button 
                        onClick={() => setActiveTab('my_tasks')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'my_tasks' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-600'}`}
                    >
                        <Briefcase size={16}/> Мои задачи 
                        <Badge className="ml-1 bg-slate-200 text-slate-600 border-transparent">
                           {user.role === ROLES.CONTROLLER ? counts.review : counts.work}
                        </Badge>
                    </button>
                    
                    <button 
                        onClick={() => setActiveTab('registry')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'registry' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-600'}`}
                    >
                        <Database size={16}/> Реестр проектов
                        <Badge className="ml-1 bg-slate-200 text-slate-600 border-transparent">{allProjects.length}</Badge>
                    </button>

                    {canViewInbox && (
                        <button 
                            onClick={() => setActiveTab('inbox')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'inbox' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-600'}`}
                        >
                            <Inbox size={16}/> Входящие
                            {incomingApps.length > 0 && <Badge className="ml-1 bg-blue-500 text-white border-blue-600">{incomingApps.length}</Badge>}
                        </button>
                    )}
                </div>
            </div>

            {/* Content: ВХОДЯЩИЕ */}
            {activeTab === 'inbox' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Inbox size={20}/></div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm">Входящие заявления</h3>
                                <p className="text-xs text-slate-500">Заявки из внешних систем (ЕПИГУ, ДХМ)</p>
                            </div>
                        </div>
                        <Button onClick={handleEmulateIncoming} disabled={isLoadingApps} className="bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 text-xs h-9">
                            <Zap size={14} className={isLoadingApps ? 'animate-pulse' : ''}/> Эмулировать входящую
                        </Button>
                    </div>

                    <Card className="overflow-hidden shadow-md border-0 ring-1 ring-slate-200">
                        {incomingApps.length === 0 ? (
                            <div className="py-20 text-center">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                    <Inbox size={32}/>
                                </div>
                                <h3 className="text-slate-500 font-medium">Список пуст</h3>
                                <p className="text-xs text-slate-400 mt-1">Нажмите "Эмулировать...", чтобы получить данные</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        <tr>
                                            <th className="px-6 py-4">Источник</th>
                                            <th className="px-6 py-4">ID</th>
                                            <th className="px-6 py-4">Дата</th>
                                            <th className="px-6 py-4">Заявитель / Адрес</th>
                                            <th className="px-6 py-4 text-right">Действие</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {incomingApps.map(app => (
                                            <tr key={app.id} className="hover:bg-blue-50/30 transition-colors">
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 rounded text-[10px] font-bold border">{app.source}</span>
                                                </td>
                                                <td className="px-6 py-4 font-mono text-xs font-bold">{app.externalId}</td>
                                                <td className="px-6 py-4 text-xs text-slate-500">{new Date(app.submissionDate).toLocaleDateString()}</td>
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-800">{app.applicant}</div>
                                                    <div className="text-xs text-slate-500 truncate max-w-xs">{app.address}</div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button 
                                                            onClick={() => handleDeleteApplication(app.id)}
                                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Удалить заявку"
                                                        >
                                                            <Trash2 size={16}/>
                                                        </button>
                                                        <Button onClick={() => handleTakeToWork(app)} className="h-8 text-xs px-3 py-1 shadow-sm">
                                                            В работу <ArrowRight size={12} className="ml-1"/>
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                </div>
            )}

            {/* Content: МОИ ЗАДАЧИ */}
            {activeTab === 'my_tasks' && (
                <div className="space-y-6 animate-in slide-in-from-left-4 duration-300">
                    
                    <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center">
                        <div className="flex items-center gap-4">
                            <SectionTitle icon={Briefcase} className="mb-0">Текущие задачи</SectionTitle>
                            
                            {/* КНОПКИ ПЕРЕКЛЮЧЕНИЯ СТАТУСОВ (ФИЛЬТРЫ) */}
                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                {canSeeWorkTab && (
                                    <button
                                        onClick={() => setTaskFilter('work')}
                                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${taskFilter === 'work' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <ListTodo size={14}/>
                                        В работе
                                        <Badge className={`ml-1 ${taskFilter === 'work' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'} border-transparent`}>
                                            {counts.work}
                                        </Badge>
                                    </button>
                                )}
                                {canSeeReviewTab && (
                                    <button
                                        onClick={() => setTaskFilter('review')}
                                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${taskFilter === 'review' ? 'bg-white shadow text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <ShieldCheck size={14}/>
                                        На проверке
                                        <Badge className={`ml-1 ${taskFilter === 'review' ? 'bg-orange-100 text-orange-700' : 'bg-slate-200 text-slate-500'} border-transparent`}>
                                            {counts.review}
                                        </Badge>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <Input 
                                    placeholder="Поиск..." 
                                    className="pl-9 h-10 text-sm"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <Card className="overflow-hidden shadow-md border-0 ring-1 ring-slate-200">
                        {myTasks.length === 0 ? (
                            <div className="py-20 text-center">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                    {taskFilter === 'work' ? <ListTodo size={32}/> : <ShieldCheck size={32}/>}
                                </div>
                                <h3 className="text-slate-500 font-medium">
                                    {taskFilter === 'work' ? 'Нет активных задач в работе' : 'Нет проектов на проверке'}
                                </h3>
                            </div>
                        ) : (
                            <ProjectsTable 
                                projects={myTasks} 
                                onSelectProject={onSelectProject}
                                onDeleteProject={undefined}
                            />
                        )}
                    </Card>
                </div>
            )}

            {/* Content: РЕЕСТР */}
            {activeTab === 'registry' && (
                <div className="space-y-6 animate-in slide-in-from-left-4 duration-300">
                    <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center">
                        <SectionTitle icon={Database}>Общий реестр проектов</SectionTitle>
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <Input 
                                placeholder="Глобальный поиск..." 
                                className="pl-9 h-10 text-sm"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <Card className="overflow-hidden shadow-md border-0 ring-1 ring-slate-200">
                        {allProjects.length === 0 ? (
                            <div className="py-20 text-center">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                    <Database size={32}/>
                                </div>
                                <h3 className="text-slate-500 font-medium">Реестр пуст</h3>
                            </div>
                        ) : (
                            <ProjectsTable 
                                projects={allProjects} 
                                onSelectProject={onSelectProject} 
                                onDeleteProject={user.role === ROLES.ADMIN ? handleDeleteProject : undefined}
                            />
                        )}
                    </Card>
                </div>
            )}
        </div>
    );
}

const ProjectsTable = ({ projects, onSelectProject, onDeleteProject = undefined }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                    <th className="px-6 py-4 w-32">Статус</th>
                    <th className="px-6 py-4 w-32">Вн. Номер</th>
                    <th className="px-6 py-4">Объект / Адрес</th>
                    <th className="px-6 py-4">Заявитель</th>
                    <th className="px-6 py-4 w-40">Обновлено</th>
                    <th className="px-6 py-4 w-48">Исполнитель</th>
                    <th className="px-6 py-4 w-20"></th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
                {projects.map(project => {
                    const appInfo = project.applicationInfo || {};
                    const statusConfig = APP_STATUS_LABELS[appInfo.status] || { label: project.status, color: getStageColor(project.status) };
                    
                    // Блокировку сняли полностью, теперь если передана функция удаления (в Реестре), удалять можно все
                    const canDelete = !!onDeleteProject;

                    return (
                        <tr 
                            key={project.id} 
                            onClick={() => onSelectProject(project.id)}
                            className="hover:bg-indigo-50/30 cursor-pointer transition-colors group"
                        >
                            <td className="px-6 py-4">
                                <div className="flex flex-col gap-1 items-start">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${statusConfig.color}`}>
                                        {statusConfig.label}
                                    </span>
                                    {appInfo.currentStage && (
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide px-1">
                                            Этап {appInfo.currentStage}
                                        </span>
                                    )}
                                </div>
                            </td>
                            <td className="px-6 py-4 font-mono text-xs text-slate-500">
                                {appInfo.internalNumber || '—'}
                            </td>
                            <td className="px-6 py-4">
                                <div className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{project.name}</div>
                                <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                                    <MapPin size={12}/>
                                    <span className="truncate max-w-xs">{project.complexInfo?.street || 'Адрес не указан'}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-xs font-medium text-slate-600">
                                {appInfo.applicant || '—'}
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-500">
                                <div className="flex items-center gap-1">
                                    <Clock size={12}/>
                                    {new Date(project.lastModified).toLocaleDateString('ru-RU')}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                {appInfo.assigneeName ? (
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-full w-max border border-slate-200">
                                        <User size={12}/> {appInfo.assigneeName}
                                    </div>
                                ) : <span className="text-slate-300 text-xs">—</span>}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    {canDelete && (
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteProject(project.id);
                                            }}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors z-10 relative"
                                            title="Удалить проект"
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                    )}
                                    <ArrowRight size={16} className={`text-indigo-400 transition-opacity ${canDelete ? 'hidden group-hover:block' : 'opacity-0 group-hover:opacity-100'}`}/>
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    </div>
);