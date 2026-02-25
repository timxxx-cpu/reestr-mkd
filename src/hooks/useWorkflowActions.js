import { useCallback } from 'react';
import { WORKFLOW_COMMENT_ACTIONS } from '@lib/workflow-action-registry';

export const useWorkflowActions = ({
  completeTask,
  rollbackTask,
  reviewStage,
  requestDecline,
  confirmDecline,
  returnFromDecline,
}) => {
  const executeCompletion = useCallback(
    async ({ currentStep, persistBeforeTransition, isStageBoundary, isLastStepGlobal }) => {
      const nextIndex = await completeTask(currentStep, {
        persistBeforeTransition,
      });

      if (isStageBoundary || isLastStepGlobal) {
        return {
          shouldExit: true,
          nextIndex,
          toastType: 'success',
          toastMessage: 'Этап завершен. Отправлено на проверку.',
        };
      }

      return {
        shouldExit: false,
        nextIndex,
        toastType: 'success',
        toastMessage: 'Задача выполнена.',
      };
    },
    [completeTask]
  );

  const executeRollback = useCallback(async () => {
    const prevIndex = await rollbackTask();

    return {
      prevIndex,
      toastType: 'info',
      toastMessage: 'Возврат к предыдущей задаче',
    };
  }, [rollbackTask]);

  const executeApproveStage = useCallback(async () => {
    await reviewStage('APPROVE');

    return {
      shouldExit: true,
      toastType: 'success',
      toastMessage: 'Этап принят. Переход к следующему этапу.',
    };
  }, [reviewStage]);

  const executeCommentAction = useCallback(
    async ({ type, comment }) => {
      if (type === WORKFLOW_COMMENT_ACTIONS.REQUEST_DECLINE) {
        await requestDecline(comment);
        return {
          shouldExit: true,
          toastType: 'info',
          toastMessage: 'Запрос на отказ отправлен начальнику филиала',
        };
      }

      if (type === WORKFLOW_COMMENT_ACTIONS.CONFIRM_DECLINE) {
        await confirmDecline(comment);
        return {
          shouldExit: true,
          toastType: 'error',
          toastMessage: 'Заявление отклонено',
        };
      }

      if (type === WORKFLOW_COMMENT_ACTIONS.RETURN_DECLINE) {
        await returnFromDecline(comment);
        return {
          shouldExit: true,
          toastType: 'success',
          toastMessage: 'Заявление возвращено технику на доработку',
        };
      }

      if (type === WORKFLOW_COMMENT_ACTIONS.REJECT_STAGE) {
        await reviewStage('REJECT', comment);
        return {
          shouldExit: true,
          toastType: 'error',
          toastMessage: 'Возвращено на доработку',
        };
      }

      return null;
    },
    [confirmDecline, requestDecline, returnFromDecline, reviewStage]
  );

  return {
    executeCompletion,
    executeRollback,
    executeApproveStage,
    executeCommentAction,
  };
};
