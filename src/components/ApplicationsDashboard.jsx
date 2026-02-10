import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Inbox,
  Briefcase,
  Search,
  ListTodo,
  ShieldCheck,
  HardHat,
  Archive,
  Eye,
  PlayCircle,
  MapPin,
  AlertCircle,
  Database,
  Zap,
  Trash2,
  ArrowRight,
  Layers,
  LogOut,
  Globe,
  CheckCircle2,
  Server,
  Ban,
  UserCheck,
  Clock,
} from 'lucide-react';
import {
  ROLES,
  APP_STATUS,
  APP_STATUS_LABELS,
  SUBSTATUS_LABELS,
  WORKFLOW_SUBSTATUS,
  STEPS_CONFIG,
} from '@lib/constants';
import {
  canTakeInboxApplication,
  canDeclineFromDashboard,
  canAssignTechnician,
} from '@lib/workflow-state-machine';
import { useCatalog } from '@hooks/useCatalogs';
import {
  Button,
  Input,
  Badge,
  Card,
  SectionTitle,
  TableSkeleton,
  Tooltip,
} from '@components/ui/UIKit';
import { IdentifierBadge } from '@components/ui/IdentifierBadge';
import { useToast } from '@context/ToastContext';
import { getStageColor } from '@lib/utils';
import { ApiService } from '@lib/api-service'; // CHANGED
import { createVirtualComplexCadastre } from '@lib/cadastre';

// --- ХЕЛПЕР: ФОРМАТИРОВАНИЕ ДАТЫ ---
const formatDate = dateStr => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

// --- ВИЗУАЛЬНЫЙ ПРОГРЕСС БАР ---
const VisualProgress = ({ current, total }) => {
  const segments = Array.from({ length: total }, (_, i) => i);
  return (
    <div
      className="flex gap-0.5 h-1.5 w-full max-w-[200px] mt-1.5"
      title={`Шаг ${current + 1} из ${total}`}
    >
      {segments.map(i => {
        let color = 'bg-slate-200';
        if (i < current) color = 'bg-blue-500';
        if (i === current) color = 'bg-blue-600 animate-pulse';
        return <div key={i} className={`flex-1 rounded-full ${color}`} />;
      })}
    </div>
  );
};

// --- КОМПОНЕНТ KPI КАРТОЧКИ ---
function MetricCard({ label, value, icon: _Icon, color, isActive, onClick }) {
  const activeClass = isActive
    ? `ring-2 ring-offset-1 ring-${color.split('-')[1]}-500 border-${color.split('-')[1]}-500 bg-white`
    : 'border-slate-200 hover:border-blue-300 bg-slate-50/50 hover:bg-white';

  return (
    <div
      onClick={onClick}
      className={`
                group p-5 rounded-xl border-2 transition-all duration-200 cursor-pointer
                hover:shadow-2xl hover:-translate-y-1 hover:scale-[1.02]
                flex items-center gap-4 ${activeClass}
            `}
    >
      <div
        className={`
                w-14 h-14 rounded-xl flex items-center justify-center 
                bg-white shadow-sm border border-slate-100
                group-hover:scale-110 transition-transform ${color}
            `}
      >
        <_Icon size={28} />
      </div>
      <div className="flex-1">
        <div className="text-3xl font-black text-slate-800 leading-none">{value}</div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-1.5">
          {label}
        </div>
      </div>
    </div>
  );
}

