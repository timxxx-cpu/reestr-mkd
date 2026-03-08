export const createVersionsDomainApi = ({ BffClient, requireBffEnabled, resolveActor }) => ({
  createVersion: async ({ entityType, entityId, snapshotData, createdBy, applicationId }) => {
    requireBffEnabled('versions.createVersion');

    const actor = resolveActor({ userName: createdBy });
    return BffClient.createVersion({
      entityType,
      entityId,
      snapshotData,
      applicationId,
      createdBy,
      userName: actor.userName,
      userRoleId: actor.userRoleId,
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
      userRoleId: actor.userRoleId,
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
      userRoleId: actor.userRoleId,
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
      userRoleId: actor.userRoleId,
      userRole: actor.userRole,
    });
  },
});
