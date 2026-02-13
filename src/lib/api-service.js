import { supabase } from './supabase';
import {
  mapProjectAggregate,
  mapBuildingFromDB,
  mapBlockDetailsFromDB,
  mapFloorFromDB,
  mapUnitFromDB,
  mapMopFromDB,
} from './db-mappers';
import { buildFloorList } from './floor-utils';
import { getBlocksList } from './utils';
import { floorKeyToVirtualId, SPECIAL_FLOOR_IDS } from './model-keys';
import { createProjectApi } from './api/project-api';
import { createWorkflowApi } from './api/workflow-api';
import { createRegistryApi } from './api/registry-api';
import { createVersionsApi } from './api/versions-api-factory';
import { normalizeProjectStatusFromDb, normalizeProjectStatusToDb } from './project-status';
import {
  createVirtualComplexCadastre,
  formatBuildingCadastre,
  formatComplexCadastre,
} from './cadastre';
import {
  generateProjectCode,
  generateBuildingCode,
  generateUnitCode,
  getBuildingPrefix,
  getUnitPrefix,
  getNextSequenceNumber,
} from './uj-identifier';

// ... (Оставляем существующие функции mapBuildingToDb, mapBlockToDb, mapBlockTypeToDb, mapDbTypeToUi без изменений) ...

// Вспомогательная функция для маппинга типов блоков
function mapBlockTypeToDB(uiType) {
  if (uiType === 'residential') return 'Ж';
  if (uiType === 'non_residential') return 'Н';
  if (uiType === 'parking') return 'Parking';
  if (uiType === 'infrastructure') return 'Infra';
  return uiType;
}

function mapDbTypeToUi(dbType) {
  if (dbType === 'Ж') return 'residential';
  if (dbType === 'Н') return 'non_residential';
  if (dbType === 'Parking') return 'parking';
  if (dbType === 'Infra') return 'infrastructure';
  return dbType;
}

function normalizeParkingTypeFromDb(parkingType) {
  if (parkingType === 'aboveground') return 'ground';
  return parkingType;
}