// --- АВАТАР ---
const UserAvatar = ({ name, role }) => {
  const initials = name ? name.substring(0, 2).toUpperCase() : '??';
  const bgColors = {
    [ROLES.ADMIN]: 'bg-purple-600 text-white',
    [ROLES.CONTROLLER]: 'bg-orange-500 text-white',
    [ROLES.TECHNICIAN]: 'bg-blue-600 text-white',
  };
  return (
    <div
      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm ${bgColors[role] || 'bg-slate-500'}`}
      title={name}
    >
      {initials}
    </div>
  );
};

const ApplicationsDashboard = ({
  user,
  projects,
  dbScope,
  onSelectProject,
  onLogout,
  onOpenCatalogs,
}) => {
  const [activeTab, setActiveTab] = useState('my_tasks');
  const [taskFilter, setTaskFilter] = useState('work');

  const [incomingApps, setIncomingApps] = useState([]);
  const [isLoadingApps, setIsLoadingApps] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const toast = useToast();
  const { options: externalSystemOptions } = useCatalog('dict_external_systems');

  const isAdmin = user.role === ROLES.ADMIN;
  const isBranchManager = user.role === ROLES.BRANCH_MANAGER;
  const canViewInbox = isAdmin || isBranchManager;
  const canViewRegistry = isAdmin || isBranchManager;

  // Авто-выбор фильтра по роли
  useEffect(() => {
    if (user.role === ROLES.CONTROLLER) {
      setTaskFilter('review');
    } else if (user.role === ROLES.BRANCH_MANAGER) {
      setTaskFilter('pending_decline');
    } else {
      setTaskFilter('work');
    }
  }, [user.role]);

  const loadInbox = useCallback(async () => {
    setIsLoadingApps(true);
    try {
      const data = await ApiService.getExternalApplications(); // CHANGED
      setIncomingApps(data);
    } catch (e) {
      console.error(e);
      toast.error('Ошибка сети');
    } finally {
      setIsLoadingApps(false);
    }
  }, [toast]);

  // Загрузка входящих
  useEffect(() => {
    if (activeTab === 'inbox' && canViewInbox) {
      loadInbox();
    }
  }, [activeTab, canViewInbox, loadInbox]);

  const handleEmulateIncoming = () => {
    setIsLoadingApps(true);
    setTimeout(() => {
      const randomId = Math.floor(1000 + Math.random() * 9000);

      // Выбор случайного источника
      const sources = externalSystemOptions.map(s => ({ id: s.code, label: s.label }));
      const randomSource = sources[Math.floor(Math.random() * sources.length)] || {
        id: 'UNKNOWN',
        label: 'Неизвестный источник',
      };

      const newApp = {
        id: `APP-${Date.now()}`,
        externalId: `${randomSource.id}-${randomId}`,
        source: randomSource.id,
        applicant: `ООО "Строй-Инвест-${Math.floor(Math.random() * 100)}"`,
        submissionDate: new Date().toISOString(),
        cadastre: createVirtualComplexCadastre(),
        address: `г. Ташкент, Мирзо-Улугбекский р-н, кв-л ${Math.floor(Math.random() * 20)}`,
        status: APP_STATUS.NEW,
      };
      setIncomingApps(prev => [newApp, ...prev]);
      setIsLoadingApps(false);
      toast.success(`Поступила заявка из ${randomSource.label}`);
    }, 400);
  };

  const handleTakeToWork = async app => {
    const toastId = toast.loading('Создание проекта...');
    try {
      // CHANGED: Передаем app, user
      await ApiService.createProjectFromApplication(dbScope, app, user);
      setIncomingApps(prev => prev.filter(a => a.id !== app.id));
      toast.dismiss(toastId);
      toast.success('Проект создан');
      setActiveTab('my_tasks');
      setTaskFilter('work');
      // Нужно обновить список проектов
      // В идеале: вызвать refetch из useProjects, но он наверху.
      // Простой способ: window.location.reload() или пробросить refetch
      // Но react-query сам обновит при фокусе или следующем маунте, если инвалидация настроена в хуке useProjects
    } catch (e) {
      console.error(e);
      toast.dismiss(toastId);
      toast.error('Ошибка: ' + e.message);
    }
  };

  const handleDeleteProject = async projectId => {
    if (!window.confirm('Удалить проект и все данные?')) return;
    try {
      await ApiService.deleteProject(dbScope, projectId);
      toast.success('Удалено');
    } catch (e) {
      toast.error('Ошибка удаления');
    }
  };

  const handleDeclineProject = async (projectId, projectName) => {
    const reason = prompt(`Укажите причину отказа для "${projectName}" (обязательно, мин. 10 символов):`);
    if (!reason || reason.trim().length < 10) {
      if (reason !== null) toast.error('Причина должна быть не менее 10 символов');
      return;
    }
    try {
      const project = projects.find(p => p.id === projectId);
      if (!project?.applicationId) {
        toast.error('Заявка не найдена');
        return;
      }
      const { supabase } = await import('@lib/supabase');
      await supabase
        .from('applications')
        .update({
          status: APP_STATUS.DECLINED,
          workflow_substatus:
            user.role === ROLES.BRANCH_MANAGER
              ? WORKFLOW_SUBSTATUS.DECLINED_BY_MANAGER
              : user.role === ROLES.CONTROLLER
                ? WORKFLOW_SUBSTATUS.DECLINED_BY_CONTROLLER
                : WORKFLOW_SUBSTATUS.DECLINED_BY_ADMIN,
          updated_at: new Date(),
        })
        .eq('id', project.applicationId);
      await supabase.from('application_history').insert({
        application_id: project.applicationId,
        action: 'DECLINE',
        prev_status: project.applicationInfo?.status,
        next_status: APP_STATUS.DECLINED,
        user_name: user.name,
        comment: reason,
      });
      toast.success('Заявление отклонено');
    } catch (e) {
      console.error(e);
      toast.error('Ошибка при отказе');
    }
  };

  // --- ЛОГИКА ФИЛЬТРАЦИИ ---
  const getFilteredProjects = scope => {
    let filtered = projects;

    // 1. Фильтр по Табу/Роли (используем внешний статус + подстатус)
    if (scope === 'my_tasks') {
      if (taskFilter === 'work') {
        filtered = filtered.filter(p => {
          const sub = p.applicationInfo?.workflowSubstatus;
          return (
            p.applicationInfo?.status === APP_STATUS.IN_PROGRESS &&
            [
              WORKFLOW_SUBSTATUS.DRAFT,
              WORKFLOW_SUBSTATUS.REVISION,
              WORKFLOW_SUBSTATUS.RETURNED_BY_MANAGER,
            ].includes(sub)
          );
        });
      } else if (taskFilter === 'review') {
        filtered = filtered.filter(
          p => p.applicationInfo?.workflowSubstatus === WORKFLOW_SUBSTATUS.REVIEW
        );
      } else if (taskFilter === 'integration') {
        filtered = filtered.filter(
          p => p.applicationInfo?.workflowSubstatus === WORKFLOW_SUBSTATUS.INTEGRATION
        );
      } else if (taskFilter === 'pending_decline') {
        filtered = filtered.filter(
          p => p.applicationInfo?.workflowSubstatus === WORKFLOW_SUBSTATUS.PENDING_DECLINE
        );
      } else if (taskFilter === 'declined') {
        filtered = filtered.filter(p => p.applicationInfo?.status === APP_STATUS.DECLINED);
      }
    }

    // 2. Глобальный поиск
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        p =>
          p.name.toLowerCase().includes(lower) ||
          p.ujCode?.toLowerCase().includes(lower) ||
          p.applicationInfo?.internalNumber?.toLowerCase().includes(lower) ||
          p.applicationInfo?.externalId?.toLowerCase().includes(lower) ||
          p.complexInfo?.street?.toLowerCase().includes(lower) ||
          p.applicationInfo?.assigneeName?.toLowerCase().includes(lower)
      );
    }

    return filtered.sort(
      (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    );
  };

  const currentList = activeTab === 'inbox' ? incomingApps : getFilteredProjects(activeTab);

  // Подсчет счетчиков
  const counts = useMemo(
    () => ({
      work: projects.filter(p => {
        const sub = p.applicationInfo?.workflowSubstatus;
        return (
          p.applicationInfo?.status === APP_STATUS.IN_PROGRESS &&
          [
            WORKFLOW_SUBSTATUS.DRAFT,
            WORKFLOW_SUBSTATUS.REVISION,
            WORKFLOW_SUBSTATUS.RETURNED_BY_MANAGER,
          ].includes(sub)
        );
      }).length,
      review: projects.filter(
        p => p.applicationInfo?.workflowSubstatus === WORKFLOW_SUBSTATUS.REVIEW
      ).length,
      integration: projects.filter(
        p => p.applicationInfo?.workflowSubstatus === WORKFLOW_SUBSTATUS.INTEGRATION
      ).length,
      pendingDecline: projects.filter(
        p => p.applicationInfo?.workflowSubstatus === WORKFLOW_SUBSTATUS.PENDING_DECLINE
      ).length,
      declined: projects.filter(p => p.applicationInfo?.status === APP_STATUS.DECLINED).length,
      completed: projects.filter(p => p.applicationInfo?.status === APP_STATUS.COMPLETED).length,
      total: projects.length,
    }),
    [projects]
  );

  return (
    <div className="w-full bg-white h-screen flex flex-col overflow-hidden">
      {/* --- ТЕМНАЯ ШАПКА --- */}
      <div className="bg-slate-900 px-8 pt-8 pb-16 shadow-2xl relative overflow-hidden border-b border-slate-800 shrink-0">
        {/* Декоративный фон */}
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-white pointer-events-none transform translate-x-1/4 -translate-y-1/4">
          <Layers size={300} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 to-transparent pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="flex items-start gap-5">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center text-white shadow-lg ring-4 ring-white/10 shrink-0">
              <Briefcase size={28} />
            </div>

            <div>
              <h1 className="text-3xl font-black text-white tracking-tight leading-none mb-1">
                Рабочий стол
              </h1>
              <p className="text-sm font-medium text-slate-400">
                Реестр Жилых Комплексов и многоквартирных домов
              </p>

              <div className="flex items-center gap-3 mt-4">
                <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-2 py-1 border border-slate-700/50">
                  <UserAvatar name={user.name} role={user.role} />
                  <span className="text-sm font-bold text-slate-200">{user.name}</span>
                </div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-800/50 px-2 py-1.5 rounded-lg border border-slate-700/50">
                  {user.role === ROLES.TECHNICIAN
                    ? 'Техник'
                    : user.role === ROLES.CONTROLLER
                      ? 'Бригадир'
                      : user.role === ROLES.BRANCH_MANAGER
                        ? 'Нач. филиала'
                        : 'Администратор'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {(isAdmin) && onOpenCatalogs && (
              <button
                onClick={onOpenCatalogs}
                className="px-3 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Справочники
              </button>
            )}
            {/* ВКЛАДКИ */}
            <div className="flex bg-slate-950/50 p-1 rounded-xl border border-white/5 backdrop-blur-sm">
              <button
                onClick={() => setActiveTab('my_tasks')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'my_tasks' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                <ListTodo size={16} /> Задачи
                <Badge
                  className={`ml-1 border-0 ${activeTab === 'my_tasks' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-500'}`}
                >
                  {user.role === ROLES.CONTROLLER
                    ? counts.review
                    : user.role === ROLES.BRANCH_MANAGER
                      ? counts.pendingDecline
                      : counts.work + counts.integration}
                </Badge>
              </button>

              {canViewRegistry && (
                <button
                  onClick={() => setActiveTab('registry')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'registry' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  <Database size={16} /> Реестр
                  <span
                    className={`px-1.5 rounded text-[9px] ${activeTab === 'registry' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-500'}`}
                  >
                    {counts.total}
                  </span>
                </button>
              )}

              {canViewInbox && (
                <button
                  onClick={() => setActiveTab('inbox')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'inbox' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  <Inbox size={16} /> Входящие
                  {incomingApps.length > 0 && (
                    <Badge className="ml-1 bg-red-500 text-white border-0 animate-pulse">
                      {incomingApps.length}
                    </Badge>
                  )}
                </button>
              )}
            </div>

            <button
              onClick={onLogout}
              className="p-3 bg-slate-950/50 border border-white/5 hover:bg-red-500/20 hover:border-red-500/50 text-slate-400 hover:text-red-400 rounded-xl transition-all"
              title="Выйти из системы"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* --- КОНТЕНТ (Смещаем вверх на шапку) --- */}
      <div className="px-8 -mt-10 relative z-20 flex-1 flex flex-col min-h-0">
        {/* Метрики */}
        {activeTab !== 'inbox' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-6 shrink-0">
            <MetricCard
              label="В работе"
              value={counts.work}
              icon={HardHat}
              color="text-blue-600"
              isActive={activeTab === 'my_tasks' && taskFilter === 'work'}
              onClick={() => {
                setActiveTab('my_tasks');
                setTaskFilter('work');
              }}
            />
            <MetricCard
              label="На проверке"
              value={counts.review}
              icon={ShieldCheck}
              color="text-orange-600"
              isActive={activeTab === 'my_tasks' && taskFilter === 'review'}
              onClick={() => {
                setActiveTab('my_tasks');
                setTaskFilter('review');
              }}
            />

            {/* Плитка для начальника филиала / админа — запросы на отказ */}
            {(isBranchManager || isAdmin) ? (
              <MetricCard
                label="На рассмотрении"
                value={counts.pendingDecline}
                icon={Clock}
                color="text-amber-600"
                isActive={activeTab === 'my_tasks' && taskFilter === 'pending_decline'}
                onClick={() => {
                  setActiveTab('my_tasks');
                  setTaskFilter('pending_decline');
                }}
              />
            ) : (
              <MetricCard
                label="Передача в УЗКАД"
                value={counts.integration}
                icon={Globe}
                color="text-indigo-600"
                isActive={activeTab === 'my_tasks' && taskFilter === 'integration'}
                onClick={() => {
                  setActiveTab('my_tasks');
                  setTaskFilter('integration');
                }}
              />
            )}

            {canViewRegistry ? (
              <MetricCard
                label="Всего в реестре"
                value={counts.total}
                icon={Archive}
                color="text-slate-600"
                isActive={activeTab === 'registry'}
                onClick={() => setActiveTab('registry')}
              />
            ) : (
              <div className="hidden md:block opacity-0 pointer-events-none"></div>
            )}
          </div>
        )}

        {/* Фильтры */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-5 shrink-0">
          <div className="flex items-center gap-2">
            {activeTab === 'my_tasks' && (
              <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                <button
                  onClick={() => setTaskFilter('work')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${taskFilter === 'work' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                >
                  <ListTodo size={14} /> В работе
                </button>
                <button
                  onClick={() => setTaskFilter('review')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${taskFilter === 'review' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                >
                  <ShieldCheck size={14} /> На проверке
                </button>
                {/* Кнопка фильтра интеграции */}
                <button
                  onClick={() => setTaskFilter('integration')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${taskFilter === 'integration' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                >
                  <Globe size={14} /> Интеграция
                </button>
                {/* Кнопка фильтра запросов на отказ (для начальника/админа) */}
                {(isBranchManager || isAdmin) && (
                  <button
                    onClick={() => setTaskFilter('pending_decline')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${taskFilter === 'pending_decline' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                  >
                    <Clock size={14} /> На рассмотрении
                    {counts.pendingDecline > 0 && (
                      <span className="bg-amber-200 text-amber-800 text-[9px] px-1.5 rounded-full font-bold">{counts.pendingDecline}</span>
                    )}
                  </button>
                )}
              </div>
            )}
            {activeTab === 'inbox' && (
              <Tooltip content="Сгенерировать тестовую заявку из внешней системы">
                <Button
                  onClick={handleEmulateIncoming}
                  disabled={isLoadingApps}
                  className="bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 h-10 text-xs px-5 rounded-xl"
                >
                  <Zap size={14} className={isLoadingApps ? 'animate-spin' : ''} /> Эмуляция (API)
                </Button>
              </Tooltip>
            )}
          </div>

          <div className="relative w-full md:w-96">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <Input
              placeholder="Поиск по номеру, названию, адресу..."
              className="pl-10 h-11 text-sm rounded-xl border-slate-200 bg-white shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Таблица */}
        <Card className="flex-1 overflow-hidden shadow-xl border-0 ring-1 ring-slate-200 rounded-t-2xl rounded-b-none bg-white flex flex-col min-h-0">
          {activeTab === 'inbox' ? (
            <InboxTable data={incomingApps} onTake={handleTakeToWork} canTake={canTakeInboxApplication(user.role)} />
          ) : (
            <ProjectsTable
              data={currentList}
              user={user}
              onSelect={onSelectProject}
              onDelete={isAdmin ? handleDeleteProject : undefined}
              onDecline={(isAdmin || isBranchManager || user.role === ROLES.CONTROLLER) ? handleDeclineProject : undefined}
            />
          )}
        </Card>
      </div>

      {/* --- ПОДВАЛ (ТЕМНЫЙ) --- */}
      <div className="bg-slate-900 border-t border-slate-800 py-4 px-8 text-xs text-slate-400 shrink-0 z-30">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            {/* ЛОГОТИП КАДАСТРА */}
            <img
              src="/kadastr_logo.png"
              alt="Logo"
              className="w-10 h-10 rounded-lg object-contain bg-white ring-2 ring-white/10"
            />
            <div className="flex flex-col">
              <span className="font-bold text-white uppercase tracking-wide">
                Кадастр Агентлиги
              </span>
              <span className="text-[10px] text-slate-500">Единая система учета недвижимости</span>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1">
              <span>Разработчик</span>
              <span className="font-bold text-blue-400">Geoinfocom</span>
            </div>
            <span className="text-[10px] font-mono text-slate-600">2026 год • Версия 1.0.1</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- ТАБЛИЦА ЗАДАЧ ---
const ProjectsTable = ({ data, user, onSelect, onDelete, onDecline, isLoading = false }) => {
  if (!isLoading && data.length === 0) return <EmptyState />;

  return (
    <div className="flex-1 overflow-y-auto">
      <table className="w-full text-left text-sm border-collapse relative">
        <thead className="bg-slate-50/95 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10 backdrop-blur-md shadow-sm">
          <tr>
            <th className="px-5 py-4 w-10 text-center">#</th>
            <th className="px-5 py-4 w-32">№ Заявления</th>
            <th className="px-5 py-4 w-28">Источник</th>
            <th className="px-5 py-4 w-32">Внешний №</th>
            <th className="px-5 py-4">Название ЖК</th>
            <th className="px-5 py-4 w-56">Адрес</th>
            <th className="px-5 py-4 w-64">Текущий этап</th>
            <th className="px-5 py-4">Исполнитель</th>
            <th className="px-5 py-4 w-28">Принято</th>
            <th className="px-5 py-4 w-28">Обновлено</th>
            <th className="px-5 py-4 text-center">Статус</th>
            <th className="px-5 py-4 text-right">Действия</th>
          </tr>
        </thead>
        {isLoading ? (
          <TableSkeleton rows={5} cols={12} />
        ) : (
          <tbody className="divide-y divide-slate-100 bg-white">
            {data.map((p, idx) => {
              const app = p.applicationInfo || {};
              const info = p.complexInfo || {};
              const substatus = app.workflowSubstatus || WORKFLOW_SUBSTATUS.DRAFT;
              const statusConfig = APP_STATUS_LABELS[app.status] || {
                label: app.status,
                color: getStageColor(app.status),
              };
              const substatusConfig = SUBSTATUS_LABELS[substatus] || statusConfig;
              const isDeclined = app.status === APP_STATUS.DECLINED;
              const isCompleted = app.status === APP_STATUS.COMPLETED;
              const isPendingDeclineStatus = substatus === WORKFLOW_SUBSTATUS.PENDING_DECLINE;

              // ДАННЫЕ ДЛЯ ЭТАПА
              const currentStepIdx = app.currentStepIndex || 0;
              const stepTitle = STEPS_CONFIG[currentStepIdx]?.title || 'Завершено';

              const canEdit =
                (user.role === ROLES.TECHNICIAN &&
                  [
                    WORKFLOW_SUBSTATUS.DRAFT,
                    WORKFLOW_SUBSTATUS.REVISION,
                    WORKFLOW_SUBSTATUS.RETURNED_BY_MANAGER,
                    WORKFLOW_SUBSTATUS.INTEGRATION,
                  ].includes(substatus)) ||
                (user.role === ROLES.CONTROLLER && substatus === WORKFLOW_SUBSTATUS.REVIEW);

              const showDeclineBtn = canDeclineFromDashboard(user.role, app.status, substatus);

              return (
                <tr
                  key={p.id}
                  className={`group transition-colors ${isDeclined ? 'bg-red-50 hover:bg-red-100' : isPendingDeclineStatus ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-blue-50/30'}`}
                >
                  <td className="px-5 py-4 text-center text-slate-400 text-xs">{idx + 1}</td>
                  <td className="px-5 py-4 font-mono text-xs font-bold text-slate-700">
                    {app.internalNumber || '—'}
                  </td>
                  <td className="px-5 py-4">
                    {app.externalSource ? (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                        {app.externalSource}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-600">
                    {app.externalId || '—'}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 mb-1">
                      {p.ujCode && (
                        <IdentifierBadge code={p.ujCode} type="project" variant="compact" />
                      )}
                      <div className="font-bold text-slate-800 text-sm line-clamp-1" title={p.name}>
                        {p.name}
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">
                      {p.composition?.length || 0} объектов
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-start gap-1.5 text-xs text-slate-600">
                      <MapPin size={12} className="mt-0.5 shrink-0 text-slate-400" />
                      <span className="line-clamp-2 leading-tight" title={info.street}>
                        {info.street || 'Адрес не указан'}
                      </span>
                    </div>
                  </td>

                  {/* ЯЧЕЙКА ТЕКУЩЕГО ЭТАПА */}
                  <td className="px-5 py-4">
                    {isCompleted ? (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                        <CheckCircle2 size={14} /> Завершен
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <span
                          className="text-[11px] font-bold text-slate-700 line-clamp-1"
                          title={stepTitle}
                        >
                          {stepTitle}
                        </span>
                        <VisualProgress current={currentStepIdx} total={STEPS_CONFIG.length} />
                      </div>
                    )}
                  </td>

                  <td className="px-5 py-4">
                    {app.assigneeName ? (
                      <div className="flex items-center gap-2">
                        <UserAvatar name={app.assigneeName} role={ROLES.TECHNICIAN} />
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-700 leading-none">
                            {app.assigneeName}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                    {formatDate(app.submissionDate)}
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                    {formatDate(p.lastModified)}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <div className="flex flex-col items-center gap-1 relative group/tooltip">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border shadow-sm ${statusConfig.color}`}
                      >
                        {statusConfig.label}
                        {isDeclined && <AlertCircle size={12} className="ml-1.5" />}
                      </span>
                      {substatus && substatus !== WORKFLOW_SUBSTATUS.DRAFT && substatus !== WORKFLOW_SUBSTATUS.DONE && !isDeclined && (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold border ${substatusConfig.color}`}
                        >
                          {substatusConfig.label}
                        </span>
                      )}
                      {(isDeclined || app.rejectionReason || app.requestedDeclineReason) && (
                        <div className="absolute bottom-full mb-2 w-56 bg-slate-800 text-white text-xs p-3 rounded-xl shadow-xl opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all z-50 text-left -translate-x-1/2 left-1/2">
                          <div className="font-bold text-red-300 mb-1 border-b border-white/10 pb-1">
                            {isDeclined ? 'Причина отказа:' : isPendingDeclineStatus ? 'Запрос на отказ:' : 'Причина возврата:'}
                          </div>
                          {app.requestedDeclineReason || app.rejectionReason || 'Не указана'}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Tooltip content="Открыть в режиме просмотра">
                        <button
                          onClick={() => onSelect(p.id, 'view')}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                        >
                          <Eye size={16} />
                        </button>
                      </Tooltip>
                      {!isCompleted && canEdit && (
                        <Tooltip content="Взять в работу и редактировать">
                          <button
                            onClick={() => onSelect(p.id, 'edit')}
                            className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-lg transition-all shadow-sm hover:shadow active:scale-95"
                          >
                            <PlayCircle size={16} />
                          </button>
                        </Tooltip>
                      )}
                      {showDeclineBtn && onDecline && (
                        <Tooltip content="Отказать заявление">
                          <button
                            onClick={() => onDecline(p.id, p.name)}
                            className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                          >
                            <Ban size={16} />
                          </button>
                        </Tooltip>
                      )}
                      {onDelete && (
                        <Tooltip content="Удалить проект" placement="left">
                          <button
                            onClick={() => onDelete(p.id)}
                            className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                          >
                            <Trash2 size={16} />
                          </button>
                        </Tooltip>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        )}
      </table>
    </div>
  );
};

// --- ТАБЛИЦА ВХОДЯЩИХ ---
const InboxTable = ({ data, onTake, canTake }) => {
  if (data.length === 0)
    return (
      <EmptyState label="Нет входящих заявок" subLabel="Ожидайте поступления из внешних систем" />
    );

  return (
    <div className="flex-1 overflow-y-auto">
      <table className="w-full text-left text-sm border-collapse relative">
        <thead className="bg-slate-50/95 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10 backdrop-blur-md shadow-sm">
          <tr>
            <th className="px-6 py-4">Источник</th>
            <th className="px-6 py-4">Внешний ID</th>
            <th className="px-6 py-4">Дата подачи</th>
            <th className="px-6 py-4">Заявитель</th>
            <th className="px-6 py-4 w-1/3">Адрес участка</th>
            <th className="px-6 py-4 text-right">Действие</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {data.map(app => (
            <tr key={app.id} className="hover:bg-blue-50/30 transition-colors">
              <td className="px-6 py-4">
                <span className="text-xs font-bold px-2 py-1 bg-slate-100 rounded border border-slate-200">
                  {app.source}
                </span>
              </td>
              <td className="px-6 py-4 font-mono text-xs font-bold text-slate-700">
                {app.externalId}
              </td>
              <td className="px-6 py-4 text-xs text-slate-500">{formatDate(app.submissionDate)}</td>
              <td className="px-6 py-4 font-bold text-slate-800">{app.applicant}</td>
              <td className="px-6 py-4 text-xs text-slate-600">{app.address}</td>
              <td className="px-6 py-4 text-right">
                <Button
                  onClick={() => canTake && onTake(app)}
                  disabled={!canTake}
                  className={`h-9 text-xs px-4 shadow-sm rounded-lg ${!canTake ? 'bg-slate-300 opacity-50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  Принять <ArrowRight size={12} className="ml-1" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const EmptyState = ({ label = 'Список пуст', subLabel = 'Нет данных для отображения' }) => (
  <div className="flex-1 flex flex-col items-center justify-center text-slate-400 min-h-[300px]">
    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
      <Inbox size={32} className="opacity-50" />
    </div>
    <h3 className="text-sm font-bold text-slate-600">{label}</h3>
    <p className="text-xs mt-1">{subLabel}</p>
  </div>
);

export default React.memo(ApplicationsDashboard);
