const isObject = value => value !== null && typeof value === 'object';

export const createVersionsApi = legacyApi => ({
  getVersions: (entityType, entityId) => legacyApi.getVersions(entityType, entityId),

  createVersion: (entityTypeOrPayload, entityId, snapshotData, payload = {}) => {
    if (isObject(entityTypeOrPayload)) return legacyApi.createVersion(entityTypeOrPayload);

    return legacyApi.createVersion({
      entityType: entityTypeOrPayload,
      entityId,
      snapshotData,
      createdBy: payload.createdBy,
      applicationId: payload.applicationId,
    });
  },

  approveVersion: (versionIdOrPayload, approvedBy = null) => {
    if (isObject(versionIdOrPayload)) return legacyApi.approveVersion(versionIdOrPayload);

    return legacyApi.approveVersion({
      versionId: versionIdOrPayload,
      approvedBy,
    });
  },

  declineVersion: (versionIdOrPayload, reason, declinedBy = null) => {
    if (isObject(versionIdOrPayload)) return legacyApi.declineVersion(versionIdOrPayload);

    return legacyApi.declineVersion({
      versionId: versionIdOrPayload,
      reason,
      declinedBy,
    });
  },

  getVersionSnapshot: versionId => legacyApi.getVersionSnapshot(versionId),

  restoreVersion: (versionIdOrPayload = {}) => {
    if (isObject(versionIdOrPayload)) return legacyApi.restoreVersion(versionIdOrPayload);

    return legacyApi.restoreVersion({ versionId: versionIdOrPayload });
  },
});
