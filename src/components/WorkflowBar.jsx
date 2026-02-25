import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { useProject } from '@context/ProjectContext';
import { useToast } from '@context/ToastContext';
import { ROLES, APP_STATUS } from '@lib/constants';
import { useKeyboardShortcuts } from '@hooks/useKeyboardShortcuts';
import { useWorkflowCompletion } from '@hooks/useWorkflowCompletion';
import { useWorkflowActions } from '@hooks/useWorkflowActions';
import { useWorkflowGuards } from '@hooks/useWorkflowGuards';
import { useWorkflowModals } from '@hooks/useWorkflowModals';
import { useWorkflowViewModel } from '@hooks/useWorkflowViewModel';
import { useWorkflowFeedback } from '@hooks/useWorkflowFeedback';
import { useTaskSwitchBlocker } from '@hooks/useTaskSwitchBlocker';
import { useWorkflowController } from '@hooks/useWorkflowController';
import { ActiveTechnicianTaskPanel, ManagerPendingDeclinePanel, ReadOnlyCompletedPanel, ReviewModePanel, TechnicianPendingDeclinePanel } from '@components/workflow/WorkflowModePanels';
import { ActiveTaskOverlays, ManagerDeclineOverlays, ReviewModeOverlays } from '@components/workflow/WorkflowOverlays';

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
  const [isLoading, setIsLoading] = useState(false);

  const {
    showExitConfirm,
    showCompleteConfirm,
    showRollbackConfirm,
    showApproveConfirm,
    actionModal,
    openExitConfirm,
    closeExitConfirm,
    openCompleteConfirm,
    closeCompleteConfirm,
    openRollbackConfirm,
    closeRollbackConfirm,
    openApproveConfirm,
    closeApproveConfirm,
    openActionModal,
    closeActionModal,
  } = useWorkflowModals();


  const {
    saveNotice,
    closeSaveNotice,
    openSavingNotice,
    openErrorNotice,
    handleSaveNoticeOk,
    getActionProgressMessage,
  } = useWorkflowFeedback();

  const [validationErrors, setValidationErrors] = useState([]);

  const {
    isTaskSwitchBlocking,
    startTaskSwitchBlock,
    resetTaskSwitchBlock,
  } = useTaskSwitchBlocker({
    currentStep,
    contextStepIndex: applicationInfo?.currentStepIndex ?? 0,
  });

  const {
    isCurrentTask,
    canGoBack,
    isReviewMode,
    isPendingDeclineMode,
    isController,
    isTechnician,
    isAdmin,
    canTechRequestDecline,
    canManagerReviewDecline,
    shortcutsEnabled,
    isActionDisabled,
  } = useWorkflowGuards({
    userRole: user.role,
    currentStep,
    applicationInfo,
    isReadOnly,
    hasActionModal: Boolean(actionModal),
    isLoading,
    isCompleteConfirmOpen: showCompleteConfirm,
    isRollbackConfirmOpen: showRollbackConfirm,
    isExitConfirmOpen: showExitConfirm,
    isSaveNoticeOpen: saveNotice.open,
  });

  const {
    isCustomSaveStep,
    isStageBoundary,
    isLastStepGlobal,
    isIntegrationStage,
    actionBtnText,
    confirmMsg,
  } = useWorkflowViewModel({ currentStep });
  const { runCompletionPrecheck } = useWorkflowCompletion({
    currentStep,
    isCustomSaveStep,
    hasUnsavedChanges,
    dbScope,
    projectId,
    queryClient,
    refetch,
    saveProjectImmediate,
  });

  const {
    executeCompletion,
    executeRollback,
    executeApproveStage,
    executeCommentAction,
  } = useWorkflowActions({
    completeTask,
    rollbackTask,
    reviewStage,
    requestDecline,
    confirmDecline,
    returnFromDecline,
  });

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
    handleActionConfirm,
    handleRequestDecline,
    handleConfirmDecline,
    handleReturnFromDecline,
    handleRejectStage,
  } = useWorkflowController({
    state: {
      hasUnsavedChanges,
      isCustomSaveStep,
      currentStep,
      isStageBoundary,
      isLastStepGlobal,
      actionModal,
    },
    operations: {
      saveProjectImmediate,
      runCompletionPrecheck,
      executeCompletion,
      executeRollback,
      executeApproveStage,
      executeCommentAction,
    },
    ui: {
      openExitConfirm,
      closeExitConfirm,
      openCompleteConfirm,
      closeCompleteConfirm,
      openRollbackConfirm,
      closeRollbackConfirm,
      openApproveConfirm,
      closeApproveConfirm,
      openActionModal,
      closeActionModal,
      openSavingNotice,
      closeSaveNotice,
      openErrorNotice,
      getActionProgressMessage,
      setValidationErrors,
      setIsLoading,
    },
    navigation: {
      onExit,
      setCurrentStep,
      startTaskSwitchBlock,
      resetTaskSwitchBlock,
    },
    toast,
  });

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
        <ReviewModeOverlays
          saveNotice={saveNotice}
          onSaveNoticeOk={handleSaveNoticeOk}
          showApproveConfirm={showApproveConfirm}
          closeApproveConfirm={closeApproveConfirm}
          stageNum={Math.max(1, (applicationInfo?.currentStage || 1) - 1)}
          onApprove={performApproveStage}
          actionModal={actionModal}
          closeActionModal={closeActionModal}
          onActionConfirm={handleActionConfirm}
          isLoading={isLoading}
        />
        <ReviewModePanel
          onOpenHistory={onOpenHistory}
          onReject={handleRejectStage}
          onApprove={handleApproveStage}
          isLoading={isLoading}
        />
      </>
    );
  }

  // --- PENDING DECLINE: Панель для начальника филиала (решение по запросу на отказ) ---
  if (isPendingDeclineMode && canManagerReviewDecline) {
    return (
      <>
        <ManagerDeclineOverlays
          saveNotice={saveNotice}
          onSaveNoticeOk={handleSaveNoticeOk}
          actionModal={actionModal}
          closeActionModal={closeActionModal}
          onActionConfirm={handleActionConfirm}
          isLoading={isLoading}
        />
        <ManagerPendingDeclinePanel
          applicationInfo={applicationInfo}
          onOpenHistory={onOpenHistory}
          onReturn={handleReturnFromDecline}
          onConfirm={handleConfirmDecline}
          isLoading={isLoading}
        />
      </>
    );
  }

  // --- PENDING DECLINE: Панель для техника (read-only, ожидание решения) ---
  if (isPendingDeclineMode && isTechnician) {
    return (
      <TechnicianPendingDeclinePanel
        onOpenHistory={onOpenHistory}
        onExit={() => onExit(false)}
      />
    );
  }

  if (
    (isTechnician || isAdmin) &&
    !isReviewMode &&
    !isPendingDeclineMode &&
    isCurrentTask &&
    !isReadOnly
  ) {

    return (
      <>
        <ActiveTaskOverlays
          validationErrors={validationErrors}
          clearValidationErrors={() => setValidationErrors([])}
          showExitConfirm={showExitConfirm}
          closeExitConfirm={closeExitConfirm}
          onExitConfirm={confirmExitWithoutSave}
          showCompleteConfirm={showCompleteConfirm}
          closeCompleteConfirm={closeCompleteConfirm}
          confirmMsg={confirmMsg}
          onCompleteConfirm={performCompletion}
          showRollbackConfirm={showRollbackConfirm}
          closeRollbackConfirm={closeRollbackConfirm}
          currentStep={currentStep}
          onRollbackConfirm={performRollback}
          isLoading={isLoading}
          actionModal={actionModal}
          closeActionModal={closeActionModal}
          onActionConfirm={handleActionConfirm}
          saveNotice={saveNotice}
          onSaveNoticeOk={handleSaveNoticeOk}
          isTaskSwitchBlocking={isTaskSwitchBlocking}
        />

        <ActiveTechnicianTaskPanel
          canGoBack={canGoBack}
          isIntegrationStage={isIntegrationStage}
          isActionDisabled={isActionDisabled}
          onRollback={handleRollback}
          projectCode={projectContext.complexInfo?.ujCode}
          currentStep={currentStep}
          onOpenHistory={onOpenHistory}
          onExitWithoutSave={handleExitWithoutSave}
          canTechRequestDecline={canTechRequestDecline}
          onRequestDecline={handleRequestDecline}
          onSave={handleSave}
          isCustomSaveStep={isCustomSaveStep}
          hasUnsavedChanges={hasUnsavedChanges}
          isLoading={isLoading}
          onSaveAndExit={handleSaveAndExit}
          onComplete={handleCompleteTaskClick}
          isStageBoundary={isStageBoundary}
          actionBtnText={actionBtnText}
        />
      </>
    );
  }

  if (!isCurrentTask && !isReviewMode) {
    return (
      <ReadOnlyCompletedPanel
        onOpenHistory={onOpenHistory}
        onExit={() => onExit(false)}
      />
    );
  }

  return null;
}
