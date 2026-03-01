import { createIdempotencyStore } from './idempotency-store.js';
import { sendError, requirePolicyActor } from './http-helpers.js';
import { generateFloorsModel } from './floor-generator.js';
import {
  buildIdempotencyContext,
  tryServeIdempotentResponse,
  rememberIdempotentResponse,
} from './idempotency-helpers.js';
import crypto from 'crypto';

function parseFloorIdsFromQuery(raw) {
  if (!raw) return [];
  return String(raw).split(',').map(x => x.trim()).filter(Boolean);
}

async function fetchAllPaged(queryFactory, pageSize = 1000) {
  let from = 0;
  const rows = [];

  while (true) {
    const { data, error } = await queryFactory(from, from + pageSize - 1);
    if (error) return { data: null, error };
    const chunk = data || [];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }

  return { data: rows, error: null };
}





async function inheritUnitAddressId(supabase, floorId, apartmentNo) {
  if (!floorId || !apartmentNo) return null;
  const { data: floor } = await supabase.from('floors').select('block_id').eq('id', floorId).maybeSingle();
  if (!floor?.block_id) return null;
  const { data: block } = await supabase.from('building_blocks').select('building_id, address_id').eq('id', floor.block_id).maybeSingle();
  if (!block) return null;
  let baseAddressId = block.address_id || null;
  if (!baseAddressId && block.building_id) {
    const { data: building } = await supabase.from('buildings').select('project_id, address_id').eq('id', block.building_id).maybeSingle();
    baseAddressId = building?.address_id || null;
    if (!baseAddressId && building?.project_id) {
      const { data: project } = await supabase.from('projects').select('address_id').eq('id', building.project_id).maybeSingle();
      baseAddressId = project?.address_id || null;
    }
  }
  if (!baseAddressId) return null;
  const { data: base } = await supabase.from('addresses').select('district, street, mahalla, building_no, city').eq('id', baseAddressId).maybeSingle();
  if (!base) return null;
  const payload = {
    id: crypto.randomUUID(),
    dtype: 'Address',
    versionrev: 0,
    district: base.district || null,
    street: base.street || null,
    mahalla: base.mahalla || null,
    city: base.city || null,
    building_no: base.building_no || null,
    apartment_no: String(apartmentNo),
    full_address: [base.city, base.building_no ? `д. ${base.building_no}` : null, `кв. ${apartmentNo}`].filter(Boolean).join(', '),
  };
  const { data, error } = await supabase.from('addresses').insert(payload).select('id').single();
  if (error) return null;
  return data?.id || null;
}
function parseNonNegativeIntOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < 0) return null;
  return num;
}


function parseNullableDecimal(value, fieldName) {
  if (value === '' || value === null || value === undefined) return null;
  const normalized = typeof value === 'string' ? value.replace(',', '.').trim() : value;
  const num = Number(normalized);
  if (!Number.isFinite(num)) {
    throw new Error(`${fieldName} must be a valid number or empty`);
  }
  return num;
}

function validateMatrixValues(values = {}) {
  const payload = {};
  const hasApts = Object.prototype.hasOwnProperty.call(values, 'apts');
  const hasUnits = Object.prototype.hasOwnProperty.call(values, 'units');
  const hasMops = Object.prototype.hasOwnProperty.call(values, 'mopQty');
  if (!hasApts && !hasUnits && !hasMops) {
    return { error: 'values must include at least one field: apts, units, mopQty' };
  }

  const MAX_ALLOWED = 500;
  if (hasApts) {
    const parsed = parseNonNegativeIntOrNull(values.apts);
    if (parsed === null && values.apts !== '' && values.apts !== null && values.apts !== undefined) return { error: 'apts must be a non-negative integer or empty' };
    if (parsed !== null && parsed > MAX_ALLOWED) return { error: `apts must be <= ${MAX_ALLOWED}` };
    payload.flats_count = parsed;
  }
  if (hasUnits) {
    const parsed = parseNonNegativeIntOrNull(values.units);
    if (parsed === null && values.units !== '' && values.units !== null && values.units !== undefined) return { error: 'units must be a non-negative integer or empty' };
    if (parsed !== null && parsed > MAX_ALLOWED) return { error: `units must be <= ${MAX_ALLOWED}` };
    payload.commercial_count = parsed;
  }
  if (hasMops) {
    const parsed = parseNonNegativeIntOrNull(values.mopQty);
    if (parsed === null && values.mopQty !== '' && values.mopQty !== null && values.mopQty !== undefined) return { error: 'mopQty must be a non-negative integer or empty' };
    if (parsed !== null && parsed > MAX_ALLOWED) return { error: `mopQty must be <= ${MAX_ALLOWED}` };
    payload.mop_count = parsed;
  }

  return { payload };
}

function mapFloorUpdatesToPayload(updates = {}) {
  const payload = {};
  if (updates.height !== undefined) payload.height = parseNullableDecimal(updates.height, 'height');
  if (updates.areaProj !== undefined) payload.area_proj = parseNullableDecimal(updates.areaProj, 'areaProj');
  if (updates.areaFact !== undefined) payload.area_fact = parseNullableDecimal(updates.areaFact, 'areaFact');
  if (updates.isDuplex !== undefined) payload.is_duplex = updates.isDuplex;
  if (updates.label !== undefined) payload.label = updates.label;
  if (updates.type !== undefined) payload.floor_type = updates.type;
  if (updates.isTechnical !== undefined) payload.is_technical = updates.isTechnical;
  if (updates.isCommercial !== undefined) payload.is_commercial = updates.isCommercial;
  return payload;
}

