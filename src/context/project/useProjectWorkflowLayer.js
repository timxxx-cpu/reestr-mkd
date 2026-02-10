import { useCallback } from 'react';
import { ApiService } from '../../lib/api-service';
import { APP_STATUS, STEPS_CONFIG, WORKFLOW_STAGES, WORKFLOW_SUBSTATUS } from '../../lib/constants';
import {
  getCompletionTransition,
  getRollbackTransition,
  getReviewTransition,
  getDeclineTransition,
  getRequestDeclineTransition,
  getReturnFromDeclineTransition,
  getRestoreTransition,
} from '../../lib/workflow-state-machine';
import { normalizeReturnedSubstatus } from '../../lib/workflow-utils';

const createHistoryEntry = (user, action, comment, details = {}) => ({
  date: new Date().toISOString(),
  user: user.name || 'Unknown',
  role: user.role || 'system',
  action,
  comment,
  ...details,
});

const getStageStepRange = stageNum => {
  const prevStage = WORKFLOW_STAGES[stageNum - 1];
  const currentStage = WORKFLOW_STAGES[stageNum];
  const startIndex = stageNum <= 1 ? 0 : (prevStage?.lastStepIndex ?? -1) + 1;
  const endIndex = currentStage?.lastStepIndex ?? STEPS_CONFIG.length - 1;
  return { startIndex, endIndex };
};

