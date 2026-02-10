export const createVersionsApi = legacyApi => ({
  getVersions: legacyApi.getVersions,
  createVersion: legacyApi.createVersion,
  approveVersion: legacyApi.approveVersion,
  declineVersion: legacyApi.declineVersion,
  getVersionSnapshot: legacyApi.getVersionSnapshot,
  restoreVersion: legacyApi.restoreVersion,
});
