import Fastify from 'fastify';
import cors from '@fastify/cors';
import { getConfig } from './config.js';
import { createSupabaseAdminClient } from './supabase.js';
import { installAuthMiddleware } from './auth.js';
import { sendError, requirePolicyActor } from './http-helpers.js';
import { registerAuthRoutes } from './auth-routes.js';
import { registerCompositionRoutes } from './composition-routes.js';
import { registerRegistryRoutes } from './registry-routes.js';
import { registerIntegrationRoutes } from './integration-routes.js';
import { registerProjectRoutes } from './project-routes.js';
import { registerCatalogRoutes } from './catalog-routes.js';
import { registerLocksRoutes } from './locks-routes.js';
import { registerWorkflowRoutes } from './workflow-routes.js';
import { buildStepValidationResult } from './validation.js';
import { parseCsvParam, normalizeProjectStatusFromDb, buildProjectAvailableActions } from './project-helpers.js';

function buildCorsOriginResolver(config) {
  if (config.runtimeEnv === 'dev') return true;

  const fromEnv = String(config.corsOrigin || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  const allowlist = fromEnv.length > 0
    ? fromEnv
    : [
      'https://reestr-mkd.vercel.app',
      'http://localhost:5173',
      'http://localhost:4173',
    ];

  return (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowlist.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'), false);
  };
}

export async function buildServer() {
  const config = getConfig();
  const supabase = createSupabaseAdminClient(config);
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: buildCorsOriginResolver(config),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-user-id',
      'x-user-role',
      'x-idempotency-key',
      'x-client-request-id',
      'x-operation-source',
    ],
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
  registerCatalogRoutes(app, { supabase });
  registerLocksRoutes(app, { supabase });
  registerWorkflowRoutes(app, { supabase });

  // --- Вспомогательные маршруты проектов ---

  app.get('/api/v1/projects/:projectId/application-id', async (req, reply) => {
    const { projectId } = req.params;
    const { scope } = req.query;

    let query = supabase.from('applications').select('id').eq('project_id', projectId);
    if (scope) query = query.eq('scope_id', scope);

    const { data, error } = await query.maybeSingle();
    if (error) return reply.code(500).send({ code: 'DB_ERROR', message: error.message });
    if (!data) return reply.code(404).send({ code: 'NOT_FOUND', message: 'Application not found' });

    return { applicationId: data.id };
  });

  app.post('/api/v1/projects/:projectId/validation/step', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'validation',
      action: 'mutate',
      forbiddenMessage: 'Role cannot validate project step',
    });
    if (!actor) return;

    const { projectId } = req.params;
    const scope = String(req.body?.scope || '').trim();
    const stepId = String(req.body?.stepId || '').trim();

    if (!scope) return sendError(reply, 400, 'VALIDATION_ERROR', 'scope is required');
    if (!stepId) return sendError(reply, 400, 'VALIDATION_ERROR', 'stepId is required');

    const { data: appRow, error: appError } = await supabase
      .from('applications')
      .select('id')
      .eq('project_id', projectId)
      .eq('scope_id', scope)
      .maybeSingle();

    if (appError) return sendError(reply, 500, 'DB_ERROR', appError.message);
    if (!appRow?.id) return sendError(reply, 404, 'NOT_FOUND', 'Application not found');

    const validationRes = await buildStepValidationResult(supabase, { projectId, stepId });
    if (!validationRes.ok) {
      return sendError(reply, validationRes.status, validationRes.code, validationRes.message);
    }

    return reply.send({ ok: validationRes.errors.length === 0, stepId, errors: validationRes.errors });
  });

  app.get('/api/v1/external-applications', async (req, reply) => {
    const actor = req.authContext || null;
    if (!actor?.userId) return sendError(reply, 401, 'UNAUTHORIZED', 'Auth context required');

    const scope = String(req.query?.scope || '').trim();
    if (!scope) return sendError(reply, 400, 'MISSING_SCOPE', 'Scope is required');

    return reply.send([
      {
        id: 'EXT-10001',
        source: 'EPIGU',
        externalId: 'EP-2026-9912',
        applicant: 'ООО "Golden House"',
        submissionDate: new Date().toISOString(),
        cadastre: '10:10:10:10:10:0001',
        address: 'г. Ташкент, Шайхантахурский р-н, ул. Навои, 12',
        status: 'NEW',
        scope,
      },
    ]);
  });

  app.get('/api/v1/projects', async (req, reply) => {
    const { scope } = req.query;
    if (!scope) return sendError(reply, 400, 'MISSING_SCOPE', 'Scope is required');

    const statusValues = parseCsvParam(req.query.status);
    const workflowSubstatusValues = parseCsvParam(req.query.workflowSubstatus);
    const assignee = req.query.assignee ? String(req.query.assignee) : null;
    const search = req.query.search ? String(req.query.search).trim() : null;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 1000)));
    const actor = req.authContext || null;

    let appsQuery = supabase
      .from('applications')
      .select('*')
      .eq('scope_id', scope)
      .order('updated_at', { ascending: false });

    if (statusValues.length === 1) appsQuery = appsQuery.eq('status', statusValues[0]);
    else if (statusValues.length > 1) appsQuery = appsQuery.in('status', statusValues);

    if (workflowSubstatusValues.length === 1) appsQuery = appsQuery.eq('workflow_substatus', workflowSubstatusValues[0]);
    else if (workflowSubstatusValues.length > 1) appsQuery = appsQuery.in('workflow_substatus', workflowSubstatusValues);

    if (assignee === 'mine') {
      if (!actor?.userId) return sendError(reply, 401, 'UNAUTHORIZED', 'Auth context required for assignee=mine');
      appsQuery = appsQuery.eq('assignee_name', actor.userId);
    } else if (assignee && assignee !== 'all') {
      appsQuery = appsQuery.eq('assignee_name', assignee);
    }

    const { data: appsData, error: appsError } = await appsQuery;
    if (appsError) return sendError(reply, 500, 'DB_ERROR', appsError.message);

    let filteredApps = appsData || [];

    if (search) {
      const lower = search.toLowerCase();
      filteredApps = filteredApps.filter(app =>
        String(app.internal_number || '').toLowerCase().includes(lower) ||
        String(app.external_id || '').toLowerCase().includes(lower) ||
        String(app.applicant || '').toLowerCase().includes(lower) ||
        String(app.assignee_name || '').toLowerCase().includes(lower)
      );
    }

    const projectIds = Array.from(new Set(filteredApps.map(app => app.project_id).filter(Boolean)));
    if (projectIds.length === 0) {
      return reply.send({ items: [], page, limit, total: 0, totalPages: 0 });
    }

    const { data: projectsData, error: projectsError } = await supabase
      .from('projects')
      .select('id, uj_code, cadastre_number, name, region, address, construction_status, updated_at, created_at, buildings(count)')
      .eq('scope_id', scope)
      .in('id', projectIds)
      .order('updated_at', { ascending: false });

    if (projectsError) return sendError(reply, 500, 'DB_ERROR', projectsError.message);

    const appsByProject = filteredApps.reduce((acc, app) => {
      if (!acc[app.project_id]) acc[app.project_id] = app;
      return acc;
    }, {});

    let mapped = (projectsData || []).map(project => {
      const app = appsByProject[project.id];
      const buildingsCount = project.buildings?.[0]?.count || 0;

      const dto = {
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

      return {
        ...dto,
        availableActions: buildProjectAvailableActions(actor?.userRole, dto, actor?.userId),
      };
    });

    if (search) {
      const lower = search.toLowerCase();
      mapped = mapped.filter(p =>
        String(p.name || '').toLowerCase().includes(lower) ||
        String(p.ujCode || '').toLowerCase().includes(lower) ||
        String(p.applicationInfo?.internalNumber || '').toLowerCase().includes(lower) ||
        String(p.applicationInfo?.externalId || '').toLowerCase().includes(lower) ||
        String(p.complexInfo?.street || '').toLowerCase().includes(lower) ||
        String(p.applicationInfo?.assigneeName || '').toLowerCase().includes(lower)
      );
    }

    mapped.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

    const total = mapped.length;
    const from = (page - 1) * limit;

    return reply.send({
      items: mapped.slice(from, from + limit),
      page,
      limit,
      total,
      totalPages: total > 0 ? Math.ceil(total / limit) : 0,
    });
  });

  app.get('/api/v1/projects/summary-counts', async (req, reply) => {
    const { scope } = req.query;
    if (!scope) return sendError(reply, 400, 'MISSING_SCOPE', 'Scope is required');

    const actor = req.authContext || null;
    const assignee = req.query.assignee ? String(req.query.assignee) : null;

    let query = supabase
      .from('applications')
      .select('status, workflow_substatus, assignee_name')
      .eq('scope_id', scope);

    if (assignee === 'mine') {
      if (!actor?.userId) return sendError(reply, 401, 'UNAUTHORIZED', 'Auth context required for assignee=mine');
      query = query.eq('assignee_name', actor.userId);
    } else if (assignee && assignee !== 'all') {
      query = query.eq('assignee_name', assignee);
    }

    const { data, error } = await query;
    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);

    const workSubstatuses = new Set(['DRAFT', 'REVISION', 'RETURNED_BY_MANAGER']);
    const counts = {
      work: 0, review: 0, integration: 0, pendingDecline: 0,
      declined: 0, registryApplications: 0, registryComplexes: 0,
    };

    (data || []).forEach(row => {
      const { status, workflow_substatus: sub } = row;
      if (status === 'IN_PROGRESS' && workSubstatuses.has(sub)) counts.work += 1;
      if (sub === 'REVIEW') counts.review += 1;
      if (sub === 'INTEGRATION') counts.integration += 1;
      if (sub === 'PENDING_DECLINE') counts.pendingDecline += 1;
      if (status === 'DECLINED') counts.declined += 1;
      if (status === 'COMPLETED' || status === 'DECLINED') counts.registryApplications += 1;
      if (status === 'COMPLETED') counts.registryComplexes += 1;
    });

    return reply.send(counts);
  });

  return { app, config };
}

const isDirectRun = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isDirectRun) {
  const { app, config } = await buildServer();
  await app.listen({ port: config.port, host: config.host });
}