export const useProjectWorkflowLayer = ({
  dbScope,
  projectId,
  mergedState,
  userProfile,
  refetch,
  saveProjectImmediate,
  setProjectMeta,
}) => {
  // --- COMPLETE TASK ---
  const completeTask = useCallback(
    async currentIndex => {
      await saveProjectImmediate({ shouldRefetch: false });

      const currentAppInfo = mergedState.applicationInfo;

      // Автонормализация: если техник начал работу в RETURNED_BY_MANAGER → переход в DRAFT
      const normalizedSubstatus = normalizeReturnedSubstatus(
        currentAppInfo.workflowSubstatus || WORKFLOW_SUBSTATUS.DRAFT
      );

      const appInfoForTransition = {
        ...currentAppInfo,
        workflowSubstatus: normalizedSubstatus,
      };

      const transition = getCompletionTransition(appInfoForTransition, currentIndex);

      const newCompleted = [...(currentAppInfo.completedSteps || [])];
      if (!newCompleted.includes(currentIndex)) {
        newCompleted.push(currentIndex);
      }

      let historyComment = `Шаг "${STEPS_CONFIG[currentIndex]?.title}" выполнен.`;
      if (transition.isLastStepGlobal) {
        historyComment = `Проект полностью завершен.`;
      } else if (transition.isStageBoundary) {
        historyComment = `Этап ${transition.stage} завершен. Отправлен на проверку.`;
      } else if (transition.isIntegrationStart) {
        historyComment = `Переход к этапу интеграции с УЗКАД.`;
      }

      const historyItem = createHistoryEntry(
        userProfile,
        transition.isStageBoundary
          ? 'Отправка на проверку'
          : transition.isIntegrationStart
            ? 'Старт интеграции'
            : 'Завершение задачи',
        historyComment,
        {
          prevStatus: currentAppInfo.status,
          nextStatus: transition.nextStatus,
          stage: transition.stage,
          stepIndex: currentIndex,
        }
      );

      const updates = {
        applicationInfo: {
          ...currentAppInfo,
          completedSteps: newCompleted,
          currentStepIndex: transition.nextStepIndex,
          status: transition.nextStatus,
          workflowSubstatus: transition.nextSubstatus,
          currentStage: transition.isStageBoundary
            ? transition.nextStage
            : currentAppInfo.currentStage,
          history: [historyItem, ...(currentAppInfo.history || [])],
        },
      };

      setProjectMeta(prev => ({ ...prev, ...updates }));
      await ApiService.saveData(dbScope, projectId, updates);
      await refetch();

      return transition.nextStepIndex;
    },
    [saveProjectImmediate, mergedState, userProfile, setProjectMeta, dbScope, projectId, refetch]
  );

  // --- ROLLBACK TASK ---
  const rollbackTask = useCallback(async () => {
    await saveProjectImmediate({ shouldRefetch: false });

    const currentAppInfo = mergedState.applicationInfo;
    const transition = getRollbackTransition(currentAppInfo);
    if (transition.currentIndex <= 0) return 0;

    const newCompleted = (currentAppInfo.completedSteps || []).filter(
      s => s < transition.prevIndex
    );

    const historyItem = createHistoryEntry(
      userProfile,
      'Возврат задачи',
      `Возврат с шага "${STEPS_CONFIG[transition.currentIndex]?.title}" на "${STEPS_CONFIG[transition.prevIndex]?.title}".`,
      {
        prevStatus: currentAppInfo.status,
        nextStatus: transition.nextStatus,
        stage: transition.nextStage,
        stepIndex: transition.prevIndex,
      }
    );

    const updates = {
      applicationInfo: {
        ...currentAppInfo,
        completedSteps: newCompleted,
        currentStepIndex: transition.prevIndex,
        status: transition.nextStatus,
        workflowSubstatus: transition.nextSubstatus,
        currentStage: transition.nextStage,
        history: [historyItem, ...(currentAppInfo.history || [])],
      },
    };

    setProjectMeta(prev => ({ ...prev, ...updates }));
    await ApiService.saveData(dbScope, projectId, updates);
    await refetch();

    return transition.prevIndex;
  }, [saveProjectImmediate, mergedState, userProfile, setProjectMeta, dbScope, projectId, refetch]);

  // --- REVIEW STAGE (APPROVE / REJECT) ---
  const reviewStage = useCallback(
    async (action, comment = '') => {
      const currentAppInfo = mergedState.applicationInfo;
      const transition = getReviewTransition(currentAppInfo, action);

      const { startIndex, endIndex } = getStageStepRange(transition.reviewedStage);
      const reviewedStepIndexes = Array.from(
        { length: endIndex - startIndex + 1 },
        (_, i) => startIndex + i
      );

      let updatedVerifiedSteps = [...(currentAppInfo.verifiedSteps || [])];
      if (transition.isApprove) {
        updatedVerifiedSteps = Array.from(
          new Set([...updatedVerifiedSteps, ...reviewedStepIndexes])
        );
      } else {
        updatedVerifiedSteps = updatedVerifiedSteps.filter(
          idx => idx < startIndex || idx > endIndex
        );
      }

      const historyItem = createHistoryEntry(
        userProfile,
        transition.isApprove ? 'Этап принят' : 'Возврат на доработку',
        comment ||
          (transition.isApprove
            ? `Этап ${transition.reviewedStage} проверен и одобрен.`
            : `Этап ${transition.reviewedStage} возвращен на доработку.`),
        {
          prevStatus: currentAppInfo.status,
          nextStatus: transition.nextStatus,
          stage: transition.reviewedStage,
          stepIndex: transition.nextStepIndex,
        }
      );

      const updates = {
        applicationInfo: {
          ...currentAppInfo,
          status: transition.nextStatus,
          workflowSubstatus: transition.nextSubstatus,
          currentStage: transition.nextStage,
          currentStepIndex: transition.nextStepIndex,
          history: [historyItem, ...(currentAppInfo.history || [])],
          rejectionReason: !transition.isApprove ? comment : null,
          verifiedSteps: updatedVerifiedSteps,
        },
      };

      setProjectMeta(prev => ({ ...prev, ...updates }));
      await ApiService.saveData(dbScope, projectId, updates);
      await refetch();

      return transition.nextStepIndex;
    },
    [mergedState, userProfile, setProjectMeta, dbScope, projectId, refetch]
  );

  // --- REQUEST DECLINE (Техник запрашивает отказ) ---
  const requestDecline = useCallback(
    async reason => {
      await saveProjectImmediate({ shouldRefetch: false });

      const currentAppInfo = mergedState.applicationInfo;
      const transition = getRequestDeclineTransition(currentAppInfo);

      const historyItem = createHistoryEntry(
        userProfile,
        'Запрос на отказ',
        reason || 'Техник запросил отказ заявления.',
        {
          prevStatus: currentAppInfo.status,
          nextStatus: transition.nextStatus,
          stepIndex: currentAppInfo.currentStepIndex,
        }
      );

      const updates = {
        applicationInfo: {
          ...currentAppInfo,
          status: transition.nextStatus,
          workflowSubstatus: transition.nextSubstatus,
          requestedDeclineReason: reason,
          requestedDeclineStep: currentAppInfo.currentStepIndex,
          requestedDeclineBy: userProfile.name,
          requestedDeclineAt: new Date().toISOString(),
          history: [historyItem, ...(currentAppInfo.history || [])],
        },
      };

      setProjectMeta(prev => ({ ...prev, ...updates }));
      await ApiService.saveData(dbScope, projectId, updates);
      await refetch();
    },
    [saveProjectImmediate, mergedState, userProfile, setProjectMeta, dbScope, projectId, refetch]
  );

  // --- CONFIRM DECLINE (Начальник филиала / админ подтверждает отказ) ---
  const confirmDecline = useCallback(
    async (comment = '') => {
      const currentAppInfo = mergedState.applicationInfo;
      const transition = getDeclineTransition(currentAppInfo, userProfile.role);

      const historyItem = createHistoryEntry(
        userProfile,
        'Отказ заявления',
        comment || 'Заявление отклонено.',
        {
          prevStatus: currentAppInfo.status,
          nextStatus: transition.nextStatus,
          stepIndex: currentAppInfo.currentStepIndex,
        }
      );

      const updates = {
        applicationInfo: {
          ...currentAppInfo,
          status: transition.nextStatus,
          workflowSubstatus: transition.nextSubstatus,
          history: [historyItem, ...(currentAppInfo.history || [])],
        },
      };

      setProjectMeta(prev => ({ ...prev, ...updates }));
      await ApiService.saveData(dbScope, projectId, updates);
      await refetch();
    },
    [mergedState, userProfile, setProjectMeta, dbScope, projectId, refetch]
  );

  // --- RETURN FROM DECLINE (Начальник филиала возвращает на доработку) ---
  const returnFromDecline = useCallback(
    async (comment = '') => {
      const currentAppInfo = mergedState.applicationInfo;
      const transition = getReturnFromDeclineTransition(currentAppInfo);

      const historyItem = createHistoryEntry(
        userProfile,
        'Возврат на доработку',
        comment || 'Начальник филиала вернул заявление на доработку.',
        {
          prevStatus: currentAppInfo.status,
          nextStatus: transition.nextStatus,
          stepIndex: currentAppInfo.currentStepIndex,
        }
      );

      const updates = {
        applicationInfo: {
          ...currentAppInfo,
          status: transition.nextStatus,
          workflowSubstatus: transition.nextSubstatus,
          requestedDeclineReason: null,
          requestedDeclineStep: null,
          requestedDeclineBy: null,
          requestedDeclineAt: null,
          history: [historyItem, ...(currentAppInfo.history || [])],
        },
      };

      setProjectMeta(prev => ({ ...prev, ...updates }));
      await ApiService.saveData(dbScope, projectId, updates);
      await refetch();
    },
    [mergedState, userProfile, setProjectMeta, dbScope, projectId, refetch]
  );

  // --- RESTORE (Восстановление из отказа, только админ) ---
  const restoreFromDecline = useCallback(
    async (comment = '') => {
      const currentAppInfo = mergedState.applicationInfo;
      const transition = getRestoreTransition(currentAppInfo);

      const historyItem = createHistoryEntry(
        userProfile,
        'Восстановление заявления',
        comment || 'Заявление восстановлено из статуса "Отказано".',
        {
          prevStatus: currentAppInfo.status,
          nextStatus: transition.nextStatus,
          stepIndex: currentAppInfo.currentStepIndex,
        }
      );

      const updates = {
        applicationInfo: {
          ...currentAppInfo,
          status: transition.nextStatus,
          workflowSubstatus: transition.nextSubstatus,
          history: [historyItem, ...(currentAppInfo.history || [])],
        },
      };

      setProjectMeta(prev => ({ ...prev, ...updates }));
      await ApiService.saveData(dbScope, projectId, updates);
      await refetch();
    },
    [mergedState, userProfile, setProjectMeta, dbScope, projectId, refetch]
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
