import { sendError, requirePolicyActor } from './http-helpers.js';
import { generateFloorsModel } from './floor-generator.js';
import crypto from 'crypto';

// Вспомогательная функция для безопасного upsert/delete этажей
const syncFloorsForBlockWithGenerator = async (supabase, blockId) => {
  // 1. Собираем полный контекст из БД (запрашиваем нужные поля для уникального ключа)
  const [
    { data: block },
    { data: building },
    { data: allBlocks },
    { data: basements },
    { data: markers },
    { data: existingFloors }
  ] = await Promise.all([
    supabase.from('building_blocks').select('*').eq('id', blockId).single(),
    supabase.from('buildings').select('*').eq('id', (await supabase.from('building_blocks').select('building_id').eq('id', blockId).single()).data?.building_id).single(),
    supabase.from('building_blocks').select('*').eq('building_id', (await supabase.from('building_blocks').select('building_id').eq('id', blockId).single()).data?.building_id),
    supabase.from('basements').select('*').eq('building_id', (await supabase.from('building_blocks').select('building_id').eq('id', blockId).single()).data?.building_id),
    supabase.from('block_floor_markers').select('*').eq('block_id', blockId),
    supabase.from('floors').select('id, floor_key, index, parent_floor_index, basement_id').eq('block_id', blockId)
  ]);

  if (!block || !building) return null;

  let targetFloorsModel = generateFloorsModel(block, building, allBlocks || [], basements || [], markers || []);

  // Функция расчета ключа уникальности (как в БД)
  const getConstraintKey = (f) => {
    const idx = Number(f.index || 0);
    const pfi = f.parent_floor_index !== null && f.parent_floor_index !== undefined ? Number(f.parent_floor_index) : -99999;
    const bid = f.basement_id || '00000000-0000-0000-0000-000000000000';
    return `${idx}_${pfi}_${bid}`;
  };

  // --- ФИЛЬТР ДЕДУПЛИКАЦИИ НОВЫХ ЭТАЖЕЙ ---
  const uniqueConstraintKeys = new Set();
  const deduplicatedModel = [];

  targetFloorsModel.forEach(floor => {
    const cKey = getConstraintKey(floor);
    if (!uniqueConstraintKeys.has(cKey)) {
      uniqueConstraintKeys.add(cKey);
      deduplicatedModel.push(floor);
    }
  });
  targetFloorsModel = deduplicatedModel;
  // ----------------------------------------

  // 3. Умный Diff и Синхронизация (Сопоставляем по слотам уникальности)
  const existingFloorsMap = new Map();
  (existingFloors || []).forEach(f => {
    existingFloorsMap.set(getConstraintKey(f), f);
  });

  const toUpsert = [];
  const usedExistingIds = new Set();
  const now = new Date().toISOString();

  targetFloorsModel.forEach(targetFloor => {
    const cKey = getConstraintKey(targetFloor);
    const existing = existingFloorsMap.get(cKey);
    
    if (existing) {
      // Если слот занят, ОБНОВЛЯЕМ существующую запись (сохраняем её ID)
      toUpsert.push({ ...targetFloor, id: existing.id, updated_at: now });
      usedExistingIds.add(existing.id);
    } else {
      // Иначе создаем новую
      toUpsert.push({ ...targetFloor, id: crypto.randomUUID(), updated_at: now });
    }
  });

  // Удаляем всё, что не попало в расчет
  const toDeleteIds = (existingFloors || [])
    .filter(f => !usedExistingIds.has(f.id))
    .map(f => f.id);

  if (toDeleteIds.length > 0) {
    const { error: deleteErr } = await supabase.from('floors').delete().in('id', toDeleteIds);
    if (deleteErr) return deleteErr;
  }

  if (toUpsert.length > 0) {
    const { error: upsertErr } = await supabase.from('floors').upsert(toUpsert, { onConflict: 'id' });
    if (upsertErr) return upsertErr;
  }

  return null;
};

const syncEntrancesForBlock = async (supabase, blockId, entrancesCount) => {
  const normalizedCount = Math.max(0, parseInt(entrancesCount, 10) || 0);

  const { data: existing, error: existingError } = await supabase
    .from('entrances')
    .select('id, number')
    .eq('block_id', blockId);
  if (existingError) return existingError;

  const existingRows = existing || [];
  const existingNumbers = new Set(existingRows.map(row => Number(row.number)));

  const toInsert = [];
  for (let i = 1; i <= normalizedCount; i += 1) {
    if (!existingNumbers.has(i)) toInsert.push({ block_id: blockId, number: i });
  }
  if (toInsert.length > 0) {
    const { error: insertError } = await supabase.from('entrances').insert(toInsert);
    if (insertError) return insertError;
  }

  const toDeleteIds = existingRows.filter(row => Number(row.number) > normalizedCount).map(row => row.id);
  if (toDeleteIds.length > 0) {
    const { error: deleteError } = await supabase.from('entrances').delete().in('id', toDeleteIds);
    if (deleteError) return deleteError;
  }

  return null;
};

