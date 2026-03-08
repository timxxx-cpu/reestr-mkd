import { useCallback } from 'react';
import { ApiService } from '../../lib/api-service';
import { getActorFromProfile } from '../../lib/actor';
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
  const actor = getActorFromProfile(userProfile);

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

      let historyComment = `РЁР°Рі "${STEPS_CONFIG[currentIndex]?.title}" РІС‹РїРѕР»РЅРµРЅ.`;
      if (currentIndex >= STEPS_CONFIG.length - 1) {
        historyComment = 'РџСЂРѕРµРєС‚ РїРѕР»РЅРѕСЃС‚СЊСЋ Р·Р°РІРµСЂС€РµРЅ.';
      }

      const applicationId = getRequiredApplicationId();
      const response = ensureWorkflowResponse(
        await ApiService.completeWorkflowStepViaBff({
          applicationId,
          stepIndex: currentIndex,
          comment: historyComment,
          userName: actor.userName,
          userRoleId: actor.userRoleId,
          userRole: actor.userRole,
          idempotencyKey: `complete-${applicationId}-${Date.now()}`,
        }),
        'complete-step'
      );

      await refetch();
      return response.currentStep;
    },
    [actor, saveProjectImmediate, refetch, getRequiredApplicationId]
  );

  const rollbackTask = useCallback(async () => {
    await saveProjectImmediate({ shouldRefetch: false });

    if (currentStepIndex <= 0) return 0;

    const applicationId = getRequiredApplicationId();
    const response = ensureWorkflowResponse(
      await ApiService.rollbackWorkflowStepViaBff({
        applicationId,
        reason: `Р’РѕР·РІСЂР°С‚ СЃ С€Р°РіР° "${STEPS_CONFIG[currentStepIndex]?.title}".`,
        userName: actor.userName,
        userRoleId: actor.userRoleId,
        userRole: actor.userRole,
        idempotencyKey: `rollback-${applicationId}-${Date.now()}`,
      }),
      'rollback-step'
    );

    await refetch();
    return response.currentStep;
  }, [actor, saveProjectImmediate, refetch, getRequiredApplicationId, currentStepIndex]);

  const reviewStage = useCallback(
    async (action, comment = '') => {
      const applicationId = getRequiredApplicationId();
      const response = ensureWorkflowResponse(
        await ApiService.reviewWorkflowStageViaBff({
          applicationId,
          action,
          comment,
          userName: actor.userName,
          userRoleId: actor.userRoleId,
          userRole: actor.userRole,
          idempotencyKey: `review-${action}-${applicationId}-${Date.now()}`,
        }),
        action === 'APPROVE' ? 'review-approve' : 'review-reject'
      );

      await refetch();
      return response.currentStep;
    },
    [actor, refetch, getRequiredApplicationId]
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
          userName: actor.userName,
          userRoleId: actor.userRoleId,
          userRole: actor.userRole,
          idempotencyKey: `req-decline-${applicationId}-${Date.now()}`,
        }),
        'request-decline'
      );

      await refetch();
    },
    [actor, saveProjectImmediate, refetch, getRequiredApplicationId, currentStepIndex]
  );

  const confirmDecline = useCallback(
    async (comment = '') => {
      const applicationId = getRequiredApplicationId();
      ensureWorkflowResponse(
        await ApiService.declineApplicationViaBff({
          applicationId,
          reason: comment || 'Р—Р°СЏРІР»РµРЅРёРµ РѕС‚РєР»РѕРЅРµРЅРѕ.',
          userName: actor.userName,
          userRoleId: actor.userRoleId,
          userRole: actor.userRole,
          idempotencyKey: `decline-${applicationId}-${Date.now()}`,
        }),
        'decline'
      );

      await refetch();
    },
    [actor, refetch, getRequiredApplicationId]
  );

  const returnFromDecline = useCallback(
    async (comment = '') => {
      const applicationId = getRequiredApplicationId();
      ensureWorkflowResponse(
        await ApiService.returnFromDeclineViaBff({
          applicationId,
          comment,
          userName: actor.userName,
          userRoleId: actor.userRoleId,
          userRole: actor.userRole,
          idempotencyKey: `return-decline-${applicationId}-${Date.now()}`,
        }),
        'return-from-decline'
      );

      await refetch();
    },
    [actor, refetch, getRequiredApplicationId]
  );

  const restoreFromDecline = useCallback(
    async (comment = '') => {
      const applicationId = getRequiredApplicationId();
      ensureWorkflowResponse(
        await ApiService.restoreApplicationViaBff({
          applicationId,
          comment,
          userName: actor.userName,
          userRoleId: actor.userRoleId,
          userRole: actor.userRole,
          idempotencyKey: `restore-${applicationId}-${Date.now()}`,
        }),
        'restore'
      );

      await refetch();
    },
    [actor, refetch, getRequiredApplicationId]
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
