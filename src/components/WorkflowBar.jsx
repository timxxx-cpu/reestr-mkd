import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Save,
  CheckCircle2,
  LogOut,
  ArrowRight,
  Loader2,
  ArrowLeft,
  Send,
  History,
  ThumbsUp,
  XCircle,
  ShieldCheck,
  AlertTriangle,
  X,
  Ban,
  Clock,
  MessageSquare
} from 'lucide-react';
import { useProject } from '@context/ProjectContext';
import { Button, SaveIndicator } from '@components/ui/UIKit';
import { useToast } from '@context/ToastContext';
import { ROLES, STEPS_CONFIG, WORKFLOW_STAGES, APP_STATUS, WORKFLOW_SUBSTATUS } from '@lib/constants';
import { getStepStage, isPendingDecline } from '@lib/workflow-utils';
import { canRequestDecline, canReviewDeclineRequest } from '@lib/workflow-state-machine';
import { IdentifierBadge } from '@components/ui/IdentifierBadge';
import { useKeyboardShortcuts } from '@hooks/useKeyboardShortcuts';
import { ApiService } from '@lib/api-service';
import {
  ActionCommentModal,
  ValidationErrorsModal,
  ExitConfirmationModal,
  RollbackConfirmationModal,
  ApproveStageModal,
  CompleteTaskModal,
  SaveProgressModal,
} from '@components/workflow/WorkflowModals';
import { useWorkflowActions } from '@components/workflow/useWorkflowActions';
import { useWorkflowBarState } from '@components/workflow/useWorkflowBarState';
import { useWorkflowOperations } from '@components/workflow/useWorkflowOperations';

// Шаги, на которых сохранение выполняется через локальные формы (блокируем верхние кнопки)
const STEPS_WITH_CUSTOM_SAVE = [
  'registry_nonres', // Нежилые блоки и инфраструктура
  'registry_res',    // Жилые блоки
  'basement_inventory',// Инвентаризация подвалов
  'floors',          // Внешняя инвентаризация
  'entrances',       // Инвентаризация подъездов
  'apartments',      // Присвоение номеров квартирам
  'mop',             // Инвентаризация МОП
  'registry_apartments', // Реестр квартир (локальное сохранение шага)
  'registry_commercial', // Реестр нежилых помещений (локальное сохранение шага)
  'registry_parking',    // Реестр машиномест (локальное сохранение шага)
];


