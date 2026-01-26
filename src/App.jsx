import React, { useState, useEffect } from 'react';
import { Loader2, User, FolderOpen, Plus, KeyRound, LogOut } from 'lucide-react';
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';

// Services & Context
import { AuthService } from './lib/auth-service';
import { ToastProvider, useToast } from './context/ToastContext'; 
import { ProjectProvider, useProject } from './context/ProjectContext';
import { STEPS_CONFIG } from './lib/constants';

// Hooks
import { useProjects } from './hooks/useProjects';

// UI & Editors
import Sidebar from './components/Sidebar';
import StepIndicator from './components/StepIndicator';
import Breadcrumbs from './components/ui/Breadcrumbs';
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
import ProjectsDashboard from './components/ProjectsDashboard';

const DB_SCOPE = 'shared_dev_env'; 
const TEST_USERS = [
    { id: 'u1', name: 'Тимур', role: 'admin' },
    { id: 'u2', name: 'Абдурашид', role: 'manager' },
    { id: 'u3', name: 'Вахит', role: 'architect' },
    { id: 'u4', name: 'Аббос', role: 'editor' },
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
                    <p className="text-slate-500 text-sm">Система управления проектной документацией и ТЭП</p>
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

function ProjectEditorRoute() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [editingBuildingId, setEditingBuildingId] = useState(null);
    const { complexInfo, composition, saveData } = useProject();
  
    const handleNext = () => { setEditingBuildingId(null); saveData(); setCurrentStep(prev => Math.min(prev + 1, (STEPS_CONFIG?.length || 1) - 1)); };
    const handlePrev = () => { setEditingBuildingId(null); saveData(); setCurrentStep(prev => Math.max(prev - 1, 0)); };
    const onStepChange = (idx) => { setEditingBuildingId(null); saveData(); setCurrentStep(idx); };
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
        
        // --- ОБНОВЛЕННАЯ ЛОГИКА ДЛЯ 3-х РЕЕСТРОВ ---
        case 'registry_apartments': return <UnitRegistry mode="apartments" />;
        case 'registry_commercial': return <UnitRegistry mode="commercial" />;
        case 'registry_parking': return <UnitRegistry mode="parking" />;
        // ---------------------------------------------

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
      <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
        <Sidebar currentStep={currentStep} onStepChange={onStepChange} isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} onBackToDashboard={handleBackToDashboard} />
        <main className={`flex-1 flex flex-col h-full relative transition-all duration-300 ${sidebarOpen ? 'ml-72' : 'ml-20'}`}>
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
    );
}

const ProjectProviderWrapper = ({ children, firebaseUser, dbScope }) => {
    const { projectId } = useParams();
    return (
        <ProjectProvider key={projectId} projectId={projectId} user={firebaseUser} customScope={dbScope}>
            <ErrorBoundary onReset={() => window.location.href = '/'}>{children}</ErrorBoundary>
        </ProjectProvider>
    );
};

const MainLayout = ({ firebaseUser, activePersona, setActivePersona }) => {
    const navigate = useNavigate();
    const toast = useToast();
    
    const { projects, isLoading, createProject, deleteProject, isCreating } = useProjects(DB_SCOPE);

    const handleCreate = async () => {
        try {
            const newId = crypto.randomUUID();
            const newProjectMeta = { 
                id: newId, 
                name: 'Новый проект', 
                status: 'Проектный', 
                lastModified: new Date().toISOString(),
                author: activePersona.name
            };
            const initialContent = { 
                complexInfo: { name: 'Новый проект', status: 'Проектный' }, 
                composition: [] 
            };
            
            await createProject({ meta: newProjectMeta, content: initialContent });
            toast.success("Проект создан!");
            navigate(`/project/${newId}`);
        } catch (e) {
            console.error(e);
            toast.error("Ошибка создания");
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Удалить проект навсегда?')) return;
        try {
            await deleteProject(id);
            toast.success("Проект удален");
        } catch (e) {
             console.error(e);
             toast.error("Ошибка удаления");
        }
    };

    const handleLogout = async () => {
        await AuthService.logout();
    };

    if (isLoading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="animate-spin text-slate-400"/></div>;

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
                <div className="flex items-center gap-4"><div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white"><FolderOpen size={20} /></div><h1 className="text-lg font-bold text-slate-800">Реестр МКД <span className="text-xs text-slate-400 font-normal ml-2">{DB_SCOPE}</span></h1></div>
                <div className="flex gap-3">
                    <div className="flex bg-slate-100 rounded-full p-1">{TEST_USERS.map(user => (<button key={user.id} onClick={() => setActivePersona(user)} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${activePersona.id === user.id ? 'bg-white shadow-sm' : 'text-slate-500'}`}><User size={12} className="inline mr-1"/> {user.name}</button>))}</div>
                    <button onClick={handleCreate} disabled={isCreating} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase shadow-lg hover:bg-blue-500"><Plus size={14}/> Новый</button>
                    <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg ml-2" title="Выйти"><LogOut size={20}/></button>
                </div>
            </div>
            <div className="p-8"><ProjectsDashboard projects={projects} onSelect={(id) => navigate(`/project/${id}`)} onCreate={handleCreate} onDelete={handleDelete}/></div>
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
            <Route path="/project/:projectId" element={<ProjectProviderWrapper firebaseUser={firebaseUser} dbScope={DB_SCOPE}><ProjectEditorRoute /></ProjectProviderWrapper>} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    </ToastProvider>
  );
}