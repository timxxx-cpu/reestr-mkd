import { ApiService } from '@lib/api-service';
import { STEPS_CONFIG } from '@lib/constants';

export const useWorkflowOperations = ({
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
}) => {
  const waitForPendingMutations = async () => {
    const startedAt = Date.now();
    const timeoutMs = 8000;

    while (queryClient.isMutating() > 0) {
      if (Date.now() - startedAt > timeoutMs) {
        console.warn('Timed out waiting for pending mutations before validation');
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 120));
    }
  };

  const handleSave = async () => {
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
  };

  const handleSaveAndExit = async () => {
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
  };

  const handleExitWithoutSave = () => {
    if (hasUnsavedChanges && !isCustomSaveStep) {
      setShowExitConfirm(true);
    } else {
      onExit(true);
    }
  };

  const confirmExitWithoutSave = () => {
    setShowExitConfirm(false);
    onExit(true);
  };

  const handleCompleteTaskClick = async () => {
    setIsLoading(true);
    openSavingNotice('Сохранение и проверка данных перед завершением...');

    try {
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      await new Promise(resolve => setTimeout(resolve, 380));

      if (isCustomSaveStep && hasUnsavedChanges) {
        closeSaveNotice();
        toast.error('Сначала сохраните изменения через кнопку "Сохранить" в форме шага.');
        return;
      }

      if (!isCustomSaveStep) {
        await saveProjectImmediate({ shouldRefetch: false });
        await waitForPendingMutations();
        await refetch();
      }

      const currentStepId = STEPS_CONFIG[currentStep]?.id;
      let errors = null;

      try {
        const validationResponse = await ApiService.validateStepCompletionViaBff({
          scope: dbScope,
          projectId,
          stepId: currentStepId,
        });

        const backendErrors = Array.isArray(validationResponse?.errors) ? validationResponse.errors : [];

        errors = backendErrors.map((err, idx) => ({
          id: `${err.code || 'VALIDATION'}-${idx}`,
          title: err.title || err.code || 'VALIDATION_ERROR',
          description: err.message || 'Ошибка проверки данных',
          source: 'backend',
        }));
      } catch (validationError) {
        console.error('Backend validation failed', validationError);
        closeSaveNotice();
        toast.error('Не удалось выполнить серверную валидацию. Попробуйте позже.');
        return;
      }

      closeSaveNotice();

      if (errors && errors.length > 0) {
        setValidationErrors(errors);
        return;
      }

      setShowCompleteConfirm(true);
    } catch (e) {
      console.error(e);
      openErrorNotice('Ошибка: запись или проверка не выполнена.');
    } finally {
      setIsLoading(false);
    }
  };

  const performCompletion = async () => {
    setShowCompleteConfirm(false);
    setIsLoading(true);
    openSavingNotice('Запись данных и завершение задачи...');

    try {
      const nextIndex = await completeTask(currentStep, {
        persistBeforeTransition: !isCustomSaveStep,
      });
      closeSaveNotice();

      if (isStageBoundary || isLastStepGlobal) {
        toast.success('Этап завершен. Отправлено на проверку.');
        onExit(true);
      } else {
        setIsTaskSwitchBlocking(true);
        setPendingStepTarget(nextIndex);
        toast.success('Задача выполнена.');
        setCurrentStep(nextIndex);
      }
    } catch (e) {
      console.error(e);
      setIsTaskSwitchBlocking(false);
      setPendingStepTarget(null);
      openErrorNotice('Ошибка: запись не произведена.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRollback = () => setShowRollbackConfirm(true);

  const performRollback = async () => {
    setShowRollbackConfirm(false);
    setIsLoading(true);
    openSavingNotice('Откат на предыдущий этап...');

    try {
      const prev = await rollbackTask();
      closeSaveNotice();
      setCurrentStep(prev);
      toast.success('Откат выполнен');
    } catch (e) {
      console.error(e);
      openErrorNotice('Ошибка возврата');
    } finally {
      setIsLoading(false);
    }
  };

  const performApproveStage = async () => {
    setShowApproveConfirm(false);
    setIsLoading(true);
    openSavingNotice('Сохранение решения...');

    try {
      await reviewStage('APPROVE');
      closeSaveNotice();
      toast.success('Этап принят. Переход к следующему этапу.');
      onExit(true);
    } catch (e) {
      console.error(e);
      openErrorNotice('Ошибка при одобрении');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveStage = async () => setShowApproveConfirm(true);

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
  };
};
