import { createIdempotencyStore } from './idempotency-store.js';
import { createPendingVersionsForApplication } from './versioning.js';

function sendError(reply, statusCode, code, message, details = null) {
  return reply.code(statusCode).send({ code, message, details, requestId: reply.request.id });
}

function getActor(req) {
  const userId = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];
  if (!userId || !userRole) return null;

  return {
    userId: decodeURIComponent(String(userId)),
    userRole: String(userRole),
  };
}

function canCreateProjectFromApplication(actorRole) {
  return ['admin', 'branch_manager', 'technician'].includes(actorRole);
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


function isProjectInitRpcEnabled() {
  return process.env.PROJECT_INIT_RPC_ENABLED === 'true';
}

async function createProjectViaRpc(supabase, { scope, appData, actorUserId }) {
  if (typeof supabase?.rpc !== 'function') {
    return { ok: false, error: { code: 'RPC_UNAVAILABLE', message: 'supabase.rpc is not available' }, reason: 'RPC_UNAVAILABLE', status: 500 };
  }

  const { data, error } = await supabase.rpc('init_project_from_application', {
    p_scope_id: scope,
    p_applicant: appData.applicant || null,
    p_address: appData.address || null,
    p_cadastre_number: formatComplexCadastre(appData.cadastre),
    p_external_source: appData.source || null,
    p_external_id: appData.externalId || null,
    p_submission_date: appData.submissionDate || null,
    p_assignee_name: actorUserId || null,
  });

  if (error) return { ok: false, error };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.ok) {
    return {
      ok: false,
      error: { code: row?.reason || 'RPC_ERROR', message: row?.message || 'Project init RPC failed' },
      reason: row?.reason || 'RPC_ERROR',
      status: row?.reason === 'REAPPLICATION_BLOCKED' ? 409 : 500,
    };
  }

  return {
    ok: true,
    value: {
      projectId: row.project_id,
      applicationId: row.application_id,
      ujCode: row.uj_code,
    },
  };
}

function formatByGroups(value, groups) {
  const digits = String(value || '').replace(/\D/g, '');
  const maxLen = groups.reduce((sum, n) => sum + n, 0);
  const normalized = digits.slice(0, maxLen);

  const parts = [];
  let offset = 0;
  for (const len of groups) {
    const part = normalized.slice(offset, offset + len);
    if (!part) break;
    parts.push(part);
    offset += len;
  }

  return parts.join(':');
}

function formatComplexCadastre(value) {
  return formatByGroups(value, [2, 2, 2, 2, 2, 4]);
}

function getNextSequenceNumber(existingCodes, prefix) {
  let max = 0;

  existingCodes.forEach(code => {
    if (!code || !String(code).startsWith(prefix)) return;
    const num = Number(String(code).slice(prefix.length));
    if (Number.isFinite(num) && num > max) max = num;
  });

  return max + 1;
}

function generateProjectCode(sequenceNumber) {
  return `UJ${String(Number(sequenceNumber) || 0).padStart(6, '0')}`;
}

async function generateNextProjectCode(supabase, scope) {
  const { data, error } = await supabase
    .from('projects')
    .select('uj_code')
    .eq('scope_id', scope)
    .not('uj_code', 'is', null)
    .order('uj_code', { ascending: false });

  if (error) throw error;

  const existingCodes = (data || []).map(item => item.uj_code).filter(Boolean);
  const nextNumber = getNextSequenceNumber(existingCodes, 'UJ');
  return generateProjectCode(nextNumber);
}

async function ensureNoActiveReapplication(supabase, scope, appData) {
  if (!appData?.reapplicationForProjectId && !appData?.cadastre) return { ok: true };

  const normalizedCadastre = appData?.cadastre ? formatComplexCadastre(appData.cadastre) : null;

  let activeAppsQuery = supabase
    .from('applications')
    .select('id, project_id, status, projects!inner(id, name, cadastre_number)')
    .eq('scope_id', scope)
    .eq('status', 'IN_PROGRESS')
    .limit(1);

  if (appData?.reapplicationForProjectId) {
    activeAppsQuery = activeAppsQuery.eq('project_id', appData.reapplicationForProjectId);
  } else if (normalizedCadastre) {
    activeAppsQuery = activeAppsQuery.eq('projects.cadastre_number', normalizedCadastre);
  }

  const { data, error } = await activeAppsQuery;
  if (error) return { ok: false, status: 500, code: 'DB_ERROR', message: error.message };

  if ((data || []).length === 0) return { ok: true };

  const active = data[0];
  const activeProject = Array.isArray(active?.projects) ? active.projects[0] : active?.projects;
  const projectName = activeProject?.name || 'ЖК';

  return {
    ok: false,
    status: 409,
    code: 'REAPPLICATION_BLOCKED',
    message: `Отказ в принятии: по ${projectName} уже есть активное заявление в работе. Повторная подача отклонена.`,
  };
}

