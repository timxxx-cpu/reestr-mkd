import { sendError, requirePolicyActor } from './http-helpers.js';

function mapBlockTypeToUi(dbType) {
  if (dbType === 'Ж') return 'residential';
  if (dbType === 'Н') return 'non_residential';
  if (dbType === 'Parking') return 'parking';
  if (dbType === 'Infra') return 'infrastructure';
  return dbType;
}

function mapBlockTypeToDb(uiType) {
  if (uiType === 'residential') return 'Ж';
  if (uiType === 'non_residential') return 'Н';
  if (uiType === 'parking') return 'Parking';
  if (uiType === 'infrastructure') return 'Infra';
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

function getBuildingPrefix(category, hasMultipleBlocks = false) {
  if (category === 'residential' || category === 'residential_main') {
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

export function registerCompositionRoutes(app, { supabase }) {
  app.get('/api/v1/projects/:projectId/buildings', async (req, reply) => {
    const { projectId } = req.params;
    const { data, error } = await supabase
      .from('buildings')
      .select('*, building_blocks (*)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);

    return reply.send(
      (data || []).map(b => ({
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
        resBlocks: (b.building_blocks || []).filter(x => x.type === 'Ж').length,
        nonResBlocks: (b.building_blocks || []).filter(x => x.type === 'Н').length,
        blocks: (b.building_blocks || [])
          .map(bl => ({
            id: bl.id,
            label: bl.label,
            type: mapBlockTypeToUi(bl.type),
            originalType: bl.type,
            floorsCount: bl.floors_count,
          }))
          .sort((a, c) => a.label.localeCompare(c.label)),
      }))
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
        category: buildingData.category,
        construction_type: normalizedFields.constructionType,
        parking_type: normalizedFields.parkingType,
        infra_type: normalizedFields.infraType,
        has_non_res_part: buildingData.hasNonResPart || false,
      })
      .select('*')
      .single();

    if (buildingError) return sendError(reply, 500, 'DB_ERROR', buildingError.message);

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
      if (blocksError) return sendError(reply, 500, 'DB_ERROR', blocksError.message);
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

    const { data, error } = await supabase
      .from('buildings')
      .update({
        label: buildingData.label,
        house_number: buildingData.houseNumber,
        construction_type: normalizedFields.constructionType,
        parking_type: normalizedFields.parkingType,
        infra_type: normalizedFields.infraType,
        has_non_res_part: buildingData.hasNonResPart,
      })
      .eq('id', buildingId)
      .select('*')
      .single();

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);

    if (blocksData) {
      const { data: existingBlocks, error: existingError } = await supabase
        .from('building_blocks')
        .select('id')
        .eq('building_id', buildingId);
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