async function ensureEntranceMatrixForBlock(supabase, blockId) {
  const [{ data: floors = [], error: floorsError }, { data: entrances = [], error: entrancesError }] =
    await Promise.all([
      supabase.from('floors').select('id').eq('block_id', blockId),
      supabase.from('entrances').select('number').eq('block_id', blockId),
    ]);

  if (floorsError) return floorsError;
  if (entrancesError) return entrancesError;

  const floorIds = floors.map(row => row.id).filter(Boolean);
  const entranceNumbers = entrances
    .map(row => Number(row.number))
    .filter(number => Number.isFinite(number) && number > 0);

  if (floorIds.length === 0 || entranceNumbers.length === 0) {
    const { error: clearError } = await supabase.from('entrance_matrix').delete().eq('block_id', blockId);
    return clearError || null;
  }

  const { data: existingRows = [], error: existingError } = await supabase
    .from('entrance_matrix')
    .select('id, floor_id, entrance_number')
    .eq('block_id', blockId);
  if (existingError) return existingError;

  const floorSet = new Set(floorIds);
  const entranceSet = new Set(entranceNumbers);
  const existingKeySet = new Set();
  const staleIds = [];

  (existingRows || []).forEach(row => {
    const floorId = row.floor_id;
    const entranceNumber = Number(row.entrance_number);
    if (!floorSet.has(floorId) || !entranceSet.has(entranceNumber)) {
      if (row.id) staleIds.push(row.id);
      return;
    }
    existingKeySet.add(`${floorId}|${entranceNumber}`);
  });

  if (staleIds.length > 0) {
    const { error: deleteError } = await supabase.from('entrance_matrix').delete().in('id', staleIds);
    if (deleteError) return deleteError;
  }

  const missingPayload = [];
  floorIds.forEach(floorId => {
    entranceNumbers.forEach(entranceNumber => {
      const key = `${floorId}|${entranceNumber}`;
      if (existingKeySet.has(key)) return;
      missingPayload.push({
        block_id: blockId,
        floor_id: floorId,
        entrance_number: entranceNumber,
        updated_at: new Date().toISOString(),
      });
    });
  });

  if (missingPayload.length > 0) {
    const { error: upsertError } = await supabase
      .from('entrance_matrix')
      .upsert(missingPayload, { onConflict: 'block_id,floor_id,entrance_number' });
    if (upsertError) return upsertError;
  }

  return null;
}

async function syncExtensionFloors(supabase, extensionId) {
  const { data: extension, error: extensionError } = await supabase
    .from('block_extensions')
    .select('id, parent_block_id, floors_count, start_floor_index')
    .eq('id', extensionId)
    .maybeSingle();
  if (extensionError) return extensionError;
  if (!extension?.id) return { message: 'Extension not found' };

  const { data: parentBlock, error: parentError } = await supabase
    .from('building_blocks')
    .select('id, type')
    .eq('id', extension.parent_block_id)
    .maybeSingle();
  if (parentError) return parentError;

  const floorsCount = Math.max(1, Number(extension.floors_count || 1));
  const startFloorIndex = Math.max(1, Number(extension.start_floor_index || 1));
  const floorType = parentBlock?.type === 'Ж' ? 'residential' : 'office';

  const { data: existingFloors = [], error: existingError } = await supabase
    .from('floors')
    .select('id, index, parent_floor_index, basement_id')
    .eq('extension_id', extension.id);
  if (existingError) return existingError;

  const existingByIndex = new Map((existingFloors || []).map(item => [Number(item.index), item]));
  const targetIndexes = [];
  const payload = [];
  const now = new Date().toISOString();

  for (let i = 0; i < floorsCount; i++) {
    const idx = startFloorIndex + i;
    targetIndexes.push(idx);
    const existing = existingByIndex.get(idx);
    payload.push({
      id: existing?.id || crypto.randomUUID(),
      block_id: null,
      extension_id: extension.id,
      index: idx,
      floor_key: `extension:${extension.id}:${idx}`,
      label: `${idx} этаж`,
      floor_type: floorType,
      parent_floor_index: null,
      basement_id: null,
      updated_at: now,
    });
  }

  const toDeleteIds = (existingFloors || [])
    .filter(item => !targetIndexes.includes(Number(item.index)))
    .map(item => item.id);

  if (toDeleteIds.length > 0) {
    const { error: deleteError } = await supabase.from('floors').delete().in('id', toDeleteIds);
    if (deleteError) return deleteError;
  }

  if (payload.length > 0) {
    const { error: upsertError } = await supabase.from('floors').upsert(payload, { onConflict: 'id' });
    if (upsertError) return upsertError;
  }

  return null;
}

const UNIT_TYPE_PREFIXES = Object.freeze({
  flat: 'EF',
  duplex_up: 'EF',
  duplex_down: 'EF',
  office: 'EO',
  office_inventory: 'EO',
  non_res_block: 'EO',
  infrastructure: 'EO',
  parking_place: 'EP',
});

const getUnitPrefix = unitType => UNIT_TYPE_PREFIXES[unitType] || 'EF';

const generateUnitCode = (prefix, sequenceNumber) => {
  const num = parseInt(String(sequenceNumber), 10) || 0;
  return `${prefix}${String(num).padStart(4, '0')}`;
};

const extractUnitSegment = code => {
  if (!code) return null;
  const str = String(code);
  const parts = str.split('-');
  return parts.length > 2 ? parts[parts.length - 1] : str;
};

const extractNumber = code => {
  if (!code) return 0;
  const match = String(code).match(/\d+$/);
  return match ? parseInt(match[0], 10) : 0;
};

const getNextUnitSequenceNumber = (existingCodes, prefix = null) => {
  if (!Array.isArray(existingCodes) || existingCodes.length === 0) return 1;
  const filtered = prefix ? existingCodes.filter(code => String(code).startsWith(prefix)) : existingCodes;
  if (filtered.length === 0) return 1;
  const numbers = filtered.map(extractNumber).filter(n => n > 0);
  if (numbers.length === 0) return 1;
  return Math.max(...numbers) + 1;
};

const resolveBuildingByFloor = async (supabase, floorId) => {
  const { data: floor, error: floorError } = await supabase
    .from('floors')
    .select('block_id')
    .eq('id', floorId)
    .single();
  if (floorError) return { error: floorError };
  if (!floor?.block_id) return { buildingId: null, buildingCode: null };

  const { data: block, error: blockError } = await supabase
    .from('building_blocks')
    .select('building_id')
    .eq('id', floor.block_id)
    .single();
  if (blockError) return { error: blockError };
  if (!block?.building_id) return { buildingId: null, buildingCode: null };

  const { data: building, error: buildingError } = await supabase
    .from('buildings')
    .select('building_code')
    .eq('id', block.building_id)
    .single();
  if (buildingError) return { error: buildingError };

  return {
    buildingId: block.building_id,
    buildingCode: building?.building_code || null,
  };
};

