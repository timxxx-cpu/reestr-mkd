import { sendError, requirePolicyActor } from './http-helpers.js';
import crypto from 'crypto';

function mapBlockTypeToUi(dbType) {
  if (dbType === 'Ж') return 'residential';
  if (dbType === 'Н') return 'non_residential';
  if (dbType === 'Parking') return 'parking';
  if (dbType === 'Infra') return 'infrastructure';
  if (dbType === 'BAS') return 'basement';
  return dbType;
}

function mapBlockTypeToDb(uiType) {
  if (uiType === 'residential') return 'Ж';
  if (uiType === 'non_residential') return 'Н';
  if (uiType === 'parking') return 'Parking';
  if (uiType === 'infrastructure') return 'Infra';
  if (uiType === 'basement') return 'BAS';
  return uiType;
}

function normalizeParkingTypeToDb(parkingType) {
  if (parkingType === 'ground') return 'aboveground';
  return parkingType;
}

function normalizeParkingTypeFromDb(parkingType) {
  if (parkingType === 'aboveground') return 'ground';
  return parkingType;
}

function normalizeParkingConstructionFromDb(constructionType) {
  if (constructionType === 'separate' || constructionType === 'integrated') return 'capital';
  return constructionType;
}

function sanitizeBuildingCategoryFields(buildingData = {}) {
  const isParking = buildingData.category === 'parking_separate';
  const isInfrastructure = buildingData.category === 'infrastructure';

  return {
    constructionType: isParking
      ? normalizeParkingConstructionFromDb(buildingData.constructionType || null)
      : null,
    parkingType: isParking ? normalizeParkingTypeToDb(buildingData.parkingType || null) : null,
    infraType: isInfrastructure ? buildingData.infraType || null : null,
  };
}


function resolveBasementCount(buildingData = {}) {
  const raw = buildingData.basementsCount ?? buildingData.basementCount ?? 0;
  const num = Number.parseInt(raw, 10);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.min(num, 10);
}

function canHaveBasements(buildingData = {}) {
  const category = buildingData.category;
  if (category === 'parking_separate') {
    const parkingType = buildingData.parkingType;
    const constructionType = buildingData.constructionType;
    if (parkingType === 'aboveground' && ['light', 'open'].includes(constructionType)) return false;
    return true;
  }
  return true;
}



async function inheritBuildingAddressId(supabase, projectId, houseNumber) {
  if (!houseNumber) return null;
  const { data: project } = await supabase.from('projects').select('address_id').eq('id', projectId).maybeSingle();
  if (!project?.address_id) return null;
  const { data: parent } = await supabase.from('addresses').select('district, street, mahalla, city').eq('id', project.address_id).maybeSingle();
  if (!parent) return null;

  const payload = {
    id: crypto.randomUUID(),
    dtype: 'Address',
    versionrev: 0,
    district: parent.district || null,
    street: parent.street || null,
    mahalla: parent.mahalla || null,
    city: parent.city || null,
    building_no: String(houseNumber),
    full_address: [parent.city, `д. ${houseNumber}`].filter(Boolean).join(', '),
  };
  const { data, error } = await supabase.from('addresses').insert(payload).select('id').single();
  if (error) return null;
  return data?.id || null;
}
function getBuildingPrefix(category, hasMultipleBlocks = false) {
  if (category === 'residential' || category === 'residential_multiblock') {
    if (category === 'residential_multiblock') return 'ZM';
    return hasMultipleBlocks ? 'ZM' : 'ZR';
  }
  if (category === 'parking_separate' || category === 'parking_integrated') return 'ZP';
  if (category === 'infrastructure') return 'ZI';
  return 'ZR';
}

