import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { auth, db, APP_ID } from './lib/firebase';

// Контексты
import { ToastProvider } from './context/ToastContext';
import { ProjectProvider, useProject } from './context/ProjectContext';
import { STEPS_CONFIG } from './lib/constants';

// UI
import Sidebar from './components/Sidebar';
import StepIndicator from './components/StepIndicator';
import ProjectsDashboard from './components/ProjectsDashboard';
import Breadcrumbs from './components/ui/Breadcrumbs';

// Редакторы
import PassportEditor from './components/editors/PassportEditor';
import CompositionEditor from './components/editors/CompositionEditor';
import BuildingSelector from './components/editors/BuildingSelector';
import BuildingConfigurator from './components/editors/BuildingConfigurator';
import ParkingConfigurator from './components/editors/ParkingConfigurator';
import FloorMatrixEditor from './components/editors/FloorMatrixEditor';
import EntranceMatrixEditor from './components/editors/EntranceMatrixEditor';
import MopEditor from './components/editors/MopEditor';
import FlatMatrixEditor from './components/editors/FlatMatrixEditor';
import SummaryDashboard from './components/editors/SummaryDashboard';

// Заглушка для пока не созданных разделов
const PlaceholderEditor = ({ title }) => (
  <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl m-8 min-h-[400px]">
    <h3 className="text-xl font-bold text-slate-400 mb-2">Раздел "{title}"</h3>
    <p className="text-slate-500">Компонент в разработке.</p>
  </div>
);

// --- Внутренний лейаут редактора ---
function ProjectEditorLayout({ onBack }) {
    const [currentStep, setCurrentStep] = useState(0);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [editingBuildingId, setEditingBuildingId] = useState(null);
  
    const { complexInfo, composition } = useProject();
  
    const handleNext = () => {
        setEditingBuildingId(null);
        setCurrentStep(prev => Math.min(prev + 1, STEPS_CONFIG.length - 1));
    };
    const handlePrev = () => {
        setEditingBuildingId(null);
        setCurrentStep(prev => Math.max(prev - 1, 0));
    };
    const onStepChange = (idx) => {
        setEditingBuildingId(null);
        setCurrentStep(idx);
    };
  
    const editingBuildingName = editingBuildingId 
      ? composition.find(b => b.id === editingBuildingId)?.label 
      : null;
  
    // Безопасное получение ID шага
    const stepConfig = STEPS_CONFIG[currentStep];
    const stepId = stepConfig ? stepConfig.id : 'unknown';
  
    const renderStepContent = () => {
      // Если выбрано здание - показываем его редактор
      if (editingBuildingId) {
          if (stepId === 'registry_res') return <BuildingConfigurator buildingId={editingBuildingId} mode="res" onBack={() => setEditingBuildingId(null)} />;
          if (stepId === 'registry_nonres') return <BuildingConfigurator buildingId={editingBuildingId} mode="nonres" onBack={() => setEditingBuildingId(null)} />;
          if (stepId === 'floors') return <FloorMatrixEditor buildingId={editingBuildingId} onBack={() => setEditingBuildingId(null)} />;
          if (stepId === 'entrances') return <EntranceMatrixEditor buildingId={editingBuildingId} onBack={() => setEditingBuildingId(null)} />;
          if (stepId === 'mop') return <MopEditor buildingId={editingBuildingId} onBack={() => setEditingBuildingId(null)} />;
          if (stepId === 'apartments') return <FlatMatrixEditor buildingId={editingBuildingId} onBack={() => setEditingBuildingId(null)} />;
      }
  
      // Иначе показываем общий редактор шага
      switch (stepId) {
        case 'passport': return <PassportEditor />;
        case 'composition': return <CompositionEditor />;
        case 'parking_config': return <ParkingConfigurator onSave={handleNext} />;
        case 'summary': return <SummaryDashboard />;
        
        // Шаги выбора здания
        case 'registry_res': 
        case 'registry_nonres':
        case 'floors':
        case 'entrances':
        case 'mop':
        case 'apartments':
            return <BuildingSelector stepId={stepId} onSelect={setEditingBuildingId} />;
            
        default: return <PlaceholderEditor title={stepConfig?.title || "Неизвестный этап"} />;
      }
    };
  
    return (
      <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
        <Sidebar 
            currentStep={currentStep} 
            onStepChange={onStepChange} 
            isOpen={sidebarOpen} 
            onToggle={() => setSidebarOpen(!sidebarOpen)} 
            onBackToDashboard={onBack} 
        />
        <main className={`flex-1 flex flex-col h-full relative transition-all duration-300 ${sidebarOpen ? 'ml-72' : 'ml-20'}`}>
            <div className="px-8 pt-6 pb-2">
                 <Breadcrumbs 
                     projectName={complexInfo.name} 
                     stepTitle={stepConfig?.title}
                     buildingName={editingBuildingName}
                     onBackToStep={() => setEditingBuildingId(null)}
                 />
            </div>
  
            <div className="flex-1 overflow-y-auto px-8 pb-6 scroll-smooth">
                {/* Индикатор показываем только на общих экранах */}
                {!editingBuildingId && <StepIndicator currentStep={currentStep} />}
                
                {renderStepContent()}
            </div>
            
            {!editingBuildingId && (
                <footer className="bg-white border-t border-slate-200 px-8 py-5 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                    <button onClick={handlePrev} disabled={currentStep === 0} className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${currentStep === 0 ? 'text-slate-300' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>Назад</button>
                    <div className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.3em]">Шаг {currentStep + 1} / {STEPS_CONFIG.length}</div>
                    <button onClick={handleNext} disabled={currentStep === STEPS_CONFIG.length - 1} className="px-8 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-slate-300 hover:bg-black active:scale-95 transition-all flex items-center gap-2">Далее</button>
                </footer>
            )}
        </main>
      </div>
    );
  }

