import Fastify from 'fastify';
import cors from '@fastify/cors';
import { getConfig } from './config.js';
import { createSupabaseAdminClient } from './supabase.js';
import { registerCompositionRoutes } from './composition-routes.js';
import { registerRegistryRoutes } from './registry-routes.js';

const INTEGRATION_START_IDX = 12;
const LAST_STEP_INDEX_BY_STAGE = {
  1: 5,
  2: 8,
  3: 11,
  4: 16,
};
const TOTAL_STEPS = 17;

function buildCompletionTransition(current) {
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

function buildRollbackTransition(current) {
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

function buildReviewTransition(current, action) {
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

function getActor(req) {
  const userId = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];
  if (!userId || !userRole) return null;
  
  // Раскодируем обратно в читаемый русский текст для сохранения в БД
  return { 
    userId: decodeURIComponent(String(userId)), 
    userRole: String(userRole) 
  };
}

function hasAnyRole(actorRole, roles = []) {
  return roles.includes(actorRole);
}

function sendError(reply, statusCode, code, message, details = null) {
  return reply.code(statusCode).send({ code, message, details, requestId: reply.request.id });
}

async function ensureActorLock(supabase, applicationId, actorUserId) {
  const { data: lockData, error: lockError } = await supabase
    .from('application_locks')
    .select('owner_user_id, expires_at')
    .eq('application_id', applicationId)
    .maybeSingle();

  if (lockError) return { ok: false, status: 500, code: 'DB_ERROR', message: lockError.message };
  if (!lockData || lockData.owner_user_id !== actorUserId || new Date(lockData.expires_at) <= new Date()) {
    return {
      ok: false,
      status: 423,
      code: 'LOCK_REQUIRED',
      message: 'Active lock owned by current user is required',
    };
  }

  return { ok: true };
}

async function getApplication(supabase, applicationId) {
  const { data: appRow, error } = await supabase
    .from('applications')
    .select('id, status, workflow_substatus, current_step, current_stage')
    .eq('id', applicationId)
    .maybeSingle();

  if (error) return { ok: false, status: 500, code: 'DB_ERROR', message: error.message };
  if (!appRow) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Application not found' };

  return { ok: true, appRow };
}

async function addHistory(supabase, { applicationId, action, prevStatus, nextStatus, userName, comment }) {
  const { data, error } = await supabase
    .from('application_history')
    .insert({
      application_id: applicationId,
      action,
      prev_status: prevStatus,
      next_status: nextStatus,
      user_name: userName,
      comment,
    })
    .select('id')
    .single();

  if (error) return { ok: false, status: 500, code: 'DB_ERROR', message: error.message };
  return { ok: true, historyEventId: data.id };
}

async function updateApplicationState(supabase, applicationId, transition) {
  const { data, error } = await supabase
    .from('applications')
    .update({
      status: transition.nextStatus,
      workflow_substatus: transition.nextSubstatus,
      current_step: transition.nextStepIndex,
      current_stage: transition.nextStage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', applicationId)
    .select('id, status, workflow_substatus, current_step, current_stage')
    .single();

  if (error) return { ok: false, status: 500, code: 'DB_ERROR', message: error.message };
  return { ok: true, updatedApp: data };
}

async function buildServer() {
  const config = getConfig();
  const supabase = createSupabaseAdminClient(config);
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true, // Разрешаем запросы с любых адресов (для DEV-режима)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-user-role']
  });

  app.get('/health', async () => ({ ok: true }));

  registerCompositionRoutes(app, { supabase });
  registerRegistryRoutes(app, { supabase });

  app.get('/api/v1/applications/:applicationId/locks', async (req, reply) => {
    const { applicationId } = req.params;
    const { data, error } = await supabase
      .from('application_locks')
      .select('owner_user_id, owner_role, expires_at')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    if (!data) return reply.send({ locked: false, ownerUserId: null, ownerRole: null, expiresAt: null });

    return reply.send({
      locked: true,
      ownerUserId: data.owner_user_id,
      ownerRole: data.owner_role,
      expiresAt: data.expires_at,
    });
  });

  app.post('/api/v1/applications/:applicationId/locks/acquire', async (req, reply) => {
    const actor = getActor(req);
    if (!actor) return sendError(reply, 401, 'UNAUTHORIZED', 'Missing x-user-id or x-user-role');

    const { applicationId } = req.params;
    const ttlSeconds = Number(req.body?.ttlSeconds || 1200);

    const { data, error } = await supabase.rpc('acquire_application_lock', {
      p_application_id: applicationId,
      p_owner_user_id: actor.userId,
      p_owner_role: actor.userRole,
      p_ttl_seconds: Math.max(60, ttlSeconds),
    });

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return sendError(reply, 500, 'EMPTY_RPC_RESPONSE', 'No response from lock RPC');

    const statusMap = { LOCKED: 409, ASSIGNEE_MISMATCH: 403, NOT_FOUND: 404 };
    if (!row.ok) return sendError(reply, statusMap[row.reason] || 409, row.reason || 'LOCK_ERROR', row.message);

    return reply.send({ ok: true, reason: row.reason, message: row.message, expiresAt: row.expires_at });
  });

  app.post('/api/v1/applications/:applicationId/locks/refresh', async (req, reply) => {
    const actor = getActor(req);
    if (!actor) return sendError(reply, 401, 'UNAUTHORIZED', 'Missing x-user-id or x-user-role');

    const { applicationId } = req.params;
    const ttlSeconds = Number(req.body?.ttlSeconds || 1200);

    const { data, error } = await supabase.rpc('refresh_application_lock', {
      p_application_id: applicationId,
      p_owner_user_id: actor.userId,
      p_ttl_seconds: Math.max(60, ttlSeconds),
    });

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return sendError(reply, 500, 'EMPTY_RPC_RESPONSE', 'No response from lock RPC');

    const statusMap = { OWNER_MISMATCH: 409, NOT_FOUND: 404 };
    if (!row.ok) return sendError(reply, statusMap[row.reason] || 409, row.reason || 'LOCK_ERROR', row.message);

    return reply.send({ ok: true, reason: row.reason, message: row.message, expiresAt: row.expires_at });
  });

  app.post('/api/v1/applications/:applicationId/locks/release', async (req, reply) => {
    const actor = getActor(req);
    if (!actor) return sendError(reply, 401, 'UNAUTHORIZED', 'Missing x-user-id or x-user-role');

    const { applicationId } = req.params;

    const { data, error } = await supabase.rpc('release_application_lock', {
      p_application_id: applicationId,
      p_owner_user_id: actor.userId,
    });

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return sendError(reply, 500, 'EMPTY_RPC_RESPONSE', 'No response from lock RPC');

    const statusMap = { OWNER_MISMATCH: 409, NOT_FOUND: 404 };
    if (!row.ok) return sendError(reply, statusMap[row.reason] || 409, row.reason || 'LOCK_ERROR', row.message);

    return reply.send({ ok: true, reason: row.reason, message: row.message });
  });

  app.post('/api/v1/applications/:applicationId/workflow/complete-step', async (req, reply) => {
    const actor = getActor(req);
    if (!actor) return sendError(reply, 401, 'UNAUTHORIZED', 'Missing x-user-id or x-user-role');

    const { applicationId } = req.params;
    const stepIndex = Number(req.body?.stepIndex);
    const comment = req.body?.comment || null;

    if (!Number.isInteger(stepIndex) || stepIndex < 0) {
      return sendError(reply, 400, 'INVALID_STEP_INDEX', 'stepIndex must be a non-negative integer');
    }

    const lockCheck = await ensureActorLock(supabase, applicationId, actor.userId);
    if (!lockCheck.ok) return sendError(reply, lockCheck.status, lockCheck.code, lockCheck.message);

    const appRes = await getApplication(supabase, applicationId);
    if (!appRes.ok) return sendError(reply, appRes.status, appRes.code, appRes.message);
    const { appRow } = appRes;

    if (Number(appRow.current_step) !== stepIndex) {
      return sendError(reply, 409, 'INVALID_STEP_STATE', 'stepIndex does not match current step', {
        expectedStepIndex: appRow.current_step,
        gotStepIndex: stepIndex,
      });
    }

    const transition = buildCompletionTransition(appRow);
    const updateRes = await updateApplicationState(supabase, applicationId, transition);
    if (!updateRes.ok) return sendError(reply, updateRes.status, updateRes.code, updateRes.message);

    const historyRes = await addHistory(supabase, {
      applicationId,
      action: 'COMPLETE_STEP',
      prevStatus: appRow.status,
      nextStatus: transition.nextStatus,
      userName: actor.userId,
      comment: comment || `Complete step ${stepIndex}`,
    });
    if (!historyRes.ok) return sendError(reply, historyRes.status, historyRes.code, historyRes.message);

    return reply.send({
      applicationStatus: updateRes.updatedApp.status,
      workflowSubstatus: updateRes.updatedApp.workflow_substatus,
      currentStep: updateRes.updatedApp.current_step,
      currentStage: updateRes.updatedApp.current_stage,
      historyEventId: historyRes.historyEventId,
    });
  });

  app.post('/api/v1/applications/:applicationId/workflow/rollback-step', async (req, reply) => {
    const actor = getActor(req);
    if (!actor) return sendError(reply, 401, 'UNAUTHORIZED', 'Missing x-user-id or x-user-role');

    const { applicationId } = req.params;
    const reason = req.body?.reason || null;

    const lockCheck = await ensureActorLock(supabase, applicationId, actor.userId);
    if (!lockCheck.ok) return sendError(reply, lockCheck.status, lockCheck.code, lockCheck.message);

    const appRes = await getApplication(supabase, applicationId);
    if (!appRes.ok) return sendError(reply, appRes.status, appRes.code, appRes.message);
    const { appRow } = appRes;

    const transition = buildRollbackTransition(appRow);
    const updateRes = await updateApplicationState(supabase, applicationId, transition);
    if (!updateRes.ok) return sendError(reply, updateRes.status, updateRes.code, updateRes.message);

    const historyRes = await addHistory(supabase, {
      applicationId,
      action: 'ROLLBACK_STEP',
      prevStatus: appRow.status,
      nextStatus: transition.nextStatus,
      userName: actor.userId,
      comment: reason || 'Rollback step',
    });
    if (!historyRes.ok) return sendError(reply, historyRes.status, historyRes.code, historyRes.message);

    return reply.send({
      applicationStatus: updateRes.updatedApp.status,
      workflowSubstatus: updateRes.updatedApp.workflow_substatus,
      currentStep: updateRes.updatedApp.current_step,
      currentStage: updateRes.updatedApp.current_stage,
      historyEventId: historyRes.historyEventId,
    });
  });

  app.post('/api/v1/applications/:applicationId/workflow/review-approve', async (req, reply) => {
    const actor = getActor(req);
    if (!actor) return sendError(reply, 401, 'UNAUTHORIZED', 'Missing x-user-id or x-user-role');

    const { applicationId } = req.params;
    const comment = req.body?.comment || null;

    const appRes = await getApplication(supabase, applicationId);
    if (!appRes.ok) return sendError(reply, appRes.status, appRes.code, appRes.message);

    const transition = buildReviewTransition(appRes.appRow, 'APPROVE');
    const updateRes = await updateApplicationState(supabase, applicationId, transition);
    if (!updateRes.ok) return sendError(reply, updateRes.status, updateRes.code, updateRes.message);

    const historyRes = await addHistory(supabase, {
      applicationId,
      action: 'REVIEW_APPROVE',
      prevStatus: appRes.appRow.status,
      nextStatus: transition.nextStatus,
      userName: actor.userId,
      comment: comment || 'Review approved',
    });
    if (!historyRes.ok) return sendError(reply, historyRes.status, historyRes.code, historyRes.message);

    return reply.send({
      applicationStatus: updateRes.updatedApp.status,
      workflowSubstatus: updateRes.updatedApp.workflow_substatus,
      currentStep: updateRes.updatedApp.current_step,
      currentStage: updateRes.updatedApp.current_stage,
      historyEventId: historyRes.historyEventId,
    });
  });

  app.post('/api/v1/applications/:applicationId/workflow/review-reject', async (req, reply) => {
    const actor = getActor(req);
    if (!actor) return sendError(reply, 401, 'UNAUTHORIZED', 'Missing x-user-id or x-user-role');

    const { applicationId } = req.params;
    const reason = req.body?.reason || null;

    const appRes = await getApplication(supabase, applicationId);
    if (!appRes.ok) return sendError(reply, appRes.status, appRes.code, appRes.message);

    const transition = buildReviewTransition(appRes.appRow, 'REJECT');
    const updateRes = await updateApplicationState(supabase, applicationId, transition);
    if (!updateRes.ok) return sendError(reply, updateRes.status, updateRes.code, updateRes.message);

    const historyRes = await addHistory(supabase, {
      applicationId,
      action: 'REVIEW_REJECT',
      prevStatus: appRes.appRow.status,
      nextStatus: transition.nextStatus,
      userName: actor.userId,
      comment: reason || 'Review rejected',
    });
    if (!historyRes.ok) return sendError(reply, historyRes.status, historyRes.code, historyRes.message);

    return reply.send({
      applicationStatus: updateRes.updatedApp.status,
      workflowSubstatus: updateRes.updatedApp.workflow_substatus,
      currentStep: updateRes.updatedApp.current_step,
      currentStage: updateRes.updatedApp.current_stage,
      historyEventId: historyRes.historyEventId,
    });
  });


  app.post('/api/v1/applications/:applicationId/workflow/assign-technician', async (req, reply) => {
    const actor = getActor(req);
    if (!actor) return sendError(reply, 401, 'UNAUTHORIZED', 'Missing x-user-id or x-user-role');
    if (!hasAnyRole(actor.userRole, ['admin', 'branch_manager'])) {
      return sendError(reply, 403, 'FORBIDDEN', 'Only admin or branch_manager can assign technician');
    }

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

    return reply.send({ assigneeUserId, workflowSubstatus: appRes.appRow.workflow_substatus, historyEventId: historyRes.historyEventId });
  });

  app.post('/api/v1/applications/:applicationId/workflow/request-decline', async (req, reply) => {
    const actor = getActor(req);
    if (!actor) return sendError(reply, 401, 'UNAUTHORIZED', 'Missing x-user-id or x-user-role');
    if (!hasAnyRole(actor.userRole, ['technician', 'admin', 'branch_manager'])) {
      return sendError(reply, 403, 'FORBIDDEN', 'Role cannot request decline');
    }

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

    return reply.send({ workflowSubstatus: 'PENDING_DECLINE', requestedDeclineAt: new Date().toISOString(), historyEventId: historyRes.historyEventId });
  });

  app.post('/api/v1/applications/:applicationId/workflow/decline', async (req, reply) => {
    const actor = getActor(req);
    if (!actor) return sendError(reply, 401, 'UNAUTHORIZED', 'Missing x-user-id or x-user-role');
    if (!hasAnyRole(actor.userRole, ['admin', 'branch_manager', 'controller'])) {
      return sendError(reply, 403, 'FORBIDDEN', 'Role cannot decline application');
    }

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

    return reply.send({
      applicationStatus: updateRes.updatedApp.status,
      workflowSubstatus: updateRes.updatedApp.workflow_substatus,
      currentStep: updateRes.updatedApp.current_step,
      currentStage: updateRes.updatedApp.current_stage,
      historyEventId: historyRes.historyEventId,
    });
  });

  app.post('/api/v1/applications/:applicationId/workflow/return-from-decline', async (req, reply) => {
    const actor = getActor(req);
    if (!actor) return sendError(reply, 401, 'UNAUTHORIZED', 'Missing x-user-id or x-user-role');
    if (!hasAnyRole(actor.userRole, ['admin', 'branch_manager'])) {
      return sendError(reply, 403, 'FORBIDDEN', 'Only admin or branch_manager can return from decline');
    }

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

    return reply.send({ workflowSubstatus: 'RETURNED_BY_MANAGER', historyEventId: historyRes.historyEventId });
  });

  app.post('/api/v1/applications/:applicationId/workflow/restore', async (req, reply) => {
    const actor = getActor(req);
    if (!actor) return sendError(reply, 401, 'UNAUTHORIZED', 'Missing x-user-id or x-user-role');
    if (!hasAnyRole(actor.userRole, ['admin'])) {
      return sendError(reply, 403, 'FORBIDDEN', 'Only admin can restore application');
    }

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

    return reply.send({
      applicationStatus: updateRes.updatedApp.status,
      workflowSubstatus: updateRes.updatedApp.workflow_substatus,
      currentStep: updateRes.updatedApp.current_step,
      currentStage: updateRes.updatedApp.current_stage,
      historyEventId: historyRes.historyEventId,
    });
  });

  return { app, config };
}

const { app, config } = await buildServer();
await app.listen({ port: config.port, host: config.host });
