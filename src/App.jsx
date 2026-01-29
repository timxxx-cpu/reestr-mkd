import React, { useState, useEffect, useRef, useContext, createContext } from 'react';
import { Loader2, User, FolderOpen, KeyRound, LogOut, Shield, Users, X, Settings, Eye } from 'lucide-react';
import { Routes, Route, useNavigate, useParams, Navigate, useSearchParams } from 'react-router-dom';

import { AuthService } from './lib/auth-service';
import { ToastProvider, useToast } from './context/ToastContext'; 
import { ProjectProvider, useProject } from './context/ProjectContext';
import { STEPS_CONFIG, ROLES, WORKFLOW_STAGES } from './lib/constants';
import { getStepStage } from './lib/workflow-utils';

import { useProjects } from './hooks/useProjects';

import Sidebar from './components/Sidebar';
import StepIndicator from './components/StepIndicator';
import Breadcrumbs from './components/ui/Breadcrumbs';
import { ReadOnlyProvider } from './components/ui/UIKit'; 
import WorkflowBar from './components/WorkflowBar'; 

import PassportEditor from './components/editors/PassportEditor';
import CompositionEditor from './components/editors/CompositionEditor';
import BuildingSelector from './components/editors/BuildingSelector';
import BuildingConfigurator from './components/editors/BuildingConfigurator';
import ParkingConfigurator from './components/editors/ParkingConfigurator';
import FloorMatrixEditor from './components/editors/FloorMatrixEditor';
import EntranceMatrixEditor from './components/editors/EntranceMatrixEditor';
import MopEditor from './components/editors/MopEditor';
import FlatMatrixEditor from './components/editors/FlatMatrixEditor';
import UnitRegistry from './components/editors/UnitRegistry'; 
import SummaryDashboard from './components/editors/SummaryDashboard';
import RegistryView from './components/editors/RegistryView'; 
import ApplicationsDashboard from './components/ApplicationsDashboard';

const DB_SCOPE = 'shared_dev_env'; 

const PersonaContext = createContext(null);

const TEST_USERS = [
    { id: 'timur_admin', name: 'Тимур', role: ROLES.ADMIN, group: 'Тимур' },
    { id: 'timur_contr', name: 'Тимур', role: ROLES.CONTROLLER, group: 'Тимур' },
    { id: 'timur_tech',  name: 'Тимур', role: ROLES.TECHNICIAN, group: 'Тимур' },

    { id: 'abdu_admin', name: 'Абдурашид', role: ROLES.ADMIN, group: 'Абдурашид' },
    { id: 'abdu_contr', name: 'Абдурашид', role: ROLES.CONTROLLER, group: 'Абдурашид' },
    { id: 'abdu_tech',  name: 'Абдурашид', role: ROLES.TECHNICIAN, group: 'Абдурашид' },

    { id: 'vakhit_admin', name: 'Вахит', role: ROLES.ADMIN, group: 'Вахит' },
    { id: 'vakhit_contr', name: 'Вахит', role: ROLES.CONTROLLER, group: 'Вахит' },
    { id: 'vakhit_tech',  name: 'Вахит', role: ROLES.TECHNICIAN, group: 'Вахит' },

    { id: 'abbos_admin', name: 'Аббос', role: ROLES.ADMIN, group: 'Аббос' },
    { id: 'abbos_contr', name: 'Аббос', role: ROLES.CONTROLLER, group: 'Аббос' },
    { id: 'abbos_tech',  name: 'Аббос', role: ROLES.TECHNICIAN, group: 'Аббос' },
];