const getExistingUnitSegmentsByBuildingCode = async (supabase, buildingCode) => {
  if (!buildingCode) return { segments: [] };
  const { data: rows, error } = await supabase
    .from('units')
    .select('unit_code')
    .ilike('unit_code', `${buildingCode}-%`);
  if (error) return { error };
  return {
    segments: (rows || []).map(row => extractUnitSegment(row.unit_code)).filter(Boolean),
  };
};

const EXTENSION_VERTICAL_ANCHORS = new Set(['GROUND', 'BLOCK_FLOOR', 'ROOF']);
const EXTENSION_CONSTRUCTION_KINDS = new Set(['capital', 'light']);

const normalizeExtensionPayload = (payload = {}) => {
  const label = String(payload.label || '').trim();
  if (!label) {
    return { error: 'label is required' };
  }

  const floorsCount = Number.parseInt(payload.floorsCount, 10);
  if (!Number.isInteger(floorsCount) || floorsCount < 1) {
    return { error: 'floorsCount must be an integer >= 1' };
  }

  const startFloorIndex = Number.parseInt(payload.startFloorIndex, 10);
  if (!Number.isInteger(startFloorIndex) || startFloorIndex < 1) {
    return { error: 'startFloorIndex must be an integer >= 1' };
  }

  const extensionType = String(payload.extensionType || 'OTHER').trim().toUpperCase();
  const constructionKind = String(payload.constructionKind || 'capital').trim().toLowerCase();
  if (!EXTENSION_CONSTRUCTION_KINDS.has(constructionKind)) {
    return { error: 'constructionKind must be one of: capital, light' };
  }

  const verticalAnchorType = String(payload.verticalAnchorType || 'GROUND').trim().toUpperCase();
  if (!EXTENSION_VERTICAL_ANCHORS.has(verticalAnchorType)) {
    return { error: 'verticalAnchorType must be one of: GROUND, BLOCK_FLOOR, ROOF' };
  }

  const anchorFloorRaw = payload.anchorFloorKey === undefined || payload.anchorFloorKey === null
    ? null
    : String(payload.anchorFloorKey).trim();
  const anchorFloorKey = anchorFloorRaw || null;

  if (verticalAnchorType === 'GROUND' && anchorFloorKey !== null) {
    return { error: 'anchorFloorKey must be null when verticalAnchorType=GROUND' };
  }

  if (verticalAnchorType !== 'GROUND' && !anchorFloorKey) {
    return { error: 'anchorFloorKey is required when verticalAnchorType is BLOCK_FLOOR or ROOF' };
  }

  return {
    data: {
      label,
      extension_type: extensionType,
      construction_kind: constructionKind,
      floors_count: floorsCount,
      start_floor_index: startFloorIndex,
      vertical_anchor_type: verticalAnchorType,
      anchor_floor_key: verticalAnchorType === 'GROUND' ? null : anchorFloorKey,
      notes: payload.notes === undefined || payload.notes === null
        ? null
        : String(payload.notes).trim() || null,
    },
  };
};