function extractBuildingSegment(code) {
  if (!code) return null;
  const parts = String(code).split('-');
  return parts.length > 1 ? parts[parts.length - 1] : String(code);
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

function generateBuildingCode(prefix, sequenceNumber) {
  return `${prefix}${String(Number(sequenceNumber) || 0).padStart(2, '0')}`;
}

async function generateNextBuildingCode(supabase, projectId, category, blocksCount = 0) {
  const prefix = getBuildingPrefix(category, blocksCount > 1);

  const { data, error } = await supabase
    .from('buildings')
    .select('building_code')
    .eq('project_id', projectId)
    .not('building_code', 'is', null);

  if (error) throw error;

  const existingSegments = (data || [])
    .map(row => extractBuildingSegment(row.building_code))
    .filter(Boolean);

  const nextNumber = getNextSequenceNumber(existingSegments, prefix);
  return generateBuildingCode(prefix, nextNumber);
}

const DEFAULT_BASEMENT_COMMUNICATIONS = {
  electricity: false,
  water: false,
  sewerage: false,
  heating: false,
  ventilation: false,
  gas: false,
  firefighting: false,
};

export function registerCompositionRoutes(app, { supabase }) {
  app.get('/api/v1/projects/:projectId/buildings', async (req, reply) => {
    const { projectId } = req.params;
    const { data, error } = await supabase
      .from('buildings')
      .select('*, building_blocks (*, block_extensions (*))')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);

    return reply.send(
      (data || []).map(b => {
        const allBlocks = b.building_blocks || [];
        const activeBlocks = allBlocks.filter(bl => !bl.is_basement_block);
        const basementBlocks = allBlocks.filter(bl => bl.is_basement_block);
        return ({
        id: b.id,
        buildingCode: b.building_code,
        label: b.label,
        houseNumber: b.house_number,
        category: b.category,
        stage: b.stage || 'Проектный',
        dateStart: b.date_start || null,
        dateEnd: b.date_end || null,
        type: b.category,
        constructionType: normalizeParkingConstructionFromDb(b.construction_type),
        parkingType: normalizeParkingTypeFromDb(b.parking_type),
        infraType: b.infra_type,
        hasNonResPart: b.has_non_res_part,
        cadastreNumber: b.cadastre_number,
        geometryCandidateId: b.geometry_candidate_id,
        footprintGeojson: b.footprint_geojson,
        buildingFootprintAreaM2: b.building_footprint_area_m2,
        basementsCount: basementBlocks.length,
        resBlocks: activeBlocks.filter(x => x.type === 'Ж').length,
        nonResBlocks: activeBlocks.filter(x => x.type === 'Н').length,
        blocks: allBlocks
          .map(bl => ({
            id: bl.id,
            label: bl.label,
            type: mapBlockTypeToUi(bl.type),
            originalType: bl.type,
            floorsCount: bl.floors_count,
            isBasementBlock: !!bl.is_basement_block,
            linkedBlockIds: Array.isArray(bl.linked_block_ids) ? bl.linked_block_ids : [],
            extensions: Array.isArray(bl.block_extensions)
              ? bl.block_extensions.map(ext => ({
                  id: ext.id,
                  label: ext.label,
                  extensionType: ext.extension_type || null,
                  floorsCount: ext.floors_count,
                  startFloorIndex: ext.start_floor_index,
                }))
              : [],
          }))
          .sort((a, c) => a.label.localeCompare(c.label)),
        });
      })
    );
  });

  app.post('/api/v1/projects/:projectId/buildings', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'composition',
      action: 'mutate',
      forbiddenMessage: 'Role cannot modify composition',
    });
    if (!actor) return;

    const { projectId } = req.params;
    const buildingData = req.body?.buildingData || {};
    const blocksData = Array.isArray(req.body?.blocksData) ? req.body.blocksData : [];

    const normalizedFields = sanitizeBuildingCategoryFields(buildingData);
    const geometryCandidateId = buildingData.geometryCandidateId || null;

    if (!geometryCandidateId) return sendError(reply, 400, 'VALIDATION_ERROR', 'Geometry candidate is required for building save');

    const { data: projectRow, error: projectError } = await supabase
      .from('projects')
      .select('uj_code')
      .eq('id', projectId)
      .single();
    if (projectError) return sendError(reply, 500, 'DB_ERROR', projectError.message);

    let buildingCodeSegment;
    try {
      buildingCodeSegment = await generateNextBuildingCode(
        supabase,
        projectId,
        buildingData.category,
        blocksData.length
      );
    } catch (e) {
      return sendError(reply, 500, 'DB_ERROR', e?.message || 'Failed to generate building code');
    }
    const buildingCode = projectRow?.uj_code
      ? `${projectRow.uj_code}-${buildingCodeSegment}`
      : buildingCodeSegment;

    const { data: insertedBuilding, error: buildingError } = await supabase
      .from('buildings')
      .insert({
        project_id: projectId,
        building_code: buildingCode,
        label: buildingData.label,
        house_number: buildingData.houseNumber,
        address_id: buildingData.addressId || await inheritBuildingAddressId(supabase, projectId, buildingData.houseNumber),
        category: buildingData.category,
        construction_type: normalizedFields.constructionType,
        parking_type: normalizedFields.parkingType,
        infra_type: normalizedFields.infraType,
        has_non_res_part: buildingData.hasNonResPart || false,
        geometry_candidate_id: null,
        footprint_geojson: null,
        building_footprint_geom: null,
        building_footprint_area_m2: null,
      })
      .select('*')
      .single();

    if (buildingError) return sendError(reply, 500, 'DB_ERROR', buildingError.message);

    const { error: assignGeomError } = await supabase.rpc('assign_building_geometry_from_candidate', {
      p_project_id: projectId,
      p_building_id: insertedBuilding.id,
      p_candidate_id: geometryCandidateId,
    });
    if (assignGeomError) {
      await supabase.from('buildings').delete().eq('id', insertedBuilding.id);
      return sendError(reply, 400, 'GEOMETRY_VALIDATION_ERROR', assignGeomError.message);
    }

    if (blocksData.length > 0) {
      const blocksPayload = blocksData.map(b => ({
        id: b.id,
        building_id: insertedBuilding.id,
        label: b.label,
        type: mapBlockTypeToDb(b.type),
        floors_count: b.floorsCount || 0,
        floors_from: 1,
        floors_to: b.floorsCount || 1,
      }));
      const { error: blocksError } = await supabase.from('building_blocks').insert(blocksPayload);
      if (blocksError) {
        await supabase.from('buildings').delete().eq('id', insertedBuilding.id);
        return sendError(reply, 500, 'DB_ERROR', blocksError.message);
      }
    }

    const basementCount = canHaveBasements(buildingData) ? resolveBasementCount(buildingData) : 0;
    if (basementCount > 0) {
      const nonBasementBlockIds = blocksData.map(b => b.id).filter(Boolean);
      const autoLinkedIds = nonBasementBlockIds.length === 1 ? nonBasementBlockIds : [];
      const basementRows = Array.from({ length: basementCount }).map((_, idx) => ({
        building_id: insertedBuilding.id,
        label: `Подвал ${idx + 1}`,
        type: 'BAS',
        is_basement_block: true,
        linked_block_ids: autoLinkedIds,
        basement_depth: 1,
        basement_has_parking: false,
        basement_parking_levels: {},
        basement_communications: DEFAULT_BASEMENT_COMMUNICATIONS,
        entrances_count: 1,
      }));
      const { error: basementCreateError } = await supabase.from('building_blocks').insert(basementRows);
      if (basementCreateError) {
        await supabase.from('buildings').delete().eq('id', insertedBuilding.id);
        return sendError(reply, 500, 'DB_ERROR', basementCreateError.message);
      }
    }

    return reply.send(insertedBuilding);
  });

 app.put('/api/v1/buildings/:buildingId', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'composition',
      action: 'mutate',
      forbiddenMessage: 'Role cannot modify composition',
    });
    if (!actor) return;

    const { buildingId } = req.params;
    const buildingData = req.body?.buildingData || {};
    const blocksData = Array.isArray(req.body?.blocksData) ? req.body.blocksData : null;
    const normalizedFields = sanitizeBuildingCategoryFields(buildingData);
    const geometryCandidateId = buildingData.geometryCandidateId || null;

    if (!geometryCandidateId) return sendError(reply, 400, 'VALIDATION_ERROR', 'Geometry candidate is required for building save');

    // 1. ИСПРАВЛЕНИЕ: Сначала получаем существующее здание, чтобы узнать его project_id
    const { data: existingBuilding, error: getBuildingError } = await supabase
      .from('buildings')
      .select('project_id, category, parking_type, construction_type')
      .eq('id', buildingId)
      .single();

    if (getBuildingError || !existingBuilding) {
      return sendError(reply, 500, 'DB_ERROR', getBuildingError?.message || 'Здание не найдено');
    }

    const projectId = existingBuilding.project_id;
    const resolvedAddressId = buildingData.addressId || await inheritBuildingAddressId(supabase, projectId, buildingData.houseNumber);

    // 2. Теперь спокойно обновляем данные здания
    const { data, error } = await supabase
      .from('buildings')
      .update({
        label: buildingData.label,
        house_number: buildingData.houseNumber,
        address_id: resolvedAddressId,
        construction_type: normalizedFields.constructionType,
        parking_type: normalizedFields.parkingType,
        infra_type: normalizedFields.infraType,
        has_non_res_part: buildingData.hasNonResPart,
      })
      .eq('id', buildingId)
      .select('*')
      .single();

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);

    // 3. Вызываем функцию привязки геометрии
    const { error: assignGeomError } = await supabase.rpc('assign_building_geometry_from_candidate', {
      p_project_id: data.project_id,
      p_building_id: buildingId,
      p_candidate_id: geometryCandidateId,
    });
    
    if (assignGeomError) return sendError(reply, 400, 'GEOMETRY_VALIDATION_ERROR', assignGeomError.message);

    // ... далее остается ваш текущий код: if (blocksData) { const { data: existingBlocks ...

    if (blocksData) {
      const { data: existingBlocks, error: existingError } = await supabase
        .from('building_blocks')
        .select('id')
        .eq('building_id', buildingId)
        .eq('is_basement_block', false);
      if (existingError) return sendError(reply, 500, 'DB_ERROR', existingError.message);

      const existingIds = new Set((existingBlocks || []).map(b => b.id));
      const nextIds = new Set(blocksData.map(b => b.id).filter(Boolean));

      const updateRows = blocksData
        .filter(b => b.id && existingIds.has(b.id))
        .map(b => ({
          id: b.id,
          building_id: buildingId,
          label: b.label,
          type: mapBlockTypeToDb(b.type),
          floors_count: b.floorsCount || 0,
          floors_from: 1,
          floors_to: b.floorsCount || 1,
        }));

      const insertRows = blocksData
        .filter(b => !b.id || !existingIds.has(b.id))
        .map(b => ({
          id: b.id,
          building_id: buildingId,
          label: b.label,
          type: mapBlockTypeToDb(b.type),
          floors_count: b.floorsCount || 0,
          floors_from: 1,
          floors_to: b.floorsCount || 1,
        }));

      const deleteIds = (existingBlocks || []).map(b => b.id).filter(id => !nextIds.has(id));

      if (updateRows.length) {
        const { error: upsertError } = await supabase
          .from('building_blocks')
          .upsert(updateRows, { onConflict: 'id' });
        if (upsertError) return sendError(reply, 500, 'DB_ERROR', upsertError.message);
      }

      if (insertRows.length) {
        const { error: insertError } = await supabase.from('building_blocks').insert(insertRows);
        if (insertError) return sendError(reply, 500, 'DB_ERROR', insertError.message);
      }

      if (deleteIds.length) {
        const { error: deleteError } = await supabase.from('building_blocks').delete().in('id', deleteIds);
        if (deleteError) return sendError(reply, 500, 'DB_ERROR', deleteError.message);
      }
    }

    const allowedBasements = canHaveBasements({
      category: data.category,
      parkingType: normalizeParkingTypeFromDb(data.parking_type),
      constructionType: normalizeParkingConstructionFromDb(data.construction_type),
    });
    const targetBasementCount = allowedBasements ? resolveBasementCount(buildingData) : 0;

    const { data: existingBasements = [], error: existingBasementsError } = await supabase
      .from('building_blocks')
      .select('id, linked_block_ids')
      .eq('building_id', buildingId)
      .eq('is_basement_block', true)
      .order('created_at', { ascending: true });
    if (existingBasementsError) return sendError(reply, 500, 'DB_ERROR', existingBasementsError.message);

    const { data: nonBasementBlocks = [], error: nonBasementBlocksError } = await supabase
      .from('building_blocks')
      .select('id')
      .eq('building_id', buildingId)
      .eq('is_basement_block', false);
    if (nonBasementBlocksError) return sendError(reply, 500, 'DB_ERROR', nonBasementBlocksError.message);

    const nonBasementIds = nonBasementBlocks.map(r => r.id);
    if (nonBasementIds.length === 1) {
      const single = [nonBasementIds[0]];
      const toPatch = existingBasements.filter(b => !Array.isArray(b.linked_block_ids) || b.linked_block_ids.length === 0);
      if (toPatch.length > 0) {
        const rows = toPatch.map(r => ({ id: r.id, linked_block_ids: single }));
        const { error: patchError } = await supabase.from('building_blocks').upsert(rows, { onConflict: 'id' });
        if (patchError) return sendError(reply, 500, 'DB_ERROR', patchError.message);
      }
    }

    if (existingBasements.length < targetBasementCount) {
      const autoLinkedIds = nonBasementIds.length === 1 ? [nonBasementIds[0]] : [];
      const toCreate = Array.from({ length: targetBasementCount - existingBasements.length }).map((_, idx) => ({
        building_id: buildingId,
        label: `Подвал ${existingBasements.length + idx + 1}`,
        type: 'BAS',
        is_basement_block: true,
        linked_block_ids: autoLinkedIds,
        basement_depth: 1,
        basement_has_parking: false,
        basement_parking_levels: {},
        basement_communications: DEFAULT_BASEMENT_COMMUNICATIONS,
        entrances_count: 1,
      }));
      const { error: createBasementError } = await supabase.from('building_blocks').insert(toCreate);
      if (createBasementError) return sendError(reply, 500, 'DB_ERROR', createBasementError.message);
    } else if (existingBasements.length > targetBasementCount) {
      const deleteBasementIds = existingBasements.slice(targetBasementCount).map(r => r.id);
      if (deleteBasementIds.length > 0) {
        const { error: deleteBasementError } = await supabase.from('building_blocks').delete().in('id', deleteBasementIds);
        if (deleteBasementError) return sendError(reply, 500, 'DB_ERROR', deleteBasementError.message);
      }
    }

    return reply.send(data);
  });

  app.delete('/api/v1/buildings/:buildingId', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'composition',
      action: 'mutate',
      forbiddenMessage: 'Role cannot modify composition',
    });
    if (!actor) return;

    const { buildingId } = req.params;
    const { error } = await supabase.from('buildings').delete().eq('id', buildingId);
    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);

    return reply.send({ ok: true });
  });
}
