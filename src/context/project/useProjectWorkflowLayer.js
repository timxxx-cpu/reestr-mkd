import { useCallback } from 'react';
import { ApiService } from '../../lib/api-service';
import { APP_STATUS, STEPS_CONFIG, WORKFLOW_STAGES } from '../../lib/constants';
import {
    getCompletionTransition,
    getRollbackTransition,
    getReviewTransition
} from '../../lib/workflow-state-machine';

const createHistoryEntry = (user, action, comment, details = {}) => ({
    date: new Date().toISOString(),
    user: user.name || 'Unknown',
    role: user.role || 'system',
    action,
    comment,
    ...details
});

const getStageStepRange = (stageNum) => {
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
    setProjectMeta
}) => {
    const completeTask = useCallback(async (currentIndex) => {
        await saveProjectImmediate({ shouldRefetch: false });

        const currentAppInfo = mergedState.applicationInfo;
        const transition = getCompletionTransition(currentAppInfo, currentIndex);

        const newCompleted = [...(currentAppInfo.completedSteps || [])];
        if (!newCompleted.includes(currentIndex)) {
            newCompleted.push(currentIndex);
        }

        let historyComment = `Шаг "${STEPS_CONFIG[currentIndex]?.title}" выполнен.`;
        if (transition.isLastStepGlobal) {
            historyComment = `Проект полностью завершен и переведен в статус "${APP_STATUS.COMPLETED}".`;
        } else if (transition.isStageBoundary) {
            historyComment = `Этап ${transition.stage} завершен. Отправлен на проверку (REVIEW).`;
        } else if (transition.isIntegrationStart) {
            historyComment = `Переход к этапу интеграции с УЗКАД. Статус изменен на "${APP_STATUS.INTEGRATION}".`;
        }

        const historyItem = createHistoryEntry(
            userProfile,
            transition.isStageBoundary ? 'Отправка на проверку' : (transition.isIntegrationStart ? 'Старт интеграции' : 'Завершение задачи'),
            historyComment,
            {
                prevStatus: currentAppInfo.status,
                nextStatus: transition.nextStatus,
                stage: transition.stage,
                stepIndex: currentIndex
            }
        );

        const updates = {
            applicationInfo: {
                ...currentAppInfo,
                completedSteps: newCompleted,
                currentStepIndex: transition.nextStepIndex,
                status: transition.nextStatus,
                currentStage: transition.isStageBoundary ? transition.nextStage : currentAppInfo.currentStage,
                history: [historyItem, ...(currentAppInfo.history || [])]
            }
        };

        setProjectMeta(prev => ({ ...prev, ...updates }));
        await ApiService.saveData(dbScope, projectId, updates);
        await refetch();

        return transition.nextStepIndex;
    }, [saveProjectImmediate, mergedState, userProfile, setProjectMeta, dbScope, projectId, refetch]);

    const rollbackTask = useCallback(async () => {
        await saveProjectImmediate({ shouldRefetch: false });

        const currentAppInfo = mergedState.applicationInfo;
        const transition = getRollbackTransition(currentAppInfo);
        if (transition.currentIndex <= 0) return 0;

        const newCompleted = (currentAppInfo.completedSteps || []).filter(s => s < transition.prevIndex);

        const historyItem = createHistoryEntry(
            userProfile,
            'Возврат задачи',
            `Возврат с шага "${STEPS_CONFIG[transition.currentIndex]?.title}" на "${STEPS_CONFIG[transition.prevIndex]?.title}".`,
            {
                prevStatus: currentAppInfo.status,
                nextStatus: transition.nextStatus,
                stage: transition.nextStage,
                stepIndex: transition.prevIndex
            }
        );

        const updates = {
            applicationInfo: {
                ...currentAppInfo,
                completedSteps: newCompleted,
                currentStepIndex: transition.prevIndex,
                status: transition.nextStatus,
                currentStage: transition.nextStage,
                history: [historyItem, ...(currentAppInfo.history || [])]
            }
        };

        setProjectMeta(prev => ({ ...prev, ...updates }));
        await ApiService.saveData(dbScope, projectId, updates);
        await refetch();

        return transition.prevIndex;
    }, [saveProjectImmediate, mergedState, userProfile, setProjectMeta, dbScope, projectId, refetch]);

    const reviewStage = useCallback(async (action, comment = '') => {
        const currentAppInfo = mergedState.applicationInfo;
        const transition = getReviewTransition(currentAppInfo, action);

        const { startIndex, endIndex } = getStageStepRange(transition.reviewedStage);
        const reviewedStepIndexes = Array.from({ length: endIndex - startIndex + 1 }, (_, i) => startIndex + i);

        let updatedVerifiedSteps = [...(currentAppInfo.verifiedSteps || [])];
        if (transition.isApprove) {
            updatedVerifiedSteps = Array.from(new Set([...updatedVerifiedSteps, ...reviewedStepIndexes]));
        } else {
            updatedVerifiedSteps = updatedVerifiedSteps.filter((idx) => idx < startIndex || idx > endIndex);
        }

        const historyItem = createHistoryEntry(
            userProfile,
            transition.isApprove ? 'Этап принят' : 'Возврат на доработку',
            comment || (transition.isApprove
                ? `Этап ${transition.reviewedStage} проверен и одобрен.`
                : `Этап ${transition.reviewedStage} возвращен на доработку.`),
            {
                prevStatus: currentAppInfo.status,
                nextStatus: transition.nextStatus,
                stage: transition.reviewedStage,
                stepIndex: transition.nextStepIndex
            }
        );

        const updates = {
            applicationInfo: {
                ...currentAppInfo,
                status: transition.nextStatus,
                currentStage: transition.nextStage,
                currentStepIndex: transition.nextStepIndex,
                history: [historyItem, ...(currentAppInfo.history || [])],
                rejectionReason: !transition.isApprove ? comment : null,
                verifiedSteps: updatedVerifiedSteps
            }
        };

        setProjectMeta(prev => ({ ...prev, ...updates }));
        await ApiService.saveData(dbScope, projectId, updates);
        await refetch();

        return transition.nextStepIndex;
    }, [mergedState, userProfile, setProjectMeta, dbScope, projectId, refetch]);

    return {
        completeTask,
        rollbackTask,
        reviewStage
    };
};
