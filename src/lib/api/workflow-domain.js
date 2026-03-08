import { ROLE_IDS } from '../roles';

export const createWorkflowDomainApi = ({ BffClient, requireBffEnabled, resolveActor, createIdempotencyKey }) => ({
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
      userRoleId: resolvedActor.userRoleId,
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
      userRoleId: resolvedActor.userRoleId,
      userRole: resolvedActor.userRole,
    });
  },

  updateUnitCadastre: async (id, cadastre, actor = {}) => {
    if (!id) return;
    requireBffEnabled('integration.updateUnitCadastre');

    const resolvedActor = resolveActor(actor);
    return BffClient.updateUnitCadastre({
      unitId: id,
      cadastre,
      userName: resolvedActor.userName,
      userRoleId: resolvedActor.userRoleId,
      userRole: resolvedActor.userRole,
    });
  },

 declineApplication: async ({ applicationId, userName, reason, userRole = 'branch_manager', userRoleId = ROLE_IDS.BRANCH_MANAGER, nextSubstatus, prevStatus }) => {
    requireBffEnabled('workflow.declineApplication');

    return BffClient.declineApplication({
      applicationId,
      reason,
      userName,
      userRoleId,
      userRole,
      // Опционально: если бэкенд научится понимать эти статусы, можно передавать их и в BffClient
      idempotencyKey: createIdempotencyKey('workflow-decline', [applicationId]),
    });
  },

  requestDecline: async ({ applicationId, reason, stepIndex, requestedBy, userRole = 'technician', userRoleId = ROLE_IDS.TECHNICIAN }) => {
    requireBffEnabled('workflow.requestDecline');

    return BffClient.requestDecline({
      applicationId,
      reason,
      stepIndex,
      userName: requestedBy,
      userRoleId,
      userRole,
      idempotencyKey: createIdempotencyKey('workflow-request-decline', [applicationId, stepIndex]),
    });
  },

  returnFromDecline: async ({ applicationId, userName, userRole = 'branch_manager', userRoleId = ROLE_IDS.BRANCH_MANAGER, comment }) => {
    requireBffEnabled('workflow.returnFromDecline');

    return BffClient.returnFromDecline({
      applicationId,
      comment,
      userName,
      userRoleId,
      userRole,
      idempotencyKey: createIdempotencyKey('workflow-return-from-decline', [applicationId]),
    });
  },

 assignTechnician: async ({ applicationId, assigneeUserId, userName = 'system', userRole = 'branch_manager', userRoleId = ROLE_IDS.BRANCH_MANAGER, reason = null }) => {
    requireBffEnabled('workflow.assignTechnician');

    return BffClient.assignTechnician({
      applicationId,
      assigneeUserId, // Теперь переменные совпадают
      reason,
      userName,
      userRoleId,
      userRole,
      idempotencyKey: createIdempotencyKey('workflow-assign-technician', [applicationId, assigneeUserId]),
    });
  },

  restoreApplication: async ({ applicationId, userName, userRole = 'admin', userRoleId = ROLE_IDS.ADMIN, comment }) => {
    requireBffEnabled('workflow.restoreApplication');

    return BffClient.restoreApplication({
      applicationId,
      comment,
      userName,
      userRoleId,
      userRole,
      idempotencyKey: createIdempotencyKey('workflow-restore', [applicationId]),
    });
  },
});
