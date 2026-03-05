import React, { useState, useEffect, useCallback } from 'react';
import {
  Briefcase,
  ListTodo,
  ShieldCheck,
  HardHat,
  Database,
  Layers,
  LogOut,
  Globe,
  Server,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  MapPinned,
} from 'lucide-react';
import {
  ROLES,
  APP_STATUS,
} from '@lib/constants';
import {
  canTakeInboxApplication,
} from '@lib/workflow-state-machine';
import { useCatalog } from '@hooks/useCatalogs';
import {
  Button,
  Badge,
  Card,
  SectionTitle,
  Select // Добавлен импорт Select
} from '@components/ui/UIKit';
import { useToast } from '@context/ToastContext';
import { ApiService } from '@lib/api-service';
import BuildingsRegistryTable from '@/features/steps/registry/BuildingsRegistryTable';
import { DASHBOARD_DEFAULTS } from './applications-dashboard/config';
import {
  getDefaultTaskFilterForRole,
  buildIncomingEmulatedApplication,
  buildResubmissionEmulatedApplication,
} from './applications-dashboard/utils';
import DashboardActionModal from './applications-dashboard/DashboardActionModal';
import UserAvatar from './applications-dashboard/UserAvatar';
import DashboardToolbar from './applications-dashboard/DashboardToolbar';
import DashboardSidePanel from './applications-dashboard/DashboardSidePanel';
import ProjectsTable from './applications-dashboard/ProjectsTable';
import InboxTable from './applications-dashboard/InboxTable';
import { useApplicationsDashboardData } from './applications-dashboard/useApplicationsDashboardData';
import { useInboxActions } from './applications-dashboard/useInboxActions';
import { useProjectModerationActions } from './applications-dashboard/useProjectModerationActions';
import ProjectsOverviewMapModal from '@components/maps/ProjectsOverviewMapModal';

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

