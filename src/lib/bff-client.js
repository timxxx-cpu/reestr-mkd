import { AuthService } from './auth-service';
import { trackOperationSource } from './operation-source-tracker';
const isLegacyRollbackEnabled = () => import.meta.env.VITE_LEGACY_ROLLBACK_ENABLED === 'true';
const isBffEnabled = () => {
  if (isLegacyRollbackEnabled()) return false;

  const raw = import.meta.env.VITE_BFF_ENABLED;
  if (raw === undefined) return true;
  return raw === 'true';
};
const getBffBaseUrl = () => import.meta.env.VITE_BFF_BASE_URL || 'http://localhost:8787';
const isCompositionEnabled = () => isBffEnabled() && import.meta.env.VITE_BFF_COMPOSITION_ENABLED !== 'false';
const isFloorsEnabled = () => isBffEnabled() && import.meta.env.VITE_BFF_FLOORS_ENABLED !== 'false';
const isEntrancesEnabled = () => isBffEnabled() && import.meta.env.VITE_BFF_ENTRANCES_ENABLED !== 'false';
const isUnitsEnabled = () => isBffEnabled() && import.meta.env.VITE_BFF_UNITS_ENABLED !== 'false';
const isMopEnabled = () => isBffEnabled() && import.meta.env.VITE_BFF_MOP_ENABLED !== 'false';
const isParkingEnabled = () => isBffEnabled() && import.meta.env.VITE_BFF_PARKING_ENABLED !== 'false';
const isIntegrationEnabled = () => isBffEnabled() && import.meta.env.VITE_BFF_INTEGRATION_ENABLED !== 'false';
const isCadastreEnabled = () => isBffEnabled() && import.meta.env.VITE_BFF_CADASTRE_ENABLED !== 'false';
const isProjectInitEnabled = () => isBffEnabled() && import.meta.env.VITE_BFF_PROJECT_INIT_ENABLED !== 'false';
const isProjectPassportEnabled = () => isBffEnabled() && import.meta.env.VITE_BFF_PROJECT_PASSPORT_ENABLED !== 'false';
const isBasementsEnabled = () => isBffEnabled() && import.meta.env.VITE_BFF_BASEMENTS_ENABLED !== 'false';
const isVersioningEnabled = () => isBffEnabled() && import.meta.env.VITE_BFF_VERSIONING_ENABLED !== 'false';
const isFullRegistryEnabled = () => isBffEnabled() && import.meta.env.VITE_BFF_FULL_REGISTRY_ENABLED !== 'false';
const isProjectContextEnabled = () => isBffEnabled() && import.meta.env.VITE_BFF_PROJECT_CONTEXT_ENABLED !== 'false';
const isProjectContextDetailsEnabled = () => isBffEnabled() && import.meta.env.VITE_BFF_PROJECT_CONTEXT_DETAILS_ENABLED !== 'false';
const isSaveMetaEnabled = () => isBffEnabled() && import.meta.env.VITE_BFF_SAVE_META_ENABLED !== 'false';
const isSaveBuildingDetailsEnabled = () => isBffEnabled() && import.meta.env.VITE_BFF_SAVE_BUILDING_DETAILS_ENABLED !== 'false';
const isRegistrySummaryEnabled = () => isBffEnabled() && import.meta.env.VITE_BFF_REGISTRY_SUMMARY_ENABLED !== 'false';
const isApplicationsReadEnabled = () => isBffEnabled() && import.meta.env.VITE_BFF_APPLICATIONS_READ_ENABLED === 'true';
const isCatalogsEnabled = () => isBffEnabled() && import.meta.env.VITE_BFF_CATALOGS_ENABLED === 'true';

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
  constructor(message, code, details) {
    super(message);
    this.name = 'BffError';
    this.code = code;
    this.details = details;
  }
}

/**
 * 2. Описываем типы для аргументов, чтобы убрать ошибки "does not exist on type"
 * @typedef {Object} RequestOptions
 * @property {string} [method]
 * @property {any} [body]
 * @property {string} [userName]
 * @property {string} [userRole]
 * @property {string} [idempotencyKey]
 */

/**
 * @param {string} path
 * @param {RequestOptions} [options]
 */
