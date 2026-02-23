const isBffEnabled = () => import.meta.env.VITE_BFF_ENABLED === 'true';
const getBffBaseUrl = () => import.meta.env.VITE_BFF_BASE_URL || 'http://localhost:8787';
const isCompositionEnabled = () => isBffEnabled() && import.meta.env.VITE_BFF_COMPOSITION_ENABLED === 'true';
const isFloorsEnabled = () => isBffEnabled() && import.meta.env.VITE_BFF_FLOORS_ENABLED === 'true';
const isEntrancesEnabled = () => isBffEnabled() && import.meta.env.VITE_BFF_ENTRANCES_ENABLED === 'true';
const isUnitsEnabled = () => isBffEnabled() && import.meta.env.VITE_BFF_UNITS_ENABLED === 'true';
const isMopEnabled = () => isBffEnabled() && import.meta.env.VITE_BFF_MOP_ENABLED === 'true';
const isParkingEnabled = () => isBffEnabled() && import.meta.env.VITE_BFF_PARKING_ENABLED === 'true';

const getAuthHeaders = (userName, userRole) => ({
  'x-user-id': encodeURIComponent(userName || 'unknown'),
  'x-user-role': userRole || 'technician',
});

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
 */

/**
 * @param {string} path
 * @param {RequestOptions} [options]
 */
async function request(path, options = {}) {
  const { method = 'GET', body, userName, userRole } = options;

  const res = await fetch(`${getBffBaseUrl()}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...getAuthHeaders(userName, userRole),
    },
    body: body ? JSON.stringify(body) : undefined,
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

  return payload;
}

export const BffClient = {
  isEnabled: isBffEnabled,
  isCompositionEnabled,
  isFloorsEnabled,
  isEntrancesEnabled,
  isUnitsEnabled,
  isMopEnabled,
  isParkingEnabled,

  getBuildings: ({ projectId }) =>
    request(`/api/v1/projects/${projectId}/buildings`),

  getParkingCounts: ({ projectId }) =>
    request(`/api/v1/projects/${projectId}/parking-counts`),

  syncParkingPlaces: ({ floorId, targetCount, userName, userRole }) =>
    request(`/api/v1/floors/${floorId}/parking-places/sync`, {
      method: 'POST',
      userName,
      userRole,
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

  batchUpsertUnits: ({ unitsList, userName, userRole }) =>
    request('/api/v1/units/batch-upsert', {
      method: 'POST',
      userName,
      userRole,
      body: { unitsList },
    }),

  reconcileUnitsForBlock: ({ blockId, userName, userRole }) =>
    request(`/api/v1/blocks/${blockId}/units/reconcile`, {
      method: 'POST',
      userName,
      userRole,
      body: {},
    }),

  reconcileCommonAreasForBlock: ({ blockId, userName, userRole }) =>
    request(`/api/v1/blocks/${blockId}/common-areas/reconcile`, {
      method: 'POST',
      userName,
      userRole,
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

  reconcileFloors: ({ blockId, floorsFrom, floorsTo, defaultType, userName, userRole }) =>
    request(`/api/v1/blocks/${blockId}/floors/reconcile`, {
      method: 'POST',
      userName,
      userRole,
      body: { floorsFrom, floorsTo, defaultType },
    }),

  upsertMatrixCell: ({ blockId, floorId, entranceNumber, values, userName, userRole }) =>
    request(`/api/v1/blocks/${blockId}/entrance-matrix/cell`, {
      method: 'PUT',
      userName,
      userRole,
      body: { floorId, entranceNumber, values },
    }),

  reconcileEntrances: ({ blockId, count, userName, userRole }) =>
    request(`/api/v1/blocks/${blockId}/entrances/reconcile`, {
      method: 'POST',
      userName,
      userRole,
      body: { count },
    }),

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
      body: { stepIndex, comment, idempotencyKey },
    }),

  rollbackStep: ({ applicationId, reason, userName, userRole, idempotencyKey }) =>
    request(`/api/v1/applications/${applicationId}/workflow/rollback-step`, {
      method: 'POST',
      userName,
      userRole,
      body: { reason, idempotencyKey },
    }),

  reviewApprove: ({ applicationId, comment, userName, userRole, idempotencyKey }) =>
    request(`/api/v1/applications/${applicationId}/workflow/review-approve`, {
      method: 'POST',
      userName,
      userRole,
      body: { comment, idempotencyKey },
    }),

  reviewReject: ({ applicationId, reason, userName, userRole, idempotencyKey }) =>
    request(`/api/v1/applications/${applicationId}/workflow/review-reject`, {
      method: 'POST',
      userName,
      userRole,
      body: { reason, idempotencyKey },
    }),

  assignTechnician: ({ applicationId, assigneeUserId, reason, userName, userRole }) =>
    request(`/api/v1/applications/${applicationId}/workflow/assign-technician`, {
      method: 'POST',
      userName,
      userRole,
      body: { assigneeUserId, reason },
    }),

  requestDecline: ({ applicationId, reason, stepIndex, userName, userRole }) =>
    request(`/api/v1/applications/${applicationId}/workflow/request-decline`, {
      method: 'POST',
      userName,
      userRole,
      body: { reason, stepIndex },
    }),

  declineApplication: ({ applicationId, reason, userName, userRole, idempotencyKey }) =>
    request(`/api/v1/applications/${applicationId}/workflow/decline`, {
      method: 'POST',
      userName,
      userRole,
      body: { reason, idempotencyKey },
    }),

  returnFromDecline: ({ applicationId, comment, userName, userRole }) =>
    request(`/api/v1/applications/${applicationId}/workflow/return-from-decline`, {
      method: 'POST',
      userName,
      userRole,
      body: { comment },
    }),

  restoreApplication: ({ applicationId, comment, userName, userRole }) =>
    request(`/api/v1/applications/${applicationId}/workflow/restore`, {
      method: 'POST',
      userName,
      userRole,
      body: { comment },
    }),
};
