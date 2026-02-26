import { sendError, requirePolicyActor } from './http-helpers.js';
import { createIdempotencyStore } from './idempotency-store.js';
import {
  buildIdempotencyContext,
  tryServeIdempotentResponse,
  rememberIdempotentResponse,
} from './idempotency-helpers.js';
import {
  getApplication,
  updateApplicationState,
  addHistory,
  updateStepCompletion,
  updateStageVerification,
  ensureActorLock,
} from './application-repository.js';
import {
  buildCompletionTransition,
  buildRollbackTransition,
  buildReviewTransition,
} from './workflow-transitions.js';

/**
 * Хелпер для workflow-маршрутов: проверяет доступ, idempotency, лок и загружает заявку.
 * Возвращает { actor, appRow, idempotencyContext } или null если ответ уже отправлен.
 */
async function prepareWorkflowRequest(req, reply, { supabase, idempotencyStore, action, requireLock = true }) {
  const actor = requirePolicyActor(req, reply, {
    module: 'workflow',
    action,
    forbiddenMessage: 'Role cannot mutate workflow',
  });
  if (!actor) return null;

  const idempotencyContext = buildIdempotencyContext(req, actor);
  if (tryServeIdempotentResponse(idempotencyStore, idempotencyContext, reply)) return null;

  const { applicationId } = req.params;

  if (requireLock) {
    const lockCheck = await ensureActorLock(supabase, applicationId, actor.userId);
    if (!lockCheck.ok) {
      sendError(reply, lockCheck.status, lockCheck.code, lockCheck.message);
      return null;
    }
  }

  const appRes = await getApplication(supabase, applicationId);
  if (!appRes.ok) {
    sendError(reply, appRes.status, appRes.code, appRes.message);
    return null;
  }

  return { actor, appRow: appRes.appRow, idempotencyContext };
}

function buildWorkflowResponse(updatedApp, historyRes) {
  return {
    applicationStatus: updatedApp.status,
    workflowSubstatus: updatedApp.workflow_substatus,
    currentStep: updatedApp.current_step,
    currentStage: updatedApp.current_stage,
    historyEventId: historyRes.historyEventId,
  };
}