export default function WorkflowBar({ user, currentStep, setCurrentStep, onExit, onOpenHistory }) {
  const projectContext = useProject();
  const {
    applicationInfo,
    saveProjectImmediate,
    completeTask,
    rollbackTask,
    reviewStage,
    requestDecline,
    confirmDecline,
    returnFromDecline,
    isReadOnly,
    hasUnsavedChanges,
    refetch,
    projectId,
    dbScope,
  } = projectContext;

  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    isLoading,
    setIsLoading,
    showExitConfirm,
    setShowExitConfirm,
    showCompleteConfirm,
    setShowCompleteConfirm,
    showRollbackConfirm,
    setShowRollbackConfirm,
    showApproveConfirm,
    setShowApproveConfirm,
    saveNotice,
    setSaveNotice,
    closeSaveNotice,
    openSavingNotice,
    openErrorNotice,
    handleSaveNoticeOk,
    validationErrors,
    setValidationErrors,
    isTaskSwitchBlocking,
    setIsTaskSwitchBlocking,
    setPendingStepTarget,
  } = useWorkflowBarState({
    currentStep,
    contextStepIndex: applicationInfo?.currentStepIndex ?? 0,
  });

  const taskIndex = applicationInfo?.currentStepIndex || 0;
  const isCurrentTask = currentStep === taskIndex;
  const canGoBack = currentStep > 0;

  const appSubstatus = applicationInfo?.workflowSubstatus || WORKFLOW_SUBSTATUS.DRAFT;
  const isReviewMode = appSubstatus === WORKFLOW_SUBSTATUS.REVIEW;
  const isPendingDeclineMode = isPendingDecline(appSubstatus);

  // ИСПРАВЛЕНИЕ: Добавляем роль BRANCH_MANAGER в список тех, кто может проверять
  const isController = user.role === ROLES.CONTROLLER || user.role === ROLES.BRANCH_MANAGER || user.role === ROLES.ADMIN;
  const isTechnician = user.role === ROLES.TECHNICIAN;
  const canTechRequestDecline = canRequestDecline(user.role, appSubstatus);
  const canManagerReviewDecline = canReviewDeclineRequest(user.role, appSubstatus);

  const currentStageNum = getStepStage(currentStep);

  const currentStepId = STEPS_CONFIG[currentStep]?.id;
  const isCustomSaveStep = STEPS_WITH_CUSTOM_SAVE.includes(currentStepId);
  
  const stageConfig = WORKFLOW_STAGES[currentStageNum];
  const isStageBoundary = stageConfig && stageConfig.lastStepIndex === currentStep;
  const isLastStepGlobal = currentStep === STEPS_CONFIG.length - 1;

  const INTEGRATION_START_IDX = 12;
  const isIntegrationStage = currentStep >= INTEGRATION_START_IDX;

  let actionBtnText = 'Перейти к следующей задаче';
  let ActionIcon = ArrowRight;
  let confirmMsg = 'Завершить текущую задачу и перейти к следующему шагу?';

  if (isLastStepGlobal) {
    actionBtnText = 'Завершить проект';
    ActionIcon = CheckCircle2;
    confirmMsg = 'Это последний шаг. Вы уверены, что хотите полностью завершить проект?';
  } else if (isStageBoundary) {
    actionBtnText = 'Отправить на проверку';
    ActionIcon = Send;
    confirmMsg = `Вы завершаете Этап ${currentStageNum}. Отправить все данные на проверку Бригадиру?`;
  }

  const {
    handleSave,
    handleSaveAndExit,
    handleExitWithoutSave,
    confirmExitWithoutSave,
    handleCompleteTaskClick,
    performCompletion,
    handleRollback,
    performRollback,
    performApproveStage,
    handleApproveStage,
  } = useWorkflowOperations({
    queryClient,
    toast,
    onExit,
    currentStep,
    setCurrentStep,
    isCustomSaveStep,
    hasUnsavedChanges,
    isStageBoundary,
    isLastStepGlobal,
    saveProjectImmediate,
    refetch,
    dbScope,
    projectId,
    completeTask,
    rollbackTask,
    reviewStage,
    setIsLoading,
    openSavingNotice,
    closeSaveNotice,
    openErrorNotice,
    setShowExitConfirm,
    setShowCompleteConfirm,
    setShowRollbackConfirm,
    setShowApproveConfirm,
    setValidationErrors,
    setIsTaskSwitchBlocking,
    setPendingStepTarget,
  });

  const {
    actionModal,
    setActionModal,
    handleActionConfirm,
    handleRequestDecline,
    handleConfirmDecline,
    handleReturnFromDecline,
    handleRejectStage,
  } = useWorkflowActions({
    requestDecline,
    confirmDecline,
    returnFromDecline,
    reviewStage,
    setSaveNotice,
    setIsLoading,
    toast,
    onExit,
  });

  const shortcutsEnabled =
    (isTechnician || user.role === ROLES.ADMIN) &&
    !isReviewMode &&
    isCurrentTask &&
    !isReadOnly &&
    !showExitConfirm &&
    !showCompleteConfirm &&
    !showRollbackConfirm &&
    !saveNotice.open &&
    !actionModal;

  useKeyboardShortcuts(
    [
      { combo: 'ctrl+s', handler: handleSave, allowInInput: true },
      { combo: 'ctrl+shift+s', handler: handleSaveAndExit, allowInInput: true },
      { combo: 'ctrl+enter', handler: handleCompleteTaskClick, allowInInput: true },
    ],
    shortcutsEnabled && !isLoading
  );

  if (!applicationInfo) return null;

  if (isReviewMode && isController) {
    return (
      <>
        {saveNotice.open && (
          <SaveProgressModal
            status={saveNotice.status}
            message={saveNotice.message}
            onOk={handleSaveNoticeOk}
          />
        )}
        {showApproveConfirm && (
          <ApproveStageModal
            stageNum={Math.max(1, (applicationInfo?.currentStage || 1) - 1)}
            onCancel={() => setShowApproveConfirm(false)}
            onConfirm={performApproveStage}
            isLoading={isLoading}
          />
        )}
        {actionModal && (
          <ActionCommentModal
            config={actionModal.config}
            onCancel={() => setActionModal(null)}
            onConfirm={handleActionConfirm}
            isLoading={isLoading}
          />
        )}
        
        <div className="bg-indigo-900 border-b border-indigo-800 px-8 py-4 flex items-center justify-between sticky top-0 z-30 shadow-xl animate-in slide-in-from-top-2 text-white">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck size={12} /> Контроль качества
              </span>
              <span className="text-base font-bold text-white tracking-tight">Проверка этапа</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={onOpenHistory}
              className="text-indigo-300 hover:text-white hover:bg-white/10 px-2 h-9"
              title="История действий"
            >
              <History size={18} />
            </Button>
            <div className="h-8 w-px bg-indigo-700 mx-1"></div>
            <Button
              onClick={handleRejectStage}
              disabled={isLoading}
              className="bg-white text-red-600 hover:bg-red-50 border border-transparent shadow-sm h-10 px-4"
            >
              <XCircle size={16} className="mr-2" /> Вернуть
            </Button>
            <Button
              onClick={handleApproveStage}
              disabled={isLoading}
              className="bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-900/20 h-10 px-6 border-0"
            >
              <ThumbsUp size={16} className="mr-2" /> Принять этап
            </Button>
          </div>
        </div>
      </>
    );
  }

  // --- PENDING DECLINE: Панель для начальника филиала (решение по запросу на отказ) ---
  if (isPendingDeclineMode && canManagerReviewDecline) {
    return (
      <>
        {saveNotice.open && (
          <SaveProgressModal
            status={saveNotice.status}
            message={saveNotice.message}
            onOk={handleSaveNoticeOk}
          />
        )}
        {actionModal && (
          <ActionCommentModal
            config={actionModal.config}
            onCancel={() => setActionModal(null)}
            onConfirm={handleActionConfirm}
            isLoading={isLoading}
          />
        )}
        
        <div className="bg-amber-900 border-b border-amber-800 px-8 py-4 flex items-center justify-between sticky top-0 z-30 shadow-xl animate-in slide-in-from-top-2 text-white">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-amber-800 rounded-xl border border-amber-700">
              <Clock size={20} className="text-amber-300" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">
                Запрос на отказ от техника
              </span>
              <span className="text-base font-bold text-white tracking-tight">
                {applicationInfo.requestedDeclineBy || 'Техник'}: {applicationInfo.requestedDeclineReason || 'Причина не указана'}
              </span>
              <span className="text-[10px] text-amber-400 mt-0.5">
                Шаг: {STEPS_CONFIG[applicationInfo.requestedDeclineStep]?.title || 'Не указан'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={onOpenHistory}
              className="text-amber-300 hover:text-white hover:bg-white/10 px-2 h-9"
              title="История действий"
            >
              <History size={18} />
            </Button>
            <div className="h-8 w-px bg-amber-700 mx-1"></div>
            <Button
              onClick={handleReturnFromDecline}
              disabled={isLoading}
              className="bg-white text-amber-700 hover:bg-amber-50 border border-transparent shadow-sm h-10 px-4"
            >
              <ArrowLeft size={16} className="mr-2" /> Вернуть на доработку
            </Button>
            <Button
              onClick={handleConfirmDecline}
              disabled={isLoading}
              className="bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-900/20 h-10 px-6 border-0"
            >
              <Ban size={16} className="mr-2" /> Подтвердить отказ
            </Button>
          </div>
        </div>
      </>
    );
  }

  // --- PENDING DECLINE: Панель для техника (read-only, ожидание решения) ---
  if (isPendingDeclineMode && isTechnician) {
    return (
      <div className="bg-amber-900 border-b border-amber-800 px-8 py-4 flex items-center justify-between sticky top-0 z-30 shadow-xl animate-in slide-in-from-top-2 text-white">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-amber-800 rounded-xl border border-amber-700">
            <Clock size={20} className="text-amber-300 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">
              Ожидание решения
            </span>
            <span className="text-sm font-bold text-white tracking-tight">
              Заявление направлено начальнику филиала для рассмотрения отказа
            </span>
            <span className="text-[10px] text-amber-400 mt-0.5">
              Данные доступны только для просмотра. Ожидайте решения.
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={onOpenHistory}
            className="h-9 px-3 text-xs bg-amber-800 border border-amber-700 hover:bg-amber-700 text-amber-300 hover:text-white"
          >
            <History size={14} className="mr-2" /> История
          </Button>
          <Button
            variant="ghost"
            onClick={() => onExit(false)}
            className="h-9 px-3 text-xs bg-amber-800 border border-amber-700 hover:bg-amber-700 text-amber-300 hover:text-white"
          >
            <LogOut size={14} className="mr-2" /> Выйти
          </Button>
        </div>
      </div>
    );
  }

  if (
    (isTechnician || user.role === ROLES.ADMIN) &&
    !isReviewMode &&
    !isPendingDeclineMode &&
    isCurrentTask &&
    !isReadOnly
  ) {
    const isActionDisabled = isLoading || !isTechnician || saveNotice.open || actionModal;

    return (
      <>
        {validationErrors.length > 0 && (
          <ValidationErrorsModal
            errors={validationErrors}
            onClose={() => setValidationErrors([])}
          />
        )}

        {showExitConfirm && (
          <ExitConfirmationModal
            onCancel={() => setShowExitConfirm(false)}
            onConfirm={confirmExitWithoutSave}
          />
        )}

        {showCompleteConfirm && (
          <CompleteTaskModal
            message={confirmMsg}
            onCancel={() => setShowCompleteConfirm(false)}
            onConfirm={performCompletion}
          />
        )}

        {showRollbackConfirm && (
          <RollbackConfirmationModal
            currentStep={currentStep}
            isFirstStep={currentStep === 0}
            onCancel={() => setShowRollbackConfirm(false)}
            onConfirm={performRollback}
            isLoading={isLoading}
          />
        )}
        
        {actionModal && (
          <ActionCommentModal
            config={actionModal.config}
            onCancel={() => setActionModal(null)}
            onConfirm={handleActionConfirm}
            isLoading={isLoading}
          />
        )}

        {saveNotice.open && (
          <SaveProgressModal
            status={saveNotice.status}
            message={saveNotice.message}
            onOk={handleSaveNoticeOk}
          />
        )}

        {isTaskSwitchBlocking && (
          <div className="fixed inset-0 z-[140] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center pointer-events-auto">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 px-6 py-5 flex items-center gap-3">
              <Loader2 size={18} className="animate-spin text-blue-600" />
              <div>
                <div className="text-sm font-bold text-slate-800">Переход к следующей задаче</div>
                <div className="text-xs text-slate-500">
                  Пожалуйста, подождите. Экран временно заблокирован.
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-slate-900 border-b border-slate-800 px-8 py-4 flex items-center justify-between sticky top-0 z-30 shadow-xl shadow-slate-900/10 animate-in slide-in-from-top-2 text-white">
          <div className="flex items-center gap-4">
            {canGoBack && !isIntegrationStage && (
              <Button
                variant="ghost"
                onClick={handleRollback}
                disabled={isActionDisabled}
                className="text-slate-400 hover:text-white hover:bg-white/10 px-2 h-9 border border-transparent"
                title="Вернуться на шаг назад"
              >
                <ArrowLeft size={18} />
              </Button>
            )}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Текущая задача
                </span>
                {projectContext.complexInfo?.ujCode && (
                  <IdentifierBadge 
                    code={projectContext.complexInfo.ujCode} 
                    type="project" 
                    variant="compact"
                    className="bg-blue-600/20 border-blue-400/30 text-blue-200"
                  />
                )}
              </div>
              <span className="text-base font-bold text-white tracking-tight">
                {STEPS_CONFIG[currentStep]?.title}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={onOpenHistory}
              disabled={isActionDisabled}
              className="text-slate-400 hover:text-white hover:bg-white/10 px-2 h-9"
              title="История действий"
            >
              <History size={18} />
            </Button>

            <div className="h-8 w-px bg-slate-700 mx-1"></div>

            <Button
              variant="ghost"
              onClick={handleExitWithoutSave}
              disabled={isActionDisabled}
              className={`text-red-400 hover:text-red-300 hover:bg-red-900/20 px-3 h-10 border border-transparent transition-colors text-xs font-bold ${isActionDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Выйти без сохранения
            </Button>

            {canTechRequestDecline && (
              <Button
                variant="ghost"
                onClick={handleRequestDecline}
                disabled={isActionDisabled}
                className="text-amber-400 hover:text-amber-300 hover:bg-amber-900/20 px-3 h-10 border border-transparent transition-colors text-xs font-bold"
                title="Запросить отказ заявления"
              >
                <Ban size={14} className="mr-1.5" />
                Запросить отказ
              </Button>
            )}

            <Button
              onClick={handleSave}
              disabled={isActionDisabled || isCustomSaveStep}
              title={isCustomSaveStep ? "Сохранение выполняется в форме ниже" : "Ctrl+S"}
              className={`relative h-10 shadow-sm transition-all border ${
                hasUnsavedChanges && !isCustomSaveStep
                  ? 'bg-blue-600 text-white border-blue-500 hover:bg-blue-500 ring-2 ring-blue-500/30'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {!isCustomSaveStep && <SaveIndicator hasChanges={hasUnsavedChanges} />}
              {isLoading ? (
                <Loader2 size={16} className="animate-spin mr-2" />
              ) : (
                <Save size={16} className="mr-2" />
              )}
              {isLoading ? 'Сохранение...' : 'Сохранить'}
            </Button>

            <Button
              variant="secondary"
              onClick={handleSaveAndExit}
              disabled={isActionDisabled || isCustomSaveStep}
              title="Ctrl+Shift+S"
              className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white h-10 shadow-sm"
            >
              {isLoading ? (
                <Loader2 size={16} className="mr-2 animate-spin" />
              ) : (
                <LogOut size={16} className="mr-2" />
              )}
              {isLoading ? 'Сохранение...' : 'Сохранить и Выйти'}
            </Button>

            <div className="h-8 w-px bg-slate-700 mx-1"></div>

            <Button
              onClick={handleCompleteTaskClick}
              disabled={isActionDisabled}
              title="Ctrl+Enter"
              className={`${isStageBoundary ? 'bg-indigo-500 hover:bg-indigo-400 shadow-indigo-900/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'} text-white shadow-lg h-10 px-6 active:scale-95 transition-transform border-0`}
            >
              {actionBtnText}
              <ActionIcon size={16} className="ml-2 opacity-80" />
            </Button>
          </div>
        </div>
      </>
    );
  }

  if (!isCurrentTask && !isReviewMode) {
    return (
      <div className="bg-slate-900 border-b border-slate-800 px-8 py-3 flex justify-between items-center sticky top-0 z-30 animate-in slide-in-from-top-2 text-slate-300">
        <div className="flex items-center gap-4">
          <div className="p-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-500">
            <CheckCircle2 size={16} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Статус
            </span>
            <span className="text-sm font-bold text-slate-300">
              Задача выполнена (Режим просмотра)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={onOpenHistory}
            className="h-9 px-3 text-xs bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 hover:text-white"
          >
            <History size={14} className="mr-2" /> История
          </Button>
          <Button
            variant="ghost"
            onClick={() => onExit(false)}
            className="h-9 px-3 text-xs bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 hover:text-white"
          >
            <LogOut size={14} className="mr-2" /> Выйти
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