async function request(path, options = {}) {
  const { method = 'GET', body, userName, userRole, idempotencyKey } = options;
  const clientRequestId = generateClientRequestId();

  const headers = {
    'x-client-request-id': clientRequestId,
    'x-operation-source': BFF_OPERATION_SOURCE,
    ...getAuthHeaders(),
  };
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
      payload?.details
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
  isLegacyRollbackEnabled,
  isCompositionEnabled,
  isFloorsEnabled,
  isEntrancesEnabled,
  isUnitsEnabled,
  isMopEnabled,
  isParkingEnabled,
  isIntegrationEnabled,
  isCadastreEnabled,
  isProjectInitEnabled,
  isProjectPassportEnabled,
  isBasementsEnabled,
  isVersioningEnabled,
  isFullRegistryEnabled,
  isProjectContextEnabled,
  isProjectContextDetailsEnabled,
  isSaveMetaEnabled,
  isSaveBuildingDetailsEnabled,
  isRegistrySummaryEnabled,
  isApplicationsReadEnabled, // <-- ДОБАВИТЬ ЭТО
  isCatalogsEnabled,         // <-- ДОБАВИТЬ ЭТО

  getRegistryBuildingsSummary: () => request('/api/v1/registry/buildings-summary'),

  getProjectsList: ({ scope }) =>
    request(`/api/v1/projects?scope=${encodeURIComponent(scope)}`),

  getCatalog: ({ table }) =>
    request(`/api/v1/catalogs/${encodeURIComponent(table)}?activeOnly=true`),

  getSystemUsers: () =>
    request(`/api/v1/catalogs/dict_system_users?activeOnly=true`),

  getCatalogAll: ({ table }) =>
    request(`/api/v1/catalogs/${encodeURIComponent(table)}`),

  getBuildings: ({ projectId }) =>
    request(`/api/v1/projects/${projectId}/buildings`),


  getProjectFullRegistry: ({ projectId }) =>
    request(`/api/v1/projects/${projectId}/full-registry`),

  getProjectContext: ({ scope, projectId }) =>
    request(`/api/v1/projects/${projectId}/context?scope=${encodeURIComponent(scope)}`),

  getProjectContextRegistryDetails: ({ projectId }) =>
    request(`/api/v1/projects/${projectId}/context-registry-details`),

  saveProjectContextMeta: ({ scope, projectId, complexInfo, applicationInfo, userName, userRole }) =>
    request(`/api/v1/projects/${projectId}/context-meta/save`, {
      method: 'POST',
      userName,
      userRole,
      body: { scope, complexInfo, applicationInfo },
    }),

  saveStepBlockStatuses: ({ scope, projectId, stepIndex, statuses, userName, userRole }) =>
    request(`/api/v1/projects/${projectId}/step-block-statuses/save`, {
      method: 'POST',
      userName,
      userRole,
      body: { scope, stepIndex, statuses },
    }),

  saveProjectBuildingDetails: ({ projectId, buildingDetails, userName, userRole }) =>
    request(`/api/v1/projects/${projectId}/context-building-details/save`, {
      method: 'POST',
      userName,
      userRole,
      body: { buildingDetails },
    }),


  getProjectPassport: ({ projectId }) =>
    request(`/api/v1/projects/${projectId}/passport`),

  updateProjectPassport: ({ projectId, info, cadastreData, userName, userRole }) =>
    request(`/api/v1/projects/${projectId}/passport`, {
      method: 'PUT',
      userName,
      userRole,
      body: { info, cadastreData },
    }),

  upsertProjectParticipant: ({ projectId, role, data, userName, userRole }) =>
    request(`/api/v1/projects/${projectId}/participants/${encodeURIComponent(role)}`, {
      method: 'PUT',
      userName,
      userRole,
      body: { data },
    }),

  upsertProjectDocument: ({ projectId, doc, userName, userRole }) =>
    request(`/api/v1/projects/${projectId}/documents`, {
      method: 'POST',
      userName,
      userRole,
      body: { doc },
    }),

  deleteProjectDocument: ({ documentId, userName, userRole }) =>
    request(`/api/v1/project-documents/${documentId}`, {
      method: 'DELETE',
      userName,
      userRole,
    }),

  deleteProject: ({ scope, projectId, userName, userRole }) =>
    request(`/api/v1/projects/${projectId}?scope=${encodeURIComponent(scope || '')}`, {
      method: 'DELETE',
      userName,
      userRole,
    }),

  getBasements: ({ projectId }) =>
    request(`/api/v1/projects/${projectId}/basements`),

  toggleBasementLevel: ({ basementId, level, isEnabled, userName, userRole }) =>
    request(`/api/v1/basements/${basementId}/parking-levels/${level}`, {
      method: 'PUT',
      userName,
      userRole,
      body: { isEnabled },
    }),

  getVersions: ({ entityType, entityId }) =>
    request(`/api/v1/versions?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`),

  createVersion: ({ entityType, entityId, snapshotData, createdBy, applicationId, userName, userRole }) =>
    request('/api/v1/versions', {
      method: 'POST',
      userName,
      userRole,
      body: { entityType, entityId, snapshotData, createdBy, applicationId },
    }),

  approveVersion: ({ versionId, approvedBy, userName, userRole }) =>
    request(`/api/v1/versions/${versionId}/approve`, {
      method: 'POST',
      userName,
      userRole,
      body: { approvedBy },
    }),

  declineVersion: ({ versionId, reason, declinedBy, userName, userRole }) =>
    request(`/api/v1/versions/${versionId}/decline`, {
      method: 'POST',
      userName,
      userRole,
      body: { reason, declinedBy },
    }),

  getVersionSnapshot: ({ versionId }) =>
    request(`/api/v1/versions/${versionId}/snapshot`),

  restoreVersion: ({ versionId, userName, userRole }) =>
    request(`/api/v1/versions/${versionId}/restore`, {
      method: 'POST',
      userName,
      userRole,
      body: {},
    }),


  createProjectFromApplication: ({ scope, appData, userName, userRole, idempotencyKey }) =>
    request('/api/v1/projects/from-application', {
      method: 'POST',
      userName,
      userRole,
      idempotencyKey,
      body: { scope, appData },
    }),


  getParkingCounts: ({ projectId }) =>
    request(`/api/v1/projects/${projectId}/parking-counts`),


  getIntegrationStatus: ({ projectId }) =>
    request(`/api/v1/projects/${projectId}/integration-status`),

  updateIntegrationStatus: ({ projectId, field, status, userName, userRole }) =>
    request(`/api/v1/projects/${projectId}/integration-status`, {
      method: 'PUT',
      userName,
      userRole,
      body: { field, status },
    }),

  updateBuildingCadastre: ({ buildingId, cadastre, userName, userRole }) =>
    request(`/api/v1/buildings/${buildingId}/cadastre`, {
      method: 'PUT',
      userName,
      userRole,
      body: { cadastre },
    }),

  updateUnitCadastre: ({ unitId, cadastre, userName, userRole }) =>
    request(`/api/v1/units/${unitId}/cadastre`, {
      method: 'PUT',
      userName,
      userRole,
      body: { cadastre },
    }),

  syncParkingPlaces: ({ floorId, targetCount, userName, userRole, idempotencyKey }) =>
    request(`/api/v1/floors/${floorId}/parking-places/sync`, {
      method: 'POST',
      userName,
      userRole,
      idempotencyKey,
      body: { targetCount },
    }),

  createBuilding: ({ projectId, buildingData, blocksData, userName, userRole }) =>
    request(`/api/v1/projects/${projectId}/buildings`, {
      method: 'POST',
      userName,
      userRole,
      body: { buildingData, blocksData },
    }),

  updateBuilding: ({ buildingId, buildingData, blocksData, userName, userRole }) =>
    request(`/api/v1/buildings/${buildingId}`, {
      method: 'PUT',
      userName,
      userRole,
      body: { buildingData, blocksData },
    }),

  deleteBuilding: ({ buildingId, userName, userRole }) =>
    request(`/api/v1/buildings/${buildingId}`, {
      method: 'DELETE',
      userName,
      userRole,
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

  upsertUnit: ({ unitData, userName, userRole }) =>
    request('/api/v1/units/upsert', {
      method: 'POST',
      userName,
      userRole,
      body: unitData,
    }),

  batchUpsertUnits: ({ unitsList, userName, userRole, idempotencyKey }) =>
    request('/api/v1/units/batch-upsert', {
      method: 'POST',
      userName,
      userRole,
      idempotencyKey,
      body: { unitsList },
    }),

  reconcileUnitsForBlock: ({ blockId, userName, userRole, idempotencyKey }) =>
    request(`/api/v1/blocks/${blockId}/units/reconcile`, {
      method: 'POST',
      userName,
      userRole,
      idempotencyKey,
      body: {},
    }),

  reconcileCommonAreasForBlock: ({ blockId, userName, userRole, idempotencyKey }) =>
    request(`/api/v1/blocks/${blockId}/common-areas/reconcile`, {
      method: 'POST',
      userName,
      userRole,
      idempotencyKey,
      body: {},
    }),

  upsertCommonArea: ({ data, userName, userRole }) =>
    request('/api/v1/common-areas/upsert', {
      method: 'POST',
      userName,
      userRole,
      body: data,
    }),

  deleteCommonArea: ({ id, userName, userRole }) =>
    request(`/api/v1/common-areas/${id}`, {
      method: 'DELETE',
      userName,
      userRole,
    }),

  clearCommonAreas: ({ blockId, floorIds = [], userName, userRole }) =>
    request(`/api/v1/blocks/${blockId}/common-areas/clear`, {
      method: 'POST',
      userName,
      userRole,
      body: { floorIds: floorIds.join(',') },
    }),

  updateFloor: ({ floorId, updates, userName, userRole }) =>
    request(`/api/v1/floors/${floorId}`, {
      method: 'PUT',
      userName,
      userRole,
      body: { updates },
    }),

  reconcileFloors: ({ blockId, floorsFrom, floorsTo, defaultType, userName, userRole, idempotencyKey }) =>
    request(`/api/v1/blocks/${blockId}/floors/reconcile`, {
      method: 'POST',
      userName,
      userRole,
      idempotencyKey,
      body: { floorsFrom, floorsTo, defaultType },
    }),

  upsertMatrixCell: ({ blockId, floorId, entranceNumber, values, userName, userRole }) =>
    request(`/api/v1/blocks/${blockId}/entrance-matrix/cell`, {
      method: 'PUT',
      userName,
      userRole,
      body: { floorId, entranceNumber, values },
    }),

  reconcileEntrances: ({ blockId, count, userName, userRole, idempotencyKey }) =>
    request(`/api/v1/blocks/${blockId}/entrances/reconcile`, {
      method: 'POST',
      userName,
      userRole,
      idempotencyKey,
      body: { count },
    }),

    resolveApplicationId: ({ projectId, scope }) =>
    request(`/api/v1/projects/${projectId}/application-id?scope=${encodeURIComponent(scope || '')}`),
    
  acquireApplicationLock: ({ applicationId, userName, userRole, ttlMinutes = 20 }) =>
    request(`/api/v1/applications/${applicationId}/locks/acquire`, {
      method: 'POST',
      userName,
      userRole,
      body: { ttlSeconds: Math.max(60, Math.floor(ttlMinutes * 60)) },
    }),

  refreshApplicationLock: ({ applicationId, userName, userRole, ttlMinutes = 20 }) =>
    request(`/api/v1/applications/${applicationId}/locks/refresh`, {
      method: 'POST',
      userName,
      userRole,
      body: { ttlSeconds: Math.max(60, Math.floor(ttlMinutes * 60)) },
    }),

  releaseApplicationLock: ({ applicationId, userName, userRole }) =>
    request(`/api/v1/applications/${applicationId}/locks/release`, {
      method: 'POST',
      userName,
      userRole,
      body: {},
    }),

  completeStep: ({ applicationId, stepIndex, comment, userName, userRole, idempotencyKey }) =>
    request(`/api/v1/applications/${applicationId}/workflow/complete-step`, {
      method: 'POST',
      userName,
      userRole,
      idempotencyKey,
      body: { stepIndex, comment },
    }),

  rollbackStep: ({ applicationId, reason, userName, userRole, idempotencyKey }) =>
    request(`/api/v1/applications/${applicationId}/workflow/rollback-step`, {
      method: 'POST',
      userName,
      userRole,
      idempotencyKey,
      body: { reason },
    }),

  reviewApprove: ({ applicationId, comment, userName, userRole, idempotencyKey }) =>
    request(`/api/v1/applications/${applicationId}/workflow/review-approve`, {
      method: 'POST',
      userName,
      userRole,
      idempotencyKey,
      body: { comment },
    }),

  reviewReject: ({ applicationId, reason, userName, userRole, idempotencyKey }) =>
    request(`/api/v1/applications/${applicationId}/workflow/review-reject`, {
      method: 'POST',
      userName,
      userRole,
      idempotencyKey,
      body: { reason },
    }),

  assignTechnician: ({ applicationId, assigneeUserId, reason, userName, userRole, idempotencyKey }) =>
    request(`/api/v1/applications/${applicationId}/workflow/assign-technician`, {
      method: 'POST',
      userName,
      userRole,
      idempotencyKey,
      body: { assigneeUserId, reason },
    }),

  requestDecline: ({ applicationId, reason, stepIndex, userName, userRole, idempotencyKey }) =>
    request(`/api/v1/applications/${applicationId}/workflow/request-decline`, {
      method: 'POST',
      userName,
      userRole,
      idempotencyKey,
      body: { reason, stepIndex },
    }),

  declineApplication: ({ applicationId, reason, userName, userRole, idempotencyKey }) =>
    request(`/api/v1/applications/${applicationId}/workflow/decline`, {
      method: 'POST',
      userName,
      userRole,
      idempotencyKey,
      body: { reason },
    }),

  returnFromDecline: ({ applicationId, comment, userName, userRole, idempotencyKey }) =>
    request(`/api/v1/applications/${applicationId}/workflow/return-from-decline`, {
      method: 'POST',
      userName,
      userRole,
      idempotencyKey,
      body: { comment },
    }),

  restoreApplication: ({ applicationId, comment, userName, userRole, idempotencyKey }) =>
    request(`/api/v1/applications/${applicationId}/workflow/restore`, {
      method: 'POST',
      userName,
      userRole,
      idempotencyKey,
      body: { comment },
    }),
};
