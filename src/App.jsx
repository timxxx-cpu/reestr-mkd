import React, { useState, useEffect, useRef, useContext, createContext } from 'react';
import { Loader2, User, FolderOpen, KeyRound, LogOut, Shield, Users, X, Settings, Eye, History } from 'lucide-react';
import { Routes, Route, useNavigate, useParams, Navigate, useSearchParams, useLocation } from 'react-router-dom';

import { AuthService } from './lib/auth-service';
import { ApiService } from './lib/api-service';
import { ToastProvider, useToast } from './context/ToastContext'; 
import { ProjectProvider, useProject } from './context/ProjectContext';
import { STEPS_CONFIG, ROLES, WORKFLOW_STAGES } from './lib/constants';

import { useProjects } from './hooks/useProjects';

import Sidebar from './components/Sidebar';
import StepIndicator from './components/StepIndicator';
import Breadcrumbs from './components/ui/Breadcrumbs';
import { ReadOnlyProvider } from './components/ui/UIKit'; 
import WorkflowBar from './components/WorkflowBar'; 
import HistoryModal from './components/HistoryModal'; 

import PassportEditor from './components/editors/PassportEditor';
import CompositionEditor from './components/editors/CompositionEditor';
import BuildingSelector from './components/editors/BuildingSelector';
import BuildingConfigurator from './components/editors/configurator';
import ParkingConfigurator from './components/editors/ParkingConfigurator';
import FloorMatrixEditor from './components/editors/FloorMatrixEditor';
import EntranceMatrixEditor from './components/editors/EntranceMatrixEditor';
import MopEditor from './components/editors/MopEditor';
import FlatMatrixEditor from './components/editors/FlatMatrixEditor';

// [UPDATED] Импорт из новой директории
import UnitRegistry from './components/editors/registry/UnitRegistry'; 

import SummaryDashboard from './components/editors/SummaryDashboard';
import RegistryView from './components/editors/RegistryView'; 
import ApplicationsDashboard from './components/ApplicationsDashboard';
import CatalogsAdminPanel from './components/admin/CatalogsAdminPanel';
import IntegrationBuildings from './components/editors/IntegrationBuildings';
import IntegrationUnits from './components/editors/IntegrationUnits'; 

const DB_SCOPE = 'shared_dev_env'; 

const PersonaContext = createContext(null);

const DevRoleSwitcher = ({ disabled }) => {
    const { activePersona, setActivePersona, availablePersonas } = useContext(PersonaContext);
    const [isOpen, setIsOpen] = useState(false);

    const roleVariants = (availablePersonas || []).filter(u =>
        u.group === activePersona.group || u.name === activePersona.name
    );

    if (!activePersona) return null;

    return (
        <div className="fixed top-20 right-6 z-50 flex flex-col items-end pointer-events-none">
            {!disabled && (
                <div className={`
                    bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl p-4 mb-4 w-72 pointer-events-auto
                    transition-all duration-300 origin-bottom-right
                    ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-10 invisible'}
                `}>
                    <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-700">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <Settings size={14} /> Роль пользователя
                        </h3>
                        <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white">
                            <X size={16} />
                        </button>
                    </div>
                    
                    <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                        <div className="text-[10px] font-bold text-slate-500 mb-1.5 ml-1">{activePersona.group || activePersona.name}</div>
                        <div className="grid grid-cols-3 gap-1">
                                    {roleVariants.map(user => {
                                        const isActive = activePersona.id === user.id;
                                        let roleLabel = 'Тех';
                                        let roleColor = 'text-blue-400 bg-blue-400/10 border-blue-400/20';
                                        
                                        if (user.role === ROLES.ADMIN) { 
                                            roleLabel = 'Адм'; 
                                            roleColor = 'text-purple-400 bg-purple-400/10 border-purple-400/20';
                                        }
                                        if (user.role === ROLES.CONTROLLER) { 
                                            roleLabel = 'Бриг'; 
                                            roleColor = 'text-orange-400 bg-orange-400/10 border-orange-400/20';
                                        }

                                        return (
                                            <button
                                                key={user.id}
                                                onClick={() => { setActivePersona(user); setIsOpen(false); }}
                                                className={`
                                                    px-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all
                                                    ${isActive 
                                                        ? 'bg-slate-100 border-slate-100 text-slate-900 shadow-sm' 
                                                        : `${roleColor} hover:bg-slate-800`
                                                    }
                                                `}
                                            >
                                                {roleLabel}
                                            </button>
                                        );
                                    })}
                        </div>
                    </div>
                </div>
            )}

            <button 
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`
                    w-12 h-12 rounded-full shadow-xl flex items-center justify-center transition-all pointer-events-auto
                    ${disabled 
                        ? 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50 grayscale' 
                        : (isOpen ? 'bg-slate-700 text-white rotate-90' : 'bg-slate-900 text-blue-400 hover:bg-blue-600 hover:text-white hover:scale-110')
                    }
                `}
                title={disabled ? "Смена роли недоступна внутри задачи" : "Сменить роль"}
            >
                <Users size={20} />
            </button>
        </div>
    );
};


