import Fastify from 'fastify';
import cors from '@fastify/cors';
import { getConfig } from './config.js';
import { createSupabaseAdminClient } from './supabase.js';
import { registerCompositionRoutes } from './composition-routes.js';
import { registerRegistryRoutes } from './registry-routes.js';
import { registerIntegrationRoutes } from './integration-routes.js';
import { registerProjectRoutes } from './project-routes.js';
import { createIdempotencyStore } from './idempotency-store.js';
import { installAuthMiddleware, requireActor } from './auth.js';
import { sendError, requirePolicyActor } from './http-helpers.js';
import { registerAuthRoutes } from './auth-routes.js';

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

function buildIdempotencyContext(req, actor) {
  const rawKey = req.headers['x-idempotency-key'];
  if (!rawKey) return null;

  const idempotencyKey = String(rawKey).trim();
  if (!idempotencyKey) return null;

  const scope = req.routeOptions?.url || req.url || 'unknown';
  const actorScope = actor?.userId || 'anonymous';
  const bodyFingerprint = JSON.stringify(req.body ?? null);

  return {
    cacheKey: `${scope}:${actorScope}:${idempotencyKey}`,
    fingerprint: `${req.method}:${scope}:${bodyFingerprint}`,
  };
}

function tryServeIdempotentResponse(idempotencyStore, idempotencyContext, reply) {
  if (!idempotencyContext) return false;

  const state = idempotencyStore.get(idempotencyContext.cacheKey, idempotencyContext.fingerprint);
  if (state.status === 'hit') {
    reply.send(state.value);
    return true;
  }

  if (state.status === 'conflict') {
    sendError(reply, 409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key was already used with a different payload');
    return true;
  }

  return false;
}

function rememberIdempotentResponse(idempotencyStore, idempotencyContext, payload) {
  if (!idempotencyContext) return;
  idempotencyStore.set(idempotencyContext.cacheKey, idempotencyContext.fingerprint, payload);
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

export async function buildServer() {
  const config = getConfig();
  const supabase = createSupabaseAdminClient(config);
  const app = Fastify({ logger: true });
  const workflowIdempotencyStore = createIdempotencyStore();

  await app.register(cors, {
    origin: true, // Разрешаем запросы с любых адресов (для DEV-режима)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-user-id',
      'x-user-role',
      'x-idempotency-key',
      'x-client-request-id',
      'x-operation-source',
    ]
  });

  app.addHook('onRequest', async (req, reply) => {
    const operationSource = String(req.headers['x-operation-source'] || 'unknown');
    const clientRequestId = req.headers['x-client-request-id']
      ? String(req.headers['x-client-request-id'])
      : null;

    req.log.info({
      operationSource,
      clientRequestId,
      requestId: req.id,
      method: req.method,
      url: req.url,
    }, 'incoming request');

    reply.header('x-request-id', req.id);
    reply.header('x-operation-source', operationSource);
  });


  installAuthMiddleware(app, config);
  app.get('/health', async () => ({ ok: true }));

  registerAuthRoutes(app, { supabase, config });
  registerCompositionRoutes(app, { supabase });
  registerRegistryRoutes(app, { supabase });
  registerIntegrationRoutes(app, { supabase });
  registerProjectRoutes(app, { supabase });

  // =====================================================================
  // НОВЫЕ МАРШРУТЫ: Чтение справочников и списка проектов (Дашборд)
  // =====================================================================

  // 1. Чтение справочников (Catalogs)
  app.get('/api/v1/catalogs/:table', async (req, reply) => {
    const { table } = req.params;
    const { activeOnly } = req.query;

    // Белый список таблиц для безопасности (защита от SQL-инъекций)
    const ALLOWED_TABLES = [
      'dict_project_statuses', 'dict_application_statuses', 'dict_external_systems',
      'dict_foundations', 'dict_wall_materials', 'dict_slab_types', 'dict_roof_types',
      'dict_light_structure_types', 'dict_parking_types', 'dict_parking_construction_types',
      'dict_infra_types', 'dict_mop_types', 'dict_unit_types', 'dict_room_types','dict_system_users'
    ];

    if (!ALLOWED_TABLES.includes(table)) {
      return reply.code(400).send({ code: 'INVALID_TABLE', message: 'Таблица не разрешена' });
    }

   let query = supabase
      .from(table)
      .select('*')
      .order('sort_order', { ascending: true });

    // Таблица пользователей сортируется по name, остальные по label
    if (table === 'dict_system_users') {
      query = query.order('name', { ascending: true });
    } else {
      query = query.order('label', { ascending: true });
    }

    if (activeOnly === 'true') {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) return reply.code(500).send({ code: 'DB_ERROR', message: error.message });

    return data || [];
  });
 // 3. Получение ID заявки по ID проекта (Вспомогательный роут)
  app.get('/api/v1/projects/:projectId/application-id', async (req, reply) => {
    const { projectId } = req.params;
    const { scope } = req.query;

    let query = supabase
      .from('applications')
      .select('id')
      .eq('project_id', projectId);

    if (scope) {
      query = query.eq('scope_id', scope);
    }

    const { data, error } = await query.maybeSingle();

    if (error) return reply.code(500).send({ code: 'DB_ERROR', message: error.message });
    if (!data) return reply.code(404).send({ code: 'NOT_FOUND', message: 'Application not found' });

    return { applicationId: data.id };
  });
  // 2. Чтение списка проектов для Дашборда
  app.get('/api/v1/projects', async (req, reply) => {
    const { scope } = req.query;
    if (!scope) return reply.code(400).send({ code: 'MISSING_SCOPE', message: 'Scope is required' });

    // Выполняем те же 2 запроса, что раньше делал фронтенд напрямую
    const [projectsRes, appsRes] = await Promise.all([
      supabase
        .from('projects')
        .select('id, uj_code, cadastre_number, name, region, address, construction_status, updated_at, created_at, buildings(count)')
        .eq('scope_id', scope)
        .order('updated_at', { ascending: false }),
      supabase
        .from('applications')
        .select('*')
        .eq('scope_id', scope)
        .order('updated_at', { ascending: false }),
    ]);

    if (projectsRes.error) return reply.code(500).send({ code: 'DB_ERROR', message: projectsRes.error.message });
    if (appsRes.error) return reply.code(500).send({ code: 'DB_ERROR', message: appsRes.error.message });

    const appsByProject = (appsRes.data || []).reduce((acc, app) => {
      if (!acc[app.project_id]) acc[app.project_id] = app;
      return acc;
    }, {});

    const normalizeProjectStatusFromDb = (status) => {
      if (status === 'project') return 'Проектный';
      if (status === 'construction') return 'Строящийся';
      if (status === 'completed') return 'Сдан в эксплуатацию';
      return status || 'Проектный';
    };

    // Маппим данные прямо на бэкенде, чтобы отдавать фронту чистый DTO
    const mapped = (projectsRes.data || []).map(project => {
      const app = appsByProject[project.id];
      const buildingsCount = project.buildings?.[0]?.count || 0;

      return {
        id: project.id,
        ujCode: project.uj_code,
        cadastre: project.cadastre_number,
        applicationId: app?.id || null,
        name: project.name || 'Без названия',
        status: normalizeProjectStatusFromDb(project.construction_status),
        lastModified: app?.updated_at || project.updated_at,

        applicationInfo: {
          status: app?.status,
          workflowSubstatus: app?.workflow_substatus || 'DRAFT',
          internalNumber: app?.internal_number,
          externalSource: app?.external_source,
          externalId: app?.external_id,
          applicant: app?.applicant,
          submissionDate: app?.submission_date,
          assigneeName: app?.assignee_name,
          currentStage: app?.current_stage,
          currentStepIndex: app?.current_step,
          rejectionReason: app?.integration_data?.rejectionReason,
          requestedDeclineReason: app?.requested_decline_reason || null,
          requestedDeclineStep: app?.requested_decline_step ?? null,
          requestedDeclineBy: app?.requested_decline_by || null,
          requestedDeclineAt: app?.requested_decline_at || null,
        },
        complexInfo: {
          name: project.name,
          region: project.region,
          street: project.address,
        },
        composition: Array(buildingsCount).fill(1),
      };
    });

    return mapped;
  });

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
    const actor = requirePolicyActor(req, reply, {
      module: 'workflow',
      action: 'mutate',
      forbiddenMessage: 'Role cannot mutate workflow',
    });
    if (!actor) return;

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
    const actor = requirePolicyActor(req, reply, {
      module: 'workflow',
      action: 'mutate',
      forbiddenMessage: 'Role cannot mutate workflow',
    });
    if (!actor) return;

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
    const actor = requirePolicyActor(req, reply, {
      module: 'workflow',
      action: 'mutate',
      forbiddenMessage: 'Role cannot mutate workflow',
    });
    if (!actor) return;

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
    const actor = requirePolicyActor(req, reply, {
      module: 'workflow',
      action: 'mutate',
      forbiddenMessage: 'Role cannot mutate workflow',
    });
    if (!actor) return;

    const { applicationId } = req.params;
    const stepIndex = Number(req.body?.stepIndex);
    const comment = req.body?.comment || null;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(workflowIdempotencyStore, idempotencyContext, reply)) return;

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

    const response = {
      applicationStatus: updateRes.updatedApp.status,
      workflowSubstatus: updateRes.updatedApp.workflow_substatus,
      currentStep: updateRes.updatedApp.current_step,
      currentStage: updateRes.updatedApp.current_stage,
      historyEventId: historyRes.historyEventId,
    };
    rememberIdempotentResponse(workflowIdempotencyStore, idempotencyContext, response);
    return reply.send(response);
  });

  app.post('/api/v1/applications/:applicationId/workflow/rollback-step', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'workflow',
      action: 'mutate',
      forbiddenMessage: 'Role cannot mutate workflow',
    });
    if (!actor) return;

    const { applicationId } = req.params;
    const reason = req.body?.reason || null;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(workflowIdempotencyStore, idempotencyContext, reply)) return;

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

    const response = {
      applicationStatus: updateRes.updatedApp.status,
      workflowSubstatus: updateRes.updatedApp.workflow_substatus,
      currentStep: updateRes.updatedApp.current_step,
      currentStage: updateRes.updatedApp.current_stage,
      historyEventId: historyRes.historyEventId,
    };
    rememberIdempotentResponse(workflowIdempotencyStore, idempotencyContext, response);
    return reply.send(response);
  });

  app.post('/api/v1/applications/:applicationId/workflow/review-approve', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'workflow',
      action: 'mutate',
      forbiddenMessage: 'Role cannot mutate workflow',
    });
    if (!actor) return;

    const { applicationId } = req.params;
    const comment = req.body?.comment || null;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(workflowIdempotencyStore, idempotencyContext, reply)) return;

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

    const response = {
      applicationStatus: updateRes.updatedApp.status,
      workflowSubstatus: updateRes.updatedApp.workflow_substatus,
      currentStep: updateRes.updatedApp.current_step,
      currentStage: updateRes.updatedApp.current_stage,
      historyEventId: historyRes.historyEventId,
    };
    rememberIdempotentResponse(workflowIdempotencyStore, idempotencyContext, response);
    return reply.send(response);
  });

  app.post('/api/v1/applications/:applicationId/workflow/review-reject', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'workflow',
      action: 'mutate',
      forbiddenMessage: 'Role cannot mutate workflow',
    });
    if (!actor) return;

    const { applicationId } = req.params;
    const reason = req.body?.reason || null;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(workflowIdempotencyStore, idempotencyContext, reply)) return;

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

    const response = {
      applicationStatus: updateRes.updatedApp.status,
      workflowSubstatus: updateRes.updatedApp.workflow_substatus,
      currentStep: updateRes.updatedApp.current_step,
      currentStage: updateRes.updatedApp.current_stage,
      historyEventId: historyRes.historyEventId,
    };
    rememberIdempotentResponse(workflowIdempotencyStore, idempotencyContext, response);
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
    if (tryServeIdempotentResponse(workflowIdempotencyStore, idempotencyContext, reply)) return;

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

    const response = { assigneeUserId, workflowSubstatus: appRes.appRow.workflow_substatus, historyEventId: historyRes.historyEventId };
    rememberIdempotentResponse(workflowIdempotencyStore, idempotencyContext, response);
    return reply.send(response);
  });

  app.post('/api/v1/applications/:applicationId/workflow/request-decline', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'workflow',
      action: 'requestDecline',
      forbiddenMessage: 'Role cannot request decline',
    });
    if (!actor) return;

    const { applicationId } = req.params;
    const reason = req.body?.reason || null;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(workflowIdempotencyStore, idempotencyContext, reply)) return;
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
    rememberIdempotentResponse(workflowIdempotencyStore, idempotencyContext, response);
    return reply.send(response);
  });

  app.post('/api/v1/applications/:applicationId/workflow/decline', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'workflow',
      action: 'decline',
      forbiddenMessage: 'Role cannot decline application',
    });
    if (!actor) return;

    const { applicationId } = req.params;
    const reason = req.body?.reason || null;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(workflowIdempotencyStore, idempotencyContext, reply)) return;

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

    const response = {
      applicationStatus: updateRes.updatedApp.status,
      workflowSubstatus: updateRes.updatedApp.workflow_substatus,
      currentStep: updateRes.updatedApp.current_step,
      currentStage: updateRes.updatedApp.current_stage,
      historyEventId: historyRes.historyEventId,
    };
    rememberIdempotentResponse(workflowIdempotencyStore, idempotencyContext, response);
    return reply.send(response);
  });

  app.post('/api/v1/applications/:applicationId/workflow/return-from-decline', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'workflow',
      action: 'returnFromDecline',
      forbiddenMessage: 'Only admin or branch_manager can return from decline',
    });
    if (!actor) return;

    const { applicationId } = req.params;
    const comment = req.body?.comment || null;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(workflowIdempotencyStore, idempotencyContext, reply)) return;

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
    rememberIdempotentResponse(workflowIdempotencyStore, idempotencyContext, response);
    return reply.send(response);
  });

  app.post('/api/v1/applications/:applicationId/workflow/restore', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'workflow',
      action: 'restore',
      forbiddenMessage: 'Only admin can restore application',
    });
    if (!actor) return;

    const { applicationId } = req.params;
    const comment = req.body?.comment || null;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(workflowIdempotencyStore, idempotencyContext, reply)) return;

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

    const response = {
      applicationStatus: updateRes.updatedApp.status,
      workflowSubstatus: updateRes.updatedApp.workflow_substatus,
      currentStep: updateRes.updatedApp.current_step,
      currentStage: updateRes.updatedApp.current_stage,
      historyEventId: historyRes.historyEventId,
    };
    rememberIdempotentResponse(workflowIdempotencyStore, idempotencyContext, response);
    return reply.send(response);
  });

  return { app, config };
}

const isDirectRun = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isDirectRun) {
  const { app, config } = await buildServer();
  await app.listen({ port: config.port, host: config.host });
}
