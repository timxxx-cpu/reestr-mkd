/**
 * Чистая бизнес-логика переходов состояний workflow.
 * Не зависит от HTTP, Supabase или Fastify — легко тестируется в изоляции.
 */

export const INTEGRATION_START_IDX = 13;

export const LAST_STEP_INDEX_BY_STAGE = Object.freeze({
  1: 6,
  2: 9,
  3: 12,
  4: 14,
});

export const TOTAL_STEPS = 15;

export function getStageStepRange(stage) {
  const normalizedStage = Number(stage || 1);
  const rangeEnd = LAST_STEP_INDEX_BY_STAGE[normalizedStage];
  if (!Number.isInteger(rangeEnd) || rangeEnd < 0) return null;

  const prevStage = normalizedStage - 1;
  const prevEnd = prevStage >= 1 ? LAST_STEP_INDEX_BY_STAGE[prevStage] : -1;
  const rangeStart = Number.isInteger(prevEnd) ? prevEnd + 1 : 0;

  return { start: rangeStart, end: rangeEnd };
}

export function buildCompletionTransition(current) {
  const currentStep = Number(current.current_step || 0);
  const currentStage = Number(current.current_stage || 1);
  const nextStepIndex = currentStep + 1;
  const stageBoundary = LAST_STEP_INDEX_BY_STAGE[currentStage] === currentStep;
  const isLastStepGlobal = nextStepIndex >= TOTAL_STEPS;

  let nextStatus = current.status || 'IN_PROGRESS';
  let nextSubstatus = current.workflow_substatus || 'DRAFT';
  let nextStage = currentStage;

  if (isLastStepGlobal) {
    nextStatus = 'COMPLETED';
    nextSubstatus = 'DONE';
  } else if (stageBoundary) {
    nextStatus = 'IN_PROGRESS';
    nextSubstatus = 'REVIEW';
    nextStage = currentStage + 1;
  } else if (nextStepIndex === INTEGRATION_START_IDX) {
    nextStatus = 'IN_PROGRESS';
    nextSubstatus = 'INTEGRATION';
  } else {
    nextStatus = 'IN_PROGRESS';
    if (nextSubstatus !== 'INTEGRATION') nextSubstatus = 'DRAFT';
  }

  return { nextStepIndex, nextStatus, nextSubstatus, nextStage };
}

export function buildRollbackTransition(current) {
  const currentStep = Number(current.current_step || 0);
  const prevIndex = Math.max(0, currentStep - 1);
  const currentSubstatus = current.workflow_substatus || 'DRAFT';

  let nextSubstatus = currentSubstatus;
  if (currentSubstatus === 'REVIEW' || currentSubstatus === 'DONE') {
    nextSubstatus = 'DRAFT';
  }

  return {
    nextStepIndex: prevIndex,
    nextStage: Number(current.current_stage || 1),
    nextStatus: 'IN_PROGRESS',
    nextSubstatus,
  };
}

export function buildReviewTransition(current, action) {
  const isApprove = action === 'APPROVE';
  const currentStage = Number(current.current_stage || 1);
  let nextStatus = current.status || 'IN_PROGRESS';
  let nextSubstatus = current.workflow_substatus || 'DRAFT';
  let nextStepIndex = Number(current.current_step || 0);
  let nextStage = currentStage;

  if (isApprove) {
    nextSubstatus = 'DRAFT';
    if (nextStepIndex === INTEGRATION_START_IDX) nextSubstatus = 'INTEGRATION';
    nextStatus = 'IN_PROGRESS';
  } else {
    nextStage = Math.max(1, currentStage - 1);
    nextStepIndex = LAST_STEP_INDEX_BY_STAGE[nextStage] ?? 0;
    nextSubstatus = 'REVISION';
    nextStatus = 'IN_PROGRESS';
  }

  return { isApprove, nextStatus, nextSubstatus, nextStepIndex, nextStage };
}