function LoginScreen({ onLogin, isLoading, users = [], usersLoading }) {
    const [selectedUserId, setSelectedUserId] = useState('');

    useEffect(() => {
        if (!selectedUserId && users.length > 0) {
            setSelectedUserId(users[0].id);
        }
    }, [users, selectedUserId]);

    const selectedUser = users.find(u => u.id === selectedUserId) || null;

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
                <div className="space-y-2">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-600/30">
                        <span className="text-3xl font-black text-white">Р</span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                        Реестр <span className="text-blue-600">Многоквартирных домов</span>
                    </h1>
                    <p className="text-slate-500 text-sm">Система обработки заявлений и инвентаризации</p>
                </div>

                <div className="space-y-4 text-left">
                    <label className="text-xs font-bold uppercase text-slate-500">Пользователь</label>
                    <select
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        disabled={usersLoading || isLoading || users.length === 0}
                        className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-blue-500"
                    >
                        {users.map(u => (
                            <option key={u.id} value={u.id}>{u.name} — {u.role}</option>
                        ))}
                    </select>

                    <button
                        onClick={() => selectedUser && onLogin(selectedUser)}
                        disabled={isLoading || usersLoading || !selectedUser}
                        className="w-full py-3.5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={20}/> : <KeyRound size={20}/>}
                        {isLoading ? 'Вход в систему...' : 'Войти'}
                    </button>
                    <p className="text-xs text-slate-400 text-center">
                        {usersLoading ? 'Загрузка пользователей...' : 'Выберите пользователя из справочника'}
                    </p>
                </div>
            </div>
        </div>
    );
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(_error) { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <div className="p-8 text-center text-red-500">Ошибка UI <button onClick={this.props.onReset} className="ml-2 underline">Сброс</button></div>;
    return this.props.children; 
  }
}