const ensureEntranceMatrixForBlock = async (supabase, blockId) => {
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
    if (clearError) return clearError;
    return null;
  }

  const { data: existingRows = [], error: existingError } = await supabase
    .from('entrance_matrix')
    .select('id, floor_id, entrance_number')
    .eq('block_id', blockId);
  if (existingError) return existingError;

  const floorIdSet = new Set(floorIds);
  const entranceSet = new Set(entranceNumbers);
  const existingKeySet = new Set();
  const staleIds = [];

  (existingRows || []).forEach(row => {
    const floorId = row.floor_id;
    const entranceNumber = Number(row.entrance_number);
    if (!floorIdSet.has(floorId) || !entranceSet.has(entranceNumber)) {
      if (row.id) staleIds.push(row.id);
      return;
    }
    existingKeySet.add(`${floorId}|${entranceNumber}`);
  });

  if (staleIds.length > 0) {
    const { error: staleDeleteError } = await supabase.from('entrance_matrix').delete().in('id', staleIds);
    if (staleDeleteError) return staleDeleteError;
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
};

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

async function fetchAllPaged(queryFactory, pageSize = 1000) {
  let from = 0;
  const rows = [];

  while (true) {
    const { data, error } = await queryFactory(from, from + pageSize - 1);
    if (error) throw error;

    const chunk = data || [];
    rows.push(...chunk);

    if (chunk.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

export function registerProjectExtendedRoutes(app, { supabase }) {
  app.get('/api/v1/projects/:projectId/context', async (req, reply) => {
    const { projectId } = req.params;
    const scope = String(req.query?.scope || '').trim();

    if (!scope) return sendError(reply, 400, 'VALIDATION_ERROR', 'scope is required');

    const { data: appRow, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('project_id', projectId)
      .eq('scope_id', scope)
      .maybeSingle();

    if (appError) return sendError(reply, 500, 'DB_ERROR', appError.message);

    const [projectRes, participantsRes, docsRes, buildingsRes, historyRes, stepsRes] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).maybeSingle(),
      supabase.from('project_participants').select('*').eq('project_id', projectId),
      supabase.from('project_documents').select('*').eq('project_id', projectId),
      supabase
        .from('buildings')
        .select(
          `
            *,
            building_blocks (
              *,
              block_construction (*),
              block_engineering (*)
            )
          `
        )
        .eq('project_id', projectId)
        .order('created_at', { ascending: true }),
      appRow?.id
        ? supabase
            .from('application_history')
            .select('*')
            .eq('application_id', appRow.id)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      appRow?.id
        ? supabase.from('application_steps').select('*').eq('application_id', appRow.id)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (projectRes.error) return sendError(reply, 500, 'DB_ERROR', projectRes.error.message);
    if (!projectRes.data) return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
    if (participantsRes.error) return sendError(reply, 500, 'DB_ERROR', participantsRes.error.message);
    if (docsRes.error) return sendError(reply, 500, 'DB_ERROR', docsRes.error.message);
    if (buildingsRes.error) return sendError(reply, 500, 'DB_ERROR', buildingsRes.error.message);
    if (historyRes.error) return sendError(reply, 500, 'DB_ERROR', historyRes.error.message);
    if (stepsRes.error) return sendError(reply, 500, 'DB_ERROR', stepsRes.error.message);

    return reply.send({
      project: projectRes.data,
      application: appRow || null,
      participants: participantsRes.data || [],
      documents: docsRes.data || [],
      buildings: buildingsRes.data || [],
      history: historyRes.data || [],
      steps: stepsRes.data || [],
    });
  });

  // POST save context (ИСПРАВЛЕННЫЙ)
  app.post('/api/v1/projects/:projectId/context-building-details/save', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'projectExtended',
      action: 'mutate',
      forbiddenMessage: 'Role cannot save building details',
    });
    if (!actor) return;

    const { projectId } = req.params;
    const buildingDetails = req.body?.buildingDetails || {};

    const { data: buildings, error: buildingsError } = await supabase
      .from('buildings')
      .select('id')
      .eq('project_id', projectId);
    if (buildingsError) return sendError(reply, 500, 'DB_ERROR', buildingsError.message);

    const knownBuildingIds = new Set((buildings || []).map(b => b.id));
    const basementsByBlockId = new Map();

    const toIntOrNull = v => (v === '' || v === undefined || v === null || isNaN(v) ? null : parseInt(v, 10));
    const toNullIfEmpty = v => (v === '' || v === undefined ? null : v);

    // ПРОХОД 1: Сохраняем подвалы (basements)
    for (const [key, details] of Object.entries(buildingDetails)) {
      if (!key.includes('_features')) continue;

      const buildingId = key.replace('_features', '');
      if (!knownBuildingIds.has(buildingId)) continue;
      const basements = details.basements || [];

      for (const base of basements) {
        if (!base.id || !base.depth) continue;

        const linkedBlockIds = Array.isArray(base.blocks)
          ? base.blocks.filter(id => typeof id === 'string' && id.length === 36)
          : [];
        if (base.blockId && typeof base.blockId === 'string' && base.blockId.length === 36) {
          linkedBlockIds.push(base.blockId);
        }
        const validBlockIds = Array.from(new Set(linkedBlockIds));
        if (validBlockIds.length === 0) continue;

        validBlockIds.forEach(blockId => {
          const list = basementsByBlockId.get(blockId) || [];
          list.push({ id: base.id, depth: base.depth });
          basementsByBlockId.set(blockId, list);
        });

        const { error: basementError } = await supabase.from('basements').upsert(
          {
            id: base.id,
            building_id: buildingId,
            block_id: validBlockIds[0],
            depth: parseInt(base.depth, 10),
            has_parking: !!base.hasParking,
          },
          { onConflict: 'id' }
        );
        if (basementError) return sendError(reply, 500, 'DB_ERROR', basementError.message);

        if (base.parkingLevels) {
          const levels = Object.entries(base.parkingLevels).map(([lvl, enabled]) => ({
            basement_id: base.id,
            depth_level: parseInt(lvl, 10),
            is_enabled: !!enabled,
          }));
          if (levels.length) {
            const { error: levelsError } = await supabase
              .from('basement_parking_levels')
              .upsert(levels, { onConflict: 'basement_id,depth_level' });
            if (levelsError) return sendError(reply, 500, 'DB_ERROR', levelsError.message);
          }
        }
      }
    }

    // ПРОХОД 2: Сохраняем блоки, маркеры и генерируем этажи
    for (const [key, details] of Object.entries(buildingDetails)) {
      if (key.includes('_features')) continue;

      const parts = key.split('_');
      const blockId = parts[parts.length - 1];
      if (!blockId || blockId.length !== 36) continue;

      // 1. Обновляем параметры блока
      const blockUpdate = {
        floors_count: toIntOrNull(details.floorsCount),
        entrances_count: toIntOrNull(details.entrances || details.inputs),
        elevators_count: toIntOrNull(details.elevators),
        vehicle_entries: toIntOrNull(details.vehicleEntries),
        levels_depth: toIntOrNull(details.levelsDepth),
        light_structure_type: toNullIfEmpty(details.lightStructureType),
        parent_blocks: Array.isArray(details.parentBlocks) ? details.parentBlocks.filter(id => typeof id === 'string' && id.length === 36) : [],
        floors_from: toIntOrNull(details.floorsFrom),
        floors_to: toIntOrNull(details.floorsTo),
        has_basement: !!details.hasBasementFloor,
        has_attic: !!details.hasAttic,
        has_loft: !!details.hasLoft,
        has_roof_expl: !!details.hasExploitableRoof,
        has_custom_address: !!details.hasCustomAddress,
        custom_house_number: toNullIfEmpty(details.customHouseNumber),
      };

      const { error: blockError } = await supabase.from('building_blocks').update(blockUpdate).eq('id', blockId);
      if (blockError) return sendError(reply, 500, 'DB_ERROR', blockError.message);

      // 2. Обновляем маркеры этажей (ВАЖНО: ДО генерации этажей)
      const markerTechSet = new Set(
        (details.technicalFloors || [])
          .map(v => Number(v))
          .filter(v => Number.isFinite(v))
          .map(v => String(v))
      );
      const markerCommSet = new Set((details.commercialFloors || []).map(v => String(v)));

      const markerPayload = Array.from(new Set([...markerTechSet, ...markerCommSet])).map(markerKey => ({
        block_id: blockId,
        marker_key: markerKey,
        marker_type: markerKey.startsWith('basement_')
          ? 'basement'
          : markerKey.includes('-Т')
            ? 'technical'
            : ['attic', 'loft', 'roof', 'tsokol'].includes(markerKey)
              ? 'special'
              : 'floor',
        floor_index: markerKey.includes('-Т')
          ? parseInt(markerKey.replace('-Т', ''), 10)
          : /^-?\d+$/.test(markerKey)
            ? parseInt(markerKey, 10)
            : null,
        parent_floor_index: markerKey.includes('-Т')
          ? parseInt(markerKey.replace('-Т', ''), 10)
          : null,
        is_technical: markerTechSet.has(markerKey),
        is_commercial: markerCommSet.has(markerKey),
        updated_at: new Date().toISOString(),
      }));

      // Сначала чистим старые маркеры
      const { error: markerDeleteError } = await supabase.from('block_floor_markers').delete().eq('block_id', blockId);
      if (markerDeleteError) return sendError(reply, 500, 'DB_ERROR', markerDeleteError.message);

      // Записываем новые
      if (markerPayload.length) {
        const { error: markerUpsertError } = await supabase
          .from('block_floor_markers')
          .upsert(markerPayload, { onConflict: 'block_id,marker_key' });
        if (markerUpsertError) return sendError(reply, 500, 'DB_ERROR', markerUpsertError.message);
      }

      // 3. ТЕПЕРЬ генерируем этажи (используя наш единый генератор)
      const floorSyncError = await syncFloorsForBlockWithGenerator(supabase, blockId);
      if (floorSyncError) return sendError(reply, 500, 'DB_ERROR', floorSyncError.message);

      // 4. Синхронизируем подъезды
      const entrancesSyncError = await syncEntrancesForBlock(supabase, blockId, details.entrances || details.inputs);
      if (entrancesSyncError) return sendError(reply, 500, 'DB_ERROR', entrancesSyncError.message);

      // 5. Перестраиваем матрицу
      const matrixSyncError = await ensureEntranceMatrixForBlock(supabase, blockId);
      if (matrixSyncError) return sendError(reply, 500, 'DB_ERROR', matrixSyncError.message);

      // 6. Сохраняем конструктив (если есть)
      if (details.foundation || details.walls || details.slabs || details.roof || details.seismicity !== undefined) {
        const { error: constructionError } = await supabase.from('block_construction').upsert(
          {
            block_id: blockId,
            foundation: toNullIfEmpty(details.foundation),
            walls: toNullIfEmpty(details.walls),
            slabs: toNullIfEmpty(details.slabs),
            roof: toNullIfEmpty(details.roof),
            seismicity: toIntOrNull(details.seismicity),
          },
          { onConflict: 'block_id' }
        );
        if (constructionError) return sendError(reply, 500, 'DB_ERROR', constructionError.message);
      }

      // 7. Сохраняем инженерию (если есть)
      if (details.engineering) {
        const { error: engineeringError } = await supabase.from('block_engineering').upsert(
          {
            block_id: blockId,
            has_electricity: !!details.engineering.electricity,
            has_water: !!details.engineering.hvs,
            has_hot_water: !!details.engineering.gvs,
            has_ventilation: !!details.engineering.ventilation,
            has_firefighting: !!details.engineering.firefighting,
            has_lowcurrent: !!details.engineering.lowcurrent,
            has_sewerage: !!details.engineering.sewerage,
            has_gas: !!details.engineering.gas,
            has_heating: !!details.engineering.heating,
          },
          { onConflict: 'block_id' }
        );
        if (engineeringError) return sendError(reply, 500, 'DB_ERROR', engineeringError.message);
      }
    }

    return reply.send({ ok: true, projectId });
  });

  app.post('/api/v1/projects/:projectId/context-meta/save', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'projectExtended',
      action: 'mutate',
      forbiddenMessage: 'Role cannot save context meta',
    });
    if (!actor) return;

    const { projectId } = req.params;
    const scope = String(req.body?.scope || '').trim();
    const complexInfo = req.body?.complexInfo || null;
    const applicationInfo = req.body?.applicationInfo || null;

    if (!scope) return sendError(reply, 400, 'VALIDATION_ERROR', 'scope is required');

    if (complexInfo) {
      const { error: projectUpdateError } = await supabase
        .from('projects')
        .update({
          name: complexInfo.name,
          construction_status: complexInfo.status,
          region: complexInfo.region,
          district: complexInfo.district,
          address: complexInfo.street,
          date_start_project: complexInfo.dateStartProject || null,
          date_end_project: complexInfo.dateEndProject || null,
          date_start_fact: complexInfo.dateStartFact || null,
          date_end_fact: complexInfo.dateEndFact || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      if (projectUpdateError) return sendError(reply, 500, 'DB_ERROR', projectUpdateError.message);
    }

    let applicationId = null;

    if (applicationInfo) {
      const { data: appFound, error: appFindError } = await supabase
        .from('applications')
        .select('id')
        .eq('project_id', projectId)
        .maybeSingle();

      if (appFindError) return sendError(reply, 500, 'DB_ERROR', appFindError.message);

      applicationId = appFound?.id || null;

      if (!applicationId) {
        const { data: createdApp, error: createAppError } = await supabase
          .from('applications')
          .insert({
            project_id: projectId,
            scope_id: scope,
            internal_number: `AUTO-${Date.now().toString().slice(-6)}`,
            external_source: 'MIGRATION_FIX',
            external_id: null,
            applicant: null,
            submission_date: new Date().toISOString(),
            assignee_name: null,
            status: applicationInfo.status || 'IN_PROGRESS',
            workflow_substatus: applicationInfo.workflowSubstatus || 'DRAFT',
            current_step: applicationInfo.currentStepIndex ?? 0,
            current_stage: applicationInfo.currentStage ?? 1,
          })
          .select('id')
          .single();

        if (createAppError) return sendError(reply, 500, 'DB_ERROR', createAppError.message);
        applicationId = createdApp?.id || null;
      }

      if (applicationId) {
        const appUpdate = {
          status: applicationInfo.status,
          current_step: applicationInfo.currentStepIndex,
          current_stage: applicationInfo.currentStage,
          updated_at: new Date().toISOString(),
        };
        if (applicationInfo.workflowSubstatus !== undefined) {
          appUpdate.workflow_substatus = applicationInfo.workflowSubstatus;
        }
        if (applicationInfo.requestedDeclineReason !== undefined) {
          appUpdate.requested_decline_reason = applicationInfo.requestedDeclineReason;
        }
        if (applicationInfo.requestedDeclineStep !== undefined) {
          appUpdate.requested_decline_step = applicationInfo.requestedDeclineStep;
        }
        if (applicationInfo.requestedDeclineBy !== undefined) {
          appUpdate.requested_decline_by = applicationInfo.requestedDeclineBy;
        }
        if (applicationInfo.requestedDeclineAt !== undefined) {
          appUpdate.requested_decline_at = applicationInfo.requestedDeclineAt;
        }

        const { error: appUpdateError } = await supabase
          .from('applications')
          .update(appUpdate)
          .eq('id', applicationId);
        if (appUpdateError) return sendError(reply, 500, 'DB_ERROR', appUpdateError.message);

        if (applicationInfo.history && applicationInfo.history.length > 0) {
          const last = applicationInfo.history[0];
          const isFresh = new Date().getTime() - new Date(last.date).getTime() < 5000;
          if (isFresh) {
            const { error: historyError } = await supabase.from('application_history').insert({
              application_id: applicationId,
              action: last.action,
              prev_status: last.prevStatus,
              next_status: last.nextStatus || applicationInfo.status,
              user_name: last.user,
              comment: last.comment,
              created_at: last.date,
            });
            if (historyError) return sendError(reply, 500, 'DB_ERROR', historyError.message);
          }
        }

        if (applicationInfo.completedSteps) {
          const stepsPayload = applicationInfo.completedSteps.map(idx => ({
            application_id: applicationId,
            step_index: idx,
            is_completed: true,
          }));
          if (stepsPayload.length) {
            const { error: stepsError } = await supabase
              .from('application_steps')
              .upsert(stepsPayload, { onConflict: 'application_id,step_index' });
            if (stepsError) return sendError(reply, 500, 'DB_ERROR', stepsError.message);
          }
        }
      }
    }

    return reply.send({ ok: true, projectId, applicationId });
  });

  app.post('/api/v1/projects/:projectId/step-block-statuses/save', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'projectExtended',
      action: 'mutate',
      forbiddenMessage: 'Role cannot save step block statuses',
    });
    if (!actor) return;

    const { projectId } = req.params;
    const scope = String(req.body?.scope || '').trim();
    const stepIndexRaw = Number(req.body?.stepIndex);
    const stepIndex = Number.isFinite(stepIndexRaw) ? Math.trunc(stepIndexRaw) : null;
    const statuses = req.body?.statuses || {};

    if (!scope) return sendError(reply, 400, 'VALIDATION_ERROR', 'scope is required');
    if (stepIndex === null || stepIndex < 0) {
      return sendError(reply, 400, 'VALIDATION_ERROR', 'stepIndex must be a non-negative number');
    }

    const { data: app, error: appErr } = await supabase
      .from('applications')
      .select('id')
      .eq('scope_id', scope)
      .eq('project_id', projectId)
      .maybeSingle();
    if (appErr) return sendError(reply, 500, 'DB_ERROR', appErr.message);
    if (!app?.id) return sendError(reply, 404, 'NOT_FOUND', 'Application not found');

    const payload = {
      application_id: app.id,
      step_index: stepIndex,
      block_statuses: statuses,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('application_steps')
      .upsert(payload, { onConflict: 'application_id,step_index' });
    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);

    return reply.send({ applicationId: app.id, stepIndex, blockStatuses: payload.block_statuses });
  });

  app.get('/api/v1/projects/:projectId/context-registry-details', async (req, reply) => {
    const { projectId } = req.params;

    const { data: buildings, error: buildingsError } = await supabase
      .from('buildings')
      .select('id, building_blocks (id)')
      .eq('project_id', projectId);

    if (buildingsError) return sendError(reply, 500, 'DB_ERROR', buildingsError.message);

    const blockIds = (buildings || []).flatMap(building =>
      (building.building_blocks || []).map(block => block.id)
    );

    if (!blockIds.length) {
      return reply.send({ markerRows: [], floors: [], entrances: [], matrix: [], units: [], mops: [] });
    }

    const { data: markerRows, error: markersError } = await supabase
      .from('block_floor_markers')
      .select('block_id, marker_key, is_technical, is_commercial')
      .in('block_id', blockIds);
    if (markersError) return sendError(reply, 500, 'DB_ERROR', markersError.message);

    const { data: floors, error: floorsError } = await supabase
      .from('floors')
      .select(
        'id, block_id, floor_key, label, index, floor_type, height, area_proj, area_fact, is_duplex, parent_floor_index, is_commercial, is_technical, is_stylobate, is_basement, is_attic, is_loft, is_roof, basement_id'
      )
      .in('block_id', blockIds);
    if (floorsError) return sendError(reply, 500, 'DB_ERROR', floorsError.message);

    const floorIds = (floors || []).map(floor => floor.id);

    const [entrancesRes, matrixRes, unitsRes, mopsRes] = await Promise.all([
      supabase.from('entrances').select('id, block_id, number').in('block_id', blockIds),
      supabase
        .from('entrance_matrix')
        .select('floor_id, entrance_number, flats_count, commercial_count, mop_count')
        .in('block_id', blockIds),
      (async () => {
        if (!floorIds.length) return { data: [], error: null };

        const data = await fetchAllPaged((from, to) =>
          supabase
            .from('units')
            .select(
              'id, floor_id, entrance_id, number, unit_type, has_mezzanine, mezzanine_type, total_area, living_area, useful_area, rooms_count, status, cadastre_number'
            )
            .in('floor_id', floorIds)
            .order('id', { ascending: true })
            .range(from, to)
        );

        return { data, error: null };
      })(),
      floorIds.length
        ? supabase
            .from('common_areas')
            .select('id, floor_id, entrance_id, type, area, height')
            .in('floor_id', floorIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (entrancesRes.error) return sendError(reply, 500, 'DB_ERROR', entrancesRes.error.message);
    if (matrixRes.error) return sendError(reply, 500, 'DB_ERROR', matrixRes.error.message);
    if (unitsRes.error) return sendError(reply, 500, 'DB_ERROR', unitsRes.error.message);
    if (mopsRes.error) return sendError(reply, 500, 'DB_ERROR', mopsRes.error.message);

    return reply.send({
      markerRows: markerRows || [],
      floors: floors || [],
      entrances: entrancesRes.data || [],
      matrix: matrixRes.data || [],
      units: unitsRes.data || [],
      mops: mopsRes.data || [],
    });
  });

  app.get('/api/v1/projects/:projectId/passport', async (req, reply) => {
    const { projectId } = req.params;

    const [projectRes, participantsRes, docsRes] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).maybeSingle(),
      supabase.from('project_participants').select('*').eq('project_id', projectId),
      supabase.from('project_documents').select('*').eq('project_id', projectId).order('doc_date', { ascending: false }),
    ]);

    if (projectRes.error) return sendError(reply, 500, 'DB_ERROR', projectRes.error.message);
    if (!projectRes.data) return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
    if (participantsRes.error) return sendError(reply, 500, 'DB_ERROR', participantsRes.error.message);
    if (docsRes.error) return sendError(reply, 500, 'DB_ERROR', docsRes.error.message);

    const project = projectRes.data;

    return reply.send({
      complexInfo: {
        name: project.name,
        ujCode: project.uj_code,
        status: project.construction_status,
        region: project.region,
        district: project.district,
        street: project.address,
        landmark: project.landmark,
        dateStartProject: project.date_start_project,
        dateEndProject: project.date_end_project,
        dateStartFact: project.date_start_fact,
        dateEndFact: project.date_end_fact,
      },
      cadastre: {
        number: project.cadastre_number,
      },
      participants: (participantsRes.data || []).reduce((acc, part) => {
        acc[part.role] = {
          id: part.id,
          name: part.name,
          inn: part.inn,
          role: part.role,
        };
        return acc;
      }, {}),
      documents: (docsRes.data || []).map(d => ({
        id: d.id,
        name: d.name,
        type: d.doc_type,
        date: d.doc_date,
        number: d.doc_number,
        url: d.file_url,
      })),
    });
  });

  app.put('/api/v1/projects/:projectId/passport', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'projectExtended',
      action: 'mutate',
      forbiddenMessage: 'Role cannot modify project passport',
    });
    if (!actor) return;

    const { projectId } = req.params;
    const info = req.body?.info || {};
    const cadastreData = req.body?.cadastreData || {};

    const payload = {
      name: info.name,
      construction_status: info.status,
      region: info.region,
      district: info.district,
      address: info.street,
      landmark: info.landmark,
      date_start_project: info.dateStartProject || null,
      date_end_project: info.dateEndProject || null,
      date_start_fact: info.dateStartFact || null,
      date_end_fact: info.dateEndFact || null,
      cadastre_number: formatComplexCadastre(cadastreData.number),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('projects')
      .update(payload)
      .eq('id', projectId)
      .select('*')
      .single();

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send(data);
  });

  app.put('/api/v1/projects/:projectId/participants/:role', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'projectExtended',
      action: 'mutate',
      forbiddenMessage: 'Role cannot modify project participants',
    });
    if (!actor) return;

    const { projectId, role } = req.params;
    const data = req.body?.data || {};

    const payload = {
      id: data.id || crypto.randomUUID(),
      project_id: projectId,
      role,
      name: data.name || '',
      inn: data.inn || '',
    };

    const { data: result, error } = await supabase
      .from('project_participants')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single();

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send(result);
  });

  app.post('/api/v1/projects/:projectId/documents', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'projectExtended',
      action: 'mutate',
      forbiddenMessage: 'Role cannot modify project documents',
    });
    if (!actor) return;

    const { projectId } = req.params;
    const doc = req.body?.doc || {};

    const payload = {
      id: doc.id || crypto.randomUUID(),
      project_id: projectId,
      name: doc.name || '',
      doc_type: doc.type || '',
      doc_date: doc.date || null,
      doc_number: doc.number || '',
      file_url: doc.url || null,
    };

    const { data, error } = await supabase
      .from('project_documents')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single();

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send(data);
  });

  app.delete('/api/v1/project-documents/:documentId', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'projectExtended',
      action: 'mutate',
      forbiddenMessage: 'Role cannot delete project documents',
    });
    if (!actor) return;

    const { documentId } = req.params;
    const { error } = await supabase.from('project_documents').delete().eq('id', documentId);
    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send({ ok: true });
  });

  app.delete('/api/v1/projects/:projectId', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'projectExtended',
      action: 'deleteProject',
      forbiddenMessage: 'Role cannot delete projects',
    });
    if (!actor) return;

    const { projectId } = req.params;
    const scope = String(req.query?.scope || '').trim();
    if (!scope) return sendError(reply, 400, 'VALIDATION_ERROR', 'scope is required');

    const { error } = await supabase.from('projects').delete().eq('id', projectId).eq('scope_id', scope);
    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send({ ok: true });
  });

  app.get('/api/v1/projects/:projectId/basements', async (req, reply) => {
    const { projectId } = req.params;
    const { data: buildings, error: bError } = await supabase.from('buildings').select('id').eq('project_id', projectId);
    if (bError) return sendError(reply, 500, 'DB_ERROR', bError.message);

    const buildingIds = (buildings || []).map(b => b.id);
    if (!buildingIds.length) return reply.send([]);

    const { data, error } = await supabase
      .from('basements')
      .select('*, basement_parking_levels (depth_level, is_enabled)')
      .in('building_id', buildingIds);

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);

    return reply.send((data || []).map(b => ({
      id: b.id,
      buildingId: b.building_id,
      blockId: b.block_id,
      depth: b.depth,
      hasParking: b.has_parking,
      parkingLevels: (b.basement_parking_levels || []).reduce((acc, l) => {
        acc[l.depth_level] = l.is_enabled;
        return acc;
      }, {}),
    })));
  });

  app.put('/api/v1/basements/:basementId/parking-levels/:level', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'projectExtended',
      action: 'mutate',
      forbiddenMessage: 'Role cannot modify basement levels',
    });
    if (!actor) return;

    const { basementId, level } = req.params;
    const parsedLevel = Number(level);
    if (!Number.isInteger(parsedLevel) || parsedLevel < 1 || parsedLevel > 10) {
      return sendError(reply, 400, 'VALIDATION_ERROR', 'level must be integer in range [1..10]');
    }

    const isEnabled = !!req.body?.isEnabled;

    const { error } = await supabase
      .from('basement_parking_levels')
      .upsert(
        { basement_id: basementId, depth_level: parsedLevel, is_enabled: isEnabled },
        { onConflict: 'basement_id,depth_level' }
      );

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send({ ok: true });
  });

  app.get('/api/v1/projects/:projectId/full-registry', async (req, reply) => {
    const { projectId } = req.params;

    const { data: buildings, error: buildingsError } = await supabase
      .from('buildings')
      .select('*')
      .eq('project_id', projectId);

    if (buildingsError) return sendError(reply, 500, 'DB_ERROR', buildingsError.message);
    if (!buildings || !buildings.length) return reply.send({ buildings: [], units: [] });

    const bIds = buildings.map(b => b.id);

    const { data: blocks, error: blocksError } = await supabase
      .from('building_blocks')
      .select('*')
      .in('building_id', bIds);
    if (blocksError) return sendError(reply, 500, 'DB_ERROR', blocksError.message);

    const blIds = (blocks || []).map(block => block.id);

    const { data: floors, error: floorsError } = await supabase
      .from('floors')
      .select('*')
      .in('block_id', blIds);
    if (floorsError) return sendError(reply, 500, 'DB_ERROR', floorsError.message);

    const fIds = (floors || []).map(floor => floor.id);

    const { data: entrances, error: entrancesError } = await supabase
      .from('entrances')
      .select('id, block_id, number')
      .in('block_id', blIds);
    if (entrancesError) return sendError(reply, 500, 'DB_ERROR', entrancesError.message);

    let units = [];
    try {
      units = await fetchAllPaged((from, to) =>
        supabase
          .from('units')
          .select('*, rooms (*)')
          .in('floor_id', fIds)
          .order('id', { ascending: true })
          .range(from, to)
      );
    } catch (error) {
      return sendError(reply, 500, 'DB_ERROR', error?.message || 'Failed to load units');
    }

    const floorToBlockMap = {};
    const blockToBuildingMap = {};
    const buildingCodeMap = {};

    (floors || []).forEach(floor => {
      floorToBlockMap[floor.id] = floor.block_id;
    });

    (blocks || []).forEach(block => {
      blockToBuildingMap[block.id] = block.building_id;
    });

    (buildings || []).forEach(building => {
      buildingCodeMap[building.id] = building.building_code;
    });

    return reply.send({
      buildings: (buildings || []).map(building => ({
        ...building,
        label: building.label,
        houseNumber: building.house_number,
        buildingCode: building.building_code,
      })),
      blocks: (blocks || []).map(block => ({
        ...block,
        tabLabel: block.label,
        buildingId: block.building_id,
      })),
      floors: (floors || []).map(floor => ({
        ...floor,
        blockId: floor.block_id,
        areaProj: floor.area_proj,
        areaFact: floor.area_fact,
      })),
      entrances: (entrances || []).map(entrance => ({
        id: entrance.id,
        blockId: entrance.block_id,
        number: entrance.number,
      })),
      units: (units || []).map(unit => {
        const blockId = floorToBlockMap[unit.floor_id] || null;
        const buildingId = blockToBuildingMap[blockId] || null;
        const buildingCode = buildingCodeMap[buildingId] || null;

        return {
          id: unit.id,
          uid: unit.id,
          unitCode: unit.unit_code,
          num: unit.number,
          number: unit.number,
          type: unit.unit_type,
          hasMezzanine: !!unit.has_mezzanine,
          mezzanineType: unit.mezzanine_type || null,
          area: unit.total_area,
          livingArea: unit.living_area,
          usefulArea: unit.useful_area,
          rooms: unit.rooms_count,
          floorId: unit.floor_id,
          entranceId: unit.entrance_id,
          buildingId,
          buildingCode,
          cadastreNumber: unit.cadastre_number,
          explication: (unit.rooms || []).map(room => ({
            id: room.id,
            type: room.room_type,
            label: room.name,
            area: room.area,
            height: room.room_height,
            level: room.level,
            isMezzanine: !!room.is_mezzanine,
          })),
        };
      }),
    });
  });

  app.get('/api/v1/versions', async (req, reply) => {
    const entityType = String(req.query?.entityType || '').trim();
    const entityId = String(req.query?.entityId || '').trim();
    if (!entityType || !entityId) {
      return sendError(reply, 400, 'VALIDATION_ERROR', 'entityType and entityId are required');
    }

    const { data, error } = await supabase
      .from('object_versions')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('version_number', { ascending: false });

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send(data || []);
  });

  app.post('/api/v1/versions', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'versioning',
      action: 'create',
      forbiddenMessage: 'Role cannot create versions',
    });
    if (!actor) return;

    const { entityType, entityId, snapshotData, createdBy, applicationId } = req.body || {};
    if (!entityType || !entityId) return sendError(reply, 400, 'VALIDATION_ERROR', 'entityType and entityId are required');

    const { data: latest, error: latestErr } = await supabase
      .from('object_versions')
      .select('version_number')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestErr) return sendError(reply, 500, 'DB_ERROR', latestErr.message);

    const { error: archiveErr } = await supabase
      .from('object_versions')
      .update({ version_status: 'PREVIOUS', updated_at: new Date().toISOString() })
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('version_status', 'PENDING');
    if (archiveErr) return sendError(reply, 500, 'DB_ERROR', archiveErr.message);

    const { data, error } = await supabase
      .from('object_versions')
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        version_number: (latest?.version_number || 0) + 1,
        version_status: 'PENDING',
        snapshot_data: snapshotData || {},
        created_by: createdBy || actor.userId,
        application_id: applicationId || null,
      })
      .select('*')
      .single();

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send(data);
  });

  app.post('/api/v1/versions/:versionId/approve', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'versioning',
      action: 'approve',
      forbiddenMessage: 'Role cannot approve versions',
    });
    if (!actor) return;

    const { versionId } = req.params;
    const approvedBy = req.body?.approvedBy || actor.userId;

    const { data: current, error: currentErr } = await supabase
      .from('object_versions')
      .select('id, entity_type, entity_id')
      .eq('id', versionId)
      .single();
    if (currentErr) return sendError(reply, 500, 'DB_ERROR', currentErr.message);

    const { error: archiveErr } = await supabase
      .from('object_versions')
      .update({ version_status: 'PREVIOUS', updated_at: new Date().toISOString() })
      .eq('entity_type', current.entity_type)
      .eq('entity_id', current.entity_id)
      .eq('version_status', 'CURRENT')
      .neq('id', versionId);
    if (archiveErr) return sendError(reply, 500, 'DB_ERROR', archiveErr.message);

    const { data, error } = await supabase
      .from('object_versions')
      .update({
        version_status: 'CURRENT',
        approved_by: approvedBy,
        declined_by: null,
        decline_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', versionId)
      .select('*')
      .single();

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send(data);
  });

  app.post('/api/v1/versions/:versionId/decline', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'versioning',
      action: 'decline',
      forbiddenMessage: 'Role cannot decline versions',
    });
    if (!actor) return;

    const { versionId } = req.params;
    const reason = req.body?.reason || null;
    const declinedBy = req.body?.declinedBy || actor.userId;

    const { data, error } = await supabase
      .from('object_versions')
      .update({
        version_status: 'REJECTED',
        decline_reason: reason,
        declined_by: declinedBy,
        updated_at: new Date().toISOString(),
      })
      .eq('id', versionId)
      .select('*')
      .single();

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send(data);
  });

  app.get('/api/v1/versions/:versionId/snapshot', async (req, reply) => {
    const { versionId } = req.params;
    const { data, error } = await supabase
      .from('object_versions')
      .select('snapshot_data')
      .eq('id', versionId)
      .single();

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send(data?.snapshot_data || {});
  });

  app.post('/api/v1/versions/:versionId/restore', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'versioning',
      action: 'restore',
      forbiddenMessage: 'Role cannot restore versions',
    });
    if (!actor) return;

    const { versionId } = req.params;

    const { data: current, error: currentErr } = await supabase
      .from('object_versions')
      .select('id, entity_type, entity_id')
      .eq('id', versionId)
      .single();
    if (currentErr) return sendError(reply, 500, 'DB_ERROR', currentErr.message);

    const { error: archiveErr } = await supabase
      .from('object_versions')
      .update({ version_status: 'PREVIOUS', updated_at: new Date().toISOString() })
      .eq('entity_type', current.entity_type)
      .eq('entity_id', current.entity_id)
      .eq('version_status', 'PENDING')
      .neq('id', versionId);
    if (archiveErr) return sendError(reply, 500, 'DB_ERROR', archiveErr.message);

    const { data, error } = await supabase
      .from('object_versions')
      .update({ version_status: 'PENDING', updated_at: new Date().toISOString() })
      .eq('id', versionId)
      .select('*')
      .single();

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    return reply.send(data);
  });
}
