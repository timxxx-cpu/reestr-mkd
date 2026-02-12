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
  RefreshCw,
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
  Undo2,
  AlertTriangle,
  X,
  MessageSquare
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
  useEscapeKey, // Добавлен импорт хука
  Select // Добавлен импорт Select
} from '@components/ui/UIKit';
import { IdentifierBadge } from '@components/ui/IdentifierBadge';
import { useToast } from '@context/ToastContext';
import { getStageColor } from '@lib/utils';
import { ApiService } from '@lib/api-service';
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

// --- МОДАЛКА ДЕЙСТВИЙ (ВЗАМЕН PROMPT/CONFIRM) ---
const DashboardActionModal = ({ config, onCancel, onConfirm, technicians = [] }) => {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  
  useEscapeKey(onCancel);

  // Инициализация значения для селекта (первый техник)
  useEffect(() => {
    if (config.type === 'select' && technicians.length > 0 && !inputValue) {
      setInputValue(technicians[0].name);
    }
  }, [config.type, technicians, inputValue]);

  const handleSubmit = () => {
    const trimmed = typeof inputValue === 'string' ? inputValue.trim() : inputValue;

    // Валидация для текстового ввода
    if (config.type === 'input') {
      if (config.required && !trimmed) {
        setError('Это поле обязательно для заполнения');
        return;
      }
      if (config.minLength && trimmed.length < config.minLength) {
        setError(`Минимальная длина комментария: ${config.minLength} символов`);
        return;
      }
    }

    onConfirm(trimmed);
  };

  // Определение стилей в зависимости от типа
  let HeaderIcon = MessageSquare;
  let headerBg = 'bg-slate-50 border-slate-100';
  let iconColor = 'text-slate-600 bg-white';
  let btnClass = 'bg-slate-900 hover:bg-slate-800';

  if (config.intent === 'destructive') {
    HeaderIcon = config.type === 'confirm' ? Trash2 : Ban;
    headerBg = 'bg-red-50 border-red-100';
    iconColor = 'text-red-600 bg-white border-red-100';
    btnClass = 'bg-red-600 hover:bg-red-700';
  } else if (config.intent === 'warning') {
    HeaderIcon = AlertTriangle;
    headerBg = 'bg-amber-50 border-amber-100';
    iconColor = 'text-amber-600 bg-white border-amber-100';
    btnClass = 'bg-amber-600 hover:bg-amber-700';
  } else if (config.intent === 'info') {
    HeaderIcon = UserCheck;
    headerBg = 'bg-blue-50 border-blue-100';
    iconColor = 'text-blue-600 bg-white border-blue-100';
    btnClass = 'bg-blue-600 hover:bg-blue-700';
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ring-1 ring-slate-900/5 scale-100 animate-in zoom-in-95 duration-200 flex flex-col">
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center gap-3 ${headerBg}`}>
          <div className={`p-2 rounded-full shadow-sm border ${iconColor}`}>
            <HeaderIcon size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 leading-tight">{config.title}</h3>
            {config.subtitle && (
              <p className="text-xs text-slate-500 font-medium">{config.subtitle}</p>
            )}
          </div>
          <button onClick={onCancel} className="ml-auto text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {config.description && (
             <p className="text-sm text-slate-600 leading-relaxed">{config.description}</p>
          )}

          {config.type === 'input' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                {config.label || 'Комментарий'} {config.required && <span className="text-red-500">*</span>}
              </label>
              <textarea
                autoFocus
                className={`w-full min-h-[100px] p-3 rounded-xl border text-sm font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 transition-all resize-none ${
                  error 
                    ? 'border-red-300 ring-red-100 focus:border-red-500 focus:ring-red-200' 
                    : 'border-slate-200 focus:border-blue-500 focus:ring-blue-100'
                }`}
                placeholder={config.placeholder}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  if (error) setError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) handleSubmit();
                }}
              />
              {error && (
                <div className="text-xs text-red-600 flex items-center gap-1 animate-in slide-in-from-top-1">
                  <AlertTriangle size={12} /> {error}
                </div>
              )}
              {config.minLength > 0 && (
                <div className="text-[10px] text-right text-slate-400">
                  {inputValue.length} / {config.minLength} символов
                </div>
              )}
            </div>
          )}

          {config.type === 'select' && (
             <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  {config.label || 'Выберите вариант'}
                </label>
                <select
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                >
                  {technicians.map((tech) => (
                    <option key={tech.id || tech.name} value={tech.name}>
                      {tech.name}
                    </option>
                  ))}
                </select>
             </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} className="h-10">
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            className={`h-10 text-white shadow-lg border-0 ${btnClass}`}
          >
            {config.confirmText || 'Подтвердить'}
          </Button>
        </div>
      </div>
    </div>
  );
};

// --- КОМПОНЕНТ KPI КАРТОЧКИ ---
function MetricCard({ label, value, icon: _Icon, color, isActive, onClick }) {
  const activeClass = isActive
    ? `ring-2 ring-offset-1 ring-${color.split('-')[1]}-500 border-${color.split('-')[1]}-500 bg-white`
    : 'border-slate-200 hover:border-blue-300 bg-slate-50/50 hover:bg-white';

  return (
    <button
      type="button"
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
    </button>
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
  const [technicians, setTechnicians] = useState([]);

  // Состояние для модалки действий
  const [actionModal, setActionModal] = useState(null); // { type, config, payload }

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

  useEffect(() => {
    let mounted = true;
    ApiService.getSystemUsers()
      .then(users => {
        if (!mounted) return;
        setTechnicians((users || []).filter(u => u.role === ROLES.TECHNICIAN));
      })
      .catch(() => {
        if (mounted) setTechnicians([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const loadInbox = useCallback(async () => {
    setIsLoadingApps(true);
    try {
      const data = await ApiService.getExternalApplications();
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
        status: 'NEW',
      };
      setIncomingApps(prev => [newApp, ...prev]);
      setIsLoadingApps(false);
      toast.success(`Поступила заявка из ${randomSource.label}`);
    }, 400);
  };

  const handleEmulateResubmission = () => {
    const candidates = (projects || []).filter(p => p?.cadastre?.number || p?.complexInfo?.cadastreNumber);
    if (candidates.length === 0) {
      toast.error('Нет ЖК с кадастровым номером для эмуляции повторной подачи');
      return;
    }

    setIsLoadingApps(true);
    setTimeout(() => {
      const selected = candidates[Math.floor(Math.random() * candidates.length)];
      const cadastreNumber = selected?.cadastre?.number || selected?.complexInfo?.cadastreNumber;
      const randomId = Math.floor(1000 + Math.random() * 9000);
      const source = externalSystemOptions?.[0]?.code || 'EPIGU';

      const newApp = {
        id: `REAPP-${Date.now()}`,
        externalId: `${source}-RE-${randomId}`,
        source,
        applicant: selected?.participants?.developer?.name || selected?.name || 'Повторная подача',
        submissionDate: new Date().toISOString(),
        cadastre: cadastreNumber,
        address: selected?.complexInfo?.street || selected?.address || 'Адрес не указан',
        status: 'NEW',
        reapplicationForProjectId: selected?.id,
        reapplicationForProjectName: selected?.name,
      };

      setIncomingApps(prev => [newApp, ...prev]);
      setIsLoadingApps(false);
      toast.success(`Эмуляция повторной подачи: ${selected?.name || 'ЖК'} (${cadastreNumber})`);
    }, 350);
  };

  const handleTakeToWork = async app => {
    const toastId = toast.loading('Создание проекта...');
    try {
      await ApiService.createProjectFromApplication(dbScope, app, user);
      setIncomingApps(prev => prev.filter(a => a.id !== app.id));
      toast.dismiss(toastId);
      toast.success('Проект создан');
      setActiveTab('my_tasks');
      setTaskFilter('work');
    } catch (e) {
      console.error(e);
      toast.dismiss(toastId);
      const message = e?.message || 'Не удалось принять заявление';

      if (message.includes('Отказ в принятии')) {
        setIncomingApps(prev =>
          prev.map(item =>
            item.id === app.id
              ? {
                  ...item,
                  status: 'DECLINED',
                  declineReason: message,
                }
              : item
          )
        );
      }

      toast.error('Ошибка: ' + message);
    }
  };

  // --- ЕДИНЫЙ ОБРАБОТЧИК ПОДТВЕРЖДЕНИЯ МОДАЛКИ ---
  const handleModalConfirm = async (result) => {
    if (!actionModal) return;
    const { type, payload } = actionModal;
    setActionModal(null); // Закрываем модалку

    try {
      // 1. СМЕНА ИСПОЛНИТЕЛЯ
      if (type === 'REASSIGN') {
        const { projectId, projectAppId } = payload;
        const newAssigneeName = result; // result - это выбранное имя из селекта

        if (!newAssigneeName) {
           toast.error('Исполнитель не выбран');
           return;
        }

        await ApiService.assignTechnician({
          applicationId: projectAppId,
          assigneeName: newAssigneeName,
        });
        toast.success(`Исполнитель изменен: ${newAssigneeName}`);
      } 
      
      // 2. УДАЛЕНИЕ ПРОЕКТА
      else if (type === 'DELETE') {
         await ApiService.deleteProject(dbScope, payload.projectId);
         toast.success('Проект удален');
      }

      // 3. ОТКАЗ ОТ ЗАЯВКИ (АДМИН/МЕНЕДЖЕР)
      else if (type === 'DECLINE') {
        const { projectId, projectAppId, projectName } = payload;
        const reason = result; // result - текст причины
        
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
          .eq('id', projectAppId);
          
        await supabase.from('application_history').insert({
          application_id: projectAppId,
          action: 'DECLINE',
          prev_status: payload.currentStatus, // Добавим в payload при вызове
          next_status: APP_STATUS.DECLINED,
          user_name: user.name,
          comment: reason,
        });
        toast.success('Заявление отклонено');
      }

      // 4. ВОЗВРАТ НА ДОРАБОТКУ
      else if (type === 'RETURN') {
        const { projectAppId } = payload;
        const comment = result; 

        await ApiService.returnFromDecline({
          applicationId: projectAppId,
          userName: user.name,
          comment,
        });
        toast.success('Заявление возвращено технику на доработку');
      }

    } catch (e) {
      console.error(e);
      toast.error('Ошибка при выполнении операции');
    }
  };


  // --- HANDLERS (Открытие модалок) ---
  const handleReassignProject = (projectId, projectName, currentAssignee) => {
    if (!(isAdmin || isBranchManager)) return;
    
    // Ищем ID заявки
    const project = projects.find(p => p.id === projectId);
    if (!project?.applicationId) {
       toast.error('Заявка не найдена');
       return;
    }

    setActionModal({
      type: 'REASSIGN',
      config: {
        type: 'select',
        intent: 'info',
        title: 'Передача заявки',
        subtitle: `ЖК "${projectName}"`,
        description: `Текущий исполнитель: ${currentAssignee || 'не назначен'}. Выберите нового ответственного:`,
        label: 'Новый исполнитель',
        confirmText: 'Назначить',
      },
      payload: { projectId, projectAppId: project.applicationId }
    });
  };

  const handleDeleteProject = (projectId) => {
    setActionModal({
      type: 'DELETE',
      config: {
        type: 'confirm',
        intent: 'destructive',
        title: 'Удаление проекта',
        description: 'Вы уверены, что хотите удалить проект и все связанные данные? Это действие необратимо.',
        confirmText: 'Да, удалить',
      },
      payload: { projectId }
    });
  };

  const handleDeclineProject = (projectId, projectName) => {
    const project = projects.find(p => p.id === projectId);
    if (!project?.applicationId) return;

    setActionModal({
      type: 'DECLINE',
      config: {
        type: 'input',
        intent: 'destructive',
        title: 'Отклонить заявление',
        subtitle: projectName,
        label: 'Причина отказа',
        placeholder: 'Опишите причину отказа подробно...',
        confirmText: 'Отклонить',
        required: true,
        minLength: 10
      },
      payload: { 
        projectId, 
        projectAppId: project.applicationId, 
        projectName,
        currentStatus: project.applicationInfo?.status
      }
    });
  };

  const handleReturnFromDecline = (projectId, projectName) => {
    const project = projects.find(p => p.id === projectId);
    if (!project?.applicationId) return;

    setActionModal({
      type: 'RETURN',
      config: {
        type: 'input',
        intent: 'warning',
        title: 'Вернуть на доработку',
        subtitle: projectName,
        label: 'Комментарий (необязательно)',
        placeholder: 'Укажите инструкции для техника...',
        confirmText: 'Вернуть',
        required: false
      },
      payload: { projectId, projectAppId: project.applicationId }
    });
  };

  // --- ЛОГИКА ФИЛЬТРАЦИИ ---
  const getFilteredProjects = scope => {
    let filtered = projects;

    // 1. Фильтр по Табу/Роли
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
      {/* --- МОДАЛКА ДЕЙСТВИЙ --- */}
      {actionModal && (
        <DashboardActionModal
          config={actionModal.config}
          onCancel={() => setActionModal(null)}
          onConfirm={handleModalConfirm}
          technicians={technicians}
        />
      )}

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
              <div className="flex items-center gap-2">
                <Tooltip content="Сгенерировать тестовую заявку из внешней системы">
                  <Button
                    onClick={handleEmulateIncoming}
                    disabled={isLoadingApps}
                    className="bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 h-10 text-xs px-5 rounded-xl"
                  >
                    <Zap size={14} className={isLoadingApps ? 'animate-spin' : ''} /> Эмуляция (API)
                  </Button>
                </Tooltip>
                <Tooltip content="Эмулировать повторную подачу заявки по существующему ЖК (по кадастровому номеру)">
                  <Button
                    onClick={handleEmulateResubmission}
                    disabled={isLoadingApps}
                    className="bg-emerald-700 text-white hover:bg-emerald-800 shadow-lg shadow-emerald-200 h-10 text-xs px-5 rounded-xl"
                  >
                    <RefreshCw size={14} className={isLoadingApps ? 'animate-spin' : ''} /> Повторная подача
                  </Button>
                </Tooltip>
              </div>
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
              onReturnFromDecline={(isAdmin || isBranchManager) ? handleReturnFromDecline : undefined}
              onReassign={(isAdmin || isBranchManager) ? handleReassignProject : undefined}
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

// --- УЛУЧШЕННАЯ ТАБЛИЦА ПРОЕКТОВ (Modern UI) ---
const ProjectsTable = ({
  data,
  user,
  onSelect,
  onDelete,
  onDecline,
  onReturnFromDecline,
  onReassign,
  isLoading = false,
}) => {
  if (!isLoading && data.length === 0) return <EmptyState />;

  return (
    // 1. Контейнер с тенью и скруглением
    <div className="flex-1 overflow-hidden flex flex-col bg-white rounded-t-2xl shadow-[0_0_15px_rgba(0,0,0,0.05)] border border-slate-200/60">
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full text-left text-sm border-collapse relative">
          
          {/* 2. Акцентная темная шапка */}
          <thead className="bg-slate-900 text-slate-300 sticky top-0 z-20 shadow-lg">
            <tr>
              {/* Используем text-center для заголовков, как вы просили */}
              <th className="px-4 py-4 w-12 text-center text-[10px] font-bold uppercase tracking-wider opacity-60">
                #
              </th>
              <th className="px-4 py-4 w-32 text-center text-[10px] font-bold uppercase tracking-wider">
                UJ-код
              </th>
              <th className="px-4 py-4 w-40 text-center text-[10px] font-bold uppercase tracking-wider">
                Кадастровый №
              </th>
              <th className="px-4 py-4 w-[18%] text-left text-[10px] font-bold uppercase tracking-wider">
                Заявка / Источник
              </th>
              <th className="px-4 py-4 w-[22%] text-left text-[10px] font-bold uppercase tracking-wider">
                Объект и Адрес
              </th>
              <th className="px-4 py-4 w-[20%] text-left text-[10px] font-bold uppercase tracking-wider">
                Процесс
              </th>
              <th className="px-4 py-4 w-[12%] text-center text-[10px] font-bold uppercase tracking-wider">
                Статус
              </th>
              <th className="px-4 py-4 text-right text-[10px] font-bold uppercase tracking-wider">
                Действия
              </th>
            </tr>
          </thead>

          {isLoading ? (
            <TableSkeleton rows={5} cols={8} />
          ) : (
            <tbody className="divide-y divide-slate-100">
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

                const currentStepIdx = app.currentStepIndex || 0;
                const stepTitle = STEPS_CONFIG[currentStepIdx]?.title || 'Завершено';

                const isAssignedToCurrentTechnician = !app.assigneeName || app.assigneeName === user.name;
                const canEdit =
                  (user.role === ROLES.TECHNICIAN &&
                    isAssignedToCurrentTechnician &&
                    [
                      WORKFLOW_SUBSTATUS.DRAFT,
                      WORKFLOW_SUBSTATUS.REVISION,
                      WORKFLOW_SUBSTATUS.RETURNED_BY_MANAGER,
                      WORKFLOW_SUBSTATUS.INTEGRATION,
                    ].includes(substatus)) ||
                  (user.role === ROLES.CONTROLLER && substatus === WORKFLOW_SUBSTATUS.REVIEW);

                const showDeclineBtn = canDeclineFromDashboard(user.role, app.status, substatus);
                const isBranchManager = user.role === ROLES.BRANCH_MANAGER;

                return (
                  <tr
                    key={p.id}
                    className={`
                      group transition-all duration-200 border-l-[3px]
                      ${isDeclined 
                        ? 'border-l-red-500 bg-red-50/30 hover:bg-red-50' 
                        : isPendingDeclineStatus 
                          ? 'border-l-amber-500 bg-amber-50/30 hover:bg-amber-50' 
                          : isCompleted
                            ? 'border-l-emerald-500 hover:bg-emerald-50/20'
                            : 'border-l-transparent hover:border-l-blue-500 hover:bg-blue-50/40 hover:shadow-md hover:translate-x-0.5'
                      }
                    `}
                  >
                    {/* #1 Индекс */}
                    <td className="px-4 py-5 text-center text-slate-400 text-xs font-mono font-medium">
                      {idx + 1}
                    </td>

                    {/* #2 UJ-код (Центрирован) */}
                    <td className="px-4 py-5 align-top">
                      <div className="flex justify-center">
                        {p.ujCode ? (
                           <IdentifierBadge code={p.ujCode} type="project" variant="default" />
                        ) : (
                           <span className="text-xs text-slate-300 font-mono">—</span>
                        )}
                      </div>
                    </td>

                    {/* #3 Кадастровый номер (Центрирован + Новый стиль) */}
                    <td className="px-4 py-5 align-top">
                      <div className="flex justify-center">
                        {p.cadastre ? (
                            <div className="flex items-center gap-1.5 bg-violet-50 px-2.5 py-1.5 rounded-lg border border-violet-100 group-hover:border-violet-200 transition-colors shadow-sm">
                              <Database size={12} className="text-violet-400"/>
                              <span className="text-xs font-mono font-bold text-violet-700 whitespace-nowrap tracking-tight">
                                  {p.cadastre}
                              </span>
                            </div>
                        ) : (
                            <span className="text-xs text-slate-300 font-mono">—</span>
                        )}
                      </div>
                    </td>

                    {/* #4 Заявка */}
                    <td className="px-4 py-5 align-top">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                           <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {app.internalNumber || '—'}
                          </span>
                          {app.externalSource && (
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider border border-slate-100 px-1 rounded-md">
                              {app.externalSource}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex flex-col gap-0.5">
                           <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                              <span className="w-3 inline-block text-center text-slate-300">Ext</span>
                              <span className="text-slate-600 font-medium">{app.externalId || '—'}</span>
                           </div>
                           <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                              <Clock size={10} className="text-slate-300"/> 
                              <span>{formatDate(app.submissionDate)}</span>
                           </div>
                        </div>
                      </div>
                    </td>

                    {/* #5 Объект */}
                    <td className="px-4 py-5 align-top">
                      <div className="flex flex-col gap-2">
                        <div className="font-bold text-slate-800 text-sm leading-snug group-hover:text-blue-700 transition-colors" title={p.name}>
                          {p.name}
                        </div>
                        
                        <div className="flex items-start gap-1.5 text-xs text-slate-500">
                          <MapPin size={13} className="mt-0.5 shrink-0 text-slate-400" />
                          <span className="line-clamp-2 leading-relaxed" title={info.street}>
                            {info.street || 'Адрес не указан'}
                          </span>
                        </div>
                        
                         <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                              {p.composition?.length || 0} зданий и сооружений
                            </span>
                         </div>
                      </div>
                    </td>

                    {/* #6 Процесс */}
                    <td className="px-4 py-5 align-top">
                      <div className="flex flex-col gap-3">
                        <div className="bg-white/50 p-2 rounded-lg border border-slate-100 shadow-sm group-hover:border-blue-100 transition-colors">
                          {isCompleted ? (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                              <CheckCircle2 size={14} /> 
                              <span>Процесс завершен</span>
                            </div>
                          ) : (
                             <>
                               <div className="flex justify-between items-baseline mb-1.5">
                                  <span className="text-[11px] font-bold text-slate-700 line-clamp-1 mr-2" title={stepTitle}>
                                    {stepTitle}
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-mono font-bold bg-slate-100 px-1 rounded">
                                    {currentStepIdx + 1}/{STEPS_CONFIG.length}
                                  </span>
                               </div>
                               <VisualProgress current={currentStepIdx} total={STEPS_CONFIG.length} />
                             </>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pl-1">
                           {app.assigneeName ? (
                              <>
                                <UserAvatar name={app.assigneeName} role={ROLES.TECHNICIAN} />
                                <div className="flex flex-col">
                                  <span className="text-[9px] text-slate-400 uppercase tracking-wide leading-none mb-0.5">Исп.</span>
                                  <span className="text-[10px] font-bold text-slate-700 leading-none">
                                    {app.assigneeName}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <span className="text-slate-300 text-[10px] italic">Не назначен</span>
                            )}
                        </div>
                      </div>
                    </td>

                    {/* #7 Статус (Центрирован) */}
                    <td className="px-4 py-5 align-top">
                      <div className="flex flex-col items-center gap-2">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border shadow-sm ${statusConfig.color}`}>
                          {statusConfig.label}
                          {isDeclined && <AlertCircle size={12} className="ml-1.5" />}
                        </span>

                        {substatus && 
                         substatus !== WORKFLOW_SUBSTATUS.DRAFT && 
                         substatus !== WORKFLOW_SUBSTATUS.DONE && 
                         !isDeclined && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold border bg-white/50 backdrop-blur-sm ${substatusConfig.color}`}>
                            {substatusConfig.label}
                          </span>
                        )}

                        {(isDeclined || app.rejectionReason || app.requestedDeclineReason) && (
                          <div className="relative group/reason">
                             <div className="cursor-help bg-red-50 text-red-600 p-1 rounded-full border border-red-100 hover:bg-red-100 transition-colors">
                                <AlertCircle size={14} />
                             </div>
                             {/* Всплывашка причины */}
                             <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-800 text-white text-[10px] p-2 rounded-lg shadow-xl opacity-0 group-hover/reason:opacity-100 pointer-events-none transition-all z-50">
                                <span className="font-bold block mb-1 text-red-300">
                                   {isDeclined ? 'Причина отказа:' : 'Запрос на отказ:'}
                                </span>
                                {app.requestedDeclineReason || app.rejectionReason || '—'}
                             </div>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* #8 Действия */}
                    <td className="px-4 py-5 text-right align-top">
                      <div className="flex flex-col items-end gap-2">
                         {!isCompleted && canEdit ? (
                            <Tooltip content="Взять в работу">
                              <button
                                onClick={() => {
                                  if (user.role === ROLES.TECHNICIAN && app.assigneeName && app.assigneeName !== user.name) {
                                    alert(`Заявка назначена на ${app.assigneeName}`);
                                    return;
                                  }
                                  onSelect(p.id, 'edit');
                                }}
                                className="group/btn flex items-center gap-2 pl-3 pr-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-md shadow-blue-200 hover:shadow-lg transition-all active:scale-95"
                              >
                                <PlayCircle size={14} className="group-hover/btn:fill-white/20" /> Открыть
                              </button>
                            </Tooltip>
                         ) : (
                            <Tooltip content="Просмотр">
                              <button
                                onClick={() => onSelect(p.id, 'view')}
                                className="flex items-center gap-2 pl-3 pr-4 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 hover:border-slate-300 text-xs font-bold rounded-lg transition-all shadow-sm"
                              >
                                <Eye size={14} /> Детали
                              </button>
                            </Tooltip>
                         )}

                         <div className="flex items-center justify-end gap-1 mt-1 opacity-40 group-hover:opacity-100 transition-opacity duration-300">
                            {isPendingDeclineStatus && onReturnFromDecline && (isBranchManager || user.role === ROLES.ADMIN) && (
                              <Tooltip content="Вернуть на доработку">
                                <button onClick={() => onReturnFromDecline(p.id, p.name)} className="p-1.5 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-md transition-colors">
                                  <Undo2 size={14} />
                                </button>
                              </Tooltip>
                            )}
                            
                            {showDeclineBtn && onDecline && (
                              <Tooltip content="Отказать">
                                <button onClick={() => onDecline(p.id, p.name)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                                  <Ban size={14} />
                                </button>
                              </Tooltip>
                            )}

                            {onReassign && !isCompleted && !isDeclined && (
                              <Tooltip content="Сменить исполнителя">
                                <button onClick={() => onReassign(p.id, p.name, app.assigneeName)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors">
                                  <UserCheck size={14} />
                                </button>
                              </Tooltip>
                            )}

                            {onDelete && (
                              <Tooltip content="Удалить">
                                <button onClick={() => onDelete(p.id)} className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                                  <Trash2 size={14} />
                                </button>
                              </Tooltip>
                            )}
                         </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          )}
        </table>
      </div>
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
            <th className="px-6 py-4">Кадастровый номер ЖК</th>
            <th className="px-6 py-4 w-1/3">Адрес участка</th>
            <th className="px-6 py-4">Статус</th>
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
              <td className="px-6 py-4">
                <div className="font-mono text-xs text-slate-700">{app.cadastre || '—'}</div>
                {app.reapplicationForProjectName ? (
                  <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                    Повторно по ЖК: {app.reapplicationForProjectName}
                  </div>
                ) : null}
              </td>
              <td className="px-6 py-4 text-xs text-slate-600">{app.address}</td>
              <td className="px-6 py-4">
                {app.status === 'DECLINED' ? (
                  <div className="inline-flex items-center px-2 py-1 rounded border border-red-200 bg-red-50 text-red-700 text-[10px] font-bold" title={app.declineReason || 'Отказ в принятии'}>
                    Отказано
                  </div>
                ) : (
                  <div className="inline-flex items-center px-2 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 text-[10px] font-bold">
                    Новая
                  </div>
                )}
              </td>
              <td className="px-6 py-4 text-right">
                <Button
                  onClick={() => canTake && app.status !== 'DECLINED' && onTake(app)}
                  disabled={!canTake || app.status === 'DECLINED'}
                  className={`h-9 text-xs px-4 shadow-sm rounded-lg ${!canTake || app.status === 'DECLINED' ? 'bg-slate-300 opacity-50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
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