function ProjectEditorRoute({ user }) {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [editingBuildingId, setEditingBuildingId] = useState(null);
    const { 
        complexInfo, 
        composition, 
        isReadOnly, 
        applicationInfo, 
        hasUnsavedChanges, 
        setHasUnsavedChanges 
    } = useProject();
    
    const [searchParams] = useSearchParams();
    const isViewMode = searchParams.get('mode') === 'view';
    
    const [historyOpen, setHistoryOpen] = useState(false); 

    const toast = useToast();
    const initialRedirectDone = useRef(false);
  
    useEffect(() => {
        if (!isViewMode && applicationInfo?.currentStepIndex !== undefined && !initialRedirectDone.current) {
            const targetStep = applicationInfo.currentStepIndex;
            const safeStep = Math.min(targetStep, STEPS_CONFIG.length - 1);
            setCurrentStep(safeStep);
            initialRedirectDone.current = true;
        }
    }, [applicationInfo, isViewMode]);

    const isTechnician = user.role === ROLES.TECHNICIAN;
    const taskIndex = applicationInfo?.currentStepIndex || 0;
    const isCurrentTask = currentStep === taskIndex;
    
    const effectiveReadOnly = isReadOnly || isViewMode || (isTechnician && !isCurrentTask);
    const maxAllowedStep = isViewMode ? STEPS_CONFIG.length - 1 : (isTechnician ? taskIndex : STEPS_CONFIG.length - 1);

    const canGoToStep = (stepIdx) => {
        if (stepIdx > maxAllowedStep) {
            toast.error(`Этот шаг еще не доступен. Завершите текущую задачу.`);
            return false;
        }
        return true;
    };

    const handleBackToDashboard = (force = false) => { 
        if (hasUnsavedChanges && !force) {
            if (!window.confirm("Есть несохраненные изменения! Выйти без сохранения?")) return;
            setHasUnsavedChanges(false);
        }
        navigate('/', { state: { refreshDashboardAt: Date.now() } }); 
    };

    const onStepChange = (idx) => { 
        if (canGoToStep(idx)) {
            setEditingBuildingId(null); 
            setCurrentStep(idx);
        }
    };
  
    const stepConfig = STEPS_CONFIG?.[currentStep];
    const stepId = stepConfig?.id || 'unknown';
  
    const renderStepContent = () => {
      if (editingBuildingId) {
          if (stepId === 'registry_res') return <BuildingConfigurator buildingId={editingBuildingId} mode="res" onBack={() => setEditingBuildingId(null)} />;
          if (stepId === 'registry_nonres') return <BuildingConfigurator buildingId={editingBuildingId} mode="nonres" onBack={() => setEditingBuildingId(null)} />;
          if (stepId === 'floors') return <FloorMatrixEditor buildingId={editingBuildingId} onBack={() => setEditingBuildingId(null)} />;
          if (stepId === 'entrances') return <EntranceMatrixEditor buildingId={editingBuildingId} onBack={() => setEditingBuildingId(null)} />;
          if (stepId === 'mop') return <MopEditor buildingId={editingBuildingId} onBack={() => setEditingBuildingId(null)} />;
          if (stepId === 'apartments') return <FlatMatrixEditor buildingId={editingBuildingId} onBack={() => setEditingBuildingId(null)} />;
      }
      switch (stepId) {
        case 'passport': return <PassportEditor />;
        case 'composition': return <CompositionEditor />;
        case 'parking_config': return <ParkingConfigurator buildingId={null} />; 
        
        case 'registry_apartments': return <UnitRegistry mode="apartments" />;
        case 'registry_commercial': return <UnitRegistry mode="commercial" />;
        case 'registry_parking': return <UnitRegistry mode="parking" />;

        case 'summary': return <SummaryDashboard />;
        case 'registry_res_view': return <RegistryView mode="res" />;
        case 'registry_nonres_view': return <RegistryView mode="nonres" />;
        case 'registry_res': 
        case 'registry_nonres':
        case 'floors':
        case 'entrances':
        case 'mop':
        case 'apartments':
            return <BuildingSelector stepId={stepId} onSelect={setEditingBuildingId} />;
        
        case 'integration_buildings': return <IntegrationBuildings />;
        case 'integration_units': return <IntegrationUnits />;

        default: return <div className="p-8 text-center text-slate-400">Раздел в разработке</div>;
      }
    };
  
    return (
      <ReadOnlyProvider value={effectiveReadOnly}>
        <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
            <Sidebar 
                currentStep={currentStep} 
                onStepChange={onStepChange} 
                isOpen={sidebarOpen} 
                onToggle={() => setSidebarOpen(!sidebarOpen)} 
                onBackToDashboard={handleBackToDashboard} 
                maxAllowedStep={maxAllowedStep} 
            />
            <main className={`flex-1 flex flex-col h-full relative transition-all duration-300 overflow-x-hidden ${sidebarOpen ? 'ml-72' : 'ml-20'}`}>
                
                {!isViewMode && (
                    <WorkflowBar 
                        user={user} 
                        currentStep={currentStep} 
                        setCurrentStep={setCurrentStep}
                        onExit={handleBackToDashboard} 
                        onOpenHistory={() => setHistoryOpen(true)} 
                    />
                )}

                {isViewMode && (
                    <div className="bg-blue-50 border-b border-blue-100 px-8 py-2 flex justify-between items-center text-xs text-blue-700 font-bold sticky top-0 z-30 animate-in slide-in-from-top-2">
                        <div className="flex items-center gap-2">
                            <Eye size={14}/> Режим просмотра
                        </div>
                        <div className="flex items-center gap-4">
                            <button onClick={() => setHistoryOpen(true)} className="flex items-center gap-1 hover:text-blue-900 transition-colors">
                                <History size={14}/> История
                            </button>
                            <div className="w-px h-3 bg-blue-200"></div>
                            <button onClick={() => handleBackToDashboard(false)} className="hover:underline opacity-80">Закрыть</button>
                        </div>
                    </div>
                )}
                
                <DevRoleSwitcher disabled={true} />

                {historyOpen && <HistoryModal history={applicationInfo?.history || []} onClose={() => setHistoryOpen(false)} />}

                <div className="px-8 pt-6 pb-2">
                    <Breadcrumbs 
                        projectName={complexInfo?.name || "Загрузка..."} 
                        stepTitle={stepConfig?.title} 
                        buildingName={editingBuildingId ? composition?.find(b => b.id === editingBuildingId)?.label : null} 
                        onBackToStep={() => setEditingBuildingId(null)}
                    />
                </div>
                <div className="flex-1 overflow-y-auto pb-6 scroll-smooth custom-scrollbar">
                    {!editingBuildingId && <StepIndicator currentStep={currentStep} />}
                    <React.Suspense fallback={<Loader2 className="animate-spin text-blue-600"/>}>{renderStepContent()}</React.Suspense>
                </div>
            </main>
        </div>
      </ReadOnlyProvider>
    );
}

