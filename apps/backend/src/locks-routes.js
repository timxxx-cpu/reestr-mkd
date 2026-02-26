import { sendError, requirePolicyActor } from './http-helpers.js';

export function registerLocksRoutes(app, { supabase }) {
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
}
