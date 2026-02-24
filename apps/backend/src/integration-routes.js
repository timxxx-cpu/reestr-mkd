import { sendError, requirePolicyActor } from './http-helpers.js';

function formatByGroups(value, groups) {
  const digits = String(value || '').replace(/\D/g, '');
  const maxLen = groups.reduce((sum, item) => sum + item, 0);
  const trimmed = digits.slice(0, maxLen);

  const parts = [];
  let offset = 0;
  for (const groupLen of groups) {
    const part = trimmed.slice(offset, offset + groupLen);
    if (!part) break;
    parts.push(part);
    offset += groupLen;
  }

  return parts.join(':');
}

function formatBuildingCadastre(value) {
  return formatByGroups(value, [2, 2, 2, 2, 2, 5]);
}

export function registerIntegrationRoutes(app, { supabase }) {
  app.get('/api/v1/projects/:projectId/integration-status', async (req, reply) => {
    const { projectId } = req.params;

    const { data, error } = await supabase
      .from('applications')
      .select('integration_data')
      .eq('project_id', projectId)
      .maybeSingle();

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send(data?.integration_data || {});
  });

  app.put('/api/v1/projects/:projectId/integration-status', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'integration',
      action: 'mutate',
      forbiddenMessage: 'Role cannot modify integration data',
    });
    if (!actor) return;

    const { projectId } = req.params;
    const field = req.body?.field;
    const status = req.body?.status;

    if (!field) return sendError(reply, 400, 'VALIDATION_ERROR', 'field is required');

    const { data: appData, error: appError } = await supabase
      .from('applications')
      .select('id, integration_data')
      .eq('project_id', projectId)
      .maybeSingle();

    if (appError) return sendError(reply, 500, 'DB_ERROR', appError.message);
    if (!appData) return sendError(reply, 404, 'NOT_FOUND', 'Application not found');

    const integrationData = {
      ...(appData.integration_data || {}),
      [field]: status,
    };

    const { error: updateError } = await supabase
      .from('applications')
      .update({ integration_data: integrationData, updated_at: new Date().toISOString() })
      .eq('id', appData.id);

    if (updateError) return sendError(reply, 500, 'DB_ERROR', updateError.message);

    return reply.send({ ok: true, integrationData });
  });

  app.put('/api/v1/buildings/:buildingId/cadastre', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'integration',
      action: 'mutate',
      forbiddenMessage: 'Role cannot modify cadastre data',
    });
    if (!actor) return;

    const { buildingId } = req.params;
    const cadastre = formatBuildingCadastre(req.body?.cadastre);

    const { data, error } = await supabase
      .from('buildings')
      .update({ cadastre_number: cadastre, updated_at: new Date().toISOString() })
      .eq('id', buildingId)
      .select('id, cadastre_number')
      .maybeSingle();

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    if (!data) return sendError(reply, 404, 'NOT_FOUND', 'Building not found');

    return reply.send({ ok: true, id: data.id, cadastre: data.cadastre_number });
  });

  app.put('/api/v1/units/:unitId/cadastre', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'integration',
      action: 'mutate',
      forbiddenMessage: 'Role cannot modify cadastre data',
    });
    if (!actor) return;

    const { unitId } = req.params;
    const cadastre = req.body?.cadastre || null;

    const { data, error } = await supabase
      .from('units')
      .update({ cadastre_number: cadastre, updated_at: new Date().toISOString() })
      .eq('id', unitId)
      .select('id, cadastre_number')
      .maybeSingle();

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    if (!data) return sendError(reply, 404, 'NOT_FOUND', 'Unit not found');

    return reply.send({ ok: true, id: data.id, cadastre: data.cadastre_number });
  });
}
