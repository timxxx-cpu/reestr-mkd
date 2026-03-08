import {
  APP_STATUS,
  WORKFLOW_STAGES,
  STEPS_CONFIG,
  WORKFLOW_SUBSTATUS,
  SUBSTATUS_TO_STATUS,
} from './constants.js';
import {
  canAssignTechnicianByRole,
  canDeclineFromDashboardByRole,
  canEditWorkflowByRole,
  canRequestDeclineByRole,
  canReviewDeclineRequestByRole,
  canTakeInboxByRole,
  getDeclineSubstatusByRole,
} from './role-policy.js';
import { getRoleKey } from './roles.js';
import { getStepStage } from './workflow-utils.js';

const INTEGRATION_START_IDX = 12;

export const WORKFLOW_ACTIONS = {
  COMPLETE_STEP: 'COMPLETE_STEP',
  ROLLBACK_STEP: 'ROLLBACK_STEP',
  REVIEW_APPROVE: 'REVIEW_APPROVE',
  REVIEW_REJECT: 'REVIEW_REJECT',
  DECLINE: 'DECLINE',
  REQUEST_DECLINE: 'REQUEST_DECLINE',
  RETURN_FROM_DECLINE: 'RETURN_FROM_DECLINE',
  RESTORE: 'RESTORE',
};

export const canEditByRoleAndStatus = (role, substatus) => canEditWorkflowByRole(role, substatus);

export const canRequestDecline = (role, substatus) => canRequestDeclineByRole(role, substatus);

export const canTakeInboxApplication = role => canTakeInboxByRole(role);

export const canDeclineFromDashboard = (role, status, substatus) =>
  canDeclineFromDashboardByRole(role, status, substatus);

export const canAssignTechnician = role => canAssignTechnicianByRole(role);

export const canReviewDeclineRequest = (role, substatus) =>
  canReviewDeclineRequestByRole(role, substatus);

export const getCompletionTransition = (currentAppInfo, currentIndex) => {
  const nextStepIndex = currentIndex + 1;
  const currentStageNum = getStepStage(currentIndex);
  const stageConfig = WORKFLOW_STAGES[currentStageNum];
  const isStageBoundary = stageConfig && stageConfig.lastStepIndex === currentIndex;
  const isLastStepGlobal = nextStepIndex >= STEPS_CONFIG.length;

  let nextStatus = currentAppInfo.status || APP_STATUS.IN_PROGRESS;
  let nextSubstatus = currentAppInfo.workflowSubstatus || WORKFLOW_SUBSTATUS.DRAFT;
  let nextStage = currentAppInfo.currentStage;

  if (isLastStepGlobal) {
    nextStatus = APP_STATUS.COMPLETED;
    nextSubstatus = WORKFLOW_SUBSTATUS.DONE;
  } else if (isStageBoundary) {
    nextStatus = APP_STATUS.IN_PROGRESS;
    nextSubstatus = WORKFLOW_SUBSTATUS.REVIEW;
    nextStage = currentStageNum + 1;
  } else if (nextStepIndex === INTEGRATION_START_IDX) {
    nextStatus = APP_STATUS.IN_PROGRESS;
    nextSubstatus = WORKFLOW_SUBSTATUS.INTEGRATION;
  } else {
    nextStatus = APP_STATUS.IN_PROGRESS;
    if (nextSubstatus !== WORKFLOW_SUBSTATUS.INTEGRATION) {
      nextSubstatus = WORKFLOW_SUBSTATUS.DRAFT;
    }
  }

  return {
    action: WORKFLOW_ACTIONS.COMPLETE_STEP,
    nextStepIndex,
    nextStatus,
    nextSubstatus,
    nextStage,
    isStageBoundary,
    isIntegrationStart: nextStepIndex === INTEGRATION_START_IDX,
    isLastStepGlobal,
    stage: currentStageNum,
  };
};