export function registerWorkflowRoutes(app, { supabase }) {
  const idempotencyStore = createIdempotencyStore();

  app.post('/api/v1/applications/:applicationId/workflow/complete-step', async (req, reply) => {
    const ctx = await prepareWorkflowRequest(req, reply, { supabase, idempotencyStore, action: 'mutate' });
    if (!ctx) return;

    const { actor, appRow, idempotencyContext } = ctx;
    const { applicationId } = req.params;
    const stepIndex = Number(req.body?.stepIndex);
    const comment = req.body?.comment || null;

    if (!Number.isInteger(stepIndex) || stepIndex < 0) {
      return sendError(reply, 400, 'INVALID_STEP_INDEX', 'stepIndex must be a non-negative integer');
    }

    if (Number(appRow.current_step) !== stepIndex) {
      return sendError(reply, 409, 'INVALID_STEP_STATE', 'stepIndex does not match current step', {
        expectedStepIndex: appRow.current_step,
        gotStepIndex: stepIndex,
      });
    }

    const transition = buildCompletionTransition(appRow);
    const updateRes = await updateApplicationState(supabase, applicationId, transition);
    if (!updateRes.ok) return sendError(reply, updateRes.status, updateRes.code, updateRes.message);

    const completedRes = await updateStepCompletion(supabase, { applicationId, stepIndex, isCompleted: true });
    if (!completedRes.ok) return sendError(reply, completedRes.status, completedRes.code, completedRes.message);

    const historyRes = await addHistory(supabase, {
      applicationId,
      action: 'COMPLETE_STEP',
      prevStatus: appRow.status,
      nextStatus: transition.nextStatus,
      userName: actor.userId,
      comment: comment || `Complete step ${stepIndex}`,
    });
    if (!historyRes.ok) return sendError(reply, historyRes.status, historyRes.code, historyRes.message);

    const response = buildWorkflowResponse(updateRes.updatedApp, historyRes);
    rememberIdempotentResponse(idempotencyStore, idempotencyContext, response);
    return reply.send(response);
  });

  app.post('/api/v1/applications/:applicationId/workflow/rollback-step', async (req, reply) => {
    const ctx = await prepareWorkflowRequest(req, reply, { supabase, idempotencyStore, action: 'mutate' });
    if (!ctx) return;

    const { actor, appRow, idempotencyContext } = ctx;
    const { applicationId } = req.params;
    const reason = req.body?.reason || null;

    const transition = buildRollbackTransition(appRow);
    const updateRes = await updateApplicationState(supabase, applicationId, transition);
    if (!updateRes.ok) return sendError(reply, updateRes.status, updateRes.code, updateRes.message);

    const rollbackRes = await updateStepCompletion(supabase, {
      applicationId,
      stepIndex: Number(appRow.current_step || 0),
      isCompleted: false,
    });
    if (!rollbackRes.ok) return sendError(reply, rollbackRes.status, rollbackRes.code, rollbackRes.message);

    const historyRes = await addHistory(supabase, {
      applicationId,
      action: 'ROLLBACK_STEP',
      prevStatus: appRow.status,
      nextStatus: transition.nextStatus,
      userName: actor.userId,
      comment: reason || 'Rollback step',
    });
    if (!historyRes.ok) return sendError(reply, historyRes.status, historyRes.code, historyRes.message);

    const response = buildWorkflowResponse(updateRes.updatedApp, historyRes);
    rememberIdempotentResponse(idempotencyStore, idempotencyContext, response);
    return reply.send(response);
  });

  app.post('/api/v1/applications/:applicationId/workflow/review-approve', async (req, reply) => {
    // Ревью не требует лока — выполняется контролёром
    const ctx = await prepareWorkflowRequest(req, reply, { supabase, idempotencyStore, action: 'mutate', requireLock: false });
    if (!ctx) return;

    const { actor, appRow, idempotencyContext } = ctx;
    const { applicationId } = req.params;
    const comment = req.body?.comment || null;

    const transition = buildReviewTransition(appRow, 'APPROVE');
    const updateRes = await updateApplicationState(supabase, applicationId, transition);
    if (!updateRes.ok) return sendError(reply, updateRes.status, updateRes.code, updateRes.message);

    const reviewedStage = Math.max(1, Number(appRow.current_stage || 1) - 1);
    const verifiedRes = await updateStageVerification(supabase, { applicationId, stage: reviewedStage, isVerified: true });
    if (!verifiedRes.ok) return sendError(reply, verifiedRes.status, verifiedRes.code, verifiedRes.message);

    const historyRes = await addHistory(supabase, {
      applicationId,
      action: 'REVIEW_APPROVE',
      prevStatus: appRow.status,
      nextStatus: transition.nextStatus,
      userName: actor.userId,
      comment: comment || 'Review approved',
    });
    if (!historyRes.ok) return sendError(reply, historyRes.status, historyRes.code, historyRes.message);

    const response = buildWorkflowResponse(updateRes.updatedApp, historyRes);
    rememberIdempotentResponse(idempotencyStore, idempotencyContext, response);
    return reply.send(response);
  });

  app.post('/api/v1/applications/:applicationId/workflow/review-reject', async (req, reply) => {
    const ctx = await prepareWorkflowRequest(req, reply, { supabase, idempotencyStore, action: 'mutate', requireLock: false });
    if (!ctx) return;

    const { actor, appRow, idempotencyContext } = ctx;
    const { applicationId } = req.params;
    const reason = req.body?.reason || null;

    const transition = buildReviewTransition(appRow, 'REJECT');
    const updateRes = await updateApplicationState(supabase, applicationId, transition);
    if (!updateRes.ok) return sendError(reply, updateRes.status, updateRes.code, updateRes.message);

    const reviewedStage = Math.max(1, Number(appRow.current_stage || 1) - 1);
    const unverifyRes = await updateStageVerification(supabase, { applicationId, stage: reviewedStage, isVerified: false });
    if (!unverifyRes.ok) return sendError(reply, unverifyRes.status, unverifyRes.code, unverifyRes.message);

    const historyRes = await addHistory(supabase, {
      applicationId,
      action: 'REVIEW_REJECT',
      prevStatus: appRow.status,
      nextStatus: transition.nextStatus,
      userName: actor.userId,
      comment: reason || 'Review rejected',
    });
    if (!historyRes.ok) return sendError(reply, historyRes.status, historyRes.code, historyRes.message);

    const response = buildWorkflowResponse(updateRes.updatedApp, historyRes);
    rememberIdempotentResponse(idempotencyStore, idempotencyContext, response);
    return reply.send(response);
  });

  app.post('/api/v1/applications/:applicationId/workflow/assign-technician', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'workflow',
      action: 'assignTechnician',
      forbiddenMessage: 'Only admin or branch_manager can assign technician',
    });
    if (!actor) return;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(idempotencyStore, idempotencyContext, reply)) return;

    const { applicationId } = req.params;
    const assigneeUserId = req.body?.assigneeUserId;
    const reason = req.body?.reason || null;

    if (!assigneeUserId) return sendError(reply, 400, 'INVALID_PAYLOAD', 'assigneeUserId is required');

    const appRes = await getApplication(supabase, applicationId);
    if (!appRes.ok) return sendError(reply, appRes.status, appRes.code, appRes.message);

    const { error: assignError } = await supabase
      .from('applications')
      .update({ assignee_name: assigneeUserId, updated_at: new Date().toISOString() })
      .eq('id', applicationId);

    if (assignError) return sendError(reply, 500, 'DB_ERROR', assignError.message);

    const historyRes = await addHistory(supabase, {
      applicationId,
      action: 'ASSIGN_TECHNICIAN',
      prevStatus: appRes.appRow.status,
      nextStatus: appRes.appRow.status,
      userName: actor.userId,
      comment: reason || `Assigned to ${assigneeUserId}`,
    });
    if (!historyRes.ok) return sendError(reply, historyRes.status, historyRes.code, historyRes.message);

    const response = {
      assigneeUserId,
      workflowSubstatus: appRes.appRow.workflow_substatus,
      historyEventId: historyRes.historyEventId,
    };
    rememberIdempotentResponse(idempotencyStore, idempotencyContext, response);
    return reply.send(response);
  });

  app.post('/api/v1/applications/:applicationId/workflow/request-decline', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'workflow',
      action: 'requestDecline',
      forbiddenMessage: 'Role cannot request decline',
    });
    if (!actor) return;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(idempotencyStore, idempotencyContext, reply)) return;

    const { applicationId } = req.params;
    const reason = req.body?.reason || null;
    const stepIndex = Number(req.body?.stepIndex ?? 0);

    const appRes = await getApplication(supabase, applicationId);
    if (!appRes.ok) return sendError(reply, appRes.status, appRes.code, appRes.message);

    const { error: appErr } = await supabase
      .from('applications')
      .update({
        status: 'IN_PROGRESS',
        workflow_substatus: 'PENDING_DECLINE',
        requested_decline_reason: reason,
        requested_decline_step: Number.isInteger(stepIndex) ? stepIndex : appRes.appRow.current_step,
        requested_decline_by: actor.userId,
        requested_decline_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId);
    if (appErr) return sendError(reply, 500, 'DB_ERROR', appErr.message);

    const historyRes = await addHistory(supabase, {
      applicationId,
      action: 'REQUEST_DECLINE',
      prevStatus: appRes.appRow.status,
      nextStatus: 'IN_PROGRESS',
      userName: actor.userId,
      comment: reason || 'Request decline',
    });
    if (!historyRes.ok) return sendError(reply, historyRes.status, historyRes.code, historyRes.message);

    const response = {
      workflowSubstatus: 'PENDING_DECLINE',
      requestedDeclineAt: new Date().toISOString(),
      historyEventId: historyRes.historyEventId,
    };
    rememberIdempotentResponse(idempotencyStore, idempotencyContext, response);
    return reply.send(response);
  });

  app.post('/api/v1/applications/:applicationId/workflow/decline', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'workflow',
      action: 'decline',
      forbiddenMessage: 'Role cannot decline application',
    });
    if (!actor) return;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(idempotencyStore, idempotencyContext, reply)) return;

    const { applicationId } = req.params;
    const reason = req.body?.reason || null;

    const substatusMap = {
      controller: 'DECLINED_BY_CONTROLLER',
      branch_manager: 'DECLINED_BY_MANAGER',
      admin: 'DECLINED_BY_ADMIN',
    };

    const appRes = await getApplication(supabase, applicationId);
    if (!appRes.ok) return sendError(reply, appRes.status, appRes.code, appRes.message);

    const transition = {
      nextStatus: 'DECLINED',
      nextSubstatus: substatusMap[actor.userRole] || 'DECLINED_BY_ADMIN',
      nextStepIndex: appRes.appRow.current_step,
      nextStage: appRes.appRow.current_stage,
    };

    const updateRes = await updateApplicationState(supabase, applicationId, transition);
    if (!updateRes.ok) return sendError(reply, updateRes.status, updateRes.code, updateRes.message);

    const historyRes = await addHistory(supabase, {
      applicationId,
      action: 'DECLINE',
      prevStatus: appRes.appRow.status,
      nextStatus: 'DECLINED',
      userName: actor.userId,
      comment: reason || 'Declined',
    });
    if (!historyRes.ok) return sendError(reply, historyRes.status, historyRes.code, historyRes.message);

    const response = buildWorkflowResponse(updateRes.updatedApp, historyRes);
    rememberIdempotentResponse(idempotencyStore, idempotencyContext, response);
    return reply.send(response);
  });

  app.post('/api/v1/applications/:applicationId/workflow/return-from-decline', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'workflow',
      action: 'returnFromDecline',
      forbiddenMessage: 'Only admin or branch_manager can return from decline',
    });
    if (!actor) return;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(idempotencyStore, idempotencyContext, reply)) return;

    const { applicationId } = req.params;
    const comment = req.body?.comment || null;

    const appRes = await getApplication(supabase, applicationId);
    if (!appRes.ok) return sendError(reply, appRes.status, appRes.code, appRes.message);

    const { error: appErr } = await supabase
      .from('applications')
      .update({
        status: 'IN_PROGRESS',
        workflow_substatus: 'RETURNED_BY_MANAGER',
        requested_decline_reason: null,
        requested_decline_step: null,
        requested_decline_by: null,
        requested_decline_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId);
    if (appErr) return sendError(reply, 500, 'DB_ERROR', appErr.message);

    const historyRes = await addHistory(supabase, {
      applicationId,
      action: 'RETURN_FROM_DECLINE',
      prevStatus: appRes.appRow.status,
      nextStatus: 'IN_PROGRESS',
      userName: actor.userId,
      comment: comment || 'Return from decline',
    });
    if (!historyRes.ok) return sendError(reply, historyRes.status, historyRes.code, historyRes.message);

    const response = { workflowSubstatus: 'RETURNED_BY_MANAGER', historyEventId: historyRes.historyEventId };
    rememberIdempotentResponse(idempotencyStore, idempotencyContext, response);
    return reply.send(response);
  });

  app.post('/api/v1/applications/:applicationId/workflow/restore', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'workflow',
      action: 'restore',
      forbiddenMessage: 'Only admin can restore application',
    });
    if (!actor) return;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(idempotencyStore, idempotencyContext, reply)) return;

    const { applicationId } = req.params;
    const comment = req.body?.comment || null;

    const appRes = await getApplication(supabase, applicationId);
    if (!appRes.ok) return sendError(reply, appRes.status, appRes.code, appRes.message);

    const transition = {
      nextStatus: 'IN_PROGRESS',
      nextSubstatus: 'DRAFT',
      nextStepIndex: appRes.appRow.current_step,
      nextStage: appRes.appRow.current_stage,
    };

    const updateRes = await updateApplicationState(supabase, applicationId, transition);
    if (!updateRes.ok) return sendError(reply, updateRes.status, updateRes.code, updateRes.message);

    const historyRes = await addHistory(supabase, {
      applicationId,
      action: 'RESTORE',
      prevStatus: appRes.appRow.status,
      nextStatus: 'IN_PROGRESS',
      userName: actor.userId,
      comment: comment || 'Restore application',
    });
    if (!historyRes.ok) return sendError(reply, historyRes.status, historyRes.code, historyRes.message);

    const response = buildWorkflowResponse(updateRes.updatedApp, historyRes);
    rememberIdempotentResponse(idempotencyStore, idempotencyContext, response);
    return reply.send(response);
  });
}