const ApplicationsDashboard = ({
  user,
  projects,
  dbScope,
  onSelectProject,
  onLogout,
  onOpenCatalogs,
}) => {
  const [activeTab, setActiveTab] = useState(DASHBOARD_DEFAULTS.TAB);
  const [taskFilter, setTaskFilter] = useState(DASHBOARD_DEFAULTS.TASK_FILTER);
  const [registryFilter, setRegistryFilter] = useState(DASHBOARD_DEFAULTS.REGISTRY_FILTER); // 'applications' | 'complexes' | 'buildings'
  const [assigneeFilter, setAssigneeFilter] = useState(DASHBOARD_DEFAULTS.ASSIGNEE_FILTER); // all | mine
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [isProjectsMapOpen, setIsProjectsMapOpen] = useState(false);
  const [projectsMapItems, setProjectsMapItems] = useState([]);
  const [isProjectsMapLoading, setIsProjectsMapLoading] = useState(false);

  const [incomingApps, setIncomingApps] = useState([]);
  const [isLoadingApps, setIsLoadingApps] = useState(false);
  const [projectsPage, setProjectsPage] = useState(1);
  const [projectsPageSize] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [technicians, setTechnicians] = useState([]);

  // Состояние для модалки действий
  const [actionModal, setActionModal] = useState(null); // { type, config, payload }

  const toast = useToast();
  const { options: externalSystemOptions } = useCatalog('dict_external_systems');

  const isAdmin = user.role === ROLES.ADMIN;
  const isBranchManager = user.role === ROLES.BRANCH_MANAGER;
  const canViewInbox = isAdmin || isBranchManager;

  // Авто-выбор фильтра по роли
  useEffect(() => {
    setTaskFilter(getDefaultTaskFilterForRole(user.role));
  }, [user.role]);

  useEffect(() => {
    setProjectsPage(1);
  }, [activeTab, taskFilter, registryFilter, assigneeFilter, searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    let mounted = true;
    ApiService.getSystemUsers()
      .then(users => {
        if (!mounted) return;
        // Разрешаем передачу заявок техникам и контролерам
        setTechnicians((users || []).filter(u => 
          u.role === ROLES.TECHNICIAN || u.role === ROLES.CONTROLLER
        ));
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
      const res = await ApiService.getExternalApplications(dbScope);
      
      // ИСПРАВЛЕНИЕ: Извлекаем массив из поля items или data, 
      // либо оставляем как есть, если пришел массив
      const appsArray = Array.isArray(res) 
        ? res 
        : (res?.items || res?.data || []);
        
      setIncomingApps(appsArray);
    } catch (e) {
      console.error(e);
      toast.error('Ошибка сети при загрузке входящих');
      setIncomingApps([]);
    } finally {
      setIsLoadingApps(false);
    }
  }, [toast, dbScope]);

  // Загрузка входящих
  useEffect(() => {
    if (activeTab === 'inbox' && canViewInbox) {
      loadInbox();
    }
  }, [activeTab, canViewInbox, loadInbox]);

  const {
    dashboardProjects,
    projectsTotal,
    projectsTotalPages,
    isLoadingProjects,
    isFetchingProjects,
    refetch,
    counts,
    currentList,
  } = useApplicationsDashboardData({
    dbScope,
    activeTab,
    taskFilter,
    registryFilter,
    assigneeFilter,
    debouncedSearchTerm,
    projectsPage,
    projectsPageSize,
    incomingApps,
  });

  const {
    handleEmulateIncoming,
    handleEmulateResubmission,
    handleTakeToWork,
  } = useInboxActions({
    user,
    dbScope,
    projects,
    externalSystemOptions,
    setIncomingApps,
    setIsLoadingApps,
    setActiveTab,
    setTaskFilter,
    toast,
  });

  const {
    handleModalConfirm,
    handleReassignProject,
    handleDeleteProject,
    handleDeclineProject,
    handleReturnFromDecline,
  } = useProjectModerationActions({
    user,
    dbScope,
    projects,
    dashboardProjects,
    setActionModal,
    toast,
    refetch,
  });

  const onEmulateIncoming = () =>
    handleEmulateIncoming(buildIncomingEmulatedApplication);

  const onEmulateResubmission = () =>
    handleEmulateResubmission(buildResubmissionEmulatedApplication);


  const handleOpenProjectsMap = useCallback(async () => {
    setIsProjectsMapOpen(true);
    if (!dbScope) {
      setProjectsMapItems([]);
      return;
    }

    setIsProjectsMapLoading(true);
    try {
      const payload = await ApiService.getProjectsMapOverview(dbScope);
      setProjectsMapItems(Array.isArray(payload?.items) ? payload.items : []);
    } catch (e) {
      toast.error(e?.message || 'Не удалось загрузить карту проектов');
      setProjectsMapItems([]);
    } finally {
      setIsProjectsMapLoading(false);
    }
  }, [dbScope, toast]);

  const onActionModalConfirm = async result => {
    const currentModal = actionModal;
    setActionModal(null);
    if (!currentModal) return;
    await handleModalConfirm({ ...currentModal, result });
  };

  return (
    <div className="w-full bg-white h-screen flex flex-col overflow-hidden">
      {/* --- МОДАЛКА ДЕЙСТВИЙ --- */}
      {actionModal && (
        <DashboardActionModal
          config={actionModal.config}
          onCancel={() => setActionModal(null)}
          onConfirm={onActionModalConfirm}
          technicians={technicians}
        />
      )}


      {isProjectsMapOpen && (
        <ProjectsOverviewMapModal
          isOpen={isProjectsMapOpen}
          projects={projectsMapItems}
          onClose={() => setIsProjectsMapOpen(false)}
          onBackToWorkdesk={() => {
            setActiveTab('workdesk');
            setIsProjectsMapOpen(false);
          }}
        />
      )}
      {/* --- ШАПКА --- */}
      <div className="bg-slate-900 px-6 py-4 shadow-xl border-b border-slate-800 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center text-white shadow-lg">
              <Briefcase size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black text-white leading-tight">
                {activeTab === 'registry' ? 'Реестр' : 'Рабочий стол'}
              </h1>
              <p className="text-xs text-slate-400">Обработка входящих заявлений на инвентаризацию жилых комплексов</p>
            </div>
          </div>

          <div className="flex items-center gap-2 relative">
            <button
              onClick={() => setIsWorkspaceMenuOpen(v => !v)}
              className="h-10 px-3 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 text-xs font-bold inline-flex items-center gap-2 hover:bg-slate-700"
            >
              {activeTab === 'registry' ? <Database size={14} /> : <Briefcase size={14} />}
              {activeTab === 'registry' ? 'Реестр' : 'Рабочий стол'}
              <ChevronDown size={14} className={`${isWorkspaceMenuOpen ? 'rotate-180' : ''} transition-transform`} />
            </button>

            {isWorkspaceMenuOpen && (
              <div className="absolute right-0 top-12 z-50 w-56 bg-white rounded-xl border border-slate-200 shadow-xl p-1">
                <button
                  className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-slate-50 flex items-center gap-2"
                  onClick={() => {
                    setActiveTab('workdesk');
                    setIsWorkspaceMenuOpen(false);
                  }}
                >
                  <Briefcase size={14} /> Рабочий стол
                </button>
                <button
                  className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-slate-50 flex items-center gap-2"
                  onClick={() => {
                    setActiveTab('registry');
                    setIsWorkspaceMenuOpen(false);
                  }}
                >
                  <Database size={14} /> Реестр
                </button>
                {isAdmin && onOpenCatalogs && (
                  <button
                    className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-slate-50 flex items-center gap-2"
                    onClick={() => {
                      onOpenCatalogs();
                      setIsWorkspaceMenuOpen(false);
                    }}
                  >
                    <Server size={14} /> Администрирование
                  </button>
                )}
              </div>
            )}

            <div className="hidden md:flex items-center gap-2 bg-slate-800/50 rounded-lg px-2 py-1 border border-slate-700/50">
              <UserAvatar name={user.name} role={user.role} />
              <span className="text-xs font-bold text-slate-200">{user.name}</span>
            </div>

            <button
              onClick={handleOpenProjectsMap}
              className="h-10 px-3 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 text-xs font-bold inline-flex items-center gap-2 hover:bg-slate-700"
              title="Открыть общую карту ЖК"
            >
              <MapPinned size={14} />
              {isProjectsMapLoading ? 'Загрузка...' : 'Карта ЖК'}
            </button>

            <button
              onClick={() => setIsSidePanelOpen(v => !v)}
              className="h-10 px-3 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 text-xs font-bold inline-flex items-center gap-2 hover:bg-slate-700"
              title={isSidePanelOpen ? 'Скрыть правую панель' : 'Показать правую панель'}
            >
              <SlidersHorizontal size={14} />
              {isSidePanelOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>

            <button
              onClick={onLogout}
              className="h-10 w-10 inline-flex items-center justify-center border border-slate-700 rounded-lg bg-slate-800 text-slate-300 hover:text-red-300 hover:bg-red-500/20"
              title="Выйти из системы"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* --- КОНТЕНТ --- */}
      <div className="px-6 py-4 flex-1 min-h-0 flex gap-4 bg-slate-50">
        <Card className="flex-1 overflow-hidden shadow-xl border-0 ring-1 ring-slate-200 rounded-2xl bg-white flex flex-col min-h-0">
          {activeTab === 'registry' && registryFilter === 'buildings' ? (
            <BuildingsRegistryTable 
               onSelectBuilding={(id) => console.log('Open building', id)} 
            />
          ) : activeTab === 'inbox' ? (
            <InboxTable 
               data={incomingApps} 
               onTake={handleTakeToWork} 
               canTake={canTakeInboxApplication(user.role)} 
            />
          ) : (
            <div className="flex-1 min-h-0 flex flex-col">
              <DashboardToolbar
                currentList={currentList}
                projectsTotal={projectsTotal}
                projectsPage={projectsPage}
                projectsTotalPages={projectsTotalPages}
                projectsPageSize={projectsPageSize}
                isFetchingProjects={isFetchingProjects}
                onPrevPage={() => setProjectsPage(p => Math.max(1, p - 1))}
                onNextPage={() => setProjectsPage(p => p + 1)}
              />
            <ProjectsTable
              data={currentList}
              user={user}
              onSelect={onSelectProject}
              onDelete={isAdmin ? handleDeleteProject : undefined}
              onDecline={handleDeclineProject}
              onReturnFromDecline={handleReturnFromDecline}
              onReassign={handleReassignProject}
              isLoading={isLoadingProjects || isFetchingProjects}
              viewOnly={activeTab === 'registry'}
            />
            </div>
          )}
        </Card>

        {isSidePanelOpen && (
          <DashboardSidePanel
            activeTab={activeTab}
            canViewInbox={canViewInbox}
            incomingApps={incomingApps}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            setActiveTab={setActiveTab}
            assigneeFilter={assigneeFilter}
            setAssigneeFilter={setAssigneeFilter}
            taskFilter={taskFilter}
            setTaskFilter={setTaskFilter}
            counts={counts}
            isBranchManager={isBranchManager}
            isAdmin={isAdmin}
            isLoadingApps={isLoadingApps}
            onEmulateIncoming={onEmulateIncoming}
            onEmulateResubmission={onEmulateResubmission}
            registryFilter={registryFilter}
            setRegistryFilter={setRegistryFilter}
          />
        )}
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

export default React.memo(ApplicationsDashboard);