// --- ГЛАВНЫЙ КОМПОНЕНТ ---
export default function App() {
  const [user, setUser] = useState(null);
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [projectsList, setProjectsList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    const unsubscribe = onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const metaRef = doc(db, 'artifacts', APP_ID, 'users', 'shared_demo_user', 'registry_data', 'projects_meta');
    const unsubscribe = onSnapshot(metaRef, (snap) => {
        if (snap.exists()) {
            setProjectsList(snap.data().list || []);
        } else {
            setDoc(metaRef, { list: [] });
        }
    });
    return () => unsubscribe();
  }, [user]);

  const createProject = async () => {
      if (!user) return;
      const newId = Date.now().toString();
      const newProject = { 
          id: newId, 
          name: 'Новый проект', 
          status: 'Проектный', 
          lastModified: new Date().toISOString() 
      };
      
      const metaRef = doc(db, 'artifacts', APP_ID, 'users', 'shared_demo_user', 'registry_data', 'projects_meta');
      await setDoc(metaRef, { list: [...projectsList, newProject] }, { merge: true });
      
      const projectRef = doc(db, 'artifacts', APP_ID, 'users', 'shared_demo_user', 'registry_data', `project_${newId}`);
      await setDoc(projectRef, { 
          complexInfo: { name: 'Новый проект', status: 'Проектный' }, 
          composition: [] 
      });

      setCurrentProjectId(newId);
  };

  const deleteProject = async (id) => {
      if (!user) return;
      if(!confirm('Вы уверены?')) return;
      
      const newList = projectsList.filter(p => p.id !== id);
      const metaRef = doc(db, 'artifacts', APP_ID, 'users', 'shared_demo_user', 'registry_data', 'projects_meta');
      await setDoc(metaRef, { list: newList }, { merge: true });
      try {
          await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', 'shared_demo_user', 'registry_data', `project_${id}`));
      } catch (e) {
          console.error("Ошибка удаления:", e);
      }
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50 gap-2 text-slate-500"><Loader2 className="animate-spin"/> Загрузка...</div>;
  if (!user) return <div className="flex items-center justify-center h-screen bg-slate-50">Ошибка авторизации</div>;

  if (!currentProjectId) {
      return (
          <ProjectsDashboard 
              projects={projectsList} 
              onCreate={createProject} 
              onSelect={setCurrentProjectId} 
              onDelete={deleteProject}
          />
      );
  }

  return (
    <ToastProvider>
      <ProjectProvider key={currentProjectId} projectId={currentProjectId} user={user}>
          <ProjectEditorLayout onBack={() => setCurrentProjectId(null)} />
          <div className="fixed bottom-1 left-1 z-[9999] px-2 py-1 bg-white/80 text-[10px] text-slate-400 border border-slate-200 rounded pointer-events-none">v1.0</div>
      </ProjectProvider>
    </ToastProvider>
  );
}