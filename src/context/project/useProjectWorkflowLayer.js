import { useCallback } from 'react';
import { ApiService } from '../../lib/api-service';
import { STEPS_CONFIG } from '../../lib/constants';

const ensureWorkflowResponse = (response, actionLabel) => {
  if (!response) {
    throw new Error(`BFF backend is required for workflow action: ${actionLabel}`);
  }
  return response;
};

export const useProjectWorkflowLayer = ({
  mergedState,
  userProfile,
  refetch,
  saveProjectImmediate,
}) => {
  const getRequiredApplicationId = useCallback(() => {
    const applicationId = mergedState?.applicationInfo?.id || null;
    if (!applicationId) {
      throw new Error('Application ID is required for workflow actions');
    }
    return applicationId;
  }, [mergedState]);

  const currentStepIndex = mergedState?.applicationInfo?.currentStepIndex ?? 0;

  const completeTask = useCallback(
    async (currentIndex, options = {}) => {
      const { persistBeforeTransition = true } = options;
      if (persistBeforeTransition) {
        await saveProjectImmediate({ shouldRefetch: false });
      }

      let historyComment = `Шаг "${STEPS_CONFIG[currentIndex]?.title}" выполнен.`;
      if (currentIndex >= STEPS_CONFIG.length - 1) {
        historyComment = 'Проект полностью завершен.';
      }

      const applicationId = getRequiredApplicationId();
      const bffResponse = ensureWorkflowResponse(
        await ApiService.completeWorkflowStepViaBff({
          applicationId,
          stepIndex: currentIndex,
          comment: historyComment,
          userName: userProfile?.name,
          userRole: userProfile?.role,
        }),
        'complete-step'
      );

      await refetch();
      return bffResponse.currentStep;
    },
    [saveProjectImmediate, userProfile, refetch, getRequiredApplicationId]
  );

  const rollbackTask = useCallback(async () => {
    await saveProjectImmediate({ shouldRefetch: false });

    if (currentStepIndex <= 0) return 0;

    const applicationId = getRequiredApplicationId();
    const bffResponse = ensureWorkflowResponse(
      await ApiService.rollbackWorkflowStepViaBff({
        applicationId,
        reason: `Возврат с шага "${STEPS_CONFIG[currentStepIndex]?.title}".`,
        userName: userProfile?.name,
        userRole: userProfile?.role,
      }),
      'rollback-step'
    );

    await refetch();
    return bffResponse.currentStep;
  }, [saveProjectImmediate, userProfile, refetch, getRequiredApplicationId, currentStepIndex]);

  const reviewStage = useCallback(
    async (action, comment = '') => {
      const applicationId = getRequiredApplicationId();
      const bffResponse = ensureWorkflowResponse(
        await ApiService.reviewWorkflowStageViaBff({
          applicationId,
          action,
          comment,
          userName: userProfile?.name,
          userRole: userProfile?.role,
        }),
        action === 'APPROVE' ? 'review-approve' : 'review-reject'
      );

      await refetch();
      return bffResponse.currentStep;
    },
    [userProfile, refetch, getRequiredApplicationId]
  );

  const requestDecline = useCallback(
    async reason => {
      await saveProjectImmediate({ shouldRefetch: false });

      const applicationId = getRequiredApplicationId();
      ensureWorkflowResponse(
        await ApiService.requestDeclineViaBff({
          applicationId,
          reason,
          stepIndex: currentStepIndex,
          userName: userProfile?.name,
          userRole: userProfile?.role,
        }),
        'request-decline'
      );

      await refetch();
    },
    [saveProjectImmediate, userProfile, refetch, getRequiredApplicationId, currentStepIndex]
  );

  const confirmDecline = useCallback(
    async (comment = '') => {
      const applicationId = getRequiredApplicationId();
      ensureWorkflowResponse(
        await ApiService.declineApplicationViaBff({
          applicationId,
          reason: comment || 'Заявление отклонено.',
          userName: userProfile?.name,
          userRole: userProfile?.role,
        }),
        'decline'
      );

      await refetch();
    },
    [userProfile, refetch, getRequiredApplicationId]
  );

  const returnFromDecline = useCallback(
    async (comment = '') => {
      const applicationId = getRequiredApplicationId();
      ensureWorkflowResponse(
        await ApiService.returnFromDeclineViaBff({
          applicationId,
          comment,
          userName: userProfile?.name,
          userRole: userProfile?.role,
        }),
        'return-from-decline'
      );

      await refetch();
    },
    [userProfile, refetch, getRequiredApplicationId]
  );

  const restoreFromDecline = useCallback(
    async (comment = '') => {
      const applicationId = getRequiredApplicationId();
      ensureWorkflowResponse(
        await ApiService.restoreApplicationViaBff({
          applicationId,
          comment,
          userName: userProfile?.name,
          userRole: userProfile?.role,
        }),
        'restore'
      );

      await refetch();
    },
    [userProfile, refetch, getRequiredApplicationId]
  );

  return {
    completeTask,
    rollbackTask,
    reviewStage,
    requestDecline,
    confirmDecline,
    returnFromDecline,
    restoreFromDecline,
  };
};