export function registerRegistryRoutes(app, { supabase }) {
  const idempotencyStore = createIdempotencyStore();

  app.get('/api/v1/registry/buildings-summary', async (req, reply) => {
    const { data, error } = await supabase
      .from('view_registry_buildings_summary')
      .select('*')
      .order('project_name', { ascending: true });

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send(data || []);
  });

  app.get('/api/v1/projects/:projectId/parking-counts', async (req, reply) => {
    const { projectId } = req.params;

    const { data: buildings, error: buildErr } = await supabase
      .from('buildings').select('id').eq('project_id', projectId);
    if (buildErr) return sendError(reply, 500, 'DB_ERROR', buildErr.message);

    const buildingIds = (buildings || []).map(b => b.id);
    if (!buildingIds.length) return reply.send({});

    const { data: blocks, error: blockErr } = await supabase
      .from('building_blocks').select('id').in('building_id', buildingIds);
    if (blockErr) return sendError(reply, 500, 'DB_ERROR', blockErr.message);

    const blockIds = (blocks || []).map(b => b.id);
    if (!blockIds.length) return reply.send({});

    const { data: floors, error: floorsErr } = await supabase
      .from('floors').select('id').in('block_id', blockIds);
    if (floorsErr) return sendError(reply, 500, 'DB_ERROR', floorsErr.message);

    const floorIds = (floors || []).map(f => f.id);
    if (!floorIds.length) return reply.send({});

    const { data: units, error } = await supabase
      .from('units').select('floor_id').eq('unit_type', 'parking_place').in('floor_id', floorIds);
    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);

    const counts = {};
    (units || []).forEach(u => { counts[u.floor_id] = (counts[u.floor_id] || 0) + 1; });
    return reply.send(counts);
  });

  app.post('/api/v1/floors/:floorId/parking-places/sync', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'registry', action: 'mutate', forbiddenMessage: 'Role cannot modify registry data',
    });
    if (!actor) return;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(idempotencyStore, idempotencyContext, reply)) return;

    const { floorId } = req.params;
    const targetCount = Math.max(0, parseInt(req.body?.targetCount, 10) || 0);

    const { data: existing, error: fetchErr } = await supabase
      .from('units').select('id, number').eq('floor_id', floorId).eq('unit_type', 'parking_place');
    if (fetchErr) return sendError(reply, 500, 'DB_ERROR', fetchErr.message);

    const currentCount = (existing || []).length;
    if (currentCount === targetCount) {
      const payload = { ok: true, added: 0, removed: 0 };
      rememberIdempotentResponse(idempotencyStore, idempotencyContext, payload);
      return reply.send(payload);
    }

    if (targetCount > currentCount) {
      const toAdd = targetCount - currentCount;
      const newUnits = Array.from({ length: toAdd }, () => ({
        id: crypto.randomUUID(),
        floor_id: floorId,
        unit_type: 'parking_place',
        number: null,
        total_area: null,
        status: 'free',
      }));
      const { error: insErr } = await supabase.from('units').insert(newUnits);
      if (insErr) return sendError(reply, 500, 'DB_ERROR', insErr.message);
      const payload = { ok: true, added: toAdd, removed: 0 };
      rememberIdempotentResponse(idempotencyStore, idempotencyContext, payload);
      return reply.send(payload);
    }

    const sorted = [...(existing || [])].sort((a, b) => parseInt(b.number || 0, 10) - parseInt(a.number || 0, 10));
    const toDelete = sorted.slice(0, currentCount - targetCount).map(u => u.id);
    if (toDelete.length > 0) {
      const { error: delErr } = await supabase.from('units').delete().in('id', toDelete);
      if (delErr) return sendError(reply, 500, 'DB_ERROR', delErr.message);
    }

    const payload = { ok: true, added: 0, removed: toDelete.length };
    rememberIdempotentResponse(idempotencyStore, idempotencyContext, payload);
    return reply.send(payload);
  });

  app.get('/api/v1/blocks/:blockId/floors', async (req, reply) => {
    const { blockId } = req.params;

    const { data: extensions, error: extensionError } = await supabase
      .from('block_extensions')
      .select('id')
      .eq('parent_block_id', blockId);
    if (extensionError) return sendError(reply, 500, 'DB_ERROR', extensionError.message);

    const extensionIds = (extensions || []).map(item => item.id);
    let query = supabase.from('floors').select('*').eq('block_id', blockId);
    if (extensionIds.length > 0) {
      query = query.or(`block_id.eq.${blockId},extension_id.in.(${extensionIds.join(',')})`);
    }

    const { data, error } = await query.order('index', { ascending: true });
    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send(data || []);
  });

  app.get('/api/v1/blocks/:blockId/entrances', async (req, reply) => {
    const { blockId } = req.params;
    const { data, error } = await supabase.from('entrances').select('*').eq('block_id', blockId).order('number', { ascending: true });
    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send(data || []);
  });

  app.get('/api/v1/blocks/:blockId/extensions', async (req, reply) => {
    const { blockId } = req.params;
    const { data, error } = await supabase
      .from('block_extensions')
      .select('*')
      .eq('parent_block_id', blockId)
      .order('created_at', { ascending: true });

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send(data || []);
  });

  app.post('/api/v1/blocks/:blockId/extensions', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'registry', action: 'mutate', forbiddenMessage: 'Role cannot modify registry data',
    });
    if (!actor) return;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(idempotencyStore, idempotencyContext, reply)) return;

    const { blockId } = req.params;
    const { data: block, error: blockError } = await supabase
      .from('building_blocks')
      .select('id, building_id')
      .eq('id', blockId)
      .maybeSingle();

    if (blockError) return sendError(reply, 500, 'DB_ERROR', blockError.message);
    if (!block?.id) return sendError(reply, 404, 'NOT_FOUND', 'Block not found');

    const normalized = normalizeExtensionPayload(req.body?.extensionData || {});
    if (normalized.error) return sendError(reply, 400, 'VALIDATION_ERROR', normalized.error);

    const insertPayload = {
      ...normalized.data,
      id: crypto.randomUUID(),
      building_id: block.building_id,
      parent_block_id: blockId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('block_extensions')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);

    const syncError = await syncExtensionFloors(supabase, data.id);
    if (syncError) return sendError(reply, 500, 'DB_ERROR', syncError.message || 'Failed to sync extension floors');

    rememberIdempotentResponse(idempotencyStore, idempotencyContext, data);
    return reply.send(data);
  });

  app.put('/api/v1/extensions/:extensionId', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'registry', action: 'mutate', forbiddenMessage: 'Role cannot modify registry data',
    });
    if (!actor) return;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(idempotencyStore, idempotencyContext, reply)) return;

    const { extensionId } = req.params;
    const normalized = normalizeExtensionPayload(req.body?.extensionData || {});
    if (normalized.error) return sendError(reply, 400, 'VALIDATION_ERROR', normalized.error);

    const { data, error } = await supabase
      .from('block_extensions')
      .update({
        ...normalized.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', extensionId)
      .select('*')
      .maybeSingle();

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    if (!data) return sendError(reply, 404, 'NOT_FOUND', 'Extension not found');

    const syncError = await syncExtensionFloors(supabase, data.id);
    if (syncError) return sendError(reply, 500, 'DB_ERROR', syncError.message || 'Failed to sync extension floors');

    rememberIdempotentResponse(idempotencyStore, idempotencyContext, data);
    return reply.send(data);
  });

  app.delete('/api/v1/extensions/:extensionId', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'registry', action: 'mutate', forbiddenMessage: 'Role cannot modify registry data',
    });
    if (!actor) return;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(idempotencyStore, idempotencyContext, reply)) return;

    const { extensionId } = req.params;
    const { data, error } = await supabase
      .from('block_extensions')
      .delete()
      .eq('id', extensionId)
      .select('id')
      .maybeSingle();

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    if (!data?.id) return sendError(reply, 404, 'NOT_FOUND', 'Extension not found');

    const payload = { ok: true, id: data.id };
    rememberIdempotentResponse(idempotencyStore, idempotencyContext, payload);
    return reply.send(payload);
  });

  app.get('/api/v1/units/:unitId/explication', async (req, reply) => {
    const { unitId } = req.params;
    const { data, error } = await supabase.from('units').select('*, rooms (*)').eq('id', unitId).maybeSingle();
    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send(data || null);
  });

  app.get('/api/v1/blocks/:blockId/units', async (req, reply) => {
    const { blockId } = req.params;
    const extraFloorIds = parseFloorIdsFromQuery(req.query?.floorIds);

    const { data: floors, error: floorsError } = await supabase.from('floors').select('id').eq('block_id', blockId);
    if (floorsError) return sendError(reply, 500, 'DB_ERROR', floorsError.message);

    const floorIds = Array.from(new Set([...(floors || []).map(f => f.id), ...extraFloorIds]));
    if (floorIds.length === 0) return reply.send({ units: [], entranceMap: {} });

    const { data: entrances, error: entrancesError } = await supabase.from('entrances').select('id, number').eq('block_id', blockId);
    if (entrancesError) return sendError(reply, 500, 'DB_ERROR', entrancesError.message);

    const entranceMap = (entrances || []).reduce((acc, item) => { acc[item.id] = item.number; return acc; }, {});

    const { data: units, error: unitsError } = await fetchAllPaged((from, to) =>
      supabase.from('units').select('*, rooms (*)').in('floor_id', floorIds)
        .order('created_at', { ascending: true }).order('id', { ascending: true }).range(from, to)
    );

    if (unitsError) return sendError(reply, 500, 'DB_ERROR', unitsError.message);
    return reply.send({ units: units || [], entranceMap });
  });

  app.post('/api/v1/units/upsert', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'registry', action: 'mutate', forbiddenMessage: 'Role cannot modify registry data',
    });
    if (!actor) return;

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
      if (unitData.addressId !== undefined) patchPayload.address_id = unitData.addressId || null;

      const { data, error } = await supabase.from('units').update(patchPayload).eq('id', unitData.id).select('*').single();
      if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
      savedUnit = data;
    } else {
      let finalUnitCode = unitData.unitCode || null;
      if (!finalUnitCode && unitData.floorId && unitData.type) {
        const buildingInfo = await resolveBuildingByFloor(supabase, unitData.floorId);
        if (buildingInfo.error) return sendError(reply, 500, 'DB_ERROR', buildingInfo.error.message);

        const { buildingId, buildingCode } = buildingInfo;
        if (buildingId && unitData.type) {
          const existingCodesRes = await getExistingUnitSegmentsByBuildingCode(supabase, buildingCode);
          if (existingCodesRes.error) return sendError(reply, 500, 'DB_ERROR', existingCodesRes.error.message);

          const prefix = getUnitPrefix(unitData.type);
          const nextSeq = getNextUnitSequenceNumber(existingCodesRes.segments, prefix);
          const segment = generateUnitCode(prefix, nextSeq);
          finalUnitCode = buildingCode ? `${buildingCode}-${segment}` : segment;
        }
      }

      const inheritedAddressId = unitData.addressId !== undefined
        ? (unitData.addressId || null)
        : await inheritUnitAddressId(supabase, unitData.floorId, unitData.num || unitData.number);

      const payload = {
        id: unitData.id || crypto.randomUUID(),
        floor_id: unitData.floorId,
        entrance_id: unitData.entranceId,
        unit_code: finalUnitCode,
        number: unitData.num || unitData.number,
        unit_type: unitData.type,
        has_mezzanine: !!unitData.hasMezzanine,
        mezzanine_type: unitData.hasMezzanine ? (unitData.mezzanineType || null) : null,
        total_area: unitData.area,
        living_area: unitData.livingArea || 0,
        useful_area: unitData.usefulArea || 0,
        rooms_count: unitData.rooms || 0,
        status: unitData.isSold ? 'sold' : 'free',
        ...(inheritedAddressId !== undefined ? { address_id: inheritedAddressId } : {}),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase.from('units').upsert(payload, { onConflict: 'id' }).select('*').single();
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
    const actor = requirePolicyActor(req, reply, {
      module: 'registry', action: 'mutate', forbiddenMessage: 'Role cannot modify registry data',
    });
    if (!actor) return;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(idempotencyStore, idempotencyContext, reply)) return;

    const { blockId } = req.params;
    const result = { removed: 0, checkedCells: 0 };

    const { data: floors, error: floorsErr } = await supabase.from('floors').select('id').eq('block_id', blockId);
    if (floorsErr) return sendError(reply, 500, 'DB_ERROR', floorsErr.message);

    const floorIds = (floors || []).map(f => f.id);
    if (floorIds.length === 0) {
      rememberIdempotentResponse(idempotencyStore, idempotencyContext, result);
      return reply.send(result);
    }

    const { data: entrances, error: entErr } = await supabase.from('entrances').select('id, number').eq('block_id', blockId);
    if (entErr) return sendError(reply, 500, 'DB_ERROR', entErr.message);

    const entranceByNumber = new Map((entrances || []).map(e => [Number(e.number), e.id]));

    const { data: matrixRows, error: matrixErr } = await supabase
      .from('entrance_matrix').select('floor_id, entrance_number, flats_count, commercial_count').eq('block_id', blockId);
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
      .from('units').select('id, floor_id, entrance_id, unit_type, created_at').in('floor_id', floorIds);
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
      if (flatsSorted.length > desired.flats) toDelete.push(...flatsSorted.slice(desired.flats).map(u => u.id));
      if (commSorted.length > desired.commercial) toDelete.push(...commSorted.slice(desired.commercial).map(u => u.id));
    });

    if (toDelete.length > 0) {
      const { error: delErr } = await supabase.from('units').delete().in('id', toDelete);
      if (delErr) return sendError(reply, 500, 'DB_ERROR', delErr.message);
      result.removed = toDelete.length;
    }

    rememberIdempotentResponse(idempotencyStore, idempotencyContext, result);
    return reply.send(result);
  });

  app.post('/api/v1/blocks/:blockId/common-areas/reconcile', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'registry', action: 'mutate', forbiddenMessage: 'Role cannot modify registry data',
    });
    if (!actor) return;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(idempotencyStore, idempotencyContext, reply)) return;

    const { blockId } = req.params;
    const result = { removed: 0, checkedCells: 0 };

    const { data: floors, error: floorsErr } = await supabase.from('floors').select('id').eq('block_id', blockId);
    if (floorsErr) return sendError(reply, 500, 'DB_ERROR', floorsErr.message);

    const floorIds = (floors || []).map(f => f.id);
    if (floorIds.length === 0) {
      rememberIdempotentResponse(idempotencyStore, idempotencyContext, result);
      return reply.send(result);
    }

    const { data: entrances, error: entErr } = await supabase.from('entrances').select('id, number').eq('block_id', blockId);
    if (entErr) return sendError(reply, 500, 'DB_ERROR', entErr.message);

    const entranceByNumber = new Map((entrances || []).map(e => [Number(e.number), e.id]));

    const { data: matrixRows, error: matrixErr } = await supabase
      .from('entrance_matrix').select('floor_id, entrance_number, mop_count').eq('block_id', blockId);
    if (matrixErr) return sendError(reply, 500, 'DB_ERROR', matrixErr.message);

    const desiredMap = new Map();
    (matrixRows || []).forEach(row => {
      const entranceId = entranceByNumber.get(Number(row.entrance_number));
      if (!entranceId) return;
      desiredMap.set(`${row.floor_id}_${entranceId}`, Math.max(0, parseInt(row.mop_count || 0, 10) || 0));
    });

    const { data: areas, error: areasErr } = await supabase.from('common_areas').select('id, floor_id, entrance_id, created_at').in('floor_id', floorIds);
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
      const sorted = [...list].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
      if (sorted.length > desired) toDelete.push(...sorted.slice(desired).map(item => item.id));
    });

    if (toDelete.length > 0) {
      const { error: delErr } = await supabase.from('common_areas').delete().in('id', toDelete);
      if (delErr) return sendError(reply, 500, 'DB_ERROR', delErr.message);
      result.removed = toDelete.length;
    }

    rememberIdempotentResponse(idempotencyStore, idempotencyContext, result);
    return reply.send(result);
  });

  app.post('/api/v1/units/batch-upsert', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'registry', action: 'mutate', forbiddenMessage: 'Role cannot modify registry data',
    });
    if (!actor) return;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(idempotencyStore, idempotencyContext, reply)) return;

    const unitsList = Array.isArray(req.body?.unitsList) ? req.body.unitsList : [];
    if (!unitsList.length) {
      const payload = { ok: true, count: 0 };
      rememberIdempotentResponse(idempotencyStore, idempotencyContext, payload);
      return reply.send(payload);
    }

    const sampleUnit = unitsList[0];
    let buildingCode = null;
    let counters = { EF: 1, EO: 1, EP: 1 };

    if (sampleUnit?.floorId) {
      const buildingInfo = await resolveBuildingByFloor(supabase, sampleUnit.floorId);
      if (buildingInfo.error) return sendError(reply, 500, 'DB_ERROR', buildingInfo.error.message);

      buildingCode = buildingInfo.buildingCode;
      if (buildingCode) {
        const existingCodesRes = await getExistingUnitSegmentsByBuildingCode(supabase, buildingCode);
        if (existingCodesRes.error) return sendError(reply, 500, 'DB_ERROR', existingCodesRes.error.message);

        counters = {
          EF: getNextUnitSequenceNumber(existingCodesRes.segments, 'EF'),
          EO: getNextUnitSequenceNumber(existingCodesRes.segments, 'EO'),
          EP: getNextUnitSequenceNumber(existingCodesRes.segments, 'EP'),
        };
      }
    }

    const payload = await Promise.all(unitsList.map(async u => {
      let finalUnitCode = u.unitCode || null;
      if (!finalUnitCode && buildingCode && u.type) {
        const prefix = getUnitPrefix(u.type);
        const seq = counters[prefix] || 1;
        finalUnitCode = `${buildingCode}-${generateUnitCode(prefix, seq)}`;
        counters[prefix] = seq + 1;
      }

      const inheritedAddressId = u.addressId !== undefined
        ? (u.addressId || null)
        : await inheritUnitAddressId(supabase, u.floorId, u.num || u.number);

      return {
        id: u.id || crypto.randomUUID(),
        floor_id: u.floorId,
        entrance_id: u.entranceId,
        number: u.num || u.number,
        unit_type: u.type,
        unit_code: finalUnitCode,
        total_area: u.area || 0,
        status: 'free',
        ...(inheritedAddressId !== undefined ? { address_id: inheritedAddressId } : {}),
        updated_at: new Date().toISOString(),
      };
    }));

    const { error } = await supabase.from('units').upsert(payload, { onConflict: 'id' });
    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);

    const response = { ok: true, count: payload.length };
    rememberIdempotentResponse(idempotencyStore, idempotencyContext, response);
    return reply.send(response);
  });

  app.post('/api/v1/common-areas/upsert', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'registry', action: 'mutate', forbiddenMessage: 'Role cannot modify registry data',
    });
    if (!actor) return;

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

    const { data, error } = await supabase.from('common_areas').upsert(payload, { onConflict: 'id' }).select('*').single();
    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send(data);
  });

  app.delete('/api/v1/common-areas/:id', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'registry', action: 'mutate', forbiddenMessage: 'Role cannot modify registry data',
    });
    if (!actor) return;

    const { error } = await supabase.from('common_areas').delete().eq('id', req.params.id);
    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send({ ok: true });
  });

  app.post('/api/v1/blocks/:blockId/common-areas/clear', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'registry', action: 'mutate', forbiddenMessage: 'Role cannot modify registry data',
    });
    if (!actor) return;

    const { blockId } = req.params;
    const extraFloorIds = parseFloorIdsFromQuery(req.body?.floorIds);

    const { data: floors, error: floorsError } = await supabase.from('floors').select('id').eq('block_id', blockId);
    if (floorsError) return sendError(reply, 500, 'DB_ERROR', floorsError.message);

    const floorIds = Array.from(new Set([...(floors || []).map(f => f.id), ...extraFloorIds]));
    if (floorIds.length === 0) return reply.send({ ok: true, deleted: 0 });

    const { data: rowsToDelete, error: countError } = await supabase.from('common_areas').select('id').in('floor_id', floorIds);
    if (countError) return sendError(reply, 500, 'DB_ERROR', countError.message);

    const { error } = await supabase.from('common_areas').delete().in('floor_id', floorIds);
    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send({ ok: true, deleted: (rowsToDelete || []).length });
  });

  app.get('/api/v1/blocks/:blockId/common-areas', async (req, reply) => {
    const { blockId } = req.params;
    const extraFloorIds = parseFloorIdsFromQuery(req.query?.floorIds);

    const { data: floors, error: floorsError } = await supabase.from('floors').select('id').eq('block_id', blockId);
    if (floorsError) return sendError(reply, 500, 'DB_ERROR', floorsError.message);

    const floorIds = Array.from(new Set([...(floors || []).map(f => f.id), ...extraFloorIds]));
    if (floorIds.length === 0) return reply.send([]);

    const { data, error } = await supabase.from('common_areas').select('*').in('floor_id', floorIds);
    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send(data || []);
  });

  app.get('/api/v1/blocks/:blockId/entrance-matrix', async (req, reply) => {
    const { blockId } = req.params;
    const { data, error } = await supabase.from('entrance_matrix').select('*').eq('block_id', blockId);
    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send(data || []);
  });

  app.put('/api/v1/floors/:floorId', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'registry', action: 'mutate', forbiddenMessage: 'Role cannot modify registry data',
    });
    if (!actor) return;

    const { floorId } = req.params;
    const updates = req.body?.updates || {};
    const payload = mapFloorUpdatesToPayload(updates);

    if (Object.keys(payload).length === 0) {
      return sendError(reply, 400, 'VALIDATION_ERROR', 'updates are required');
    }

    const { data, error } = await supabase.from('floors').update(payload).eq('id', floorId).select('*').single();
    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    if (!data?.id) return sendError(reply, 404, 'NOT_FOUND', 'Floor not found');
    return reply.send(data);
  });



  app.put('/api/v1/floors/batch', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'registry', action: 'mutate', forbiddenMessage: 'Role cannot modify registry data',
    });
    if (!actor) return;

    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const strict = Boolean(req.body?.strict);
    if (items.length === 0) return reply.send({ ok: true, updated: 0, failed: [] });

    const failed = [];
    const payload = [];

    items.forEach((item, index) => {
      const floorId = item?.id;
      if (!floorId) {
        failed.push({ index, reason: 'id is required' });
        return;
      }
      const updates = mapFloorUpdatesToPayload(item?.updates || {});
      if (Object.keys(updates).length === 0) {
        failed.push({ index, id: floorId, reason: 'updates are required' });
        return;
      }
      payload.push({ id: floorId, ...updates });
    });

    if (payload.length > 0) {
      const floorIds = payload.map(item => item.id);
      const { data: existingFloors, error: existingFloorsError } = await supabase.from('floors').select('id').in('id', floorIds);
      if (existingFloorsError) return sendError(reply, 500, 'DB_ERROR', existingFloorsError.message);

      const existingIdSet = new Set((existingFloors || []).map(row => row.id));
      const filteredPayload = [];

      payload.forEach((item, index) => {
        if (existingIdSet.has(item.id)) {
          filteredPayload.push(item);
          return;
        }
        const sourceIdx = items.findIndex(source => source?.id === item.id);
        failed.push({ index: sourceIdx >= 0 ? sourceIdx : index, id: item.id, reason: 'floor not found' });
      });

      if (strict && failed.length > 0) {
        return sendError(reply, 409, 'PARTIAL_UPDATE', 'One or more floors cannot be updated', { failed });
      }

      if (filteredPayload.length === 0) {
        return reply.send({ ok: failed.length === 0, updated: 0, failed });
      }

      const { error } = await supabase.from('floors').upsert(filteredPayload, { onConflict: 'id' });
      if (error) return sendError(reply, 500, 'DB_ERROR', error.message);

      return reply.send({ ok: failed.length === 0, updated: filteredPayload.length, failed });
    }

    return reply.send({ ok: failed.length === 0, updated: 0, failed });
  });

  app.post('/api/v1/blocks/:blockId/floors/reconcile', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'registry', action: 'mutate', forbiddenMessage: 'Role cannot modify registry data',
    });
    if (!actor) return;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(idempotencyStore, idempotencyContext, reply)) return;

    const { blockId } = req.params;

    const { data: block, error: blockErr } = await supabase.from('building_blocks').select('*').eq('id', blockId).single();
    if (blockErr || !block) return sendError(reply, 500, 'DB_ERROR', blockErr?.message || 'Block not found');

    const [
      { data: building },
      { data: allBlocks },
      { data: markers },
      { data: existingFloors },
    ] = await Promise.all([
      supabase.from('buildings').select('*').eq('id', block.building_id).single(),
      supabase.from('building_blocks').select('*').eq('building_id', block.building_id),
      supabase.from('block_floor_markers').select('*').eq('block_id', blockId),
      supabase.from('floors').select('id, floor_key, index, parent_floor_index, basement_id').eq('block_id', blockId),
    ]);

    let targetFloorsModel = generateFloorsModel(block, building, allBlocks || [], markers || []);

    const getConstraintKey = f => {
      const idx = Number(f.index || 0);
      const pfi = f.parent_floor_index !== null && f.parent_floor_index !== undefined ? Number(f.parent_floor_index) : -99999;
      const bid = f.basement_id || '00000000-0000-0000-0000-000000000000';
      return `${idx}_${pfi}_${bid}`;
    };

    const uniqueKeys = new Set();
    targetFloorsModel = targetFloorsModel.filter(floor => {
      const cKey = getConstraintKey(floor);
      if (uniqueKeys.has(cKey)) return false;
      uniqueKeys.add(cKey);
      return true;
    });

    const existingFloorsMap = new Map((existingFloors || []).map(f => [getConstraintKey(f), f]));
    const toUpsert = [];
    const usedExistingIds = new Set();
    const now = new Date().toISOString();

    targetFloorsModel.forEach(targetFloor => {
      const cKey = getConstraintKey(targetFloor);
      const existing = existingFloorsMap.get(cKey);
      if (existing) {
        toUpsert.push({ ...targetFloor, id: existing.id, updated_at: now });
        usedExistingIds.add(existing.id);
      } else {
        toUpsert.push({ ...targetFloor, id: crypto.randomUUID(), updated_at: now });
      }
    });

    const toDeleteIds = (existingFloors || []).filter(f => !usedExistingIds.has(f.id)).map(f => f.id);

    if (toDeleteIds.length > 0) {
      const { error: deleteErr } = await supabase.from('floors').delete().in('id', toDeleteIds);
      if (deleteErr) return sendError(reply, 500, 'DB_ERROR', deleteErr.message);
    }

    if (toUpsert.length > 0) {
      const { error: upsertErr } = await supabase.from('floors').upsert(toUpsert, { onConflict: 'id' });
      if (upsertErr) return sendError(reply, 500, 'DB_ERROR', upsertErr.message);
    }

    const matrixEnsureError = await ensureEntranceMatrixForBlock(supabase, blockId);
    if (matrixEnsureError) return sendError(reply, 500, 'DB_ERROR', matrixEnsureError.message);

    const result = { ok: true, deleted: toDeleteIds.length, upserted: toUpsert.length };
    rememberIdempotentResponse(idempotencyStore, idempotencyContext, result);
    return reply.send(result);
  });

  app.post('/api/v1/blocks/:blockId/entrances/reconcile', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'registry', action: 'mutate', forbiddenMessage: 'Role cannot modify registry data',
    });
    if (!actor) return;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(idempotencyStore, idempotencyContext, reply)) return;

    const { blockId } = req.params;
    const normalizedCount = Math.max(0, parseInt(req.body?.count, 10) || 0);

    const { data: existing, error: existingErr } = await supabase.from('entrances').select('id, number').eq('block_id', blockId);
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

    const matrixEnsureError = await ensureEntranceMatrixForBlock(supabase, blockId);
    if (matrixEnsureError) return sendError(reply, 500, 'DB_ERROR', matrixEnsureError.message);

    const result = { ok: true, count: normalizedCount, created: toCreate.length, deleted: toDeleteIds.length };
    rememberIdempotentResponse(idempotencyStore, idempotencyContext, result);
    return reply.send(result);
  });

  app.put('/api/v1/blocks/:blockId/entrance-matrix/cell', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'registry', action: 'mutate', forbiddenMessage: 'Role cannot modify registry data',
    });
    if (!actor) return;

    const { blockId } = req.params;
    const floorId = req.body?.floorId;
    const entranceNumber = Number(req.body?.entranceNumber);
    const values = req.body?.values || {};

    if (!floorId || !Number.isFinite(entranceNumber)) {
      return sendError(reply, 400, 'VALIDATION_ERROR', 'floorId and entranceNumber are required');
    }

    const validated = validateMatrixValues(values);
    if (validated.error) {
      return sendError(reply, 400, 'VALIDATION_ERROR', validated.error);
    }

    const payload = {
      block_id: blockId,
      floor_id: floorId,
      entrance_number: entranceNumber,
      updated_at: new Date().toISOString(),
      ...validated.payload,
    };

    const { data, error } = await supabase
      .from('entrance_matrix')
      .upsert(payload, { onConflict: 'block_id,floor_id,entrance_number' })
      .select('*')
      .single();

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send(data);
  });

  app.put('/api/v1/blocks/:blockId/entrance-matrix/batch', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'registry', action: 'mutate', forbiddenMessage: 'Role cannot modify registry data',
    });
    if (!actor) return;

    const { blockId } = req.params;
    const cells = Array.isArray(req.body?.cells) ? req.body.cells : [];
    if (cells.length === 0) return reply.send({ ok: true, updated: 0, failed: [] });

    const payload = [];
    const failed = [];

    cells.forEach((cell, index) => {
      const floorId = cell?.floorId;
      const entranceNumber = Number(cell?.entranceNumber);
      if (!floorId || !Number.isFinite(entranceNumber)) {
        failed.push({ index, reason: 'floorId and entranceNumber are required' });
        return;
      }
      const validated = validateMatrixValues(cell?.values || {});
      if (validated.error) {
        failed.push({ index, floorId, entranceNumber, reason: validated.error });
        return;
      }
      payload.push({
        block_id: blockId,
        floor_id: floorId,
        entrance_number: entranceNumber,
        updated_at: new Date().toISOString(),
        ...validated.payload,
      });
    });

    if (payload.length > 0) {
      const { error } = await supabase
        .from('entrance_matrix')
        .upsert(payload, { onConflict: 'block_id,floor_id,entrance_number' });
      if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    }

    return reply.send({ ok: true, updated: payload.length, failed });
  });

  app.post('/api/v1/blocks/:blockId/reconcile/preview', async (req, reply) => {
    const { blockId } = req.params;

    const { data: floors, error: floorsErr } = await supabase.from('floors').select('id').eq('block_id', blockId);
    if (floorsErr) return sendError(reply, 500, 'DB_ERROR', floorsErr.message);

    const floorIds = (floors || []).map(f => f.id);
    if (floorIds.length === 0) {
      return reply.send({ units: { toRemove: 0, checkedCells: 0 }, commonAreas: { toRemove: 0, checkedCells: 0 } });
    }

    const { data: entrances, error: entErr } = await supabase.from('entrances').select('id, number').eq('block_id', blockId);
    if (entErr) return sendError(reply, 500, 'DB_ERROR', entErr.message);
    const entranceByNumber = new Map((entrances || []).map(e => [Number(e.number), e.id]));

    const { data: matrixRows, error: matrixErr } = await supabase
      .from('entrance_matrix').select('floor_id, entrance_number, flats_count, commercial_count, mop_count').eq('block_id', blockId);
    if (matrixErr) return sendError(reply, 500, 'DB_ERROR', matrixErr.message);

    const desiredUnitsMap = new Map();
    const desiredMopsMap = new Map();
    (matrixRows || []).forEach(row => {
      const entranceId = entranceByNumber.get(Number(row.entrance_number));
      if (!entranceId) return;
      const key = `${row.floor_id}_${entranceId}`;
      desiredUnitsMap.set(key, {
        flats: Math.max(0, parseInt(row.flats_count || 0, 10) || 0),
        commercial: Math.max(0, parseInt(row.commercial_count || 0, 10) || 0),
      });
      desiredMopsMap.set(key, Math.max(0, parseInt(row.mop_count || 0, 10) || 0));
    });

    const { data: units, error: unitsErr } = await supabase
      .from('units').select('id, floor_id, entrance_id, unit_type, created_at').in('floor_id', floorIds);
    if (unitsErr) return sendError(reply, 500, 'DB_ERROR', unitsErr.message);

    const { data: areas, error: areasErr } = await supabase
      .from('common_areas').select('id, floor_id, entrance_id, created_at').in('floor_id', floorIds);
    if (areasErr) return sendError(reply, 500, 'DB_ERROR', areasErr.message);

    const isFlatType = type => ['flat', 'duplex_up', 'duplex_down'].includes(type);
    const isCommercialType = type => ['office', 'office_inventory', 'non_res_block', 'infrastructure'].includes(type);

    const groupedUnits = new Map();
    (units || []).forEach(u => {
      const key = `${u.floor_id}_${u.entrance_id}`;
      if (!groupedUnits.has(key)) groupedUnits.set(key, { flats: [], commercial: [] });
      if (isFlatType(u.unit_type)) groupedUnits.get(key).flats.push(u);
      else if (isCommercialType(u.unit_type)) groupedUnits.get(key).commercial.push(u);
    });

    let unitsToRemove = 0;
    groupedUnits.forEach((bucket, key) => {
      const desired = desiredUnitsMap.get(key) || { flats: 0, commercial: 0 };
      unitsToRemove += Math.max(0, bucket.flats.length - desired.flats);
      unitsToRemove += Math.max(0, bucket.commercial.length - desired.commercial);
    });

    const groupedAreas = new Map();
    (areas || []).forEach(a => {
      const key = `${a.floor_id}_${a.entrance_id}`;
      if (!groupedAreas.has(key)) groupedAreas.set(key, []);
      groupedAreas.get(key).push(a);
    });

    let mopsToRemove = 0;
    groupedAreas.forEach((list, key) => {
      const desired = desiredMopsMap.get(key) || 0;
      mopsToRemove += Math.max(0, list.length - desired);
    });

    return reply.send({
      units: { toRemove: unitsToRemove, checkedCells: groupedUnits.size },
      commonAreas: { toRemove: mopsToRemove, checkedCells: groupedAreas.size },
    });
  });
}
