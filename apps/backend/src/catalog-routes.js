import { sendError, requirePolicyActor } from './http-helpers.js';

const ALLOWED_CATALOG_TABLES = [
  'dict_project_statuses',
  'dict_application_statuses',
  'dict_external_systems',
  'dict_foundations',
  'dict_wall_materials',
  'dict_slab_types',
  'dict_roof_types',
  'dict_light_structure_types',
  'dict_parking_types',
  'dict_parking_construction_types',
  'dict_infra_types',
  'dict_mop_types',
  'dict_unit_types',
  'dict_room_types',
  'dict_system_users',
];

export function registerCatalogRoutes(app, { supabase }) {
  app.get('/api/v1/catalogs/:table', async (req, reply) => {
    const { table } = req.params;
    const { activeOnly } = req.query;

    if (!ALLOWED_CATALOG_TABLES.includes(table)) {
      return sendError(reply, 400, 'INVALID_TABLE', 'Таблица не разрешена');
    }

    let query = supabase.from(table).select('*').order('sort_order', { ascending: true });

    if (table === 'dict_system_users') {
      query = query.order('name', { ascending: true });
    } else {
      query = query.order('label', { ascending: true });
    }

    if (activeOnly === 'true') {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);

    return data || [];
  });

  app.post('/api/v1/catalogs/:table/upsert', async (req, reply) => {
    if (!requirePolicyActor(req, reply, {
      module: 'catalogs',
      action: 'mutate',
      forbiddenMessage: 'Role cannot mutate catalogs',
    })) return;

    const { table } = req.params;
    if (!ALLOWED_CATALOG_TABLES.includes(table)) {
      return sendError(reply, 400, 'INVALID_TABLE', 'Таблица не разрешена');
    }

    const item = req.body?.item || {};
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return sendError(reply, 400, 'VALIDATION_ERROR', 'Body must include an item object');
    }

    const itemId = item.id == null ? null : String(item.id).trim();
    if (!itemId) {
      return sendError(reply, 400, 'VALIDATION_ERROR', 'item.id is required');
    }

    const payload = {
      ...item,
      id: itemId,
      code: item.code,
      label: item.label,
      sort_order: Number(item.sort_order || item.sortOrder || 100),
      is_active: item.is_active ?? item.isActive ?? true,
    };

    const { error } = await supabase.from(table).upsert(payload);
    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);

    return { ok: true };
  });

  app.put('/api/v1/catalogs/:table/:id/active', async (req, reply) => {
    if (!requirePolicyActor(req, reply, {
      module: 'catalogs',
      action: 'mutate',
      forbiddenMessage: 'Role cannot mutate catalogs',
    })) return;

    const { table, id } = req.params;
    if (!ALLOWED_CATALOG_TABLES.includes(table)) {
      return sendError(reply, 400, 'INVALID_TABLE', 'Таблица не разрешена');
    }

    if (typeof req.body?.isActive !== 'boolean') {
      return sendError(reply, 400, 'VALIDATION_ERROR', 'isActive must be a boolean');
    }

    const { error } = await supabase.from(table).update({ is_active: req.body.isActive }).eq('id', id);
    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);

    return { ok: true };
  });
}
