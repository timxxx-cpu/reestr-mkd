import {
  mapProjectAggregate,
  mapBuildingFromDB,
  mapBlockDetailsFromDB,
  mapFloorFromDB,
  mapUnitFromDB,
  mapMopFromDB,
} from './db-mappers';
import { createProjectApi } from './api/project-api';
import { createWorkflowApi } from './api/workflow-api';
import { createRegistryApi } from './api/registry-api';
import { createVersionsApi } from './api/versions-api-factory';
import { BffClient } from './bff-client';
import { AuthService } from './auth-service';

const resolveActor = (actor = {}) => {
  const currentUser = AuthService.getCurrentUser?.() || null;

  return {
    userName: actor.userName || currentUser?.name || currentUser?.displayName || currentUser?.email || currentUser?.id || 'unknown',
    userRole: actor.userRole || currentUser?.role || 'technician',
  };
};


const requireBffEnabled = operation => {
  if (!BffClient.isEnabled()) {
    throw new Error(`BFF backend is required for operation: ${operation}`);
  }
};

const createIdempotencyKey = (operation, scopeParts = []) => {
  const normalizedScope = scopeParts
    .filter(Boolean)
    .map(part => String(part).trim())
    .join(':');

  const suffix = typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return normalizedScope ? `${operation}:${normalizedScope}:${suffix}` : `${operation}:${suffix}`;
};