const ProjectProviderWrapper = ({ children, firebaseUser, dbScope, activePersona }) => {
    const { projectId } = useParams();
    return (
        <ProjectProvider key={projectId} projectId={projectId} user={firebaseUser} customScope={dbScope} userProfile={activePersona}>
            <ErrorBoundary onReset={() => window.location.href = '/'}>{children}</ErrorBoundary>
        </ProjectProvider>
    );
};

const MainLayout = ({ activePersona }) => { 
    const navigate = useNavigate();
    const location = useLocation();
    const { projects, isLoading, refetchProjects } = useProjects(DB_SCOPE);

    useEffect(() => {
        refetchProjects();
    }, [location.key, location.state, refetchProjects]);

    const handleLogout = async () => {
        await AuthService.logout();
    };

    if (isLoading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="animate-spin text-slate-400"/></div>;

    return (
        <div className="min-h-screen bg-slate-50">
            <ApplicationsDashboard 
                user={activePersona} 
                projects={projects} 
                dbScope={DB_SCOPE}
                onSelectProject={(id, mode) => navigate(`/project/${id}${mode === 'view' ? '?mode=view' : ''}`)}
                onLogout={handleLogout} 
                onOpenCatalogs={() => navigate('/admin/catalogs')}
            />
            
            <DevRoleSwitcher disabled={false} />
        </div>
    );
};

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [availablePersonas, setAvailablePersonas] = useState([]);

  const [activePersona, setActivePersona] = useState(() => {
      try {
          const saved = localStorage.getItem('dev_active_persona');
          if (saved) {
              return JSON.parse(saved);
          }
      } catch (e) {
          console.error("Ошибка чтения роли из storage", e);
      }
      return null;
  });

  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isUsersLoading, setIsUsersLoading] = useState(false);

  useEffect(() => {
      let mounted = true;
      const loadUsers = async () => {
          setIsUsersLoading(true);
          try {
              const users = await ApiService.getSystemUsers();
              if (!mounted) return;
              setAvailablePersonas(users);

              if (users.length > 0) {
                  setActivePersona(prev => prev || users[0]);
              }
          } catch (e) {
              console.error('Не удалось загрузить пользователей из БД', e);
              if (mounted) setAvailablePersonas([]);
          } finally {
              if (mounted) setIsUsersLoading(false);
          }
      };

      loadUsers();
      return () => { mounted = false; };
  }, []);

  useEffect(() => {
      if (!activePersona || availablePersonas.length === 0) return;
      const fresh = availablePersonas.find(u => u.id === activePersona.id);
      if (!fresh) return;

      const changed =
          fresh.name !== activePersona.name
          || fresh.role !== activePersona.role
          || fresh.group !== activePersona.group;

      if (changed) setActivePersona(fresh);
  }, [availablePersonas, activePersona]);

  useEffect(() => {
      if (activePersona) {
          localStorage.setItem('dev_active_persona', JSON.stringify(activePersona));
      }
  }, [activePersona]);

  useEffect(() => {
    const unsubscribe = AuthService.subscribe((u) => { 
        setFirebaseUser(u); 
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (selectedPersona) => {
      if (!selectedPersona) return;
      setIsAuthLoading(true);
      try {
          await AuthService.signInDemo(selectedPersona);
          setActivePersona(selectedPersona);
      } catch (error) {
          console.error("Login failed", error);
      } finally {
          setIsAuthLoading(false);
      }
  };

  if (!firebaseUser) {
      return <LoginScreen onLogin={handleLogin} isLoading={isAuthLoading} users={availablePersonas} usersLoading={isUsersLoading} />;
  }

  if (!activePersona) {
      return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="animate-spin text-slate-400"/></div>;
  }

  return (
    <PersonaContext.Provider value={{ activePersona, setActivePersona, availablePersonas }}>
        <ToastProvider>
            <Routes>
                <Route path="/" element={<MainLayout activePersona={activePersona} />} />
                <Route path="/admin/catalogs" element={<CatalogsAdminPanel />} />
                <Route path="/project/:projectId" element={
                    <ProjectProviderWrapper firebaseUser={firebaseUser} dbScope={DB_SCOPE} activePersona={activePersona}>
                        <ProjectEditorRoute user={activePersona} />
                    </ProjectProviderWrapper>
                } />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </ToastProvider>
    </PersonaContext.Provider>
  );
}
