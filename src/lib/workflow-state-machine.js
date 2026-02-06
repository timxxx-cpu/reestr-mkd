import { APP_STATUS, ROLES, WORKFLOW_STAGES, STEPS_CONFIG } from './constants.js';
import { getStepStage } from './workflow-utils.js';

const INTEGRATION_START_IDX = 12;

export const WORKFLOW_ACTIONS = {
    COMPLETE_STEP: 'COMPLETE_STEP',
    ROLLBACK_STEP: 'ROLLBACK_STEP',
    REVIEW_APPROVE: 'REVIEW_APPROVE',
    REVIEW_REJECT: 'REVIEW_REJECT'
};

export const canEditByRoleAndStatus = (role, status) => {
    if (role === ROLES.ADMIN) return true;
    if (role === ROLES.CONTROLLER) return false;

    if (role === ROLES.TECHNICIAN) {
        return [APP_STATUS.DRAFT, APP_STATUS.NEW, APP_STATUS.REJECTED, APP_STATUS.INTEGRATION].includes(status);
    }

    return false;
};

export const getCompletionTransition = (currentAppInfo, currentIndex) => {
    const nextStepIndex = currentIndex + 1;
    const currentStageNum = getStepStage(currentIndex);
    const stageConfig = WORKFLOW_STAGES[currentStageNum];
    const isStageBoundary = stageConfig && stageConfig.lastStepIndex === currentIndex;
    const isLastStepGlobal = nextStepIndex >= STEPS_CONFIG.length;

    let nextStatus = currentAppInfo.status;
    let nextStage = currentAppInfo.currentStage;

    if (isLastStepGlobal) {
        nextStatus = APP_STATUS.COMPLETED;
    } else if (isStageBoundary) {
        nextStatus = APP_STATUS.REVIEW;
        nextStage = currentStageNum + 1;
    } else if (nextStepIndex === INTEGRATION_START_IDX) {
        nextStatus = APP_STATUS.INTEGRATION;
    }

    return {
        action: WORKFLOW_ACTIONS.COMPLETE_STEP,
        nextStepIndex,
        nextStatus,
        nextStage,
        isStageBoundary,
        isIntegrationStart: nextStepIndex === INTEGRATION_START_IDX,
        isLastStepGlobal,
        stage: currentStageNum
    };
};

export const getRollbackTransition = (currentAppInfo) => {
    const currentIndex = currentAppInfo.currentStepIndex || 0;
    const prevIndex = Math.max(0, currentIndex - 1);
    const nextStatus = [APP_STATUS.COMPLETED, APP_STATUS.REVIEW].includes(currentAppInfo.status)
        ? APP_STATUS.DRAFT
        : currentAppInfo.status;

    return {
        action: WORKFLOW_ACTIONS.ROLLBACK_STEP,
        currentIndex,
        prevIndex,
        nextStatus,
        nextStage: getStepStage(prevIndex)
    };
};

export const getReviewTransition = (currentAppInfo, action) => {
    const isApprove = action === 'APPROVE';

    let nextStatus = currentAppInfo.status;
    let nextStepIndex = currentAppInfo.currentStepIndex;
    let nextStage = currentAppInfo.currentStage;

    const reviewedStage = Math.max(1, currentAppInfo.currentStage - 1);

    if (isApprove) {
        nextStatus = APP_STATUS.DRAFT;
        if (nextStepIndex === INTEGRATION_START_IDX) {
            nextStatus = APP_STATUS.INTEGRATION;
        }
    } else {
        nextStage = Math.max(1, currentAppInfo.currentStage - 1);
        const prevStageConfig = WORKFLOW_STAGES[nextStage];
        nextStepIndex = prevStageConfig ? prevStageConfig.lastStepIndex : 0;
        nextStatus = APP_STATUS.REJECTED;
    }

    return {
        action: isApprove ? WORKFLOW_ACTIONS.REVIEW_APPROVE : WORKFLOW_ACTIONS.REVIEW_REJECT,
        isApprove,
        reviewedStage,
        nextStatus,
        nextStepIndex,
        nextStage
    };
};