export function registerProjectRoutes(app, { supabase }) {
  const idempotencyStore = createIdempotencyStore();
  app.post('/api/v1/projects/from-application', async (req, reply) => {
    const actor = getActor(req);
    if (!actor) return sendError(reply, 401, 'UNAUTHORIZED', 'Missing x-user-id or x-user-role');
    if (!canCreateProjectFromApplication(actor.userRole)) {
      return sendError(reply, 403, 'FORBIDDEN', 'Role cannot create project from application');
    }

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(idempotencyStore, idempotencyContext, reply)) return;

    const scope = String(req.body?.scope || '').trim();
    const appData = req.body?.appData || {};

    if (!scope) return sendError(reply, 400, 'VALIDATION_ERROR', 'scope is required');

    const reapplicationCheck = await ensureNoActiveReapplication(supabase, scope, appData);
    if (!reapplicationCheck.ok) {
      return sendError(
        reply,
        reapplicationCheck.status,
        reapplicationCheck.code,
        reapplicationCheck.message
      );
    }

    let createResult;

    if (isProjectInitRpcEnabled()) {
      try {
        const rpcResult = await createProjectViaRpc(supabase, {
          scope,
          appData,
          actorUserId: actor.userId,
        });

        if (rpcResult.ok) {
          createResult = rpcResult.value;
        } else if (rpcResult.reason === 'REAPPLICATION_BLOCKED') {
          return sendError(reply, 409, 'REAPPLICATION_BLOCKED', rpcResult.error.message);
        } else {
          // fallback на non-RPC путь, если функция еще не выкачена в окружение
          req.log?.warn?.({ err: rpcResult.error }, 'init_project_from_application RPC failed, fallback to direct path');
        }
      } catch (rpcUnexpectedError) {
        req.log?.warn?.({ err: rpcUnexpectedError }, 'Unexpected RPC failure, fallback to direct path');
      }
    }

    if (!createResult) {
      let ujCode;
      try {
        ujCode = await generateNextProjectCode(supabase, scope);
      } catch (error) {
        return sendError(reply, 500, 'DB_ERROR', error?.message || 'Failed to generate UJ code');
      }

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          scope_id: scope,
          uj_code: ujCode,
          name: appData.applicant ? `ЖК от ${appData.applicant}` : 'Новый проект',
          address: appData.address,
          cadastre_number: formatComplexCadastre(appData.cadastre),
          construction_status: 'Проектный',
        })
        .select('id, uj_code, name')
        .single();

      if (projectError) return sendError(reply, 500, 'DB_ERROR', projectError.message);

      const { data: createdApp, error: appError } = await supabase
        .from('applications')
        .insert({
          project_id: project.id,
          scope_id: scope,
          internal_number: `INT-${Date.now().toString().slice(-6)}`,
          external_source: appData.source,
          external_id: appData.externalId,
          applicant: appData.applicant,
          submission_date: appData.submissionDate || new Date().toISOString(),
          assignee_name: actor.userId,
          status: 'IN_PROGRESS',
          workflow_substatus: 'DRAFT',
          current_step: 0,
          current_stage: 1,
        })
        .select('id')
        .single();

      if (appError) {
        await supabase.from('projects').delete().eq('id', project.id);
        return sendError(reply, 500, 'DB_ERROR', appError.message);
      }

      createResult = {
        projectId: project.id,
        applicationId: createdApp.id,
        ujCode: project.uj_code,
      };
    }

    let versionsResult = { createdCount: 0, skipped: true };
    let versioningWarning = null;
    try {
      versionsResult = await createPendingVersionsForApplication({
        supabase,
        projectId: createResult.projectId,
        applicationId: createResult.applicationId,
        createdBy: actor.userId,
      });
    } catch (versionError) {
      versioningWarning = versionError?.message || 'Failed to create pending versions';
    }

    const response = {
      ok: true,
      projectId: createResult.projectId,
      applicationId: createResult.applicationId,
      ujCode: createResult.ujCode,
      versioning: versionsResult,
      warning: versioningWarning,
    };

    rememberIdempotentResponse(idempotencyStore, idempotencyContext, response);
    return reply.send(response);
  });
}