const LegacyApiService = {
  getSystemUsers: async () => {
    const data = await BffClient.getSystemUsers();

    return (data || []).map(u => ({
      id: u.id,
      code: u.code,
      name: u.name,
      role: u.role,
      group: u.group_name || u.name,
      sortOrder: u.sort_order || 100,
    }));
  },

  // ... дальше идет getProjectsList ...

  // --- DASHBOARD & LISTS ---

  // src/lib/api-service.js

  // [UPDATED] Получить список проектов
  getProjectsPage: async (scope, options = {}) => {
    if (!scope) {
      return {
        items: [],
        page: Number(options?.page || 1),
        limit: Number(options?.limit || 50),
        total: 0,
        totalPages: 0,
      };
    }

    const response = await BffClient.getProjectsList({ scope, ...options });
    if (Array.isArray(response)) {
      const page = Number(options?.page || 1);
      const limit = Number(options?.limit || response.length || 1);
      return {
        items: response,
        page,
        limit,
        total: response.length,
        totalPages: response.length > 0 ? Math.ceil(response.length / Math.max(limit, 1)) : 0,
      };
    }

    return {
      items: Array.isArray(response?.items) ? response.items : [],
      page: Number(response?.page || options?.page || 1),
      limit: Number(response?.limit || options?.limit || 50),
      total: Number(response?.total || 0),
      totalPages: Number(response?.totalPages || 0),
    };
  },

  getProjectsList: async (scope, options = {}) => {
    const pageData = await LegacyApiService.getProjectsPage(scope, options);
    return pageData.items;
  },

/**
   * @param {Object} [params]
   * @param {string} [params.scope]
   * @param {string} [params.assignee]
   */
  getProjectsSummaryCounts: async ({ scope, assignee } = {}) => {
    if (!scope) {
      return {
        work: 0,
        review: 0,
        integration: 0,
        pendingDecline: 0,
        declined: 0,
        registryApplications: 0,
        registryComplexes: 0,
      };
    }

    return BffClient.getProjectsSummaryCounts({ scope, assignee });
  },

  saveStepBlockStatuses: async ({ scope, projectId, stepIndex, statuses }) => {
    requireBffEnabled('project.saveStepBlockStatuses');

    const resolvedActor = resolveActor({});
    return BffClient.saveStepBlockStatuses({
      scope,
      projectId,
      stepIndex,
      statuses,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  validateStepCompletionViaBff: async ({ scope, projectId, stepId }) => {
    requireBffEnabled('project.validateStepCompletion');

    const resolvedActor = resolveActor({});
    return BffClient.validateProjectStep({
      scope,
      projectId,
      stepId,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  getExternalApplications: async scope => {
    requireBffEnabled('project.getExternalApplications');
    return BffClient.getExternalApplications({ scope });
  },

  // --- WORK LOCK (защита от одновременного редактирования) ---
 acquireApplicationLock: async ({ scope, projectId, userName, userRole, ttlMinutes = 20 }) => {
    requireBffEnabled('locks.acquireApplicationLock');

    const res = await BffClient.resolveApplicationId({ projectId, scope });
    if (!res?.applicationId) return { ok: false, reason: 'NOT_FOUND', message: 'Заявка не найдена' };

    const response = await BffClient.acquireApplicationLock({
      applicationId: res.applicationId,
      userName,
      userRole,
      ttlMinutes,
    });
    return { ...response, applicationId: res.applicationId };
  },


  refreshApplicationLock: async ({ applicationId, userName, userRole = 'technician', ttlMinutes = 20 }) => {
    requireBffEnabled('locks.refreshApplicationLock');
    return BffClient.refreshApplicationLock({ applicationId, userName, userRole, ttlMinutes });
  },


  releaseApplicationLock: async ({ applicationId, userName, userRole = 'technician' }) => {
    if (!applicationId) return { ok: false };

    requireBffEnabled('locks.releaseApplicationLock');
    return BffClient.releaseApplicationLock({ applicationId, userName, userRole });
  },


  completeWorkflowStepViaBff: async ({ applicationId, stepIndex, comment, userName, userRole, idempotencyKey }) => {
    if (!BffClient.isEnabled()) return null;
    return BffClient.completeStep({
      applicationId,
      stepIndex,
      comment,
      userName,
      userRole,
      idempotencyKey: idempotencyKey || createIdempotencyKey('workflow-complete-step', [applicationId, stepIndex]),
    });
  },


  rollbackWorkflowStepViaBff: async ({ applicationId, reason, userName, userRole, idempotencyKey }) => {
    if (!BffClient.isEnabled()) return null;
    return BffClient.rollbackStep({
      applicationId,
      reason,
      userName,
      userRole,
      idempotencyKey: idempotencyKey || createIdempotencyKey('workflow-rollback-step', [applicationId]),
    });
  },

  reviewWorkflowStageViaBff: async ({ applicationId, action, comment, userName, userRole, idempotencyKey }) => {
    if (!BffClient.isEnabled()) return null;
    if (action === 'APPROVE') {
      return BffClient.reviewApprove({
        applicationId,
        comment,
        userName,
        userRole,
        idempotencyKey: idempotencyKey || createIdempotencyKey('workflow-review-approve', [applicationId]),
      });
    }
    return BffClient.reviewReject({
      applicationId,
      reason: comment,
      userName,
      userRole,
      idempotencyKey: idempotencyKey || createIdempotencyKey('workflow-review-reject', [applicationId]),
    });
  },


  requestDeclineViaBff: async ({ applicationId, reason, stepIndex, userName, userRole, idempotencyKey }) => {
    if (!BffClient.isEnabled()) return null;
    return BffClient.requestDecline({
      applicationId,
      reason,
      stepIndex,
      userName,
      userRole,
      idempotencyKey: idempotencyKey || createIdempotencyKey('workflow-request-decline', [applicationId, stepIndex]),
    });
  },

  declineApplicationViaBff: async ({ applicationId, reason, userName, userRole, idempotencyKey }) => {
    if (!BffClient.isEnabled()) return null;
    return BffClient.declineApplication({
      applicationId,
      reason,
      userName,
      userRole,
      idempotencyKey: idempotencyKey || createIdempotencyKey('workflow-decline', [applicationId]),
    });
  },

  returnFromDeclineViaBff: async ({ applicationId, comment, userName, userRole, idempotencyKey }) => {
    if (!BffClient.isEnabled()) return null;
    return BffClient.returnFromDecline({
      applicationId,
      comment,
      userName,
      userRole,
      idempotencyKey: idempotencyKey || createIdempotencyKey('workflow-return-from-decline', [applicationId]),
    });
  },

  restoreApplicationViaBff: async ({ applicationId, comment, userName, userRole, idempotencyKey }) => {
    if (!BffClient.isEnabled()) return null;
    return BffClient.restoreApplication({
      applicationId,
      comment,
      userName,
      userRole,
      idempotencyKey: idempotencyKey || createIdempotencyKey('workflow-restore', [applicationId]),
    });
  },

  // --- WORKFLOW & CREATION ---

  // [UPDATED] Создание проекта из заявки (Транзакция)
  createProjectFromApplication: async (scope, appData, user) => {
    if (!scope) throw new Error('No scope provided');
    requireBffEnabled('project.createProjectFromApplication');

    const resolvedActor = resolveActor({
      userName: user?.name,
      userRole: user?.role,
    });

    const response = await BffClient.createProjectFromApplication({
      scope,
      appData,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
      idempotencyKey: createIdempotencyKey('project-init-from-application', [scope, appData?.externalId || appData?.id || appData?.cadastre]),
    });

    return response?.projectId;
  },

  // Удаление проекта (Каскадное удаление настроено в БД, но для надежности можно и тут)
  deleteProject: async (scope, projectId, actor = {}) => {
    if (!scope) return;
    requireBffEnabled('project.deleteProject');

    const resolvedActor = resolveActor(actor);
    return BffClient.deleteProject({
      scope,
      projectId,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  // --- LOAD FULL CONTEXT ---

  // [NEW] Полная загрузка контекста проекта (Замена RegistryService.getProjectMeta)
  getProjectFullData: async (scope, projectId) => {
    if (!scope || !projectId) return null;
    requireBffEnabled('project.getProjectFullData');

    const context = await BffClient.getProjectContext({ scope, projectId });
    const app = context.application || null;
    const pRes = { data: context.project, error: null };
    const partsRes = { data: context.participants || [], error: null };
    const docsRes = { data: context.documents || [], error: null };
    const buildingsRes = { data: context.buildings || [], error: null };
    const historyRes = { data: context.history || [], error: null };
    const stepsRes = { data: context.steps || [], error: null };

    if (pRes.error) throw pRes.error;

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

    const composition = [];
    const buildingDetails = {};

    (buildingsRes.data || []).forEach(b => {
      composition.push(mapBuildingFromDB(b, b.building_blocks));

      b.building_blocks.forEach(block => {
        const uiKey = `${b.id}_${block.id}`;
        const mapped = mapBlockDetailsFromDB(b, block);
        buildingDetails[uiKey] = mapped;
      });
    });

    return {
      ...projectData,
      composition,
      buildingDetails,
      floorData: {},
      entrancesData: {},
      flatMatrix: {},
      mopData: {},
      parkingPlaces: {},
    };
  },

  // --- PROJECT PASSPORT ---
  getProjectDetails: async projectId => {
    if (!projectId) return null;
    requireBffEnabled('project.getProjectDetails');
    return BffClient.getProjectPassport({ projectId });
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

  updateProjectInfo: async (projectId, info = {}, cadastreData = {}, actor = {}) => {
    if (!projectId) return null;
    requireBffEnabled('project.updateProjectInfo');

    const resolvedActor = resolveActor(actor);
    return BffClient.updateProjectPassport({
      projectId,
      info,
      cadastreData,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  upsertParticipant: async (projectId, role, data = {}, actor = {}) => {
    requireBffEnabled('project.upsertParticipant');

    const resolvedActor = resolveActor(actor);
    return BffClient.upsertProjectParticipant({
      projectId,
      role,
      data,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  upsertDocument: async (projectId, doc = {}, actor = {}) => {
    requireBffEnabled('project.upsertDocument');

    const resolvedActor = resolveActor(actor);
    return BffClient.upsertProjectDocument({
      projectId,
      doc,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  deleteDocument: async (id, actor = {}) => {
    if (!id) return;
    requireBffEnabled('project.deleteDocument');

    const resolvedActor = resolveActor(actor);
    return BffClient.deleteProjectDocument({
      documentId: id,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  // --- STANDARD API METHODS (Existing ones preserved) ---

  getBuildingsRegistrySummary: async () => {
    requireBffEnabled('registry.getBuildingsRegistrySummary');
    return BffClient.getRegistryBuildingsSummary();
  },

  getBuildings: async projectId => {
    requireBffEnabled('project.getBuildings');
    return BffClient.getBuildings({ projectId });
  },

   createBuilding: async (projectId, buildingData, blocksData, actor = {}) => {
    requireBffEnabled('project.createBuilding');

    const resolvedActor = resolveActor(actor);
    return BffClient.createBuilding({
      projectId,
      buildingData,
      blocksData,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  updateBuilding: async (buildingId, buildingData, actor = {}, blocksData = null) => {
    requireBffEnabled('project.updateBuilding');

    const resolvedActor = resolveActor(actor);
    return BffClient.updateBuilding({
      buildingId,
      buildingData,
      blocksData,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  deleteBuilding: async (buildingId, actor = {}) => {
    requireBffEnabled('project.deleteBuilding');

    const resolvedActor = resolveActor(actor);
    return BffClient.deleteBuilding({
      buildingId,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  // --- FLOORS ---
  getFloors: async blockId => {
    requireBffEnabled('composition.getFloors');
    const data = await BffClient.getFloors({ blockId });
    return (data || []).map(f => mapFloorFromDB(f, null, blockId));
  },

  updateFloor: async (floorId, updates, actor = {}) => {
    requireBffEnabled('composition.updateFloor');

    const resolvedActor = resolveActor(actor);
    return BffClient.updateFloor({
      floorId,
      updates,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  generateFloors: async (blockId, floorsFrom, floorsTo, defaultType = 'residential', actor = {}) => {
    requireBffEnabled('composition.generateFloors');

    const resolvedActor = resolveActor(actor);
    return BffClient.reconcileFloors({
      blockId,
      floorsFrom,
      floorsTo,
      defaultType,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
      idempotencyKey: createIdempotencyKey('reconcile-floors', [blockId]),
    });
  },

  // --- MATRIX ---
  getEntrances: async blockId => {
    requireBffEnabled('matrix.getEntrances');
    return BffClient.getEntrances({ blockId });
  },


  getMatrix: async blockId => {
    requireBffEnabled('matrix.getMatrix');

    const data = await BffClient.getEntranceMatrix({ blockId });
    const map = {};
    (data || []).forEach(row => {
      map[`${row.floor_id}_${row.entrance_number}`] = {
        id: row.id,
        apts: row.flats_count,
        units: row.commercial_count,
        mopQty: row.mop_count,
      };
    });
    return map;
  },


  upsertMatrixCell: async (blockId, floorId, entranceNumber, values, actor = {}) => {
    requireBffEnabled('matrix.upsertMatrixCell');

    const resolvedActor = resolveActor(actor);
    return BffClient.upsertMatrixCell({
      blockId,
      floorId,
      entranceNumber,
      values,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },


  syncEntrances: async (blockId, count, actor = {}) => {
    requireBffEnabled('matrix.syncEntrances');

    const resolvedActor = resolveActor(actor);
    return BffClient.reconcileEntrances({
      blockId,
      count,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
      idempotencyKey: createIdempotencyKey('reconcile-entrances', [blockId]),
    });
  },

  // --- UNITS ---

  getUnitExplicationById: async unitId => {
    requireBffEnabled('units.getUnitExplicationById');

    const data = await BffClient.getUnitExplicationById({ unitId });
    if (!data) return null;

    return {
      id: data.id,
      unitCode: data.unit_code,
      number: data.number,
      num: data.number,
      type: data.unit_type,
      hasMezzanine: !!data.has_mezzanine,
      mezzanineType: data.mezzanine_type || null,
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
        isMezzanine: !!r.is_mezzanine,
      })),
    };
  },


  getUnits: async (blockId, options = {}) => {
    requireBffEnabled('units.getUnits');

    const extraFloorIds = Array.isArray(options?.floorIds) ? options.floorIds.filter(Boolean) : [];
    const payload = await BffClient.getUnits({ blockId, floorIds: extraFloorIds });
    const units = payload?.units || [];
    const entranceMap = payload?.entranceMap || {};

    return units.map(u => ({
      ...mapUnitFromDB(u, u.rooms, entranceMap, null, blockId),
      entranceIndex: u.entrance_id ? entranceMap[u.entrance_id] || 1 : u.entrance_index || 1,
    }));
  },


  upsertUnit: async (unitData, actor = {}) => {
    requireBffEnabled('units.upsertUnit');

    const resolvedActor = resolveActor(actor);
    return BffClient.upsertUnit({
      unitData,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  // --- COMMON AREAS ---
  getCommonAreas: async (blockId, options = {}) => {
    requireBffEnabled('commonAreas.getCommonAreas');

    const extraFloorIds = Array.isArray(options?.floorIds) ? options.floorIds.filter(Boolean) : [];
    const data = await BffClient.getCommonAreas({ blockId, floorIds: extraFloorIds });
    return (data || []).map(m => mapMopFromDB(m, {}, null, blockId));
  },

  /**
   * @param {{
   * id?: string,
   * floorId: string,
   * entranceId?: string,
   * type: string,
   * area: number,
   * height?: number | string
   * }} data
   */
  upsertCommonArea: async (data, actor = {}) => {
    requireBffEnabled('commonAreas.upsertCommonArea');

    const resolvedActor = resolveActor(actor);
    return BffClient.upsertCommonArea({
      data,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },


  deleteCommonArea: async (id, actor = {}) => {
    requireBffEnabled('commonAreas.deleteCommonArea');

    const resolvedActor = resolveActor(actor);
    return BffClient.deleteCommonArea({
      id,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },


  clearCommonAreas: async (blockId, options = {}, actor = {}) => {
    requireBffEnabled('commonAreas.clearCommonAreas');

    const extraFloorIds = Array.isArray(options?.floorIds) ? options.floorIds.filter(Boolean) : [];
    const resolvedActor = resolveActor(actor);
    return BffClient.clearCommonAreas({
      blockId,
      floorIds: extraFloorIds,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },


  reconcileUnitsForBlock: async (blockId, actor = {}) => {
    requireBffEnabled('units.reconcileUnitsForBlock');

    const resolvedActor = resolveActor(actor);
    return BffClient.reconcileUnitsForBlock({
      blockId,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
      idempotencyKey: createIdempotencyKey('reconcile-units', [blockId]),
    });
  },


  reconcileCommonAreasForBlock: async (blockId, actor = {}) => {
    requireBffEnabled('commonAreas.reconcileCommonAreasForBlock');

    const resolvedActor = resolveActor(actor);
    return BffClient.reconcileCommonAreasForBlock({
      blockId,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
      idempotencyKey: createIdempotencyKey('reconcile-mops', [blockId]),
    });
  },

  // --- PARKING & BASEMENTS ---
  getBasements: async projectId => {
    requireBffEnabled('basements.getBasements');
    return BffClient.getBasements({ projectId });
  },

  toggleBasementLevel: async (basementId, level, isEnabled, actor = {}) => {
    requireBffEnabled('basements.toggleBasementLevel');

    const resolvedActor = resolveActor(actor);
    return BffClient.toggleBasementLevel({
      basementId,
      level,
      isEnabled,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  getParkingCounts: async projectId => {
    requireBffEnabled('basements.getParkingCounts');
    return BffClient.getParkingCounts({ projectId });
  },

  syncParkingPlaces: async (floorId, targetCount, _buildingId, actor = {}) => {
    requireBffEnabled('basements.syncParkingPlaces');

    const resolvedActor = resolveActor(actor);
    return BffClient.syncParkingPlaces({
      floorId,
      targetCount,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
      idempotencyKey: createIdempotencyKey('sync-parking', [floorId]),
    });
  },

  // --- META & INTEGRATION ---
  getIntegrationStatus: async projectId => {
    requireBffEnabled('integration.getIntegrationStatus');
    return BffClient.getIntegrationStatus({ projectId });
  },

  updateIntegrationStatus: async (projectId, field, status, actor = {}) => {
    requireBffEnabled('integration.updateIntegrationStatus');

    const resolvedActor = resolveActor(actor);
    return BffClient.updateIntegrationStatus({
      projectId,
      field,
      status,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  updateBuildingCadastre: async (id, cadastre, actor = {}) => {
    if (!id) return;
    requireBffEnabled('integration.updateBuildingCadastre');

    const resolvedActor = resolveActor(actor);
    return BffClient.updateBuildingCadastre({
      buildingId: id,
      cadastre,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  updateUnitCadastre: async (id, cadastre, actor = {}) => {
    requireBffEnabled('integration.updateUnitCadastre');

    const resolvedActor = resolveActor(actor);
    return BffClient.updateUnitCadastre({
      unitId: id,
      cadastre,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },


  declineApplication: async ({ applicationId, userName, reason, userRole = 'branch_manager' }) => {
    requireBffEnabled('workflow.declineApplication');

    return BffClient.declineApplication({
      applicationId,
      reason,
      userName,
      userRole,
      idempotencyKey: createIdempotencyKey('workflow-decline', [applicationId]),
    });
  },

  requestDecline: async ({ applicationId, reason, stepIndex, requestedBy, userRole = 'technician' }) => {
    requireBffEnabled('workflow.requestDecline');

    return BffClient.requestDecline({
      applicationId,
      reason,
      stepIndex,
      userName: requestedBy,
      userRole,
      idempotencyKey: createIdempotencyKey('workflow-request-decline', [applicationId, stepIndex]),
    });
  },

  returnFromDecline: async ({ applicationId, userName, userRole = 'branch_manager', comment }) => {
    requireBffEnabled('workflow.returnFromDecline');

    return BffClient.returnFromDecline({
      applicationId,
      comment,
      userName,
      userRole,
      idempotencyKey: createIdempotencyKey('workflow-return-from-decline', [applicationId]),
    });
  },

  assignTechnician: async ({ applicationId, assigneeName, userName = 'system', userRole = 'branch_manager', reason = null }) => {
    requireBffEnabled('workflow.assignTechnician');

    return BffClient.assignTechnician({
      applicationId,
      assigneeUserId: assigneeName,
      reason,
      userName,
      userRole,
      idempotencyKey: createIdempotencyKey('workflow-assign-technician', [applicationId, assigneeName]),
    });
  },

  restoreApplication: async ({ applicationId, userName, userRole = 'admin', comment }) => {
    requireBffEnabled('workflow.restoreApplication');

    return BffClient.restoreApplication({
      applicationId,
      comment,
      userName,
      userRole,
      idempotencyKey: createIdempotencyKey('workflow-restore', [applicationId]),
    });
  },

  getVersions: async (entityType, entityId) => {
    requireBffEnabled('versions.getVersions');
    return BffClient.getVersions({ entityType, entityId });
  },

  createVersion: async ({ entityType, entityId, snapshotData, createdBy, applicationId }) => {
    requireBffEnabled('versions.createVersion');

    const actor = resolveActor({ userName: createdBy });
    return BffClient.createVersion({
      entityType,
      entityId,
      snapshotData,
      createdBy,
      applicationId,
      userName: actor.userName,
      userRole: actor.userRole,
    });
  },

  approveVersion: async ({ versionId, approvedBy }) => {
    requireBffEnabled('versions.approveVersion');

    const actor = resolveActor({ userName: approvedBy });
    return BffClient.approveVersion({
      versionId,
      approvedBy,
      userName: actor.userName,
      userRole: actor.userRole,
    });
  },

  declineVersion: async ({ versionId, reason, declinedBy }) => {
    requireBffEnabled('versions.declineVersion');

    const actor = resolveActor({ userName: declinedBy });
    return BffClient.declineVersion({
      versionId,
      reason,
      declinedBy,
      userName: actor.userName,
      userRole: actor.userRole,
    });
  },

  getVersionSnapshot: async versionId => {
    requireBffEnabled('versions.getVersionSnapshot');
    return BffClient.getVersionSnapshot({ versionId });
  },

  restoreVersion: async ({ versionId }) => {
    requireBffEnabled('versions.restoreVersion');

    const actor = resolveActor({});
    return BffClient.restoreVersion({
      versionId,
      userName: actor.userName,
      userRole: actor.userRole,
    });
  },

  getProjectFullRegistry: async projectId => {
    requireBffEnabled('project.getProjectFullRegistry');
    return BffClient.getProjectFullRegistry({ projectId });
  },

  getProjectTepSummary: async projectId => {
    requireBffEnabled('project.getProjectTepSummary');
    return BffClient.getProjectTepSummary({ projectId });
  },

  // --- META SAVE (ГЛОБАЛЬНОЕ СОХРАНЕНИЕ ИЗ КОНТЕКСТА) ---
  // Это аналог старого saveData из registry-service, адаптированный под Context
  // Он умеет сохранять "всё подряд", разбирая payload
  saveData: async (scope, projectId, payload) => {
    requireBffEnabled('project.saveData');
    if (!scope) return;

    const { buildingSpecificData, ...generalData } = payload || {};
    const resolvedActor = resolveActor({});
    let applicationId = null;

    if (generalData.complexInfo || generalData.applicationInfo) {
      const metaResponse = await BffClient.saveProjectContextMeta({
        scope,
        projectId,
        complexInfo: generalData.complexInfo || null,
        applicationInfo: generalData.applicationInfo || null,
        userName: resolvedActor.userName,
        userRole: resolvedActor.userRole,
      });

      applicationId = metaResponse?.applicationId || null;
    }

    if (generalData.buildingDetails) {
      await BffClient.saveProjectBuildingDetails({
        projectId,
        buildingDetails: generalData.buildingDetails,
        userName: resolvedActor.userName,
        userRole: resolvedActor.userRole,
      });
    }

    if (generalData.stepBlockStatuses && generalData.stepIndex !== undefined) {
      await BffClient.saveStepBlockStatuses({
        scope,
        projectId,
        stepIndex: generalData.stepIndex,
        statuses: generalData.stepBlockStatuses,
        userName: resolvedActor.userName,
        userRole: resolvedActor.userRole,
      });
    }

    void buildingSpecificData;

    return { ok: true, applicationId };
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
  validateStepCompletionViaBff: LegacyApiService.validateStepCompletionViaBff,
};
