import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Eye, History } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useToast } from '@context/ToastContext';
import { useProject } from '@context/ProjectContext';
import { STEPS_CONFIG } from '@lib/constants';
import { hasRole, ROLE_IDS } from '@lib/roles';
import { ReadOnlyProvider } from '@components/ui/UIKit';
import { renderWorkflowStepContent } from '@/features/workflow/step-registry';

const Sidebar = React.lazy(() => import('@components/Sidebar'));
const StepIndicator = React.lazy(() => import('@components/StepIndicator'));
const WorkflowBar = React.lazy(() => import('@components/WorkflowBar'));
const HistoryModal = React.lazy(() => import('@components/HistoryModal'));

const RouteChromeFallback = ({ className = 'h-16' }) => (
  <div className={`flex items-center justify-center bg-slate-900/5 ${className}`}>
    <Loader2 className="animate-spin text-slate-400" size={20} />
  </div>
);

export default function ProjectEditorRoute({ user }) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingBuildingId, setEditingBuildingId] = useState(null);
  const {
    projectId,
    isReadOnly,
    applicationInfo,
    hasUnsavedChanges,
    setHasUnsavedChanges,
  } = useProject();

  const [searchParams] = useSearchParams();
  const isViewMode = searchParams.get('mode') === 'view';

  const [historyOpen, setHistoryOpen] = useState(false);

  const toast = useToast();
  const initialRedirectDone = useRef(false);

  useEffect(() => {
    if (isViewMode) return;
    if (initialRedirectDone.current) return;

    if (!applicationInfo?.id) return;
    if (applicationInfo.currentStepIndex === undefined || applicationInfo.currentStepIndex === null) return;

    const targetStep = applicationInfo.currentStepIndex;
    const safeStep = Math.min(targetStep, STEPS_CONFIG.length - 1);
    setCurrentStep(safeStep);
    initialRedirectDone.current = true;
  }, [applicationInfo?.id, applicationInfo?.currentStepIndex, isViewMode]);

  const isTechnician = hasRole(user, ROLE_IDS.TECHNICIAN);
  const taskIndex = applicationInfo?.currentStepIndex || 0;
  const isCurrentTask = currentStep === taskIndex;

  const effectiveReadOnly = isReadOnly || isViewMode || (isTechnician && !isCurrentTask);
  const maxAllowedStep = isViewMode
    ? STEPS_CONFIG.length - 1
    : isTechnician
      ? taskIndex
      : STEPS_CONFIG.length - 1;

  const canGoToStep = stepIdx => {
    if (stepIdx > maxAllowedStep) {
      toast.error(`Этот шаг еще не доступен. Завершите текущую задачу.`);
      return false;
    }
    return true;
  };

  const handleBackToDashboard = (force = false) => {
    if (hasUnsavedChanges && !force) {
      if (!window.confirm('Есть несохраненные изменения! Выйти без сохранения?')) return;
      setHasUnsavedChanges(false);
    }
    navigate('/', { state: { refreshDashboardAt: Date.now() } });
  };

  const onStepChange = idx => {
    if (canGoToStep(idx)) {
      setEditingBuildingId(null);
      setCurrentStep(idx);
    }
  };

  const stepConfig = STEPS_CONFIG?.[currentStep];
  const stepId = stepConfig?.id || 'unknown';

  const renderStepContent = () =>
    renderWorkflowStepContent({
      stepId,
      projectId,
      editingBuildingId,
      setEditingBuildingId,
    });

  return (
    <ReadOnlyProvider value={effectiveReadOnly}>
      <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
        <React.Suspense fallback={<RouteChromeFallback className="w-20 h-full" />}>
          <Sidebar
            currentStep={currentStep}
            onStepChange={onStepChange}
            isOpen={sidebarOpen}
            onToggle={() => setSidebarOpen(!sidebarOpen)}
            onBackToDashboard={handleBackToDashboard}
            maxAllowedStep={maxAllowedStep}
          />
        </React.Suspense>
        <main
          className={`flex-1 flex flex-col h-full relative transition-all duration-300 overflow-x-hidden ${sidebarOpen ? 'ml-72' : 'ml-20'}`}
        >
          {!isViewMode && (
            <React.Suspense fallback={<RouteChromeFallback />}>
              <WorkflowBar
                user={user}
                currentStep={currentStep}
                setCurrentStep={setCurrentStep}
                onExit={handleBackToDashboard}
                onOpenHistory={() => setHistoryOpen(true)}
              />
            </React.Suspense>
          )}

          {isViewMode && (
            <div className="bg-blue-50 border-b border-blue-100 px-8 py-2 flex justify-between items-center text-xs text-blue-700 font-bold sticky top-0 z-30 animate-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <Eye size={14} /> Режим просмотра
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setHistoryOpen(true)}
                  className="flex items-center gap-1 hover:text-blue-900 transition-colors"
                >
                  <History size={14} /> История
                </button>
                <div className="w-px h-3 bg-blue-200"></div>
                <button
                  onClick={() => handleBackToDashboard(false)}
                  className="hover:underline opacity-80"
                >
                  Закрыть
                </button>
              </div>
            </div>
          )}

            <div className="px-8 py-4">
            <h1 className="text-2xl font-black tracking-tight text-slate-800">{stepConfig?.title}</h1>
            <p className="text-sm text-slate-500 mt-1">{stepConfig?.description}</p>
          </div>

          {historyOpen && (
            <React.Suspense fallback={null}>
              <HistoryModal
                history={applicationInfo?.history || []}
                onClose={() => setHistoryOpen(false)}
              />
            </React.Suspense>
          )}

          <div className="flex-1 overflow-y-auto pb-6 scroll-smooth custom-scrollbar">
            {!editingBuildingId && (
              <React.Suspense fallback={<RouteChromeFallback className="h-14 bg-white" />}>
                <StepIndicator currentStep={currentStep} />
              </React.Suspense>
            )}
            <React.Suspense fallback={<Loader2 className="animate-spin text-blue-600" />}>
              {renderStepContent()}
            </React.Suspense>
          </div>
        </main>
      </div>
    </ReadOnlyProvider>
  );
}
