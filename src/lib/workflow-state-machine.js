import {
  APP_STATUS,
  ROLES,
  WORKFLOW_STAGES,
  STEPS_CONFIG,
  WORKFLOW_SUBSTATUS,
  SUBSTATUS_TO_STATUS,
} from './constants.js';
import { getStepStage } from './workflow-utils.js';

const INTEGRATION_START_IDX = 12;

// --- WORKFLOW ACTIONS ---
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

// --- ROLE & STATUS CHECKS ---

/**
 * Определяет, может ли пользователь редактировать данные
 * в зависимости от роли и подстатуса workflow.
 * @param {string} role - Роль пользователя
 * @param {string} substatus - Текущий подстатус workflow
 * @returns {boolean}
 */
export const canEditByRoleAndStatus = (role, substatus) => {
  if (role === ROLES.ADMIN) return true;
  if (role === ROLES.CONTROLLER) return false;
  if (role === ROLES.BRANCH_MANAGER) return false;

  if (role === ROLES.TECHNICIAN) {
    return [
      WORKFLOW_SUBSTATUS.DRAFT,
      WORKFLOW_SUBSTATUS.REVISION,
      WORKFLOW_SUBSTATUS.RETURNED_BY_MANAGER,
      WORKFLOW_SUBSTATUS.INTEGRATION,
    ].includes(substatus);
  }

  return false;
};

/**
 * Определяет, может ли пользователь запросить отказ заявления.
 * Только техник может запросить отказ, и только из рабочих подстатусов.
 */
export const canRequestDecline = (role, substatus) => {
  if (role !== ROLES.TECHNICIAN) return false;
  return [
    WORKFLOW_SUBSTATUS.DRAFT,
    WORKFLOW_SUBSTATUS.REVISION,
    WORKFLOW_SUBSTATUS.RETURNED_BY_MANAGER,
    WORKFLOW_SUBSTATUS.INTEGRATION,
  ].includes(substatus);
};

/**
 * Определяет, может ли пользователь принять входящую заявку.
 */
export const canTakeInboxApplication = role => {
  return role === ROLES.ADMIN || role === ROLES.BRANCH_MANAGER;
};

/**
 * Определяет, может ли пользователь отказать заявление с рабочего стола.
 */
export const canDeclineFromDashboard = (role, status, substatus) => {
  if (status === APP_STATUS.COMPLETED || status === APP_STATUS.DECLINED) return false;

  if (role === ROLES.ADMIN) return true;
  if (role === ROLES.BRANCH_MANAGER) return true;
  if (role === ROLES.CONTROLLER && substatus === WORKFLOW_SUBSTATUS.REVIEW) return true;

  return false;
};

/**
 * Определяет, может ли пользователь назначать техника-исполнителя.
 */
export const canAssignTechnician = role => {
  return role === ROLES.ADMIN || role === ROLES.BRANCH_MANAGER;
};

/**
 * Определяет, может ли пользователь рассматривать запрос на отказ.
 */
export const canReviewDeclineRequest = (role, substatus) => {
  if (substatus !== WORKFLOW_SUBSTATUS.PENDING_DECLINE) return false;
  return role === ROLES.ADMIN || role === ROLES.BRANCH_MANAGER;
};

// --- COMPLETION TRANSITION ---

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
    // Подстатус остается DRAFT (или INTEGRATION если уже в интеграции)
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

// --- ROLLBACK TRANSITION ---

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

// --- REVIEW TRANSITION (APPROVE / REJECT) ---

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

// --- DECLINE TRANSITION (Отказ заявления) ---

export const getDeclineTransition = (currentAppInfo, declinedByRole) => {
  const substatusMap = {
    [ROLES.CONTROLLER]: WORKFLOW_SUBSTATUS.DECLINED_BY_CONTROLLER,
    [ROLES.BRANCH_MANAGER]: WORKFLOW_SUBSTATUS.DECLINED_BY_MANAGER,
    [ROLES.ADMIN]: WORKFLOW_SUBSTATUS.DECLINED_BY_ADMIN,
  };

  return {
    action: WORKFLOW_ACTIONS.DECLINE,
    nextStatus: APP_STATUS.DECLINED,
    nextSubstatus: substatusMap[declinedByRole] || WORKFLOW_SUBSTATUS.DECLINED_BY_ADMIN,
    prevStatus: currentAppInfo.status,
    prevSubstatus: currentAppInfo.workflowSubstatus,
  };
};

// --- REQUEST DECLINE TRANSITION (Техник запрашивает отказ) ---

export const getRequestDeclineTransition = currentAppInfo => ({
  action: WORKFLOW_ACTIONS.REQUEST_DECLINE,
  nextStatus: APP_STATUS.IN_PROGRESS,
  nextSubstatus: WORKFLOW_SUBSTATUS.PENDING_DECLINE,
  nextStepIndex: currentAppInfo.currentStepIndex,
  nextStage: currentAppInfo.currentStage,
  prevSubstatus: currentAppInfo.workflowSubstatus,
});

// --- RETURN FROM DECLINE TRANSITION (Начальник возвращает на доработку) ---

export const getReturnFromDeclineTransition = currentAppInfo => ({
  action: WORKFLOW_ACTIONS.RETURN_FROM_DECLINE,
  nextStatus: APP_STATUS.IN_PROGRESS,
  nextSubstatus: WORKFLOW_SUBSTATUS.RETURNED_BY_MANAGER,
  nextStepIndex: currentAppInfo.currentStepIndex,
  nextStage: currentAppInfo.currentStage,
  prevSubstatus: currentAppInfo.workflowSubstatus,
});

// --- RESTORE TRANSITION (Восстановление из отказа, только админ) ---

export const getRestoreTransition = currentAppInfo => ({
  action: WORKFLOW_ACTIONS.RESTORE,
  nextStatus: APP_STATUS.IN_PROGRESS,
  nextSubstatus: WORKFLOW_SUBSTATUS.DRAFT,
  nextStepIndex: currentAppInfo.currentStepIndex,
  nextStage: currentAppInfo.currentStage,
  prevStatus: currentAppInfo.status,
  prevSubstatus: currentAppInfo.workflowSubstatus,
});
