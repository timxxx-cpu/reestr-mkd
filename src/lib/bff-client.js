const isBffEnabled = () => import.meta.env.VITE_BFF_ENABLED === 'true';
const getBffBaseUrl = () => import.meta.env.VITE_BFF_BASE_URL || 'http://localhost:8787';

const getAuthHeaders = (userName, userRole) => ({
  'x-user-id': userName || 'unknown',
  'x-user-role': userRole || 'technician',
});

async function request(path, { method = 'GET', body, userName, userRole } = {}) {
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
    const err = new Error(payload?.message || `BFF request failed: ${res.status}`);
    err.code = payload?.code;
    err.details = payload?.details;
    throw err;
  }

  return payload;
}

export const BffClient = {
  isEnabled: isBffEnabled,

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