const DevRoleSwitcher = () => {
    const { activePersona, setActivePersona } = useContext(PersonaContext);
    const [isOpen, setIsOpen] = useState(false);

    const groups = TEST_USERS.reduce((acc, user) => {
        if (!acc[user.group]) acc[user.group] = [];
        acc[user.group].push(user);
        return acc;
    }, {});

    if (!activePersona) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
            <div className={`
                bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl p-4 mb-4 w-72 pointer-events-auto
                transition-all duration-300 origin-bottom-right
                ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-10 invisible'}
            `}>
                <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-700">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Settings size={14} /> Тестовые роли
                    </h3>
                    <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white">
                        <X size={16} />
                    </button>
                </div>
                
                <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                    {Object.entries(groups).map(([groupName, users]) => (
                        <div key={groupName}>
                            <div className="text-[10px] font-bold text-slate-500 mb-1.5 ml-1">{groupName}</div>
                            <div className="grid grid-cols-3 gap-1">
                                {users.map(user => {
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
                    ))}
                </div>
            </div>

            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-12 h-12 rounded-full shadow-xl flex items-center justify-center transition-all pointer-events-auto
                    ${isOpen ? 'bg-slate-700 text-white rotate-90' : 'bg-slate-900 text-blue-400 hover:bg-blue-600 hover:text-white hover:scale-110'}
                `}
                title="Сменить пользователя"
            >
                <Users size={20} />
            </button>
        </div>
    );
};


function LoginScreen({ onLogin, isLoading }) {
    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
                <div className="space-y-2">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-600/30">
                        <span className="text-3xl font-black text-white">Р</span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                        Реестр <span className="text-blue-600">Многоквартирных домов</span>
                    </h1>
                    <p className="text-slate-500 text-sm">Система обработки заявлений и инвентаризации</p>
                </div>

                <div className="space-y-4">
                    <button 
                        onClick={onLogin} 
                        disabled={isLoading}
                        className="w-full py-3.5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={20}/> : <KeyRound size={20}/>}
                        {isLoading ? 'Вход в систему...' : 'Войти в систему'}
                    </button>
                    <p className="text-xs text-slate-400">Доступ для сотрудников</p>
                </div>
            </div>
        </div>
    );
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error) { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <div className="p-8 text-center text-red-500">Ошибка UI <button onClick={this.props.onReset} className="ml-2 underline">Сброс</button></div>;
    return this.props.children; 
  }
}

function ProjectEditorRoute({ user }) {
    const { projectId } = useParams();
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
    
    const toast = useToast();
    const initialRedirectDone = useRef(false);
  
    // 1. Инициализация: Переход на актуальный шаг задачи
    useEffect(() => {
        // Если режим просмотра - не редиректим принудительно
        if (!isViewMode && applicationInfo?.currentStepIndex !== undefined && !initialRedirectDone.current) {
            const targetStep = applicationInfo.currentStepIndex;
            // Если индекс выходит за границы (проект завершен), ставим последний доступный
            const safeStep = Math.min(targetStep, STEPS_CONFIG.length - 1);
            setCurrentStep(safeStep);
            initialRedirectDone.current = true;
        }
    }, [applicationInfo, isViewMode]);

    // 2. Логика блокировки "чужих" шагов
    const isTechnician = user.role === ROLES.TECHNICIAN;
    const taskIndex = applicationInfo?.currentStepIndex || 0;
    const isCurrentTask = currentStep === taskIndex;
    
    // Блокируем, если глобальный ReadOnly или если техник ушел со своей задачи, ИЛИ включен режим просмотра
    const effectiveReadOnly = isReadOnly || isViewMode || (isTechnician && !isCurrentTask);

    // Максимально доступный шаг для навигации
    // В режиме просмотра доступны ВСЕ шаги. В режиме задачи - только до текущего.
    const maxAllowedStep = isViewMode ? STEPS_CONFIG.length - 1 : (isTechnician ? taskIndex : STEPS_CONFIG.length - 1);

    const canGoToStep = (stepIdx) => {
        if (stepIdx > maxAllowedStep) {
            toast.error(`Этот шаг еще не доступен. Завершите текущую задачу.`);
            return false;
        }
        return true;
    };

    const handleBackToDashboard = () => { 
        if (hasUnsavedChanges) {
            if (!window.confirm("Есть несохраненные изменения! Выйти без сохранения?")) return;
            setHasUnsavedChanges(false);
        }
        navigate('/'); 
    };

    const onStepChange = (idx) => { 
        if (hasUnsavedChanges) {
            if (!window.confirm("Есть несохраненные изменения! При переходе они пропадут. Продолжить?")) return;
            setHasUnsavedChanges(false);
        }

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
        case 'parking_config': return <ParkingConfigurator buildingId={null} />; // Кнопка onSave убрана, т.к. есть WorkflowBar
        
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
            <main className={`flex-1 flex flex-col h-full relative transition-all duration-300 ${sidebarOpen ? 'ml-72' : 'ml-20'}`}>
                
                {/* ПАНЕЛЬ ЗАДАЧИ: Скрываем в режиме просмотра */}
                {!isViewMode && (
                    <WorkflowBar 
                        user={user} 
                        currentStep={currentStep} 
                        setCurrentStep={setCurrentStep}
                        onExit={handleBackToDashboard} 
                    />
                )}

                {/* Баннер режима просмотра */}
                {isViewMode && (
                    <div className="bg-blue-50 border-b border-blue-100 px-8 py-2 flex justify-between items-center text-xs text-blue-700 font-bold sticky top-0 z-30 animate-in slide-in-from-top-2">
                        <div className="flex items-center gap-2">
                            <Eye size={14}/> Режим просмотра
                        </div>
                        <button onClick={handleBackToDashboard} className="hover:underline opacity-80">Закрыть</button>
                    </div>
                )}
                
                <DevRoleSwitcher />

                <div className="px-8 pt-6 pb-2">
                    <Breadcrumbs 
                        projectName={complexInfo?.name || "Загрузка..."} 
                        stepTitle={stepConfig?.title} 
                        buildingName={editingBuildingId ? composition?.find(b => b.id === editingBuildingId)?.label : null} 
                        onBackToStep={() => setEditingBuildingId(null)}
                    />
                </div>
                <div className="flex-1 overflow-y-auto px-8 pb-6 scroll-smooth custom-scrollbar">
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

const MainLayout = ({ firebaseUser, activePersona }) => { 
    const navigate = useNavigate();
    const { projects, isLoading } = useProjects(DB_SCOPE);

    const handleLogout = async () => {
        await AuthService.logout();
    };

    if (isLoading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="animate-spin text-slate-400"/></div>;

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center sticky top-0 z-50 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white"><FolderOpen size={20} /></div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-800 leading-none">Реестр МКД</h1>
                        <span className="text-xs text-slate-400 font-normal">{DB_SCOPE}</span>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full border border-slate-200">
                        <User size={14} className="text-slate-500"/>
                        <span className="text-xs font-bold text-slate-700">{activePersona.name}</span>
                        <span className="text-[10px] text-slate-400 font-medium px-1.5 py-0.5 bg-white rounded border border-slate-200 ml-1">
                            {activePersona.role === ROLES.ADMIN ? 'ADM' : activePersona.role === ROLES.CONTROLLER ? 'CTRL' : 'TECH'}
                        </span>
                    </div>

                    <div className="h-6 w-px bg-slate-200"></div>

                    <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Выйти">
                        <LogOut size={20}/>
                    </button>
                </div>
            </div>
            
            <ApplicationsDashboard 
                user={activePersona} 
                projects={projects} 
                dbScope={DB_SCOPE}
                onSelectProject={(id, mode) => navigate(`/project/${id}${mode === 'view' ? '?mode=view' : ''}`)}
            />
            
            <DevRoleSwitcher />
        </div>
    );
};

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [activePersona, setActivePersona] = useState(TEST_USERS[0]);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = AuthService.subscribe((u) => { 
        setFirebaseUser(u); 
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
      setIsAuthLoading(true);
      try {
          await AuthService.signInDemo();
      } catch (error) {
          console.error("Login failed", error);
      } finally {
          setIsAuthLoading(false);
      }
  };

  if (!firebaseUser) {
      return <LoginScreen onLogin={handleLogin} isLoading={isAuthLoading} />;
  }

  return (
    <PersonaContext.Provider value={{ activePersona, setActivePersona }}>
        <ToastProvider>
            <Routes>
                <Route path="/" element={<MainLayout firebaseUser={firebaseUser} activePersona={activePersona} />} />
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