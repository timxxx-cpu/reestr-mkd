import { AuthService } from './auth-service';
import { trackOperationSource } from './operation-source-tracker';
import { getCurrentActor } from './actor';
import { getRoleId, getRoleKey } from './roles';
const isBffEnabled = () => {
  const raw = import.meta.env.VITE_BFF_ENABLED;
  if (raw === undefined) return true;
  return raw === 'true';
};
const getBffBaseUrl = () => import.meta.env.VITE_BFF_BASE_URL || 'http://localhost:8787';

const BFF_OPERATION_SOURCE = 'bff';

const generateClientRequestId = () => {
  if (typeof crypto?.randomUUID === 'function') {
    return `fe-${crypto.randomUUID()}`;
  }

  return `fe-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getAuthHeaders = () => {
  const token = AuthService.getToken();
  if (!token) return {}; 
  
  return {
    'Authorization': `Bearer ${token}`
  };
};

// 1. Создаем кастомный класс ошибки, чтобы VS Code знал о полях code и details
class BffError extends Error {
  constructor(message, code, details, status) {
    super(message);
    this.name = 'BffError';
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

/**
 * 2. Описываем типы для аргументов, чтобы убрать ошибки "does not exist on type"
 * @typedef {Object} RequestOptions
 * @property {string} [method]
 * @property {any} [body]
 * @property {string} [userId]
 * @property {string} [userName]
 * @property {string} [userRole]
 * @property {number} [userRoleId]
 * @property {string} [idempotencyKey]
 */

/**
 * @param {string} path
 * @param {RequestOptions} [options]
 */
async function request(path, options = {}) {
  const { method = 'GET', body, userId, userName, userRole, userRoleId, idempotencyKey } = options;
  const clientRequestId = generateClientRequestId();

  const headers = {
    'x-client-request-id': clientRequestId,
    'x-operation-source': BFF_OPERATION_SOURCE,
    ...getAuthHeaders(),
  };

  const currentActor = getCurrentActor();
  const resolvedUserId = userId || AuthService.getCurrentUser?.()?.id || userName;
  const resolvedUserRoleId = getRoleId(userRoleId ?? currentActor.userRoleId ?? userRole);
  const resolvedUserRole = getRoleKey(userRole ?? currentActor.userRole ?? resolvedUserRoleId);

  if (resolvedUserId) headers['x-user-id'] = encodeURIComponent(String(resolvedUserId));
  if (resolvedUserRoleId) headers['x-user-role-id'] = String(resolvedUserRoleId);
  if (resolvedUserRole) headers['x-user-role'] = String(resolvedUserRole);
  if (idempotencyKey) headers['x-idempotency-key'] = idempotencyKey;
  if (body !== undefined && body !== null) {
    headers['content-type'] = 'application/json';
  }

  const res = await fetch(`${getBffBaseUrl()}${path}`, {
    method,
    headers,
   body: (body !== undefined && body !== null) ? JSON.stringify(body) : undefined,
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 3. Используем наш кастомный класс ошибки
    throw new BffError(
      payload?.message || `BFF request failed: ${res.status}`,
      payload?.code,
      payload?.details,
      res.status
    );
  }

  if (import.meta.env.DEV) {
    const requestId = res.headers.get('x-request-id') || payload?.requestId || null;

    trackOperationSource({
      source: BFF_OPERATION_SOURCE,
      operation: `${method} ${path}`,
      requestId,
    });

    console.info('[BFF]', method, path, {
      operationSource: BFF_OPERATION_SOURCE,
      clientRequestId,
      requestId,
      status: res.status,
    });
  }

  return payload;
}

  export const BffClient = {
  isEnabled: isBffEnabled,

  getRegistryBuildingsSummary: () => request('/api/v1/registry/buildings-summary'),

  getProjectsList: (options = {}) => {
    const { scope, status, workflowSubstatus, assignee, search, page, limit } = options;
    const params = new URLSearchParams();
    if (scope) params.set('scope', scope);
    if (status) params.set('status', status);
    if (workflowSubstatus) params.set('workflowSubstatus', workflowSubstatus);
    if (assignee) params.set('assignee', assignee);
    if (search) params.set('search', search);
    if (page) params.set('page', String(page));
    if (limit) params.set('limit', String(limit));
    return request(`/api/v1/projects?${params.toString()}`);
  },


  getProjectsMapOverview: ({ scope }) =>
    request(`/api/v1/projects/map-overview?scope=${encodeURIComponent(scope || '')}`),

  getProjectsSummaryCounts: (options = {}) => {
    const { scope, assignee } = options;
    const params = new URLSearchParams();
    if (scope) params.set('scope', scope);
    if (assignee) params.set('assignee', assignee);
    return request(`/api/v1/projects/summary-counts?${params.toString()}`);
  },

  getExternalApplications: (options = {}) => {
    const { scope } = options;
    const params = new URLSearchParams();
    if (scope) params.set('scope', scope);
    return request(`/api/v1/external-applications?${params.toString()}`);
  },

  getCatalog: ({ table }) =>
    request(`/api/v1/catalogs/${encodeURIComponent(table)}?activeOnly=true`),

  getSystemUsers: () =>
    request(`/api/v1/catalogs/dict_system_users?activeOnly=true`),

  getCatalogAll: ({ table }) =>
    request(`/api/v1/catalogs/${encodeURIComponent(table)}`),

  upsertCatalogItem: ({ table, item, userName, userRole, userRoleId }) =>
    request(`/api/v1/catalogs/${encodeURIComponent(table)}/upsert`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      body: { item },
    }),

  setCatalogItemActive: ({ table, id, isActive, userName, userRole, userRoleId }) =>
    request(`/api/v1/catalogs/${encodeURIComponent(table)}/${encodeURIComponent(id)}/active`, {
      method: 'PUT',
      userName,
      userRoleId,
      userRole,
      body: { isActive },
    }),

  getBuildings: ({ projectId }) =>
    request(`/api/v1/projects/${projectId}/buildings`),


  getProjectFullRegistry: ({ projectId }) =>
    request(`/api/v1/projects/${projectId}/full-registry`),

  getProjectTepSummary: ({ projectId }) =>
    request(`/api/v1/projects/${projectId}/tep-summary`),

  getProjectContext: ({ scope, projectId }) =>
    request(`/api/v1/projects/${projectId}/context?scope=${encodeURIComponent(scope)}`),

  getProjectContextRegistryDetails: ({ projectId }) =>
    request(`/api/v1/projects/${projectId}/context-registry-details`),

  validateProjectStep: ({ projectId, scope, stepId, userName, userRole, userRoleId }) =>
    request(`/api/v1/projects/${projectId}/validation/step`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      body: { scope, stepId },
    }),

  saveProjectContextMeta: ({ scope, projectId, complexInfo, applicationInfo, userName, userRole, userRoleId }) =>
    request(`/api/v1/projects/${projectId}/context-meta/save`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      body: { scope, complexInfo, applicationInfo },
    }),

  saveStepBlockStatuses: ({ scope, projectId, stepIndex, statuses, userName, userRole, userRoleId }) =>
    request(`/api/v1/projects/${projectId}/step-block-statuses/save`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      body: { scope, stepIndex, statuses },
    }),

  saveProjectBuildingDetails: ({ projectId, buildingDetails, userName, userRole, userRoleId }) =>
    request(`/api/v1/projects/${projectId}/context-building-details/save`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      body: { buildingDetails },
    }),



  getProjectGeometryCandidates: ({ projectId }) =>
    request(`/api/v1/projects/${projectId}/geometry-candidates`),

  importProjectGeometryCandidates: ({ projectId, candidates, userName, userRole, userRoleId }) =>
    request(`/api/v1/projects/${projectId}/geometry-candidates/import`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      body: { candidates },
    }),
deleteProjectGeometryCandidate: ({ projectId, candidateId, userName, userRole, userRoleId }) =>
    request(`/api/v1/projects/${projectId}/geometry-candidates/${candidateId}`, {
      method: 'DELETE',
      userName,
      userRoleId,
      userRole,
    }),

  selectBuildingGeometry: ({ projectId, buildingId, candidateId, userName, userRole, userRoleId }) =>
    request(`/api/v1/projects/${projectId}/buildings/${buildingId}/geometry/select`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      body: { candidateId },
    }),
  selectProjectLandPlot: ({ projectId, candidateId, userName, userRole, userRoleId }) =>
    request(`/api/v1/projects/${projectId}/land-plot/select`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      body: { candidateId },
    }),
  unselectProjectLandPlot: ({ projectId, userName, userRole, userRoleId }) =>
    request(`/api/v1/projects/${projectId}/land-plot/unselect`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
    }),

  getProjectPassport: ({ projectId }) =>
    request(`/api/v1/projects/${projectId}/passport`),

  updateProjectPassport: ({ projectId, info, cadastreData, userName, userRole, userRoleId }) =>
    request(`/api/v1/projects/${projectId}/passport`, {
      method: 'PUT',
      userName,
      userRoleId,
      userRole,
      body: { info, cadastreData },
    }),

  upsertProjectParticipant: ({ projectId, role, data, userName, userRole, userRoleId }) =>
    request(`/api/v1/projects/${projectId}/participants/${encodeURIComponent(role)}`, {
      method: 'PUT',
      userName,
      userRoleId,
      userRole,
      body: { data },
    }),

  upsertProjectDocument: ({ projectId, doc, userName, userRole, userRoleId }) =>
    request(`/api/v1/projects/${projectId}/documents`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      body: { doc },
    }),

  deleteProjectDocument: ({ documentId, userName, userRole, userRoleId }) =>
    request(`/api/v1/project-documents/${documentId}`, {
      method: 'DELETE',
      userName,
      userRoleId,
      userRole,
    }),

  deleteProject: ({ scope, projectId, userName, userRole, userRoleId }) =>
    request(`/api/v1/projects/${projectId}?scope=${encodeURIComponent(scope || '')}`, {
      method: 'DELETE',
      userName,
      userRoleId,
      userRole,
    }),

  getBasements: ({ projectId }) =>
    request(`/api/v1/projects/${projectId}/basements`),

  getBasementsByBuildingIds: ({ buildingIds }) =>
    request(`/api/v1/basements?buildingIds=${encodeURIComponent(buildingIds.join(','))}`),

  toggleBasementLevel: ({ basementId, level, isEnabled, userName, userRole, userRoleId }) =>
    request(`/api/v1/basements/${basementId}/parking-levels/${level}`, {
      method: 'PUT',
      userName,
      userRoleId,
      userRole,
      body: { isEnabled },
    }),

  getVersions: ({ entityType, entityId }) =>
    request(`/api/v1/versions?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`),

  createVersion: ({ entityType, entityId, snapshotData, createdBy, applicationId, userName, userRole, userRoleId }) =>
    request('/api/v1/versions', {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      body: { entityType, entityId, snapshotData, createdBy, applicationId },
    }),

  approveVersion: ({ versionId, approvedBy, userName, userRole, userRoleId }) =>
    request(`/api/v1/versions/${versionId}/approve`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      body: { approvedBy },
    }),

  declineVersion: ({ versionId, reason, declinedBy, userName, userRole, userRoleId }) =>
    request(`/api/v1/versions/${versionId}/decline`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      body: { reason, declinedBy },
    }),

  getVersionSnapshot: ({ versionId }) =>
    request(`/api/v1/versions/${versionId}/snapshot`),

  restoreVersion: ({ versionId, userName, userRole, userRoleId }) =>
    request(`/api/v1/versions/${versionId}/restore`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      body: {},
    }),


  createProjectFromApplication: ({ scope, appData, userName, userRole, userRoleId, idempotencyKey }) =>
    request('/api/v1/projects/from-application', {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      idempotencyKey,
      body: { scope, appData },
    }),


  getParkingCounts: ({ projectId }) =>
    request(`/api/v1/projects/${projectId}/parking-counts`),


  getIntegrationStatus: ({ projectId }) =>
    request(`/api/v1/projects/${projectId}/integration-status`),

  updateIntegrationStatus: ({ projectId, field, status, userName, userRole, userRoleId }) =>
    request(`/api/v1/projects/${projectId}/integration-status`, {
      method: 'PUT',
      userName,
      userRoleId,
      userRole,
      body: { field, status },
    }),

  updateBuildingCadastre: ({ buildingId, cadastre, userName, userRole, userRoleId }) =>
    request(`/api/v1/buildings/${buildingId}/cadastre`, {
      method: 'PUT',
      userName,
      userRoleId,
      userRole,
      body: { cadastre },
    }),

  updateUnitCadastre: ({ unitId, cadastre, userName, userRole, userRoleId }) =>
    request(`/api/v1/units/${unitId}/cadastre`, {
      method: 'PUT',
      userName,
      userRoleId,
      userRole,
      body: { cadastre },
    }),

  syncParkingPlaces: ({ floorId, targetCount, userName, userRole, userRoleId, idempotencyKey }) =>
    request(`/api/v1/floors/${floorId}/parking-places/sync`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      idempotencyKey,
      body: { targetCount },
    }),

  createBuilding: ({ projectId, buildingData, blocksData, userName, userRole, userRoleId }) =>
    request(`/api/v1/projects/${projectId}/buildings`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      body: { buildingData, blocksData },
    }),

  updateBuilding: ({ buildingId, buildingData, blocksData, userName, userRole, userRoleId }) =>
    request(`/api/v1/buildings/${buildingId}`, {
      method: 'PUT',
      userName,
      userRoleId,
      userRole,
      body: { buildingData, blocksData },
    }),

  deleteBuilding: ({ buildingId, userName, userRole, userRoleId }) =>
    request(`/api/v1/buildings/${buildingId}`, {
      method: 'DELETE',
      userName,
      userRoleId,
      userRole,
    }),

  getBlockExtensions: ({ blockId }) =>
    request(`/api/v1/blocks/${blockId}/extensions`),

  createBlockExtension: ({ blockId, extensionData, userName, userRole, userRoleId, idempotencyKey }) =>
    request(`/api/v1/blocks/${blockId}/extensions`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      idempotencyKey,
      body: { extensionData },
    }),

  updateBlockExtension: ({ extensionId, extensionData, userName, userRole, userRoleId, idempotencyKey }) =>
    request(`/api/v1/extensions/${extensionId}`, {
      method: 'PUT',
      userName,
      userRoleId,
      userRole,
      idempotencyKey,
      body: { extensionData },
    }),

  deleteBlockExtension: ({ extensionId, userName, userRole, userRoleId, idempotencyKey }) =>
    request(`/api/v1/extensions/${extensionId}`, {
      method: 'DELETE',
      userName,
      userRoleId,
      userRole,
      idempotencyKey,
    }),

  getFloors: ({ blockId }) =>
    request(`/api/v1/blocks/${blockId}/floors`),

  getEntrances: ({ blockId }) =>
    request(`/api/v1/blocks/${blockId}/entrances`),

  getEntranceMatrix: ({ blockId }) =>
    request(`/api/v1/blocks/${blockId}/entrance-matrix`),

  getUnitExplicationById: ({ unitId }) =>
    request(`/api/v1/units/${unitId}/explication`),

  getUnits: ({ blockId, floorIds = [] }) =>
    request(`/api/v1/blocks/${blockId}/units${floorIds.length ? `?floorIds=${encodeURIComponent(floorIds.join(','))}` : ''}`),

  getCommonAreas: ({ blockId, floorIds = [] }) =>
    request(`/api/v1/blocks/${blockId}/common-areas${floorIds.length ? `?floorIds=${encodeURIComponent(floorIds.join(','))}` : ''}`),

  upsertUnit: ({ unitData, userName, userRole, userRoleId }) =>
    request('/api/v1/units/upsert', {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      body: { data: unitData },
    }),

  batchUpsertUnits: ({ unitsList, userName, userRole, userRoleId, idempotencyKey }) =>
    request('/api/v1/units/batch-upsert', {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      idempotencyKey,
      body: { unitsList },
    }),

  reconcileUnitsForBlock: ({ blockId, userName, userRole, userRoleId, idempotencyKey }) =>
    request(`/api/v1/blocks/${blockId}/units/reconcile`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      idempotencyKey,
      body: {},
    }),

  reconcileCommonAreasForBlock: ({ blockId, userName, userRole, userRoleId, idempotencyKey }) =>
    request(`/api/v1/blocks/${blockId}/common-areas/reconcile`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      idempotencyKey,
      body: {},
    }),

  previewReconcileByBlock: ({ blockId }) =>
    request(`/api/v1/blocks/${blockId}/reconcile/preview`, {
      method: 'POST',
      body: {},
    }),

  upsertCommonArea: ({ data, userName, userRole, userRoleId }) =>
    request('/api/v1/common-areas/upsert', {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      body: { data },
    }),

  deleteCommonArea: ({ id, userName, userRole, userRoleId }) =>
    request(`/api/v1/common-areas/${id}`, {
      method: 'DELETE',
      userName,
      userRoleId,
      userRole,
    }),

  clearCommonAreas: ({ blockId, floorIds = [], userName, userRole, userRoleId }) =>
    request(`/api/v1/blocks/${blockId}/common-areas/clear`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      body: { floorIds: floorIds.join(',') },
    }),

  updateFloor: ({ floorId, updates, userName, userRole, userRoleId }) =>
    request(`/api/v1/floors/${floorId}`, {
      method: 'PUT',
      userName,
      userRoleId,
      userRole,
      body: { updates },
    }),


  updateFloorsBatch: ({ items, userName, userRole, userRoleId }) =>
    request('/api/v1/floors/batch', {
      method: 'PUT',
      userName,
      userRoleId,
      userRole,
      body: { items },
    }),

  reconcileFloors: ({ blockId, floorsFrom, floorsTo, defaultType, userName, userRole, userRoleId, idempotencyKey }) =>
    request(`/api/v1/blocks/${blockId}/floors/reconcile`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      idempotencyKey,
      body: { floorsFrom, floorsTo, defaultType },
    }),

  upsertMatrixCell: ({ blockId, floorId, entranceNumber, values, userName, userRole, userRoleId }) =>
    request(`/api/v1/blocks/${blockId}/entrance-matrix/cell`, {
      method: 'PUT',
      userName,
      userRoleId,
      userRole,
      body: { data: { floorId, entranceNumber, values } },
    }),

  batchUpsertMatrixCells: ({ blockId, cells, userName, userRole, userRoleId }) =>
    request(`/api/v1/blocks/${blockId}/entrance-matrix/batch`, {
      method: 'PUT',
      userName,
      userRoleId,
      userRole,
      body: { cells },
    }),

  reconcileEntrances: ({ blockId, count, userName, userRole, userRoleId, idempotencyKey }) =>
    request(`/api/v1/blocks/${blockId}/entrances/reconcile`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      idempotencyKey,
      body: { count },
    }),

    resolveApplicationId: ({ projectId, scope }) =>
    request(`/api/v1/projects/${projectId}/application-id?scope=${encodeURIComponent(scope || '')}`),

  acquireApplicationLock: ({ applicationId, userName, userRole, userRoleId, ttlMinutes = 20 }) =>
    request(`/api/v1/applications/${applicationId}/locks/acquire`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      body: { ttlSeconds: Math.max(60, Math.floor(ttlMinutes * 60)) },
    }),

  refreshApplicationLock: ({ applicationId, userName, userRole, userRoleId, ttlMinutes = 20 }) =>
    request(`/api/v1/applications/${applicationId}/locks/refresh`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      body: { ttlSeconds: Math.max(60, Math.floor(ttlMinutes * 60)) },
    }),

  releaseApplicationLock: ({ applicationId, userName, userRole, userRoleId }) =>
    request(`/api/v1/applications/${applicationId}/locks/release`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      body: {},
    }),

  completeStep: ({ applicationId, stepIndex, comment, userName, userRole, userRoleId, idempotencyKey }) =>
    request(`/api/v1/applications/${applicationId}/workflow/complete-step`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      idempotencyKey,
      body: { stepIndex, comment },
    }),

  rollbackStep: ({ applicationId, reason, userName, userRole, userRoleId, idempotencyKey }) =>
    request(`/api/v1/applications/${applicationId}/workflow/rollback-step`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      idempotencyKey,
      body: { reason },
    }),

  reviewApprove: ({ applicationId, comment, userName, userRole, userRoleId, idempotencyKey }) =>
    request(`/api/v1/applications/${applicationId}/workflow/review-approve`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      idempotencyKey,
      body: { comment },
    }),

  reviewReject: ({ applicationId, reason, userName, userRole, userRoleId, idempotencyKey }) =>
    request(`/api/v1/applications/${applicationId}/workflow/review-reject`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      idempotencyKey,
      body: { reason },
    }),

  assignTechnician: ({ applicationId, assigneeUserId, reason, userName, userRole, userRoleId, idempotencyKey }) =>
    request(`/api/v1/applications/${applicationId}/workflow/assign-technician`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      idempotencyKey,
      body: { assigneeUserId, reason },
    }),

  requestDecline: ({ applicationId, reason, stepIndex, userName, userRole, userRoleId, idempotencyKey }) =>
    request(`/api/v1/applications/${applicationId}/workflow/request-decline`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      idempotencyKey,
      body: { reason, stepIndex },
    }),

  declineApplication: ({ applicationId, reason, userName, userRole, userRoleId, idempotencyKey }) =>
    request(`/api/v1/applications/${applicationId}/workflow/decline`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      idempotencyKey,
      body: { reason },
    }),

  returnFromDecline: ({ applicationId, comment, userName, userRole, userRoleId, idempotencyKey }) =>
    request(`/api/v1/applications/${applicationId}/workflow/return-from-decline`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      idempotencyKey,
      body: { comment },
    }),

  restoreApplication: ({ applicationId, comment, userName, userRole, userRoleId, idempotencyKey }) =>
    request(`/api/v1/applications/${applicationId}/workflow/restore`, {
      method: 'POST',
      userName,
      userRoleId,
      userRole,
      idempotencyKey,
      body: { comment },
    }),
};
