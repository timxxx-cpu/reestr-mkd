import React, { useState, useEffect, useRef } from 'react';
import { Loader2, User, FolderOpen, KeyRound, LogOut, Shield } from 'lucide-react';
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';

import { AuthService } from './lib/auth-service';
import { ToastProvider, useToast } from './context/ToastContext'; 
import { ProjectProvider, useProject } from './context/ProjectContext';
import { STEPS_CONFIG, ROLES, WORKFLOW_STAGES } from './lib/constants';

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

// --- СПИСОК ПОЛЬЗОВАТЕЛЕЙ (4 x 3) ---
const TEST_USERS = [
    { id: 'timur_admin', name: 'Тимур (Адм)', role: ROLES.ADMIN },
    { id: 'timur_contr', name: 'Тимур (Бриг)', role: ROLES.CONTROLLER },
    { id: 'timur_tech',  name: 'Тимур (Тех)', role: ROLES.TECHNICIAN },

    { id: 'abdu_admin', name: 'Абдурашид (Адм)', role: ROLES.ADMIN },
    { id: 'abdu_contr', name: 'Абдурашид (Бриг)', role: ROLES.CONTROLLER },
    { id: 'abdu_tech',  name: 'Абдурашид (Тех)', role: ROLES.TECHNICIAN },

    { id: 'vakhit_admin', name: 'Вахит (Адм)', role: ROLES.ADMIN },
    { id: 'vakhit_contr', name: 'Вахит (Бриг)', role: ROLES.CONTROLLER },
    { id: 'vakhit_tech',  name: 'Вахит (Тех)', role: ROLES.TECHNICIAN },

    { id: 'abbos_admin', name: 'Аббос (Адм)', role: ROLES.ADMIN },
    { id: 'abbos_contr', name: 'Аббос (Бриг)', role: ROLES.CONTROLLER },
    { id: 'abbos_tech',  name: 'Аббос (Тех)', role: ROLES.TECHNICIAN },
];

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
                    <p className="text-xs text-slate-400">Доступ для сотрудников (БТИ)</p>
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
    const { complexInfo, composition, saveData, isReadOnly, applicationInfo } = useProject();
    const toast = useToast();
    const initialRedirectDone = useRef(false);
  
    const currentStage = applicationInfo?.currentStage || 1;
    
    // --- АВТО-ПЕРЕХОД НА ТЕКУЩИЙ ЭТАП ---
    useEffect(() => {
        if (applicationInfo?.currentStage && !initialRedirectDone.current) {
            const stage = applicationInfo.currentStage;
            if (stage > 1) {
                const prevStageConfig = WORKFLOW_STAGES[stage - 1];
                if (prevStageConfig) {
                    const startStep = prevStageConfig.lastStepIndex + 1;
                    if (startStep < STEPS_CONFIG.length) {
                        setCurrentStep(startStep);
                    }
                }
            }
            initialRedirectDone.current = true;
        }
    }, [applicationInfo]);

    // --- ЛОГИКА БЛОКИРОВКИ ПРОШЛЫХ ШАГОВ ---
    const getStepStage = (stepIdx) => {
        for (const [stageNum, config] of Object.entries(WORKFLOW_STAGES)) {
            if (stepIdx <= config.lastStepIndex) return parseInt(stageNum);
        }
        return 4; 
    };

    const stepStage = getStepStage(currentStep);
    const isStepLocked = user.role === ROLES.TECHNICIAN && stepStage < currentStage;
    const effectiveReadOnly = isReadOnly || isStepLocked;

    // --- ЛОГИКА ОГРАНИЧЕНИЯ НАВИГАЦИИ (ВПЕРЕД) ---
    // Вычисляем максимально доступный шаг для текущей роли
    let maxAllowedStep = STEPS_CONFIG.length - 1; // По умолчанию все доступно

    if (user.role === ROLES.TECHNICIAN) {
        // Для техника ограничено текущим этапом
        maxAllowedStep = WORKFLOW_STAGES[currentStage]?.lastStepIndex ?? 0;
    } 
    // Для Админа и Бригадира - ограничений нет (они видят все шаги)

    const canGoToStep = (stepIdx) => {
        if (stepIdx > maxAllowedStep) {
            toast.error(`Этап ${currentStage} не завершен. Доступ закрыт до утверждения.`);
            return false;
        }
        return true;
    };

    const handleNext = () => { 
        const nextStep = currentStep + 1;
        if (nextStep >= STEPS_CONFIG.length) return;

        if (canGoToStep(nextStep)) {
            setEditingBuildingId(null); 
            saveData(); 
            setCurrentStep(nextStep);
        }
    };

    const handlePrev = () => { 
        setEditingBuildingId(null); 
        saveData(); 
        setCurrentStep(prev => Math.max(prev - 1, 0)); 
    };

    const onStepChange = (idx) => { 
        if (canGoToStep(idx)) {
            setEditingBuildingId(null); 
            saveData(); 
            setCurrentStep(idx);
        }
    };

    const handleBackToDashboard = () => { saveData(); navigate('/'); };
  
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
        case 'parking_config': return <ParkingConfigurator onSave={handleNext} buildingId={null} />;
        
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
                maxAllowedStep={maxAllowedStep} // Передаем лимит в Sidebar
            />
            <main className={`flex-1 flex flex-col h-full relative transition-all duration-300 ${sidebarOpen ? 'ml-72' : 'ml-20'}`}>
                
                <WorkflowBar user={user} currentStep={currentStep} />

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
                {!editingBuildingId && (
                    <footer className="bg-white border-t border-slate-200 px-8 py-5 flex justify-between items-center shadow-sm z-20">
                        <button onClick={handlePrev} disabled={currentStep === 0} className="px-6 py-2.5 rounded-xl text-xs font-bold uppercase text-slate-600 hover:bg-slate-50 disabled:opacity-50">Назад</button>
                        <div className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.3em]">Шаг {currentStep + 1} / {STEPS_CONFIG?.length}</div>
                        <button onClick={handleNext} disabled={currentStep === (STEPS_CONFIG?.length || 1) - 1} className="px-8 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase shadow-lg hover:bg-black transition-all">Далее</button>
                    </footer>
                )}
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

const MainLayout = ({ firebaseUser, activePersona, setActivePersona }) => {
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
                    <div className="flex bg-slate-100 rounded-full p-1 border border-slate-200 overflow-x-auto max-w-[500px] no-scrollbar">
                        {TEST_USERS.map(user => {
                            const isSelected = activePersona.id === user.id;
                            const displayName = user.name.split(' ')[0]; 
                            return (
                                <button 
                                    key={user.id} 
                                    onClick={() => setActivePersona(user)} 
                                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${isSelected ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {isSelected && <Shield size={10} className="text-blue-500"/>}
                                    {user.name}
                                </button>
                            );
                        })}
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
                onSelectProject={(id) => navigate(`/project/${id}`)}
            />
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
    <ToastProvider>
        <Routes>
            <Route path="/" element={<MainLayout firebaseUser={firebaseUser} activePersona={activePersona} setActivePersona={setActivePersona} />} />
            <Route path="/project/:projectId" element={
                <ProjectProviderWrapper firebaseUser={firebaseUser} dbScope={DB_SCOPE} activePersona={activePersona}>
                    <ProjectEditorRoute user={activePersona} />
                </ProjectProviderWrapper>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    </ToastProvider>
  );
}