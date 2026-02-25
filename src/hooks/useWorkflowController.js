import { useCallback } from 'react';
import { WORKFLOW_COMMENT_ACTIONS } from '@lib/workflow-action-registry';

export const useWorkflowController = ({
  state,
  operations,
  ui,
  navigation,
  toast,
}) => {
  const {
    hasUnsavedChanges,
    isCustomSaveStep,
    currentStep,
    isStageBoundary,
    isLastStepGlobal,
    actionModal,
  } = state;

  const {
    saveProjectImmediate,
    runCompletionPrecheck,
    executeCompletion,
    executeRollback,
    executeApproveStage,
    executeCommentAction,
  } = operations;

  const {
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
  } = ui;

  const {
    onExit,
    setCurrentStep,
    startTaskSwitchBlock,
    resetTaskSwitchBlock,
  } = navigation;

  const handleSave = useCallback(async () => {
    setIsLoading(true);
    openSavingNotice('Пожалуйста, дождитесь окончания записи...');
    try {
      await saveProjectImmediate();
      closeSaveNotice();
      toast.success('Данные успешно сохранены');
    } catch (e) {
      console.error(e);
      openErrorNotice('Ошибка: запись не произведена.');
    } finally {
      setIsLoading(false);
    }
  }, [closeSaveNotice, openErrorNotice, openSavingNotice, saveProjectImmediate, setIsLoading, toast]);

  const handleSaveAndExit = useCallback(async () => {
    setIsLoading(true);
    openSavingNotice('Сохранение перед выходом...');
    try {
      await saveProjectImmediate();
      closeSaveNotice();
      onExit(true);
    } catch (e) {
      console.error(e);
      openErrorNotice('Ошибка: запись не произведена.');
    } finally {
      setIsLoading(false);
    }
  }, [closeSaveNotice, onExit, openErrorNotice, openSavingNotice, saveProjectImmediate, setIsLoading]);

  const handleExitWithoutSave = useCallback(() => {
    if (hasUnsavedChanges && !isCustomSaveStep) {
      openExitConfirm();
      return;
    }
    onExit(true);
  }, [hasUnsavedChanges, isCustomSaveStep, onExit, openExitConfirm]);

  const confirmExitWithoutSave = useCallback(() => {
    closeExitConfirm();
    onExit(true);
  }, [closeExitConfirm, onExit]);

  const handleCompleteTaskClick = useCallback(async () => {
    setIsLoading(true);
    openSavingNotice('Сохранение и проверка данных перед завершением...');

    try {
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      await new Promise(resolve => setTimeout(resolve, 380));

      const precheckResult = await runCompletionPrecheck();

      if (!precheckResult.ok && precheckResult.reason === 'custom-save-required') {
        closeSaveNotice();
        toast.error('Сначала сохраните изменения через кнопку "Сохранить" в форме шага.');
        return;
      }

      if (!precheckResult.ok && precheckResult.reason === 'validation-failed') {
        console.error('Backend validation failed', precheckResult.error);
        closeSaveNotice();
        toast.error('Не удалось выполнить серверную валидацию. Попробуйте позже.');
        return;
      }

      if (!precheckResult.ok && precheckResult.reason === 'validation-errors') {
        closeSaveNotice();
        setValidationErrors(precheckResult.errors);
        return;
      }

      closeSaveNotice();
      openCompleteConfirm();
    } catch (e) {
      console.error(e);
      openErrorNotice('Ошибка: запись или проверка не выполнена.');
    } finally {
      setIsLoading(false);
    }
  }, [
    closeSaveNotice,
    openCompleteConfirm,
    openErrorNotice,
    openSavingNotice,
    runCompletionPrecheck,
    setIsLoading,
    setValidationErrors,
    toast,
  ]);

  const performCompletion = useCallback(async () => {
    closeCompleteConfirm();
    setIsLoading(true);
    openSavingNotice('Запись данных и завершение задачи...');

    try {
      const result = await executeCompletion({
        currentStep,
        persistBeforeTransition: !isCustomSaveStep,
        isStageBoundary,
        isLastStepGlobal,
      });
      closeSaveNotice();

      if (result.shouldExit) {
        toast[result.toastType](result.toastMessage);
        onExit(true);
        return;
      }

      startTaskSwitchBlock(result.nextIndex);
      toast[result.toastType](result.toastMessage);
      setCurrentStep(result.nextIndex);
    } catch (e) {
      console.error(e);
      resetTaskSwitchBlock();
      openErrorNotice('Ошибка: запись не произведена.');
    } finally {
      setIsLoading(false);
    }
  }, [
    closeCompleteConfirm,
    closeSaveNotice,
    currentStep,
    executeCompletion,
    isCustomSaveStep,
    isLastStepGlobal,
    isStageBoundary,
    onExit,
    openErrorNotice,
    openSavingNotice,
    resetTaskSwitchBlock,
    setCurrentStep,
    setIsLoading,
    startTaskSwitchBlock,
    toast,
  ]);

  const handleRollback = useCallback(() => {
    openRollbackConfirm();
  }, [openRollbackConfirm]);

  const performRollback = useCallback(async () => {
    closeRollbackConfirm();
    setIsLoading(true);
    openSavingNotice('Возврат к предыдущей задаче...');
    try {
      const result = await executeRollback();
      closeSaveNotice();
      toast[result.toastType](result.toastMessage);
      setCurrentStep(result.prevIndex);
    } catch (e) {
      console.error(e);
      openErrorNotice('Ошибка возврата');
    } finally {
      setIsLoading(false);
    }
  }, [
    closeRollbackConfirm,
    closeSaveNotice,
    executeRollback,
    openErrorNotice,
    openSavingNotice,
    setCurrentStep,
    setIsLoading,
    toast,
  ]);

  const performApproveStage = useCallback(async () => {
    closeApproveConfirm();
    setIsLoading(true);
    openSavingNotice('Сохранение решения...');

    try {
      const result = await executeApproveStage();
      closeSaveNotice();
      toast[result.toastType](result.toastMessage);
      if (result.shouldExit) onExit(true);
    } catch (e) {
      console.error(e);
      openErrorNotice('Ошибка при одобрении');
    } finally {
      setIsLoading(false);
    }
  }, [
    closeApproveConfirm,
    closeSaveNotice,
    executeApproveStage,
    onExit,
    openErrorNotice,
    openSavingNotice,
    setIsLoading,
    toast,
  ]);

  const handleApproveStage = useCallback(() => {
    openApproveConfirm();
  }, [openApproveConfirm]);

  const handleActionConfirm = useCallback(async (comment) => {
    if (!actionModal) return;

    const type = actionModal.type;
    closeActionModal();

    setIsLoading(true);

    try {
      const progressMessage = getActionProgressMessage(type);
      if (!progressMessage) return;

      openSavingNotice(progressMessage);
      const result = await executeCommentAction({ type, comment });
      closeSaveNotice();

      if (!result) return;

      toast[result.toastType](result.toastMessage);
      if (result.shouldExit) onExit(true);
    } catch (e) {
      console.error(e);
      openErrorNotice('Произошла ошибка при выполнении операции');
    } finally {
      setIsLoading(false);
    }
  }, [
    actionModal,
    closeActionModal,
    closeSaveNotice,
    executeCommentAction,
    getActionProgressMessage,
    onExit,
    openErrorNotice,
    openSavingNotice,
    setIsLoading,
    toast,
  ]);

  const handleRequestDecline = useCallback(() => {
    openActionModal(WORKFLOW_COMMENT_ACTIONS.REQUEST_DECLINE);
  }, [openActionModal]);

  const handleConfirmDecline = useCallback(() => {
    openActionModal(WORKFLOW_COMMENT_ACTIONS.CONFIRM_DECLINE);
  }, [openActionModal]);

  const handleReturnFromDecline = useCallback(() => {
    openActionModal(WORKFLOW_COMMENT_ACTIONS.RETURN_DECLINE);
  }, [openActionModal]);

  const handleRejectStage = useCallback(() => {
    openActionModal(WORKFLOW_COMMENT_ACTIONS.REJECT_STAGE);
  }, [openActionModal]);

  return {
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
  };
};