export const getRollbackTransition = currentAppInfo => {
  const currentIndex = currentAppInfo.currentStepIndex || 0;
  const prevIndex = Math.max(0, currentIndex - 1);
  const currentSubstatus = currentAppInfo.workflowSubstatus || WORKFLOW_SUBSTATUS.DRAFT;

  let nextSubstatus = currentSubstatus;
  if (
    currentSubstatus === WORKFLOW_SUBSTATUS.REVIEW ||
    currentSubstatus === WORKFLOW_SUBSTATUS.DONE
  ) {
    nextSubstatus = WORKFLOW_SUBSTATUS.DRAFT;
  }

  const nextStatus = SUBSTATUS_TO_STATUS[nextSubstatus] || APP_STATUS.IN_PROGRESS;

  return {
    action: WORKFLOW_ACTIONS.ROLLBACK_STEP,
    currentIndex,
    prevIndex,
    nextStatus,
    nextSubstatus,
    nextStage: getStepStage(prevIndex),
  };
};

export const getReviewTransition = (currentAppInfo, action) => {
  const isApprove = action === 'APPROVE';

  let nextStatus = currentAppInfo.status;
  let nextSubstatus = currentAppInfo.workflowSubstatus;
  let nextStepIndex = currentAppInfo.currentStepIndex;
  let nextStage = currentAppInfo.currentStage;

  const reviewedStage = Math.max(1, currentAppInfo.currentStage - 1);

  if (isApprove) {
    nextSubstatus = WORKFLOW_SUBSTATUS.DRAFT;
    if (nextStepIndex === INTEGRATION_START_IDX) {
      nextSubstatus = WORKFLOW_SUBSTATUS.INTEGRATION;
    }
    nextStatus = SUBSTATUS_TO_STATUS[nextSubstatus] || APP_STATUS.IN_PROGRESS;
  } else {
    nextStage = Math.max(1, currentAppInfo.currentStage - 1);
    const prevStageConfig = WORKFLOW_STAGES[nextStage];
    nextStepIndex = prevStageConfig ? prevStageConfig.lastStepIndex : 0;
    nextSubstatus = WORKFLOW_SUBSTATUS.REVISION;
    nextStatus = APP_STATUS.IN_PROGRESS;
  }

  return {
    action: isApprove ? WORKFLOW_ACTIONS.REVIEW_APPROVE : WORKFLOW_ACTIONS.REVIEW_REJECT,
    isApprove,
    reviewedStage,
    nextStatus,
    nextSubstatus,
    nextStepIndex,
    nextStage,
  };
};

export const getDeclineTransition = (currentAppInfo, declinedByRole) => {
  return {
    action: WORKFLOW_ACTIONS.DECLINE,
    nextStatus: APP_STATUS.DECLINED,
    nextSubstatus: getDeclineSubstatusByRole(getRoleKey(declinedByRole)),
    prevStatus: currentAppInfo.status,
    prevSubstatus: currentAppInfo.workflowSubstatus,
  };
};

export const getRequestDeclineTransition = currentAppInfo => ({
  action: WORKFLOW_ACTIONS.REQUEST_DECLINE,
  nextStatus: APP_STATUS.IN_PROGRESS,
  nextSubstatus: WORKFLOW_SUBSTATUS.PENDING_DECLINE,
  nextStepIndex: currentAppInfo.currentStepIndex,
  nextStage: currentAppInfo.currentStage,
  prevSubstatus: currentAppInfo.workflowSubstatus,
});

export const getReturnFromDeclineTransition = currentAppInfo => ({
  action: WORKFLOW_ACTIONS.RETURN_FROM_DECLINE,
  nextStatus: APP_STATUS.IN_PROGRESS,
  nextSubstatus: WORKFLOW_SUBSTATUS.RETURNED_BY_MANAGER,
  nextStepIndex: currentAppInfo.currentStepIndex,
  nextStage: currentAppInfo.currentStage,
  prevSubstatus: currentAppInfo.workflowSubstatus,
});

export const getRestoreTransition = currentAppInfo => ({
  action: WORKFLOW_ACTIONS.RESTORE,
  nextStatus: APP_STATUS.IN_PROGRESS,
  nextSubstatus: WORKFLOW_SUBSTATUS.DRAFT,
  nextStepIndex: currentAppInfo.currentStepIndex,
  nextStage: currentAppInfo.currentStage,
  prevStatus: currentAppInfo.status,
  prevSubstatus: currentAppInfo.workflowSubstatus,
});
