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

function canMutateRegistry(actorRole) {
  return ['admin', 'branch_manager', 'technician'].includes(actorRole);
}

function parseFloorIdsFromQuery(raw) {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);
}

export function registerRegistryRoutes(app, { supabase }) {

  app.get('/api/v1/projects/:projectId/parking-counts', async (req, reply) => {
    const { projectId } = req.params;

    const { data: buildings, error: buildErr } = await supabase
      .from('buildings')
      .select('id')
      .eq('project_id', projectId);
    if (buildErr) return sendError(reply, 500, 'DB_ERROR', buildErr.message);

    const buildingIds = (buildings || []).map(b => b.id);
    if (!buildingIds.length) return reply.send({});

    const { data: blocks, error: blockErr } = await supabase
      .from('building_blocks')
      .select('id')
      .in('building_id', buildingIds);
    if (blockErr) return sendError(reply, 500, 'DB_ERROR', blockErr.message);

    const blockIds = (blocks || []).map(b => b.id);
    if (!blockIds.length) return reply.send({});

    const { data: floors, error: floorsErr } = await supabase
      .from('floors')
      .select('id')
      .in('block_id', blockIds);
    if (floorsErr) return sendError(reply, 500, 'DB_ERROR', floorsErr.message);

    const floorIds = (floors || []).map(f => f.id);
    if (!floorIds.length) return reply.send({});

    const { data: units, error } = await supabase
      .from('units')
      .select('floor_id')
      .eq('unit_type', 'parking_place')
      .in('floor_id', floorIds);
    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);

    const counts = {};
    (units || []).forEach(u => {
      counts[u.floor_id] = (counts[u.floor_id] || 0) + 1;
    });

    return reply.send(counts);
  });

  app.post('/api/v1/floors/:floorId/parking-places/sync', async (req, reply) => {
    const actor = getActor(req);
    if (!actor) return sendError(reply, 401, 'UNAUTHORIZED', 'Missing x-user-id or x-user-role');
    if (!canMutateRegistry(actor.userRole)) {
      return sendError(reply, 403, 'FORBIDDEN', 'Role cannot modify registry data');
    }

    const { floorId } = req.params;
    const targetCount = Math.max(0, parseInt(req.body?.targetCount, 10) || 0);

    const { data: existing, error: fetchErr } = await supabase
      .from('units')
      .select('id, number')
      .eq('floor_id', floorId)
      .eq('unit_type', 'parking_place');
    if (fetchErr) return sendError(reply, 500, 'DB_ERROR', fetchErr.message);

    const currentCount = (existing || []).length;
    if (currentCount === targetCount) return reply.send({ ok: true, added: 0, removed: 0 });

    if (targetCount > currentCount) {
      const toAdd = targetCount - currentCount;
      const newUnits = [];
      for (let i = 1; i <= toAdd; i += 1) {
        newUnits.push({
          id: crypto.randomUUID(),
          floor_id: floorId,
          unit_type: 'parking_place',
          number: null,
          total_area: null,
          status: 'free',
        });
      }
      const { error: insErr } = await supabase.from('units').insert(newUnits);
      if (insErr) return sendError(reply, 500, 'DB_ERROR', insErr.message);
      return reply.send({ ok: true, added: toAdd, removed: 0 });
    }

    const sorted = [...(existing || [])].sort((a, b) => parseInt(b.number || 0, 10) - parseInt(a.number || 0, 10));
    const toDelete = sorted.slice(0, currentCount - targetCount).map(u => u.id);
    if (toDelete.length > 0) {
      const { error: delErr } = await supabase.from('units').delete().in('id', toDelete);
      if (delErr) return sendError(reply, 500, 'DB_ERROR', delErr.message);
    }

    return reply.send({ ok: true, added: 0, removed: toDelete.length });
  });

  app.get('/api/v1/blocks/:blockId/floors', async (req, reply) => {
    const { blockId } = req.params;

    const { data, error } = await supabase
      .from('floors')
      .select('*')
      .eq('block_id', blockId)
      .order('index', { ascending: true });

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send(data || []);
  });

  app.get('/api/v1/blocks/:blockId/entrances', async (req, reply) => {
    const { blockId } = req.params;

    const { data, error } = await supabase
      .from('entrances')
      .select('*')
      .eq('block_id', blockId)
      .order('number', { ascending: true });

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send(data || []);
  });

  app.get('/api/v1/units/:unitId/explication', async (req, reply) => {
    const { unitId } = req.params;

    const { data, error } = await supabase
      .from('units')
      .select('*, rooms (*)')
      .eq('id', unitId)
      .maybeSingle();

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    if (!data) return reply.send(null);

    return reply.send(data);
  });

  app.get('/api/v1/blocks/:blockId/units', async (req, reply) => {
    const { blockId } = req.params;
    const extraFloorIds = parseFloorIdsFromQuery(req.query?.floorIds);

    const { data: floors, error: floorsError } = await supabase
      .from('floors')
      .select('id')
      .eq('block_id', blockId);
    if (floorsError) return sendError(reply, 500, 'DB_ERROR', floorsError.message);

    const floorIds = Array.from(new Set([...(floors || []).map(f => f.id), ...extraFloorIds]));
    if (floorIds.length === 0) return reply.send({ units: [], entranceMap: {} });

    const { data: entrances, error: entrancesError } = await supabase
      .from('entrances')
      .select('id, number')
      .eq('block_id', blockId);
    if (entrancesError) return sendError(reply, 500, 'DB_ERROR', entrancesError.message);

    const entranceMap = (entrances || []).reduce((acc, item) => {
      acc[item.id] = item.number;
      return acc;
    }, {});

    const { data: units, error: unitsError } = await supabase
      .from('units')
      .select('*, rooms (*)')
      .in('floor_id', floorIds)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (unitsError) return sendError(reply, 500, 'DB_ERROR', unitsError.message);
    return reply.send({ units: units || [], entranceMap });
  });

  app.post('/api/v1/units/upsert', async (req, reply) => {
    const actor = getActor(req);
    if (!actor) return sendError(reply, 401, 'UNAUTHORIZED', 'Missing x-user-id or x-user-role');
    if (!canMutateRegistry(actor.userRole)) {
      return sendError(reply, 403, 'FORBIDDEN', 'Role cannot modify registry data');
    }

    const unitData = req.body || {};
    const isPatch = !!unitData.id && (unitData.floorId === undefined || unitData.type === undefined);

    let savedUnit;
    if (isPatch) {
      const patchPayload = { updated_at: new Date().toISOString() };
      if (unitData.num !== undefined) patchPayload.number = unitData.num;
      if (unitData.number !== undefined) patchPayload.number = unitData.number;
      if (unitData.type !== undefined) patchPayload.unit_type = unitData.type;
      if (unitData.area !== undefined) patchPayload.total_area = unitData.area;
      if (unitData.livingArea !== undefined) patchPayload.living_area = unitData.livingArea;
      if (unitData.usefulArea !== undefined) patchPayload.useful_area = unitData.usefulArea;
      if (unitData.rooms !== undefined) patchPayload.rooms_count = unitData.rooms;
      if (unitData.isSold !== undefined) patchPayload.status = unitData.isSold ? 'sold' : 'free';
      if (unitData.hasMezzanine !== undefined) patchPayload.has_mezzanine = !!unitData.hasMezzanine;
      if (unitData.mezzanineType !== undefined) patchPayload.mezzanine_type = unitData.mezzanineType || null;
      if (unitData.unitCode !== undefined) patchPayload.unit_code = unitData.unitCode;

      const { data, error } = await supabase
        .from('units')
        .update(patchPayload)
        .eq('id', unitData.id)
        .select('*')
        .single();
      if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
      savedUnit = data;
    } else {
      const payload = {
        id: unitData.id || crypto.randomUUID(),
        floor_id: unitData.floorId,
        entrance_id: unitData.entranceId,
        unit_code: unitData.unitCode || null,
        number: unitData.num || unitData.number,
        unit_type: unitData.type,
        has_mezzanine: !!unitData.hasMezzanine,
        mezzanine_type: unitData.hasMezzanine ? (unitData.mezzanineType || null) : null,
        total_area: unitData.area,
        living_area: unitData.livingArea || 0,
        useful_area: unitData.usefulArea || 0,
        rooms_count: unitData.rooms || 0,
        status: unitData.isSold ? 'sold' : 'free',
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('units')
        .upsert(payload, { onConflict: 'id' })
        .select('*')
        .single();
      if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
      savedUnit = data;
    }

    if (unitData.explication && Array.isArray(unitData.explication)) {
      const { error: delErr } = await supabase.from('rooms').delete().eq('unit_id', savedUnit.id);
      if (delErr) return sendError(reply, 500, 'DB_ERROR', delErr.message);

      if (unitData.explication.length > 0) {
        const roomsPayload = unitData.explication.map(r => ({
          id: r.id || crypto.randomUUID(),
          unit_id: savedUnit.id,
          room_type: r.type,
          area: r.area || 0,
          room_height: r.height === '' || r.height === undefined ? null : r.height,
          level: r.level || 1,
          is_mezzanine: !!r.isMezzanine,
          name: r.label || '',
        }));
        const { error: insErr } = await supabase.from('rooms').insert(roomsPayload);
        if (insErr) return sendError(reply, 500, 'DB_ERROR', insErr.message);
      }
    }

    return reply.send(savedUnit);
  });

  app.post('/api/v1/blocks/:blockId/units/reconcile', async (req, reply) => {
    const actor = getActor(req);
    if (!actor) return sendError(reply, 401, 'UNAUTHORIZED', 'Missing x-user-id or x-user-role');
    if (!canMutateRegistry(actor.userRole)) {
      return sendError(reply, 403, 'FORBIDDEN', 'Role cannot modify registry data');
    }

    const { blockId } = req.params;
    const result = { removed: 0, checkedCells: 0 };

    const { data: floors, error: floorsErr } = await supabase
      .from('floors')
      .select('id')
      .eq('block_id', blockId);
    if (floorsErr) return sendError(reply, 500, 'DB_ERROR', floorsErr.message);

    const floorIds = (floors || []).map(f => f.id);
    if (floorIds.length === 0) return reply.send(result);

    const { data: entrances, error: entErr } = await supabase
      .from('entrances')
      .select('id, number')
      .eq('block_id', blockId);
    if (entErr) return sendError(reply, 500, 'DB_ERROR', entErr.message);

    const entranceByNumber = new Map((entrances || []).map(e => [Number(e.number), e.id]));

    const { data: matrixRows, error: matrixErr } = await supabase
      .from('entrance_matrix')
      .select('floor_id, entrance_number, flats_count, commercial_count')
      .eq('block_id', blockId);
    if (matrixErr) return sendError(reply, 500, 'DB_ERROR', matrixErr.message);

    const desiredMap = new Map();
    (matrixRows || []).forEach(row => {
      const entranceId = entranceByNumber.get(Number(row.entrance_number));
      if (!entranceId) return;
      desiredMap.set(`${row.floor_id}_${entranceId}`, {
        flats: Math.max(0, parseInt(row.flats_count || 0, 10) || 0),
        commercial: Math.max(0, parseInt(row.commercial_count || 0, 10) || 0),
      });
    });

    const { data: units, error: unitsErr } = await supabase
      .from('units')
      .select('id, floor_id, entrance_id, unit_type, created_at')
      .in('floor_id', floorIds);
    if (unitsErr) return sendError(reply, 500, 'DB_ERROR', unitsErr.message);

    const isFlatType = type => ['flat', 'duplex_up', 'duplex_down'].includes(type);
    const isCommercialType = type => ['office', 'office_inventory', 'non_res_block', 'infrastructure'].includes(type);

    const grouped = new Map();
    (units || []).forEach(u => {
      const key = `${u.floor_id}_${u.entrance_id}`;
      if (!grouped.has(key)) grouped.set(key, { flats: [], commercial: [] });
      if (isFlatType(u.unit_type)) grouped.get(key).flats.push(u);
      else if (isCommercialType(u.unit_type)) grouped.get(key).commercial.push(u);
    });

    const toDelete = [];
    grouped.forEach((bucket, key) => {
      const desired = desiredMap.get(key) || { flats: 0, commercial: 0 };
      result.checkedCells += 1;

      const sortByAge = (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      const flatsSorted = [...bucket.flats].sort(sortByAge);
      const commSorted = [...bucket.commercial].sort(sortByAge);

      if (flatsSorted.length > desired.flats) {
        toDelete.push(...flatsSorted.slice(desired.flats).map(u => u.id));
      }
      if (commSorted.length > desired.commercial) {
        toDelete.push(...commSorted.slice(desired.commercial).map(u => u.id));
      }
    });

    if (toDelete.length > 0) {
      const { error: delErr } = await supabase.from('units').delete().in('id', toDelete);
      if (delErr) return sendError(reply, 500, 'DB_ERROR', delErr.message);
      result.removed = toDelete.length;
    }

    return reply.send(result);
  });

  app.post('/api/v1/blocks/:blockId/common-areas/reconcile', async (req, reply) => {
    const actor = getActor(req);
    if (!actor) return sendError(reply, 401, 'UNAUTHORIZED', 'Missing x-user-id or x-user-role');
    if (!canMutateRegistry(actor.userRole)) {
      return sendError(reply, 403, 'FORBIDDEN', 'Role cannot modify registry data');
    }

    const { blockId } = req.params;
    const result = { removed: 0, checkedCells: 0 };

    const { data: floors, error: floorsErr } = await supabase
      .from('floors')
      .select('id')
      .eq('block_id', blockId);
    if (floorsErr) return sendError(reply, 500, 'DB_ERROR', floorsErr.message);

    const floorIds = (floors || []).map(f => f.id);
    if (floorIds.length === 0) return reply.send(result);

    const { data: entrances, error: entErr } = await supabase
      .from('entrances')
      .select('id, number')
      .eq('block_id', blockId);
    if (entErr) return sendError(reply, 500, 'DB_ERROR', entErr.message);

    const entranceByNumber = new Map((entrances || []).map(e => [Number(e.number), e.id]));

    const { data: matrixRows, error: matrixErr } = await supabase
      .from('entrance_matrix')
      .select('floor_id, entrance_number, mop_count')
      .eq('block_id', blockId);
    if (matrixErr) return sendError(reply, 500, 'DB_ERROR', matrixErr.message);

    const desiredMap = new Map();
    (matrixRows || []).forEach(row => {
      const entranceId = entranceByNumber.get(Number(row.entrance_number));
      if (!entranceId) return;
      desiredMap.set(`${row.floor_id}_${entranceId}`, Math.max(0, parseInt(row.mop_count || 0, 10) || 0));
    });

    const { data: areas, error: areasErr } = await supabase
      .from('common_areas')
      .select('id, floor_id, entrance_id, created_at')
      .in('floor_id', floorIds);
    if (areasErr) return sendError(reply, 500, 'DB_ERROR', areasErr.message);

    const grouped = new Map();
    (areas || []).forEach(a => {
      const key = `${a.floor_id}_${a.entrance_id}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(a);
    });

    const toDelete = [];
    grouped.forEach((list, key) => {
      const desired = desiredMap.get(key) || 0;
      result.checkedCells += 1;
      const sorted = [...list].sort(
        (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      );
      if (sorted.length > desired) {
        toDelete.push(...sorted.slice(desired).map(item => item.id));
      }
    });

    if (toDelete.length > 0) {
      const { error: delErr } = await supabase.from('common_areas').delete().in('id', toDelete);
      if (delErr) return sendError(reply, 500, 'DB_ERROR', delErr.message);
      result.removed = toDelete.length;
    }

    return reply.send(result);
  });

  app.post('/api/v1/units/batch-upsert', async (req, reply) => {
    const actor = getActor(req);
    if (!actor) return sendError(reply, 401, 'UNAUTHORIZED', 'Missing x-user-id or x-user-role');
    if (!canMutateRegistry(actor.userRole)) {
      return sendError(reply, 403, 'FORBIDDEN', 'Role cannot modify registry data');
    }

    const unitsList = Array.isArray(req.body?.unitsList) ? req.body.unitsList : [];
    if (!unitsList.length) return reply.send({ ok: true, count: 0 });

    const payload = unitsList.map(u => ({
      id: u.id || crypto.randomUUID(),
      floor_id: u.floorId,
      entrance_id: u.entranceId,
      number: u.num || u.number,
      unit_type: u.type,
      unit_code: u.unitCode || null,
      total_area: u.area || 0,
      status: 'free',
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from('units').upsert(payload, { onConflict: 'id' });
    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);

    return reply.send({ ok: true, count: payload.length });
  });

  app.post('/api/v1/common-areas/upsert', async (req, reply) => {
    const actor = getActor(req);
    if (!actor) return sendError(reply, 401, 'UNAUTHORIZED', 'Missing x-user-id or x-user-role');
    if (!canMutateRegistry(actor.userRole)) {
      return sendError(reply, 403, 'FORBIDDEN', 'Role cannot modify registry data');
    }

    const payload = {
      id: req.body?.id,
      floor_id: req.body?.floorId,
      entrance_id: req.body?.entranceId,
      type: req.body?.type,
      area: req.body?.area,
      height: req.body?.height === '' || req.body?.height === undefined ? null : req.body?.height,
      updated_at: new Date().toISOString(),
    };

    if (!payload.floor_id || !payload.type) {
      return sendError(reply, 400, 'VALIDATION_ERROR', 'floorId and type are required');
    }

    const { data, error } = await supabase
      .from('common_areas')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single();

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send(data);
  });

  app.delete('/api/v1/common-areas/:id', async (req, reply) => {
    const actor = getActor(req);
    if (!actor) return sendError(reply, 401, 'UNAUTHORIZED', 'Missing x-user-id or x-user-role');
    if (!canMutateRegistry(actor.userRole)) {
      return sendError(reply, 403, 'FORBIDDEN', 'Role cannot modify registry data');
    }

    const { id } = req.params;
    const { error } = await supabase.from('common_areas').delete().eq('id', id);
    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);

    return reply.send({ ok: true });
  });

  app.post('/api/v1/blocks/:blockId/common-areas/clear', async (req, reply) => {
    const actor = getActor(req);
    if (!actor) return sendError(reply, 401, 'UNAUTHORIZED', 'Missing x-user-id or x-user-role');
    if (!canMutateRegistry(actor.userRole)) {
      return sendError(reply, 403, 'FORBIDDEN', 'Role cannot modify registry data');
    }

    const { blockId } = req.params;
    const extraFloorIds = parseFloorIdsFromQuery(req.body?.floorIds);

    const { data: floors, error: floorsError } = await supabase
      .from('floors')
      .select('id')
      .eq('block_id', blockId);
    if (floorsError) return sendError(reply, 500, 'DB_ERROR', floorsError.message);

    const floorIds = Array.from(new Set([...(floors || []).map(f => f.id), ...extraFloorIds]));
    if (floorIds.length === 0) return reply.send({ ok: true, deleted: 0 });

    const { data: rowsToDelete, error: countError } = await supabase
      .from('common_areas')
      .select('id')
      .in('floor_id', floorIds);
    if (countError) return sendError(reply, 500, 'DB_ERROR', countError.message);

    const { error } = await supabase.from('common_areas').delete().in('floor_id', floorIds);
    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);

    return reply.send({ ok: true, deleted: (rowsToDelete || []).length });
  });

  app.get('/api/v1/blocks/:blockId/common-areas', async (req, reply) => {
    const { blockId } = req.params;
    const extraFloorIds = parseFloorIdsFromQuery(req.query?.floorIds);

    const { data: floors, error: floorsError } = await supabase
      .from('floors')
      .select('id')
      .eq('block_id', blockId);
    if (floorsError) return sendError(reply, 500, 'DB_ERROR', floorsError.message);

    const floorIds = Array.from(new Set([...(floors || []).map(f => f.id), ...extraFloorIds]));
    if (floorIds.length === 0) return reply.send([]);

    const { data, error } = await supabase
      .from('common_areas')
      .select('*')
      .in('floor_id', floorIds);

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send(data || []);
  });

  app.get('/api/v1/blocks/:blockId/entrance-matrix', async (req, reply) => {
    const { blockId } = req.params;

    const { data, error } = await supabase
      .from('entrance_matrix')
      .select('*')
      .eq('block_id', blockId);

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send(data || []);
  });
  app.put('/api/v1/floors/:floorId', async (req, reply) => {
    const actor = getActor(req);
    if (!actor) return sendError(reply, 401, 'UNAUTHORIZED', 'Missing x-user-id or x-user-role');
    if (!canMutateRegistry(actor.userRole)) {
      return sendError(reply, 403, 'FORBIDDEN', 'Role cannot modify registry data');
    }

    const { floorId } = req.params;
    const updates = req.body?.updates || {};
    const payload = {};

    if (updates.height !== undefined) payload.height = updates.height;
    if (updates.areaProj !== undefined) payload.area_proj = updates.areaProj;
    if (updates.areaFact !== undefined) payload.area_fact = updates.areaFact;
    if (updates.isDuplex !== undefined) payload.is_duplex = updates.isDuplex;
    if (updates.label !== undefined) payload.label = updates.label;
    if (updates.type !== undefined) payload.floor_type = updates.type;
    if (updates.isTechnical !== undefined) payload.is_technical = updates.isTechnical;
    if (updates.isCommercial !== undefined) payload.is_commercial = updates.isCommercial;

    const { data, error } = await supabase
      .from('floors')
      .update(payload)
      .eq('id', floorId)
      .select('*')
      .single();

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send(data);
  });

  app.post('/api/v1/blocks/:blockId/floors/reconcile', async (req, reply) => {
    const actor = getActor(req);
    if (!actor) return sendError(reply, 401, 'UNAUTHORIZED', 'Missing x-user-id or x-user-role');
    if (!canMutateRegistry(actor.userRole)) {
      return sendError(reply, 403, 'FORBIDDEN', 'Role cannot modify registry data');
    }

    const { blockId } = req.params;
    const floorsFrom = Number(req.body?.floorsFrom || 1);
    const floorsTo = Number(req.body?.floorsTo || 1);
    const defaultType = req.body?.defaultType || 'residential';

    const normalizedFrom = Number.isFinite(floorsFrom) ? floorsFrom : 1;
    const normalizedTo = Number.isFinite(floorsTo) ? floorsTo : 1;

    const { data: existing, error: fetchErr } = await supabase
      .from('floors')
      .select('id, index')
      .eq('block_id', blockId);
    if (fetchErr) return sendError(reply, 500, 'DB_ERROR', fetchErr.message);

    const existingRows = existing || [];
    const existingIndices = new Set(existingRows.map(e => Number(e.index)));
    const targetIndices = new Set();
    for (let i = normalizedFrom; i <= normalizedTo; i += 1) targetIndices.add(i);

    const toDeleteIds = existingRows.filter(e => !targetIndices.has(Number(e.index))).map(e => e.id);
    const toCreateIndices = Array.from(targetIndices).filter(i => !existingIndices.has(i));

    if (toDeleteIds.length > 0) {
      const { error: deleteErr } = await supabase.from('floors').delete().in('id', toDeleteIds);
      if (deleteErr) return sendError(reply, 500, 'DB_ERROR', deleteErr.message);
    }

    if (toCreateIndices.length > 0) {
      const payload = toCreateIndices.map(i => ({
        block_id: blockId,
        index: i,
        label: `${i} этаж`,
        floor_type: defaultType,
        floor_key: `floor:${i}`,
        height: 3.0,
        area_proj: 0,
        is_commercial: defaultType === 'office',
        is_technical: false,
      }));
      const { error: insertErr } = await supabase.from('floors').insert(payload);
      if (insertErr) return sendError(reply, 500, 'DB_ERROR', insertErr.message);
    }

    return reply.send({ ok: true, deleted: toDeleteIds.length, created: toCreateIndices.length });
  });

  app.post('/api/v1/blocks/:blockId/entrances/reconcile', async (req, reply) => {
    const actor = getActor(req);
    if (!actor) return sendError(reply, 401, 'UNAUTHORIZED', 'Missing x-user-id or x-user-role');
    if (!canMutateRegistry(actor.userRole)) {
      return sendError(reply, 403, 'FORBIDDEN', 'Role cannot modify registry data');
    }

    const { blockId } = req.params;
    const normalizedCount = Math.max(0, parseInt(req.body?.count, 10) || 0);

    const { data: existing, error: existingErr } = await supabase
      .from('entrances')
      .select('id, number')
      .eq('block_id', blockId);
    if (existingErr) return sendError(reply, 500, 'DB_ERROR', existingErr.message);

    const existingRows = existing || [];
    const existingNums = new Set(existingRows.map(e => Number(e.number)));
    const toCreate = [];
    for (let i = 1; i <= normalizedCount; i += 1) {
      if (!existingNums.has(i)) toCreate.push({ block_id: blockId, number: i });
    }

    if (toCreate.length > 0) {
      const { error: insertErr } = await supabase.from('entrances').insert(toCreate);
      if (insertErr) return sendError(reply, 500, 'DB_ERROR', insertErr.message);
    }

    const toDeleteIds = existingRows.filter(e => Number(e.number) > normalizedCount).map(e => e.id);
    if (toDeleteIds.length > 0) {
      const { error: deleteErr } = await supabase.from('entrances').delete().in('id', toDeleteIds);
      if (deleteErr) return sendError(reply, 500, 'DB_ERROR', deleteErr.message);
    }

    const { error: matrixTrimErr } = await supabase
      .from('entrance_matrix')
      .delete()
      .eq('block_id', blockId)
      .gt('entrance_number', normalizedCount);
    if (matrixTrimErr) return sendError(reply, 500, 'DB_ERROR', matrixTrimErr.message);

    return reply.send({ ok: true, count: normalizedCount, created: toCreate.length, deleted: toDeleteIds.length });
  });

  app.put('/api/v1/blocks/:blockId/entrance-matrix/cell', async (req, reply) => {
    const actor = getActor(req);
    if (!actor) return sendError(reply, 401, 'UNAUTHORIZED', 'Missing x-user-id or x-user-role');
    if (!canMutateRegistry(actor.userRole)) {
      return sendError(reply, 403, 'FORBIDDEN', 'Role cannot modify registry data');
    }

    const { blockId } = req.params;
    const floorId = req.body?.floorId;
    const entranceNumber = Number(req.body?.entranceNumber);
    const values = req.body?.values || {};

    if (!floorId || !Number.isFinite(entranceNumber)) {
      return sendError(reply, 400, 'VALIDATION_ERROR', 'floorId and entranceNumber are required');
    }

    const payload = {
      block_id: blockId,
      floor_id: floorId,
      entrance_number: entranceNumber,
      updated_at: new Date().toISOString(),
    };
    if (values.apts !== undefined) payload.flats_count = values.apts;
    if (values.units !== undefined) payload.commercial_count = values.units;
    if (values.mopQty !== undefined) payload.mop_count = values.mopQty;

    const { data, error } = await supabase
      .from('entrance_matrix')
      .upsert(payload, { onConflict: 'block_id,floor_id,entrance_number' })
      .select('*')
      .single();

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send(data);
  });
}