function normalizeParkingTypeToDb(parkingType) {
  if (parkingType === 'ground') return 'aboveground';
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

const normalizeDateInput = value => {
  if (value === '' || value === undefined) return null;
  return value;
};

const fetchAllPaged = async (queryFactory, pageSize = 1000) => {
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
};

// === UJ IDENTIFIER GENERATION ===

/**
 * Генерация UJ-кода для нового проекта
 * @param {string} scope - Scope ID
 * @returns {Promise<string>} UJ-код формата UJ000000
 */
const generateNextProjectCode = async scope => {
  const { data, error } = await supabase
    .from('projects')
    .select('uj_code')
    .eq('scope_id', scope)
    .not('uj_code', 'is', null)
    .order('uj_code', { ascending: false });

  if (error) throw error;

  const existingCodes = (data || []).map(p => p.uj_code).filter(Boolean);
  const nextNumber = getNextSequenceNumber(existingCodes, 'UJ');

  return generateProjectCode(nextNumber);
};

const extractBuildingSegment = code => {
  if (!code) return null;
  const str = String(code);
  const parts = str.split('-');
  return parts.length > 1 ? parts[parts.length - 1] : str;
};

const extractUnitSegment = code => {
  if (!code) return null;
  const str = String(code);
  const parts = str.split('-');
  return parts.length > 2 ? parts[parts.length - 1] : str;
};

/**
 * Генерация кода здания внутри проекта (сегмент ZD00)
 * @param {string} projectId - ID проекта (оставлен для совместимости вызова)
 * @param {string} category - Категория здания
 * @param {number} blocksCount - Количество блоков (для определения ZR/ZM)
 * @returns {Promise<string>} Код-сегмент формата ZD00
 */
  const generateNextBuildingCode = async (projectId, category, blocksCount = 0) => {
  const hasMultipleBlocks = blocksCount > 1;
  const prefix = getBuildingPrefix(category, hasMultipleBlocks);

  const { data, error } = await supabase
    .from('buildings')
    .select('building_code')
    .eq('project_id', projectId)
    .not('building_code', 'is', null);

  if (error) throw error;

 const existingCodes = (data || [])
    .map(b => extractBuildingSegment(b.building_code))
    .filter(Boolean);
  const nextNumber = getNextSequenceNumber(existingCodes, prefix);

  return generateBuildingCode(prefix, nextNumber);
};

const isBuildingCodeConflict = error =>
  error?.code === '23505' && String(error?.message || '').includes('idx_buildings_code');

/**
 * Генерация кода помещения внутри здания (сегмент EL000)
 * @param {string} buildingId - ID здания
 * @param {string} unitType - Тип помещения
 * @returns {Promise<string>} Код-сегмент формата EL000
 */
const generateNextUnitCode = async (buildingId, unitType) => {
  const prefix = getUnitPrefix(unitType);

  const { data: blocks, error: blocksErr } = await supabase
    .from('building_blocks')
    .select('id')
    .eq('building_id', buildingId);

  if (blocksErr) throw blocksErr;

  const blockIds = (blocks || []).map(b => b.id);
  if (blockIds.length === 0) return generateUnitCode(prefix, 1);

  const { data: floors, error: floorsErr } = await supabase
    .from('floors')
    .select('id')
    .in('block_id', blockIds);

  if (floorsErr) throw floorsErr;

  const floorIds = (floors || []).map(f => f.id);
  if (floorIds.length === 0) return generateUnitCode(prefix, 1);

  const { data: units, error: unitsErr } = await supabase
    .from('units')
    .select('unit_code')
    .in('floor_id', floorIds)
    .not('unit_code', 'is', null);

  if (unitsErr) throw unitsErr;

  const existingCodes = (units || [])
    .map(u => extractUnitSegment(u.unit_code))
    .filter(Boolean);
  const nextNumber = getNextSequenceNumber(existingCodes, prefix);

  return generateUnitCode(prefix, nextNumber);
};

const isUnitCodeConflict = error =>
  error?.code === '23505' && String(error?.message || '').includes('idx_units_code');

export const UPSERT_ON_CONFLICT = Object.freeze({
  projects: 'id',
  project_participants: 'id',
  project_documents: 'id',
  floors: 'id',
  entrance_matrix: 'block_id,floor_id,entrance_number',
  units: 'id',
  common_areas: 'id',
  basements: 'id',
  basement_parking_levels: 'basement_id,depth_level',
  application_steps: 'application_id,step_index',
  block_floor_markers: 'block_id,marker_key',
  block_construction: 'block_id',
  block_engineering: 'block_id',
});

const upsertWithConflict = (table, payload, options = {}) => {
  const conflict = UPSERT_ON_CONFLICT[table];
  if (!conflict) {
    throw new Error(`Missing onConflict mapping for table: ${table}`);
  }

  const { select, single } = options;
  const baseQuery = supabase.from(table).upsert(payload, { onConflict: conflict });

  if (single) {
    const selectedQuery = select ? baseQuery.select(select) : baseQuery.select();
    return selectedQuery.single();
  }

  if (select) {
    return baseQuery.select(select);
  }

  return baseQuery;
};

const syncFloorsForBlockFromDetails = async (building, currentBlock, buildingDetails) => {
  if (!building?.id || !currentBlock?.id) return;

  const desiredFloors = buildFloorList(building, currentBlock, buildingDetails);
  const desiredByKey = new Map();

  desiredFloors.forEach(f => {
    if (!f?.floorKey) return;
    desiredByKey.set(f.floorKey, {
      block_id: currentBlock.id,
      floor_key: f.floorKey,
      index: Number(f.index ?? 0),
      label: f.label || null,
      floor_type: f.type || 'residential',
      parent_floor_index: f.parentFloorIndex ?? null,
      basement_id: f.basementId ?? null,
      is_technical: !!f.flags?.isTechnical,
      is_commercial: !!f.flags?.isCommercial,
      is_stylobate: !!f.flags?.isStylobate,
      is_basement: !!f.flags?.isBasement,
      is_attic: !!f.flags?.isAttic,
      is_loft: !!f.flags?.isLoft,
      is_roof: !!f.flags?.isRoof,
      updated_at: new Date(),
    });
  });

  const { data: existingRows, error: existingErr } = await supabase
    .from('floors')
    .select('id, floor_key')
    .eq('block_id', currentBlock.id);

  if (existingErr) throw existingErr;

  const existingMap = new Map((existingRows || []).map(r => [r.floor_key, r]));
  const desiredKeys = new Set(desiredByKey.keys());
  const toDeleteIds = (existingRows || [])
    .filter(r => !desiredKeys.has(r.floor_key))
    .map(r => r.id);

  if (toDeleteIds.length) {
    const { error: delErr } = await supabase.from('floors').delete().in('id', toDeleteIds);
    if (delErr) throw delErr;
  }

  const upsertPayload = Array.from(desiredByKey.entries()).map(([floorKey, row]) => ({
    ...row,
    id: existingMap.get(floorKey)?.id || crypto.randomUUID(),
  }));

  if (upsertPayload.length) {
    const { error: upsertErr } = await upsertWithConflict('floors', upsertPayload);
    if (upsertErr) throw upsertErr;
  }
};

const VERSION_STATUS_FLOW = {
  PENDING: 'PENDING',
  CURRENT: 'CURRENT',
  REJECTED: 'REJECTED',
  PREVIOUS: 'PREVIOUS',
};

const VERSIONING_ENABLED = false;

const resolveTargetVersionStatus = appStatus => {
  if (appStatus === 'COMPLETED') return VERSION_STATUS_FLOW.CURRENT;
  if (appStatus === 'DECLINED') return VERSION_STATUS_FLOW.REJECTED;
  return VERSION_STATUS_FLOW.PENDING;
};

const collectProjectVersionEntities = async projectId => {
  const entities = [];

  const { data: projectRow } = await supabase.from('projects').select('*').eq('id', projectId).maybeSingle();
  if (projectRow) {
    entities.push({ entityType: 'project', entityId: projectRow.id, snapshotData: projectRow });
  }

  const { data: buildings = [] } = await supabase.from('buildings').select('*').eq('project_id', projectId);
  for (const row of buildings) {
    entities.push({ entityType: 'building', entityId: row.id, snapshotData: row });
  }
  const buildingIds = buildings.map(b => b.id);
  if (buildingIds.length === 0) return entities;

  const { data: blocks = [] } = await supabase.from('building_blocks').select('*').in('building_id', buildingIds);
  for (const row of blocks) {
    entities.push({ entityType: 'building_block', entityId: row.id, snapshotData: row });
  }

  const blockIds = blocks.map(b => b.id);
  if (blockIds.length === 0) return entities;

  const [
    { data: basements = [] },
    { data: floors = [] },
    { data: entrances = [] },
    { data: blockConstruction = [] },
    { data: blockEngineering = [] },
    { data: blockMarkers = [] },
    { data: entranceMatrix = [] },
  ] = await Promise.all([
    supabase.from('basements').select('*').in('building_id', buildingIds),
    supabase.from('floors').select('*').in('block_id', blockIds),
    supabase.from('entrances').select('*').in('block_id', blockIds),
    supabase.from('block_construction').select('*').in('block_id', blockIds),
    supabase.from('block_engineering').select('*').in('block_id', blockIds),
    supabase.from('block_floor_markers').select('*').in('block_id', blockIds),
    supabase.from('entrance_matrix').select('*').in('block_id', blockIds),
  ]);

  for (const row of basements) entities.push({ entityType: 'basement', entityId: row.id, snapshotData: row });
  for (const row of floors) entities.push({ entityType: 'floor', entityId: row.id, snapshotData: row });
  for (const row of entrances)
    entities.push({ entityType: 'entrance', entityId: row.id, snapshotData: row });
  for (const row of blockConstruction)
    entities.push({ entityType: 'block_construction', entityId: row.id, snapshotData: row });
  for (const row of blockEngineering)
    entities.push({ entityType: 'block_engineering', entityId: row.id, snapshotData: row });
  for (const row of blockMarkers)
    entities.push({ entityType: 'block_floor_marker', entityId: row.id, snapshotData: row });
  for (const row of entranceMatrix)
    entities.push({ entityType: 'entrance_matrix', entityId: row.id, snapshotData: row });

  const basementIds = basements.map(r => r.id);
  const floorIds = floors.map(r => r.id);

  const [
    { data: basementParkingLevels = [] },
    { data: units = [] },
    { data: commonAreas = [] },
  ] = await Promise.all([
    basementIds.length
      ? supabase.from('basement_parking_levels').select('*').in('basement_id', basementIds)
      : Promise.resolve({ data: [] }),
    floorIds.length ? supabase.from('units').select('*').in('floor_id', floorIds) : Promise.resolve({ data: [] }),
    floorIds.length
      ? supabase.from('common_areas').select('*').in('floor_id', floorIds)
      : Promise.resolve({ data: [] }),
  ]);

  for (const row of basementParkingLevels)
    entities.push({ entityType: 'basement_parking_level', entityId: row.id, snapshotData: row });
  for (const row of units) entities.push({ entityType: 'unit', entityId: row.id, snapshotData: row });
  for (const row of commonAreas)
    entities.push({ entityType: 'common_area', entityId: row.id, snapshotData: row });

  const unitIds = units.map(r => r.id);
  if (unitIds.length) {
    const { data: rooms = [] } = await supabase.from('rooms').select('*').in('unit_id', unitIds);
    for (const row of rooms) entities.push({ entityType: 'room', entityId: row.id, snapshotData: row });
  }

  return entities;
};

const createPendingVersionsForApplication = async ({ projectId, applicationId, createdBy = null }) => {
  if (!VERSIONING_ENABLED) return;

  const entities = await collectProjectVersionEntities(projectId);

  for (const entity of entities) {
        const { data: versions, error: versionsErr } = await supabase
      .from('object_versions')
      .select('id, version_number, version_status, snapshot_data')
      .eq('entity_type', entity.entityType)
      .eq('entity_id', entity.entityId)
      .order('version_number', { ascending: false });
    if (versionsErr) throw versionsErr;

    const existing = versions || [];
    const hasPending = existing.some(v => v.version_status === VERSION_STATUS_FLOW.PENDING);
    if (hasPending) continue;

    const latestCurrent = existing.find(v => v.version_status === VERSION_STATUS_FLOW.CURRENT);

        const { error: insertErr } = await supabase.from('object_versions').insert({
      entity_type: entity.entityType,
      entity_id: entity.entityId,
      version_number: (existing[0]?.version_number || 0) + 1,
      version_status: VERSION_STATUS_FLOW.PENDING,
      snapshot_data: latestCurrent?.snapshot_data || entity.snapshotData || {},
      created_by: createdBy,
      application_id: applicationId,
      updated_at: new Date().toISOString(),
    });
    if (insertErr) throw insertErr;
  }
};

const syncVersionStatusesByApplicationStatus = async ({ projectId, applicationId, appStatus }) => {
  if (!VERSIONING_ENABLED) return;

  const targetStatus = resolveTargetVersionStatus(appStatus);

  if (targetStatus === VERSION_STATUS_FLOW.PENDING) {
    await createPendingVersionsForApplication({ projectId, applicationId });
    return;
  }

  const entities = await collectProjectVersionEntities(projectId);

  for (const entity of entities) {
        const { data: versions, error: versionsErr } = await supabase
      .from('object_versions')
      .select('id, version_number, version_status')
      .eq('entity_type', entity.entityType)
      .eq('entity_id', entity.entityId)
      .order('version_number', { ascending: false });
    if (versionsErr) throw versionsErr;

    const list = versions || [];
    const pending = list.find(v => v.version_status === VERSION_STATUS_FLOW.PENDING);

    if (targetStatus === VERSION_STATUS_FLOW.CURRENT) {
            const { error: prevErr } = await supabase
        .from('object_versions')
        .update({ version_status: VERSION_STATUS_FLOW.PREVIOUS, updated_at: new Date().toISOString() })
        .eq('entity_type', entity.entityType)
        .eq('entity_id', entity.entityId)
        .eq('version_status', VERSION_STATUS_FLOW.CURRENT);
      if (prevErr) throw prevErr;

      if (pending) {
                const { error: currentErr } = await supabase
          .from('object_versions')
          .update({
            version_status: VERSION_STATUS_FLOW.CURRENT,
            decline_reason: null,
            declined_by: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', pending.id);
        if (currentErr) throw currentErr;
      }
      continue;
    }

    if (targetStatus === VERSION_STATUS_FLOW.REJECTED && pending) {
            const { error: rejectErr } = await supabase
        .from('object_versions')
        .update({ version_status: VERSION_STATUS_FLOW.REJECTED, updated_at: new Date().toISOString() })
        .eq('id', pending.id);
      if (rejectErr) throw rejectErr;
    }
  }
};

const LegacyApiService = {
  getSystemUsers: async () => {
    const { data, error } = await supabase
      .from('dict_system_users')
      .select('id, code, name, role, group_name, is_active, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;

    return (data || []).map(u => ({
      id: u.id,
      code: u.code,
      name: u.name,
      role: u.role,
      group: u.group_name || u.name,
      sortOrder: u.sort_order || 100,
    }));
  },

  // --- DASHBOARD & LISTS ---

  // src/lib/api-service.js

  // [UPDATED] Получить список проектов
  getProjectsList: async scope => {
    if (!scope) return [];

    const [projectsRes, appsRes] = await Promise.all([
      supabase
        .from('projects')
        // ДОБАВИЛИ: buildings(count) — это быстрый запрос количества без самих данных
        .select('id, uj_code, cadastre_number, name, region, address, construction_status, updated_at, created_at, buildings(count)')
        .eq('scope_id', scope)
        .order('updated_at', { ascending: false }),
      supabase
        .from('applications')
        .select('*')
        .eq('scope_id', scope)
        .order('updated_at', { ascending: false }),
    ]);

    if (projectsRes.error) throw projectsRes.error;
    if (appsRes.error) throw appsRes.error;

    const appsByProject = (appsRes.data || []).reduce((acc, app) => {
      if (!acc[app.project_id]) acc[app.project_id] = app;
      return acc;
    }, {});

    return (projectsRes.data || []).map(project => {
      const app = appsByProject[project.id];
      // Извлекаем количество зданий из ответа Supabase
      // project.buildings вернет массив [{ count: N }]
      const buildingsCount = project.buildings?.[0]?.count || 0;

      return {
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
        // СОЗДАЕМ "ВИРТУАЛЬНЫЙ" МАССИВ НУЖНОЙ ДЛИНЫ
        // UI компонент просто смотрит .length, ему не нужны реальные данные внутри
        composition: Array(buildingsCount).fill(1),
      };
    });
  },

  saveStepBlockStatuses: async ({ scope, projectId, stepIndex, statuses }) => {
    const { data: app, error: appErr } = await supabase
      .from('applications')
      .select('id')
      .eq('scope_id', scope)
      .eq('project_id', projectId)
      .maybeSingle();

    if (appErr) throw appErr;
    if (!app?.id) throw new Error('Заявка не найдена');

    const payload = {
      application_id: app.id,
      step_index: stepIndex,
      block_statuses: statuses || {},
      updated_at: new Date().toISOString(),
    };

    const { error } = await upsertWithConflict('application_steps', payload);
    if (error) throw error;

    return { applicationId: app.id, stepIndex, blockStatuses: payload.block_statuses };
  },

  // [NEW] Mock внешних заявок
  getExternalApplications: async () => {
    // Имитация задержки
    await new Promise(r => setTimeout(r, 500));
    return [
      {
        id: 'EXT-' + Math.floor(Math.random() * 10000),
        source: 'EPIGU',
        externalId: 'EP-2026-9912',
        applicant: 'ООО "Golden House"',
        submissionDate: new Date().toISOString(),
        cadastre: createVirtualComplexCadastre(),
        address: 'г. Ташкент, Шайхантахурский р-н, ул. Навои, 12',
        status: 'NEW',
      },
    ];
  },



  // --- WORK LOCK (защита от одновременного редактирования) ---
  acquireApplicationLock: async ({ scope, projectId, userName, userRole, ttlMinutes = 20 }) => {
    const { data: app, error } = await supabase
      .from('applications')
      .select('id')
      .eq('scope_id', scope)
      .eq('project_id', projectId)
      .maybeSingle();
    if (error) throw error;
    if (!app?.id) return { ok: false, reason: 'NOT_FOUND', message: 'Заявка не найдена' };

    const { data, error: rpcErr } = await supabase.rpc('acquire_application_lock', {
      p_application_id: app.id,
      p_owner_user_id: userName,
      p_owner_role: userRole,
      p_ttl_seconds: Math.max(60, Math.floor(ttlMinutes * 60)),
    });
    if (rpcErr) throw rpcErr;

    const row = Array.isArray(data) ? data[0] : data;
    return {
      ok: !!row?.ok,
      reason: row?.reason || null,
      message: row?.message || null,
      expiresAt: row?.expires_at || null,
      applicationId: app.id,
    };
  },

  refreshApplicationLock: async ({ applicationId, userName, ttlMinutes = 20 }) => {
    const { data, error } = await supabase.rpc('refresh_application_lock', {
      p_application_id: applicationId,
      p_owner_user_id: userName,
      p_ttl_seconds: Math.max(60, Math.floor(ttlMinutes * 60)),
    });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    return {
      ok: !!row?.ok,
      reason: row?.reason || null,
      message: row?.message || null,
      expiresAt: row?.expires_at || null,
    };
  },

  releaseApplicationLock: async ({ applicationId, userName }) => {
    if (!applicationId) return { ok: false };

    const { data, error } = await supabase.rpc('release_application_lock', {
      p_application_id: applicationId,
      p_owner_user_id: userName,
    });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    return {
      ok: !!row?.ok,
      reason: row?.reason || null,
      message: row?.message || null,
    };
  },

  // --- WORKFLOW & CREATION ---

  // [UPDATED] Создание проекта из заявки (Транзакция)
  createProjectFromApplication: async (scope, appData, user) => {
    if (!scope) throw new Error('No scope provided');

    // Бизнес-правило повторной подачи: если по ЖК уже есть активная заявка в работе,
    // новую повторную заявку принимать нельзя.
    if (appData?.reapplicationForProjectId || appData?.cadastre) {
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

      const { data: activeApps, error: activeAppsErr } = await activeAppsQuery;
      if (activeAppsErr) throw activeAppsErr;

      if ((activeApps || []).length > 0) {
        const active = activeApps[0];
        const activeProject = Array.isArray(active?.projects) ? active.projects[0] : active?.projects;
        const projectName = activeProject?.name || 'ЖК';
        throw new Error(
          `Отказ в принятии: по ${projectName} уже есть активное заявление в работе. Повторная подача отклонена.`
        );
      }
    }

    // Генерируем UJ-код для проекта
    const ujCode = await generateNextProjectCode(scope);

    // 1. Создаем проект
    const { data: project, error: pErr } = await supabase
      .from('projects')
      .insert({
        scope_id: scope,
        uj_code: ujCode,
        name: appData.applicant ? `ЖК от ${appData.applicant}` : 'Новый проект',
        address: appData.address,
        cadastre_number: formatComplexCadastre(appData.cadastre),
        construction_status: normalizeProjectStatusToDb('Проектный'),
      })
      .select()
      .single();

    if (pErr) throw pErr;

    // 2. Создаем заявку (связываем с проектом)
    const { data: createdApp, error: aErr } = await supabase
      .from('applications')
      .insert({
        project_id: project.id,
        scope_id: scope,
        internal_number: `INT-${Date.now().toString().slice(-6)}`,
        external_source: appData.source,
        external_id: appData.externalId,
        applicant: appData.applicant,
        submission_date: appData.submissionDate || new Date(),
        assignee_name: user.name,
        status: 'IN_PROGRESS', // Внешний статус
        workflow_substatus: 'DRAFT', // Подстатус — сразу в работу
        current_step: 0,
        current_stage: 1,
      })
      .select('id')
      .single();

    if (aErr) {
      // Rollback (удаляем проект, если заявка не создалась)
      await supabase.from('projects').delete().eq('id', project.id);
      throw aErr;
    }

    await createPendingVersionsForApplication({
      projectId: project.id,
      applicationId: createdApp?.id || null,
      createdBy: user?.name || null,
    });

    return project.id;
  },

  // Удаление проекта (Каскадное удаление настроено в БД, но для надежности можно и тут)
  deleteProject: async (scope, projectId) => {
    if (!scope) return;
    // Удаляем проект, заявка удалится каскадно (ON DELETE CASCADE)
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('scope_id', scope);
    if (error) throw error;
  },

  // --- LOAD FULL CONTEXT ---

  // [NEW] Полная загрузка контекста проекта (Замена RegistryService.getProjectMeta)
  getProjectFullData: async (scope, projectId) => {
    if (!scope || !projectId) return null;

    // 1. Загружаем заявку
    const { data: app, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('project_id', projectId)
      .eq('scope_id', scope)
      .maybeSingle();

    if (appError) {
      throw appError;
    }

    // 2. Параллельная загрузка таблиц
    const [pRes, partsRes, docsRes, buildingsRes, historyRes, stepsRes] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
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
      app?.id
        ? supabase
            .from('application_history')
            .select('*')
            .eq('application_id', app.id)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      app?.id
        ? supabase.from('application_steps').select('*').eq('application_id', app.id)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (pRes.error) throw pRes.error;

    // 3. Агрегация через маппер
    const fallbackApp = app || {
      id: null,
      updated_at: pRes.data.updated_at,
      internal_number: null,
      external_source: null,
      external_id: null,
      applicant: null,
      submission_date: null,
      status: 'IN_PROGRESS',
      workflow_substatus: 'DRAFT',
      assignee_name: null,
      current_step: 0,
      current_stage: 1,
      requested_decline_reason: null,
      requested_decline_step: null,
      requested_decline_by: null,
      requested_decline_at: null,
    };

    const projectData = mapProjectAggregate(
      pRes.data,
      fallbackApp,
      historyRes.data || [],
      stepsRes.data || [],
      partsRes.data || [],
      docsRes.data || []
    );

    // 4. Сборка composition и buildingDetails (нужно для UI конфигуратора)
    const composition = [];
    const buildingDetails = {};

    // Вспомогательные данные для маппинга деталей (нужно подтянуть этажи для определения коммерции/тех)
    // Это тяжелый запрос, но он нужен для инициализации buildingDetails в формате UI
    const buildingIds = (buildingsRes.data || []).map(b => b.id);
    const blockIds = (buildingsRes.data || []).flatMap(b =>
      (b.building_blocks || []).map(block => block.id)
    );

    const technicalFloorsMap = {};
    const commercialFloorsMap = {};
    const floorData = {};
    const entrancesData = {};
    const flatMatrix = {};
    const mopData = {};
    const parkingPlaces = {};

    if (blockIds.length > 0) {
      const { data: markerRows } = await supabase
        .from('block_floor_markers')
        .select('block_id, marker_key, is_technical, is_commercial')
        .in('block_id', blockIds);

      (markerRows || []).forEach(row => {
        if (row.is_technical) {
          if (!technicalFloorsMap[row.block_id]) technicalFloorsMap[row.block_id] = new Set();
          const parsed = parseInt(String(row.marker_key).replace('-Т', ''), 10);
          if (Number.isFinite(parsed)) technicalFloorsMap[row.block_id].add(parsed);
        }

        if (row.is_commercial) {
          if (!commercialFloorsMap[row.block_id]) commercialFloorsMap[row.block_id] = new Set();
          commercialFloorsMap[row.block_id].add(String(row.marker_key));
        }
      });
    }

    if (blockIds.length > 0) {
      // Оптимизация: берем только нужные поля
      const { data: floorsData } = await supabase
        .from('floors')
        .select(
          'id, block_id, floor_key, label, index, floor_type, height, area_proj, area_fact, is_duplex, parent_floor_index, is_commercial, is_technical, is_stylobate, is_basement, is_attic, is_loft, is_roof, basement_id'
        )
        .in('block_id', blockIds);

      const blockToBuilding = (buildingsRes.data || []).reduce((acc, building) => {
        (building.building_blocks || []).forEach(block => {
          acc[block.id] = building.id;
        });
        return acc;
      }, {});
      const floorContextById = {};

      (floorsData || []).forEach(row => {
        const buildingId = blockToBuilding[row.block_id];
        const virtualId = floorKeyToVirtualId(row.floor_key || `floor:${row.index}`) || row.id;
        if (buildingId) {
          const key = `${buildingId}_${row.block_id}_${virtualId}`;
          floorData[key] = {
            id: row.id,
            buildingId,
            blockId: row.block_id,
            floorKey: row.floor_key,
            label: row.label,
            index: row.index,
            sortOrder: row.index,
            type: row.floor_type,
            height: row.height,
            areaProj: row.area_proj,
            areaFact: row.area_fact,
            isDuplex: row.is_duplex,
            parentFloorIndex: row.parent_floor_index,
            basementId: row.basement_id,
            flags: {
              isTechnical: !!row.is_technical,
              isCommercial: !!row.is_commercial,
              isStylobate: !!row.is_stylobate,
              isBasement: !!row.is_basement,
              isAttic: !!row.is_attic,
              isLoft: !!row.is_loft,
              isRoof: !!row.is_roof,
            },
          };
          floorContextById[row.id] = { buildingId, blockId: row.block_id, virtualId };
          if (virtualId.startsWith('base_')) {
            parkingPlaces[`${buildingId}_${row.block_id}_${virtualId}_meta`] = { count: 0 };
          }
        }

        if (row.is_technical && row.parent_floor_index !== null) {
          if (!technicalFloorsMap[row.block_id]) technicalFloorsMap[row.block_id] = new Set();
          technicalFloorsMap[row.block_id].add(row.parent_floor_index);
        }

        if (row.is_commercial) {
          if (!commercialFloorsMap[row.block_id]) commercialFloorsMap[row.block_id] = new Set();

          let key = String(row.index);
          if (row.floor_type === 'basement' && row.basement_id) key = `basement_${row.basement_id}`;
          else if (row.floor_type === 'tsokol') key = 'tsokol';
          else if (row.is_attic) key = 'attic';
          else if (row.is_loft) key = 'loft';
          else if (row.is_roof) key = 'roof';
          else if (row.is_technical && row.parent_floor_index) key = `${row.parent_floor_index}-Т`;

          commercialFloorsMap[row.block_id].add(key);
        }
      });

      const [entrancesRes, matrixRes, unitsRes, mopsRes] = await Promise.all([
        supabase.from('entrances').select('id, block_id, number').in('block_id', blockIds),
        supabase
          .from('entrance_matrix')
          .select('floor_id, entrance_number, flats_count, commercial_count, mop_count')
          .in('block_id', blockIds),
        (async () => {
          const floorIds = (floorsData || []).map(f => f.id);
          if (!floorIds.length) return { data: [], error: null };

          const data = await fetchAllPaged((from, to) =>
            supabase
              .from('units')
              .select(
                'id, floor_id, entrance_id, number, unit_type, total_area, living_area, useful_area, rooms_count, status, cadastre_number'
              )
              .in('floor_id', floorIds)
              .order('id', { ascending: true })
              .range(from, to)
          );

          return { data, error: null };
        })(),
        supabase
          .from('common_areas')
          .select('id, floor_id, entrance_id, type, area')
          .in(
            'floor_id',
            (floorsData || []).map(f => f.id)
          ),
      ]);

      if (entrancesRes.error) throw entrancesRes.error;
      if (matrixRes.error) throw matrixRes.error;
      if (unitsRes.error) throw unitsRes.error;
      if (mopsRes.error) throw mopsRes.error;

      const entranceNumberById = (entrancesRes.data || []).reduce((acc, row) => {
        acc[row.id] = row.number;
        return acc;
      }, {});

      (matrixRes.data || []).forEach(row => {
        const floorCtx = floorContextById[row.floor_id];
        if (!floorCtx) return;
        const key = `${floorCtx.buildingId}_${floorCtx.blockId}_ent${row.entrance_number}_${floorCtx.virtualId}`;
        entrancesData[key] = {
          apts: row.flats_count ?? 0,
          units: row.commercial_count ?? 0,
          mopQty: row.mop_count ?? 0,
        };
      });

      (unitsRes.data || []).forEach(row => {
        const floorCtx = floorContextById[row.floor_id];
        if (!floorCtx) return;

        if (row.unit_type === 'parking_place') {
          const parkingKey = `${floorCtx.buildingId}_${floorCtx.blockId}_place_${row.id}`;
          parkingPlaces[parkingKey] = {
            id: row.id,
            floorId: row.floor_id,
            number: row.number,
            area: row.total_area,
          };
          const metaKey = `${floorCtx.buildingId}_${floorCtx.blockId}_${floorCtx.virtualId}_meta`;
          const current = parseInt(parkingPlaces[metaKey]?.count || 0, 10);
          parkingPlaces[metaKey] = { count: current + 1 };
          return;
        }

        flatMatrix[`${floorCtx.buildingId}_${floorCtx.blockId}_${row.id}`] = {
          id: row.id,
          blockId: floorCtx.blockId,
          buildingId: floorCtx.buildingId,
          floorId: row.floor_id,
          entranceId: row.entrance_id || null,
          entranceIndex: entranceNumberById[row.entrance_id] || null,
          num: row.number,
          number: row.number,
          type: row.unit_type,
          area: row.total_area,
          livingArea: row.living_area,
          usefulArea: row.useful_area,
          rooms: row.rooms_count,
          isSold: row.status === 'sold',
          cadastreNumber: row.cadastre_number,
        };
      });

      (mopsRes.data || []).forEach(row => {
        const floorCtx = floorContextById[row.floor_id];
        if (!floorCtx) return;
        const entranceNum = entranceNumberById[row.entrance_id] || 1;
        const key = `${floorCtx.buildingId}_${floorCtx.blockId}_e${entranceNum}_f${floorCtx.virtualId}_mops`;
        if (!mopData[key]) mopData[key] = [];
        mopData[key].push({
          id: row.id,
          floorId: row.floor_id,
          entranceId: row.entrance_id,
          type: row.type,
          area: row.area,
          height: row.height,
        });
      });
    }

    // Подгрузка подвалов для features
    let featuresMap = {};
    if (buildingIds.length > 0) {
      const { data: basementsData } = await supabase
        .from('basements')
        .select('id, building_id, block_id, depth, has_parking')
        .in('building_id', buildingIds);

      const basementIds = (basementsData || []).map(b => b.id);
      let parkingLevelsMap = {};

      if (basementIds.length > 0) {
        const { data: levelsData } = await supabase
          .from('basement_parking_levels')
          .select('basement_id, depth_level, is_enabled')
          .in('basement_id', basementIds);

        parkingLevelsMap = (levelsData || []).reduce((acc, level) => {
          if (!acc[level.basement_id]) acc[level.basement_id] = {};
          acc[level.basement_id][level.depth_level] = level.is_enabled;
          return acc;
        }, {});
      }

      (basementsData || []).forEach(base => {
        if (!featuresMap[base.building_id]) {
          featuresMap[base.building_id] = { basements: [], exploitableRoofs: [] };
        }
        featuresMap[base.building_id].basements.push({
          id: base.id,
          depth: base.depth,
          hasParking: base.has_parking,
          parkingLevels: parkingLevelsMap[base.id] || {},
          blocks: [base.block_id],
          buildingId: base.building_id,
          blockId: base.block_id,
        });
      });
    }

    // Сборка финальной структуры
    (buildingsRes.data || []).forEach(b => {
      composition.push(mapBuildingFromDB(b, b.building_blocks));

      b.building_blocks.forEach(block => {
        const uiKey = `${b.id}_${block.id}`;
        const mapped = mapBlockDetailsFromDB(b, block);
        const derivedTechnicalFloors = Array.from(technicalFloorsMap[block.id] || []);
        const derivedCommercialFloors = Array.from(commercialFloorsMap[block.id] || []);
        mapped.technicalFloors = mapped.technicalFloors?.length
          ? mapped.technicalFloors
          : derivedTechnicalFloors;
        mapped.commercialFloors = mapped.commercialFloors?.length
          ? mapped.commercialFloors
          : derivedCommercialFloors;
        buildingDetails[uiKey] = mapped;
      });

      if (featuresMap[b.id]) {
        buildingDetails[`${b.id}_features`] = featuresMap[b.id];
      }
    });

    return {
      ...projectData,
      composition,
      buildingDetails,
      floorData,
      entrancesData,
      flatMatrix,
      mopData,
      parkingPlaces,
    };
  },

  // --- PROJECT PASSPORT ---
  getProjectDetails: async projectId => {
    if (!projectId) return null;

    const [projectRes, partsRes, docsRes] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase.from('project_participants').select('*').eq('project_id', projectId),
      supabase
        .from('project_documents')
        .select('*')
        .eq('project_id', projectId)
        .order('doc_date', { ascending: false }),
    ]);

    if (projectRes.error) throw projectRes.error;
    if (partsRes.error) throw partsRes.error;
    if (docsRes.error) throw docsRes.error;

    const project = projectRes.data;

    return {
      complexInfo: {
        name: project.name,
        ujCode: project.uj_code,
        status: normalizeProjectStatusFromDb(project.construction_status),
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
      participants: (partsRes.data || []).reduce((acc, part) => {
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
    };
  },

  createProject: async (name, street = '', scope = 'shared_dev_env') => {
    const appData = {
      source: 'MANUAL',
      externalId: null,
      applicant: name,
      address: street,
      cadastre: '',
      submissionDate: new Date(),
    };

    const user = { name: 'System', role: 'admin' };
    return ApiService.createProjectFromApplication(scope, appData, user);
  },

  updateProjectInfo: async (projectId, info = {}, cadastreData = {}) => {
    if (!projectId) return null;

    const payload = {
      name: info.name,
      construction_status: normalizeProjectStatusToDb(info.status),
      region: info.region,
      district: info.district,
      address: info.street,
      landmark: info.landmark,
      date_start_project: normalizeDateInput(info.dateStartProject),
      date_end_project: normalizeDateInput(info.dateEndProject),
      date_start_fact: normalizeDateInput(info.dateStartFact),
      date_end_fact: normalizeDateInput(info.dateEndFact),
      cadastre_number: formatComplexCadastre(cadastreData.number),
      updated_at: new Date(),
    };

    const { data, error } = await supabase
      .from('projects')
      .update(payload)
      .eq('id', projectId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  upsertParticipant: async (projectId, role, data = {}) => {
    const payload = {
      id: data.id || crypto.randomUUID(),
      project_id: projectId,
      role,
      name: data.name || '',
      inn: data.inn || '',
    };

    const { data: result, error } = await supabase
      .from('project_participants')
      .upsert(payload, { onConflict: UPSERT_ON_CONFLICT.project_participants })
      .select()
      .single();

    if (error) throw error;
    return result;
  },

  upsertDocument: async (projectId, doc = {}) => {
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
      .upsert(payload, { onConflict: UPSERT_ON_CONFLICT.project_documents })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  deleteDocument: async id => {
    if (!id) return;
    const { error } = await supabase.from('project_documents').delete().eq('id', id);
    if (error) throw error;
  },

  // --- STANDARD API METHODS (Existing ones preserved) ---

  getBuildings: async projectId => {
    const { data, error } = await supabase
      .from('buildings')
      .select(`*, building_blocks (*)`)
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return data.map(b => ({
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
      resBlocks: b.building_blocks.filter(x => x.type === 'Ж').length,
      nonResBlocks: b.building_blocks.filter(x => x.type === 'Н').length,
      blocks: b.building_blocks
        .map(bl => ({
          id: bl.id,
          label: bl.label,
          type: mapDbTypeToUi(bl.type),
          originalType: bl.type,
          floorsCount: bl.floors_count,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    }));
  },

   createBuilding: async (projectId, buildingData, blocksData) => {
    const normalizedFields = sanitizeBuildingCategoryFields(buildingData);
    const blocksCount = Array.isArray(blocksData) ? blocksData.length : 0;
     const maxCodeRetries = 3;

    const { data: projectRow, error: projectErr } = await supabase
      .from('projects')
      .select('uj_code')
      .eq('id', projectId)
      .single();

    if (projectErr) throw projectErr;

    let building = null;
    let bError = null;

    for (let attempt = 1; attempt <= maxCodeRetries; attempt += 1) {
      const buildingSegment = await generateNextBuildingCode(
        projectId,
        buildingData.category,
        blocksCount
      );
      const buildingCode = projectRow?.uj_code
        ? `${projectRow.uj_code}-${buildingSegment}`
        : buildingSegment;

      const insertResult = await supabase
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
        .select()
        .single();

      building = insertResult.data;
      bError = insertResult.error;

      if (!bError) break;
      if (!isBuildingCodeConflict(bError) || attempt === maxCodeRetries) {
        throw bError;
      }
    }
   
    if (blocksData && blocksData.length > 0) {
      const blocksPayload = blocksData.map(b => ({
        id: b.id,
        building_id: building.id,
        label: b.label,
        type: mapBlockTypeToDB(b.type),
        floors_count: b.floorsCount || 0,
        floors_from: 1,
        floors_to: b.floorsCount || 1,
      }));

      const { error: blError } = await supabase.from('building_blocks').insert(blocksPayload);

      if (blError) throw blError;
    }
    return building;
  },

  updateBuilding: async (buildingId, buildingData) => {
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
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  deleteBuilding: async buildingId => {
    const { error } = await supabase.from('buildings').delete().eq('id', buildingId);
    if (error) throw error;
  },

  // --- FLOORS ---
  getFloors: async blockId => {
    const { data, error } = await supabase
      .from('floors')
      .select('*')
      .eq('block_id', blockId)
      .order('index', { ascending: true });
    if (error) throw error;
    return data.map(f => mapFloorFromDB(f, null, blockId));
  },

  updateFloor: async (floorId, updates) => {
    const payload = {};
    // Map UI keys to DB columns
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
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  generateFloors: async (blockId, floorsFrom, floorsTo, defaultType = 'residential') => {
    // ... (Без изменений, логика уже есть в вашем файле, просто оставляем)
    const { data: existing, error: fetchErr } = await supabase
      .from('floors')
      .select('id, index')
      .eq('block_id', blockId);
    if (fetchErr) throw fetchErr;
    const existingIndices = new Set(existing.map(e => e.index));
    const targetIndices = new Set();
    for (let i = floorsFrom; i <= floorsTo; i++) targetIndices.add(i);
    const toDeleteIds = existing.filter(e => !targetIndices.has(e.index)).map(e => e.id);
    const toCreateIndices = Array.from(targetIndices).filter(i => !existingIndices.has(i));

    if (toDeleteIds.length > 0) await supabase.from('floors').delete().in('id', toDeleteIds);
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
      await supabase.from('floors').insert(payload);
    }
  },

  // --- MATRIX ---
  getEntrances: async blockId => {
    const { data, error } = await supabase
      .from('entrances')
      .select('*')
      .eq('block_id', blockId)
      .order('number');
    if (error) throw error;
    return data;
  },

  getMatrix: async blockId => {
    const { data, error } = await supabase
      .from('entrance_matrix')
      .select('*')
      .eq('block_id', blockId);
    if (error) throw error;
    const map = {};
    data.forEach(row => {
      map[`${row.floor_id}_${row.entrance_number}`] = {
        id: row.id,
        apts: row.flats_count,
        units: row.commercial_count,
        mopQty: row.mop_count,
      };
    });
    return map;
  },

  upsertMatrixCell: async (blockId, floorId, entranceNumber, values) => {
    const payload = {
      block_id: blockId,
      floor_id: floorId,
      entrance_number: entranceNumber,
      updated_at: new Date(),
    };
    if (values.apts !== undefined) payload.flats_count = values.apts;
    if (values.units !== undefined) payload.commercial_count = values.units;
    if (values.mopQty !== undefined) payload.mop_count = values.mopQty;

    const { data, error } = await supabase
      .from('entrance_matrix')
      .upsert(payload, { onConflict: UPSERT_ON_CONFLICT.entrance_matrix })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  syncEntrances: async (blockId, count) => {
    const normalizedCount = Math.max(0, parseInt(count, 10) || 0);
    const { data: existing, error: existingErr } = await supabase
      .from('entrances')
      .select('id, number')
      .eq('block_id', blockId);
    if (existingErr) throw existingErr;

    const existingRows = existing || [];
    const existingNums = new Set(existingRows.map(e => e.number));
    const toCreate = [];
    for (let i = 1; i <= normalizedCount; i++) {
      if (!existingNums.has(i)) toCreate.push({ block_id: blockId, number: i });
    }
    if (toCreate.length > 0) {
      const { error: insertErr } = await supabase.from('entrances').insert(toCreate);
      if (insertErr) throw insertErr;
    }

    const toDeleteIds = existingRows.filter(e => e.number > normalizedCount).map(e => e.id);
    if (toDeleteIds.length > 0) {
      const { error: deleteErr } = await supabase.from('entrances').delete().in('id', toDeleteIds);
      if (deleteErr) throw deleteErr;
    }

    const { error: matrixTrimErr } = await supabase
      .from('entrance_matrix')
      .delete()
      .eq('block_id', blockId)
      .gt('entrance_number', normalizedCount);
    if (matrixTrimErr) throw matrixTrimErr;
  },

  // --- UNITS ---

  getUnitExplicationById: async unitId => {
    const { data, error } = await supabase
      .from('units')
      .select('*, rooms (*)')
      .eq('id', unitId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      unitCode: data.unit_code,
      number: data.number,
      num: data.number,
      type: data.unit_type,
      area: data.total_area,
      livingArea: data.living_area,
      usefulArea: data.useful_area,
      rooms: data.rooms_count,
      floorId: data.floor_id,
      entranceId: data.entrance_id,
      explication: (data.rooms || []).map(r => ({
        id: r.id,
        type: r.room_type,
        label: r.name,
        area: r.area,
        height: r.room_height,
        level: r.level,
      })),
    };
  },

  getUnits: async (blockId, options = {}) => {
    const extraFloorIds = Array.isArray(options?.floorIds) ? options.floorIds.filter(Boolean) : [];

    const { data: blockFloors, error: floorsError } = await supabase
      .from('floors')
      .select('id')
      .eq('block_id', blockId);

    if (floorsError) throw floorsError;

    const floorIds = Array.from(new Set([...(blockFloors || []).map(f => f.id), ...extraFloorIds]));
    if (floorIds.length === 0) return [];

    const { data: entrances, error: entrancesError } = await supabase
      .from('entrances')
      .select('id, number')
      .eq('block_id', blockId);
    if (entrancesError) throw entrancesError;

    const entranceMap = (entrances || []).reduce((acc, item) => {
      acc[item.id] = item.number;
      return acc;
    }, {});

    const units = await fetchAllPaged((from, to) =>
      supabase
        .from('units')
        .select('*, rooms (*)')
        .in('floor_id', floorIds)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
    );

    return units.map(u => ({
      ...mapUnitFromDB(u, u.rooms, entranceMap, null, blockId),
      entranceIndex: u.entrance_id ? entranceMap[u.entrance_id] || 1 : u.entrance_index || 1,
    }));
  },

  upsertUnit: async unitData => {
    let buildingId = null;
    let buildingCode = null;

    if (!unitData.unitCode && unitData.floorId && unitData.type) {
      const { data: floor } = await supabase
        .from('floors')
        .select('block_id')
        .eq('id', unitData.floorId)
        .single();

      if (floor?.block_id) {
        const { data: block } = await supabase
          .from('building_blocks')
          .select('building_id')
          .eq('id', floor.block_id)
          .single();

        if (block?.building_id) {
         buildingId = block.building_id;
          const { data: building } = await supabase
            .from('buildings')
            .select('building_code')
            .eq('id', block.building_id)
            .single();
          buildingCode = building?.building_code || null;
        }
      }
    }

    const unitId = unitData.id || crypto.randomUUID();
    const maxCodeRetries = 3;
    let savedUnit = null;

    for (let attempt = 1; attempt <= maxCodeRetries; attempt += 1) {
      const unitSegment =
        unitData.unitCode ||
        (buildingId && unitData.type ? await generateNextUnitCode(buildingId, unitData.type) : null);

      const unitCode =
        unitData.unitCode ||
        (buildingCode && unitSegment ? `${buildingCode}-${extractUnitSegment(unitSegment)}` : unitSegment);

      const unitPayload = {
        id: unitId,
        floor_id: unitData.floorId,
        entrance_id: unitData.entranceId,
        unit_code: unitCode,
        number: unitData.num || unitData.number,
        unit_type: unitData.type,
        total_area: unitData.area,
        living_area: unitData.livingArea || 0,
        useful_area: unitData.usefulArea || 0,
        rooms_count: unitData.rooms || 0,
        status: unitData.isSold ? 'sold' : 'free',
        updated_at: new Date(),
      };

      const upsertResult = await upsertWithConflict('units', unitPayload, {
        single: true,
      });

      savedUnit = upsertResult.data;
      const error = upsertResult.error;

      if (!error) break;

      const canRetryCode = !unitData.unitCode && buildingId && isUnitCodeConflict(error);
      if (!canRetryCode || attempt === maxCodeRetries) {
        throw error;
      }
    }

    if (!savedUnit) throw new Error('Unit upsert returned empty payload');

    // Sync rooms
    if (unitData.explication && Array.isArray(unitData.explication)) {
      await supabase.from('rooms').delete().eq('unit_id', savedUnit.id);
      if (unitData.explication.length > 0) {
        const roomsPayload = unitData.explication.map(r => ({
          id: r.id || crypto.randomUUID(),
          unit_id: savedUnit.id,
          room_type: r.type,
          area: r.area || 0,
          room_height: r.height === '' || r.height === undefined ? null : r.height,
          level: r.level || 1,
          name: r.label || '',
        }));
        await supabase.from('rooms').insert(roomsPayload);
      }
    }
    return savedUnit;
  },

  batchUpsertUnits: async unitsList => {
    const payload = unitsList.map(u => ({
      id: u.id || crypto.randomUUID(),
      floor_id: u.floorId,
      entrance_id: u.entranceId,
      number: u.num || u.number,
      unit_type: u.type,
      total_area: u.area || 0,
      status: 'free',
      updated_at: new Date(),
    }));
    const { error } = await upsertWithConflict('units', payload);
    if (error) throw error;
  },

  // --- COMMON AREAS ---
  getCommonAreas: async (blockId, options = {}) => {
    const extraFloorIds = Array.isArray(options?.floorIds) ? options.floorIds.filter(Boolean) : [];
    const { data: floors } = await supabase.from('floors').select('id').eq('block_id', blockId);
    const floorIds = Array.from(new Set([...(floors || []).map(f => f.id), ...extraFloorIds]));
    if (floorIds.length === 0) return [];
    const { data, error } = await supabase
      .from('common_areas')
      .select('*')
      .in('floor_id', floorIds);
    if (error) throw error;
    return data.map(m => mapMopFromDB(m, {}, null, blockId));
  },

  upsertCommonArea: async data => {
    const payload = {
      id: data.id || crypto.randomUUID(),
      floor_id: data.floorId,
      entrance_id: data.entranceId,
      type: data.type,
      area: data.area,
      height: data.height === "" || data.height === undefined ? null : data.height,
    };
    const { data: res, error } = await upsertWithConflict('common_areas', payload, {
      single: true,
    });
    if (error) throw error;
    return res;
  },

  deleteCommonArea: async id => {
    const { error } = await supabase.from('common_areas').delete().eq('id', id);
    if (error) throw error;
  },

  clearCommonAreas: async (blockId, options = {}) => {
    const extraFloorIds = Array.isArray(options?.floorIds) ? options.floorIds.filter(Boolean) : [];
    const { data: floors } = await supabase.from('floors').select('id').eq('block_id', blockId);
    const floorIds = Array.from(new Set([...(floors || []).map(f => f.id), ...extraFloorIds]));
    if (floorIds.length > 0) {
      await supabase.from('common_areas').delete().in('floor_id', floorIds);
    }
  },

  // --- PARKING & BASEMENTS ---
  getBasements: async projectId => {
    const { data: buildings } = await supabase
      .from('buildings')
      .select('id')
      .eq('project_id', projectId);
    const buildingIds = buildings.map(b => b.id);
    if (buildingIds.length === 0) return [];
    const { data, error } = await supabase
      .from('basements')
      .select(`*, basement_parking_levels (depth_level, is_enabled)`)
      .in('building_id', buildingIds);
    if (error) throw error;
    return data.map(b => ({
      id: b.id,
      buildingId: b.building_id,
      blockId: b.block_id,
      depth: b.depth,
      hasParking: b.has_parking,
      parkingLevels: (b.basement_parking_levels || []).reduce((acc, l) => {
        acc[l.depth_level] = l.is_enabled;
        return acc;
      }, {}),
    }));
  },

  toggleBasementLevel: async (basementId, level, isEnabled) => {
    const { error } = await supabase
      .from('basement_parking_levels')
      .upsert(
        { basement_id: basementId, depth_level: level, is_enabled: isEnabled },
        { onConflict: UPSERT_ON_CONFLICT.basement_parking_levels }
      );
    if (error) throw error;
  },

  getParkingCounts: async projectId => {
    // Получаем все здания проекта
    const { data: buildings } = await supabase
      .from('buildings')
      .select('id')
      .eq('project_id', projectId);
    const buildingIds = buildings.map(b => b.id);
    if (!buildingIds.length) return {};

    // Получаем все блоки
    const { data: blocks } = await supabase
      .from('building_blocks')
      .select('id')
      .in('building_id', buildingIds);
    const blockIds = blocks.map(b => b.id);
    if (!blockIds.length) return {};

    // Получаем этажи
    const { data: floors } = await supabase.from('floors').select('id').in('block_id', blockIds);
    const floorIds = floors.map(f => f.id);
    if (!floorIds.length) return {};

    // Считаем парковочные места
    const { data: units, error } = await supabase
      .from('units')
      .select('floor_id')
      .eq('unit_type', 'parking_place')
      .in('floor_id', floorIds);
    if (error) throw error;

    const counts = {};
    units.forEach(u => {
      counts[u.floor_id] = (counts[u.floor_id] || 0) + 1;
    });
    return counts;
  },

  syncParkingPlaces: async (floorId, targetCount, _buildingId) => {
    const { data: existing } = await supabase
      .from('units')
      .select('id, number')
      .eq('floor_id', floorId)
      .eq('unit_type', 'parking_place');

    const currentCount = existing.length;
    if (currentCount === targetCount) return;

    if (targetCount > currentCount) {
      const toAdd = targetCount - currentCount;
      const newUnits = [];
      for (let i = 1; i <= toAdd; i++) {
        newUnits.push({
          id: crypto.randomUUID(),
          floor_id: floorId,
          unit_type: 'parking_place',
          number: null,
          total_area: null,
          status: 'free',
        });
      }
      await supabase.from('units').insert(newUnits);
    } else {
      const sorted = existing.sort((a, b) => parseInt(b.number) - parseInt(a.number));
      const toDelete = sorted.slice(0, currentCount - targetCount).map(u => u.id);
      await supabase.from('units').delete().in('id', toDelete);
    }
  },

  // --- META & INTEGRATION ---
  getIntegrationStatus: async projectId => {
    const { data } = await supabase
      .from('applications')
      .select('integration_data')
      .eq('project_id', projectId)
      .single();
    return data?.integration_data || {};
  },

  updateIntegrationStatus: async (projectId, field, status) => {
    const { data: app } = await supabase
      .from('applications')
      .select('id, integration_data')
      .eq('project_id', projectId)
      .single();
    if (!app) return;
    const newData = { ...(app.integration_data || {}), [field]: status };
    await supabase.from('applications').update({ integration_data: newData }).eq('id', app.id);
  },

  updateBuildingCadastre: async (id, cadastre) => {
    if (!id) return;
    const { error } = await supabase
      .from('buildings')
      .update({ cadastre_number: formatBuildingCadastre(cadastre) })
      .eq('id', id);
    if (error) throw error;
  },

  updateUnitCadastre: async (id, cadastre) => {
    await supabase.from('units').update({ cadastre_number: cadastre }).eq('id', id);
  },



  declineApplication: async ({ applicationId, nextSubstatus, prevStatus, userName, reason }) => {
    const { error: appErr } = await supabase
      .from('applications')
      .update({
        status: 'DECLINED',
        workflow_substatus: nextSubstatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId);
    if (appErr) throw appErr;

    const { error: histErr } = await supabase.from('application_history').insert({
      application_id: applicationId,
      action: 'DECLINE',
      prev_status: prevStatus,
      next_status: 'DECLINED',
      user_name: userName,
      comment: reason,
    });
    if (histErr) throw histErr;
  },

  requestDecline: async ({ applicationId, reason, stepIndex, requestedBy }) => {
    const { error } = await supabase
      .from('applications')
      .update({
        workflow_substatus: 'PENDING_DECLINE',
        requested_decline_reason: reason,
        requested_decline_step: stepIndex,
        requested_decline_by: requestedBy,
        requested_decline_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId);
    if (error) throw error;
  },

  returnFromDecline: async ({ applicationId, userName, comment }) => {
    const { error: appErr } = await supabase
      .from('applications')
      .update({
        status: 'IN_PROGRESS',
        workflow_substatus: 'RETURNED_BY_MANAGER',
        requested_decline_reason: null,
        requested_decline_step: null,
        requested_decline_by: null,
        requested_decline_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId);
    if (appErr) throw appErr;

    const { error: histErr } = await supabase.from('application_history').insert({
      application_id: applicationId,
      action: 'RETURN_FROM_DECLINE',
      prev_status: 'IN_PROGRESS',
      next_status: 'IN_PROGRESS',
      user_name: userName,
      comment: comment || 'Возврат на доработку после запроса на отказ',
    });
    if (histErr) throw histErr;
  },

  assignTechnician: async ({ applicationId, assigneeName }) => {
    const { error } = await supabase
      .from('applications')
      .update({ assignee_name: assigneeName, updated_at: new Date().toISOString() })
      .eq('id', applicationId);
    if (error) throw error;
  },

  restoreApplication: async ({ applicationId, userName, comment }) => {
    const { error: appErr } = await supabase
      .from('applications')
      .update({
        status: 'IN_PROGRESS',
        workflow_substatus: 'DRAFT',
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId);
    if (appErr) throw appErr;

    const { error: histErr } = await supabase.from('application_history').insert({
      application_id: applicationId,
      action: 'RESTORE',
      prev_status: 'DECLINED',
      next_status: 'IN_PROGRESS',
      user_name: userName,
      comment: comment || 'Восстановление заявления',
    });
    if (histErr) throw histErr;
  },

  getVersions: async (entityType, entityId) => {
    if (!VERSIONING_ENABLED) return [];

    const { data, error } = await supabase
      .from('object_versions')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('version_number', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  createVersion: async ({ entityType, entityId, snapshotData, createdBy, applicationId }) => {
    if (!VERSIONING_ENABLED) return null;

    const { data: latest, error: latestErr } = await supabase
      .from('object_versions')
      .select('version_number')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestErr) throw latestErr;

    const { error: archiveInWorkError } = await supabase
      .from('object_versions')
      .update({ version_status: 'PREVIOUS', updated_at: new Date().toISOString() })
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('version_status', 'PENDING');
    if (archiveInWorkError) throw archiveInWorkError;

    const { data, error } = await supabase
      .from('object_versions')
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        version_number: (latest?.version_number || 0) + 1,
        version_status: 'PENDING',
        snapshot_data: snapshotData || {},
        created_by: createdBy || null,
        application_id: applicationId || null,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  approveVersion: async ({ versionId, approvedBy }) => {
    if (!VERSIONING_ENABLED) return null;

    const { data: current, error: currentErr } = await supabase
      .from('object_versions')
      .select('id, entity_type, entity_id')
      .eq('id', versionId)
      .single();
    if (currentErr) throw currentErr;

    const { error: archiveErr } = await supabase
      .from('object_versions')
      .update({ version_status: 'PREVIOUS', updated_at: new Date().toISOString() })
      .eq('entity_type', current.entity_type)
      .eq('entity_id', current.entity_id)
      .eq('version_status', 'CURRENT')
      .neq('id', versionId);
    if (archiveErr) throw archiveErr;

    const { data, error } = await supabase
      .from('object_versions')
      .update({
        version_status: 'CURRENT',
        approved_by: approvedBy || null,
        declined_by: null,
        decline_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', versionId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  declineVersion: async ({ versionId, reason, declinedBy }) => {
    if (!VERSIONING_ENABLED) return null;

    const { data, error } = await supabase
      .from('object_versions')
      .update({
        version_status: 'REJECTED',
        decline_reason: reason || null,
        declined_by: declinedBy || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', versionId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  getVersionSnapshot: async versionId => {
    if (!VERSIONING_ENABLED) return {};

    const { data, error } = await supabase
      .from('object_versions')
      .select('snapshot_data')
      .eq('id', versionId)
      .single();
    if (error) throw error;
    return data?.snapshot_data || {};
  },

  restoreVersion: async ({ versionId }) => {
    if (!VERSIONING_ENABLED) return null;

    const { data: current, error: currentErr } = await supabase
      .from('object_versions')
      .select('id, entity_type, entity_id')
      .eq('id', versionId)
      .single();
    if (currentErr) throw currentErr;

    const { error: archiveInWorkError } = await supabase
      .from('object_versions')
      .update({ version_status: 'PREVIOUS', updated_at: new Date().toISOString() })
      .eq('entity_type', current.entity_type)
      .eq('entity_id', current.entity_id)
      .eq('version_status', 'PENDING')
      .neq('id', versionId);
    if (archiveInWorkError) throw archiveInWorkError;

    const { data, error } = await supabase
      .from('object_versions')
      .update({ version_status: 'PENDING', updated_at: new Date().toISOString() })
      .eq('id', versionId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  getProjectFullRegistry: async projectId => {
    // Тяжелый запрос для сводной.
    // Можно оптимизировать RPC, но пока так:
    const { data: buildings } = await supabase
      .from('buildings')
      .select('*')
      .eq('project_id', projectId);
    if (!buildings || !buildings.length) return { buildings: [], units: [] };

    const bIds = buildings.map(b => b.id);
    const { data: blocks } = await supabase
      .from('building_blocks')
      .select('*')
      .in('building_id', bIds);
    const blIds = blocks.map(b => b.id);

    const { data: floors } = await supabase.from('floors').select('*').in('block_id', blIds);
    const fIds = (floors || []).map(f => f.id);

    const { data: entrances } = await supabase
      .from('entrances')
      .select('id, block_id, number')
      .in('block_id', blIds);

    const units = await fetchAllPaged((from, to) =>
      supabase
        .from('units')
        .select('*, rooms (*)')
        .in('floor_id', fIds)
        .order('id', { ascending: true })
        .range(from, to)
    );

    // Создаем маппинг для быстрого доступа к buildingCode через floor -> block -> building
    const floorToBlockMap = {};
    const blockToBuildingMap = {};
    const buildingCodeMap = {};

    (floors || []).forEach(f => {
      floorToBlockMap[f.id] = f.block_id;
    });

    (blocks || []).forEach(b => {
      blockToBuildingMap[b.id] = b.building_id;
    });

    (buildings || []).forEach(b => {
      buildingCodeMap[b.id] = b.building_code;
    });

    return {
      buildings: (buildings || []).map(b => ({
        ...b,
        label: b.label,
        houseNumber: b.house_number,
        buildingCode: b.building_code,
      })),
      blocks: (blocks || []).map(b => ({
        ...b,
        tabLabel: b.label,
        buildingId: b.building_id,
      })),
      floors: (floors || []).map(f => ({
        ...f,
        blockId: f.block_id,
        areaProj: f.area_proj,
        areaFact: f.area_fact,
      })),
      entrances: (entrances || []).map(e => ({
        id: e.id,
        blockId: e.block_id,
        number: e.number,
      })),
      units: (units || []).map(u => {
        // Получаем buildingId и buildingCode через цепочку floor -> block -> building
        const blockId = floorToBlockMap[u.floor_id];
        const buildingId = blockToBuildingMap[blockId];
        const buildingCode = buildingCodeMap[buildingId];

        return {
          id: u.id,
          unitCode: u.unit_code,
          number: u.number,
          num: u.number,
          type: u.unit_type,
          area: u.total_area,
          livingArea: u.living_area,
          usefulArea: u.useful_area,
          rooms: u.rooms_count,
          floorId: u.floor_id,
          entranceId: u.entrance_id,
          buildingId: buildingId,
          buildingCode: buildingCode,
          cadastreNumber: u.cadastre_number,
          explication: (u.rooms || []).map(r => ({
            id: r.id,
            type: r.room_type,
            label: r.name,
            area: r.area,
            height: r.room_height,
            level: r.level,
          })),
        };
      }),
    };
  },

  // --- META SAVE (ГЛОБАЛЬНОЕ СОХРАНЕНИЕ ИЗ КОНТЕКСТА) ---
  // Это аналог старого saveData из registry-service, адаптированный под Context
  // Он умеет сохранять "всё подряд", разбирая payload
  saveData: async (scope, projectId, payload) => {
    if (!scope) return;
    const { buildingSpecificData, ...generalData } = payload;
    const promises = [];
    const floorSyncTargets = [];
    const entranceSyncTargets = [];
    let versioningSyncInfo = null;

    // 1. Обновление Project/App Info
    if (generalData.complexInfo) {
      const ci = generalData.complexInfo;
      promises.push(
        supabase
          .from('projects')
          .update({
            name: ci.name,
            construction_status: normalizeProjectStatusToDb(ci.status),
            region: ci.region,
            district: ci.district,
            address: ci.street,
            date_start_project: normalizeDateInput(ci.dateStartProject),
            date_end_project: normalizeDateInput(ci.dateEndProject),
            date_start_fact: normalizeDateInput(ci.dateStartFact),
            date_end_fact: normalizeDateInput(ci.dateEndFact),
            updated_at: new Date(),
          })
          .eq('id', projectId)
      );
    }

    if (generalData.applicationInfo) {
      const ai = generalData.applicationInfo;

      // Находим заявку; если ее нет (частый кейс при миграции), создаем техническую запись,
      // чтобы Workflow (статус/шаги/история) продолжал корректно работать.
      const { data: appFound } = await supabase
        .from('applications')
        .select('id')
        .eq('project_id', projectId)
        .maybeSingle();

      let applicationId = appFound?.id || null;

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
            submission_date: new Date(),
            assignee_name: null,
            status: ai.status || 'IN_PROGRESS',
            workflow_substatus: ai.workflowSubstatus || 'DRAFT',
            current_step: ai.currentStepIndex ?? 0,
            current_stage: ai.currentStage ?? 1,
          })
          .select('id')
          .single();

        if (createAppError) throw createAppError;
        applicationId = createdApp?.id;
      }

      if (applicationId) {
        const appUpdate = {
          status: ai.status,
          current_step: ai.currentStepIndex,
          current_stage: ai.currentStage,
          updated_at: new Date(),
        };
        if (ai.workflowSubstatus !== undefined) {
          appUpdate.workflow_substatus = ai.workflowSubstatus;
        }
        if (ai.requestedDeclineReason !== undefined) {
          appUpdate.requested_decline_reason = ai.requestedDeclineReason;
        }
        if (ai.requestedDeclineStep !== undefined) {
          appUpdate.requested_decline_step = ai.requestedDeclineStep;
        }
        if (ai.requestedDeclineBy !== undefined) {
          appUpdate.requested_decline_by = ai.requestedDeclineBy;
        }
        if (ai.requestedDeclineAt !== undefined) {
          appUpdate.requested_decline_at = ai.requestedDeclineAt;
        }
        promises.push(
          supabase
            .from('applications')
            .update(appUpdate)
            .eq('id', applicationId)
        );

        // History & Steps
        if (ai.history && ai.history.length > 0) {
          const last = ai.history[0];
          const isFresh = new Date().getTime() - new Date(last.date).getTime() < 5000;
          if (isFresh) {
            promises.push(
              supabase.from('application_history').insert({
                application_id: applicationId,
                action: last.action,
                prev_status: last.prevStatus,
                next_status: last.nextStatus || ai.status,
                user_name: last.user,
                comment: last.comment,
                created_at: last.date,
              })
            );
          }
        }

        versioningSyncInfo = {
          applicationId,
          appStatus: ai.status,
          userName: ai.history?.[0]?.user || null,
        };

        if (ai.completedSteps) {
          const stepsPayload = ai.completedSteps.map(idx => ({
            application_id: applicationId,
            step_index: idx,
            is_completed: true,
          }));
          if (stepsPayload.length)
            promises.push(
              supabase
                .from('application_steps')
                .upsert(stepsPayload, { onConflict: UPSERT_ON_CONFLICT.application_steps })
            );
        }
      }
    }

    // 2. Building Details (Configs)
    // В новой схеме конфиги блоков живут в building_blocks и смежных таблицах.
    // Payload из контекста приходит в виде "buildingDetails": { "bId_blId": {...} }
    if (generalData.buildingDetails) {
      for (const [key, details] of Object.entries(generalData.buildingDetails)) {
        if (key.includes('_features')) {
          // Обработка подвалов (basements)
          const buildingId = key.replace('_features', '');
          const basements = details.basements || [];
          for (const base of basements) {
            if (base.id && base.depth) {
              promises.push(
                supabase.from('basements').upsert(
                  {
                    id: base.id,
                    building_id: buildingId,
                    block_id: base.blockId || (base.blocks ? base.blocks[0] : null), // Привязка к блоку
                    depth: parseInt(base.depth),
                    has_parking: !!base.hasParking,
                  },
                  { onConflict: UPSERT_ON_CONFLICT.basements }
                )
              );
              // Уровни паркинга
              if (base.parkingLevels) {
                const levels = Object.entries(base.parkingLevels).map(([lvl, enabled]) => ({
                  basement_id: base.id,
                  depth_level: parseInt(lvl),
                  is_enabled: enabled,
                }));
                if (levels.length)
                  promises.push(
                    supabase
                      .from('basement_parking_levels')
                      .upsert(levels, { onConflict: UPSERT_ON_CONFLICT.basement_parking_levels })
                  );
              }
            }
          }
          continue;
        }

        // key = "buildingId_blockId"
        const parts = key.split('_');
        const blockId = parts[parts.length - 1]; // UUID is last
        // Проверка на валидный UUID
        if (blockId && blockId.length === 36) {
          const buildingId = parts[0];
          const blockUpdate = {
            floors_count: details.floorsCount,
            entrances_count: details.entrances || details.inputs,
            elevators_count: details.elevators,
            vehicle_entries: details.vehicleEntries,
            levels_depth: details.levelsDepth,
            light_structure_type: details.lightStructureType,
            parent_blocks: details.parentBlocks || [],
            floors_from: details.floorsFrom,
            floors_to: details.floorsTo,
            has_basement: details.hasBasementFloor,
            has_attic: details.hasAttic,
            has_loft: details.hasLoft,
            has_roof_expl: details.hasExploitableRoof,
            has_custom_address: details.hasCustomAddress,
            custom_house_number: details.customHouseNumber,
          };
          promises.push(supabase.from('building_blocks').update(blockUpdate).eq('id', blockId));
          floorSyncTargets.push({ buildingId, blockId });

          const desiredEntrancesRaw = details.entrances ?? details.inputs;
          const desiredEntrances = parseInt(desiredEntrancesRaw, 10);
          if (Number.isFinite(desiredEntrances) && desiredEntrances > 0) {
            entranceSyncTargets.push({ blockId, count: desiredEntrances });
          }

          const markerTechSet = new Set(
            (details.technicalFloors || [])
              .map(v => Number(v))
              .filter(v => Number.isFinite(v))
              .map(v => String(v))
          );
          const markerCommSet = new Set((details.commercialFloors || []).map(v => String(v)));

          const markerPayload = Array.from(new Set([...markerTechSet, ...markerCommSet])).map(
            markerKey => ({
              block_id: blockId,
              marker_key: markerKey,
              marker_type: markerKey.startsWith('basement_')
                ? 'basement'
                : markerKey.includes('-Т')
                  ? 'technical'
                  : SPECIAL_FLOOR_IDS.includes(markerKey)
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
              updated_at: new Date(),
            })
          );

          promises.push(supabase.from('block_floor_markers').delete().eq('block_id', blockId));
          if (markerPayload.length) {
            promises.push(
              supabase
                .from('block_floor_markers')
                .upsert(markerPayload, { onConflict: UPSERT_ON_CONFLICT.block_floor_markers })
            );
          }

          if (details.foundation || details.walls) {
            promises.push(
              supabase.from('block_construction').upsert(
                {
                  block_id: blockId,
                  foundation: details.foundation,
                  walls: details.walls,
                  slabs: details.slabs,
                  roof: details.roof,
                  seismicity: details.seismicity,
                },
                { onConflict: UPSERT_ON_CONFLICT.block_engineering }
              )
            );
          }
          if (details.engineering) {
            promises.push(
              supabase.from('block_engineering').upsert(
                {
                  block_id: blockId,
                  has_electricity: details.engineering.electricity,
                  has_water: details.engineering.hvs,
                  has_sewerage: details.engineering.sewerage,
                  has_gas: details.engineering.gas,
                  has_heating: details.engineering.heating,
                  // ... map others
                },
                { onConflict: UPSERT_ON_CONFLICT.block_engineering }
              )
            );
          }
        }
      }
    }

    // 3. Building Specific Data (Matrices saved via separate keys)
    // В новой архитектуре мы стараемся сохранять матрицы сразу (debounce),
    // но если Context накопил изменения, они придут сюда.
    if (buildingSpecificData) {
      const matrixPromises = [];

      const parseFloorKey = key => {
        // Формат: {buildingId}_{blockId}_{virtualFloorId}
        const parts = String(key || '').split('_');
        if (parts.length < 3) return null;
        return {
          buildingId: parts[0],
          blockId: parts[1],
          virtualId: parts.slice(2).join('_'),
        };
      };

      const parseEntranceKey = key => {
        // Формат: {buildingId}_{blockId}_ent{n}_{virtualFloorId}
        const match = String(key || '').match(/^([^_]+)_([^_]+)_ent(\d+)_(.+)$/);
        if (!match) return null;
        return {
          buildingId: match[1],
          blockId: match[2],
          entranceNumber: parseInt(match[3], 10),
          virtualId: match[4],
        };
      };

      for (const [buildingId, buildingPayload] of Object.entries(buildingSpecificData)) {
        const floorData = buildingPayload?.floorData || {};
        const entrancesData = buildingPayload?.entrancesData || {};

        const floorEntries = Object.entries(floorData).filter(([key]) =>
          key.startsWith(`${buildingId}_`)
        );
        const entranceEntries = Object.entries(entrancesData).filter(([key]) =>
          key.startsWith(`${buildingId}_`)
        );

        if (floorEntries.length === 0 && entranceEntries.length === 0) continue;

        const relatedBlockIds = new Set();
        floorEntries.forEach(([key]) => {
          const parsed = parseFloorKey(key);
          if (parsed?.blockId) relatedBlockIds.add(parsed.blockId);
        });
        entranceEntries.forEach(([key]) => {
          const parsed = parseEntranceKey(key);
          if (parsed?.blockId) relatedBlockIds.add(parsed.blockId);
        });

        if (relatedBlockIds.size === 0) continue;

        const { data: floorsRows, error: floorsErr } = await supabase
          .from('floors')
          .select('id, block_id, floor_key, index')
          .in('block_id', Array.from(relatedBlockIds));
        if (floorsErr) throw floorsErr;

        const floorIdByVirtual = new Map();
        (floorsRows || []).forEach(row => {
          const virtualId = floorKeyToVirtualId(row.floor_key || `floor:${row.index}`) || row.id;
          floorIdByVirtual.set(`${row.block_id}|${virtualId}`, row.id);
        });

        floorEntries.forEach(([key, floor]) => {
          const parsed = parseFloorKey(key);
          if (!parsed) return;
          const floorId = floorIdByVirtual.get(`${parsed.blockId}|${parsed.virtualId}`);
          if (!floorId) return;

          const updatePayload = {};
          if (floor?.height !== undefined) updatePayload.height = floor.height;
          if (floor?.areaProj !== undefined) updatePayload.area_proj = floor.areaProj;
          if (floor?.areaFact !== undefined) updatePayload.area_fact = floor.areaFact;
          if (floor?.isDuplex !== undefined) updatePayload.is_duplex = !!floor.isDuplex;
          if (floor?.label !== undefined) updatePayload.label = floor.label;
          if (floor?.type !== undefined) updatePayload.floor_type = floor.type;
          if (floor?.flags?.isTechnical !== undefined)
            updatePayload.is_technical = !!floor.flags.isTechnical;
          if (floor?.flags?.isCommercial !== undefined)
            updatePayload.is_commercial = !!floor.flags.isCommercial;
          if (floor?.flags?.isStylobate !== undefined)
            updatePayload.is_stylobate = !!floor.flags.isStylobate;
          if (floor?.flags?.isBasement !== undefined)
            updatePayload.is_basement = !!floor.flags.isBasement;
          if (floor?.flags?.isAttic !== undefined) updatePayload.is_attic = !!floor.flags.isAttic;
          if (floor?.flags?.isLoft !== undefined) updatePayload.is_loft = !!floor.flags.isLoft;
          if (floor?.flags?.isRoof !== undefined) updatePayload.is_roof = !!floor.flags.isRoof;

          if (Object.keys(updatePayload).length > 0) {
            matrixPromises.push(supabase.from('floors').update(updatePayload).eq('id', floorId));
          }
        });

        entranceEntries.forEach(([key, entry]) => {
          const parsed = parseEntranceKey(key);
          if (!parsed || !Number.isFinite(parsed.entranceNumber)) return;

          const floorId = floorIdByVirtual.get(`${parsed.blockId}|${parsed.virtualId}`);
          if (!floorId) return;

          matrixPromises.push(
            supabase.from('entrance_matrix').upsert(
              {
                block_id: parsed.blockId,
                floor_id: floorId,
                entrance_number: parsed.entranceNumber,
                flats_count: parseInt(entry?.apts || 0, 10) || 0,
                commercial_count: parseInt(entry?.units || 0, 10) || 0,
                mop_count: parseInt(entry?.mopQty || 0, 10) || 0,
                updated_at: new Date(),
              },
              { onConflict: UPSERT_ON_CONFLICT.entrance_matrix }
            )
          );
        });
      }

      if (matrixPromises.length > 0) {
        const matrixResults = await Promise.all(matrixPromises);
        const matrixError = matrixResults.find(r => r?.error)?.error;
        if (matrixError) throw matrixError;
      }
    }

    await Promise.all(promises);

    if (entranceSyncTargets.length > 0) {
      const uniqueEntranceTargets = Array.from(
        new Map(entranceSyncTargets.map(item => [item.blockId, item])).values()
      );
      for (const target of uniqueEntranceTargets) {
        await ApiService.syncEntrances(target.blockId, target.count);
      }
    }

    if (floorSyncTargets.length > 0 && generalData.buildingDetails) {
      const uniqueBuildingIds = Array.from(new Set(floorSyncTargets.map(t => t.buildingId)));

      const { data: buildingsRows, error: buildingsErr } = await supabase
        .from('buildings')
        .select('id, category, house_number, parking_type, construction_type')
        .in('id', uniqueBuildingIds);
      if (buildingsErr) throw buildingsErr;

      const { data: blocksRows, error: blocksErr } = await supabase
        .from('building_blocks')
        .select('id, building_id, label, type')
        .in('building_id', uniqueBuildingIds);
      if (blocksErr) throw blocksErr;

      const blocksByBuilding = (blocksRows || []).reduce((acc, row) => {
        if (!acc[row.building_id]) acc[row.building_id] = [];
        acc[row.building_id].push({
          id: row.id,
          label: row.label,
          type: mapDbTypeToUi(row.type),
        });
        return acc;
      }, {});

      const buildingMap = (buildingsRows || []).reduce((acc, row) => {
        acc[row.id] = {
          id: row.id,
          category: row.category,
          houseNumber: row.house_number,
          parkingType: normalizeParkingTypeFromDb(row.parking_type),
          constructionType: normalizeParkingConstructionFromDb(row.construction_type),
          blocks: blocksByBuilding[row.id] || [],
        };
        return acc;
      }, {});

      for (const target of floorSyncTargets) {
        const building = buildingMap[target.buildingId];
        if (!building) continue;
        const blocksList = getBlocksList(building, generalData.buildingDetails || {});
        const currentBlock = blocksList.find(b => b.id === target.blockId);
        if (!currentBlock) continue;
        await syncFloorsForBlockFromDetails(
          building,
          currentBlock,
          generalData.buildingDetails || {}
        );
      }
    }

    if (versioningSyncInfo?.applicationId && versioningSyncInfo?.appStatus) {
      await syncVersionStatusesByApplicationStatus({
        projectId,
        applicationId: versioningSyncInfo.applicationId,
        appStatus: versioningSyncInfo.appStatus,
      });
    }
  },
};

export const ApiService = {
  ...createProjectApi(LegacyApiService),
  ...createWorkflowApi(LegacyApiService),
  ...createRegistryApi(LegacyApiService),
  ...createVersionsApi(LegacyApiService),
  saveData: LegacyApiService.saveData,
  saveStepBlockStatuses: LegacyApiService.saveStepBlockStatuses,
  getUnitExplicationById: LegacyApiService.getUnitExplicationById,
};