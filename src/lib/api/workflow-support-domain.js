export const createWorkflowSupportApi = ({
  BffClient,
  requireBffEnabled,
  resolveActor,
  createIdempotencyKey,
}) => ({
  saveStepBlockStatuses: async ({ scope, projectId, stepIndex, statuses }) => {
    requireBffEnabled('project.saveStepBlockStatuses');

    const resolvedActor = resolveActor({});
    return BffClient.saveStepBlockStatuses({
      scope,
      projectId,
      stepIndex,
      statuses,
      userName: resolvedActor.userName,
      userRoleId: resolvedActor.userRoleId,
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
      userRoleId: resolvedActor.userRoleId,
      userRole: resolvedActor.userRole,
    });
  },

  acquireApplicationLock: async ({ scope, projectId, userName, userRole, userRoleId, ttlMinutes = 20 }) => {
    requireBffEnabled('locks.acquireApplicationLock');

    const res = await BffClient.resolveApplicationId({ projectId, scope });
    if (!res?.applicationId) {
      return { ok: false, reason: 'NOT_FOUND', message: 'Заявка не найдена' };
    }

    const response = await BffClient.acquireApplicationLock({
      applicationId: res.applicationId,
      userName,
      userRole,
      userRoleId,
      ttlMinutes,
    });
    return { ...response, applicationId: res.applicationId };
  },

  refreshApplicationLock: async ({ applicationId, userName, userRole, userRoleId, ttlMinutes = 20 }) => {
    requireBffEnabled('locks.refreshApplicationLock');
    return BffClient.refreshApplicationLock({ applicationId, userName, userRole, userRoleId, ttlMinutes });
  },

  releaseApplicationLock: async ({ applicationId, userName, userRole, userRoleId }) => {
    if (!applicationId) return { ok: false };

    requireBffEnabled('locks.releaseApplicationLock');
    return BffClient.releaseApplicationLock({ applicationId, userName, userRole, userRoleId });
  },

  completeWorkflowStepViaBff: async ({ applicationId, stepIndex, comment, userName, userRole, userRoleId, idempotencyKey }) => {
    if (!BffClient.isEnabled()) return null;
    return BffClient.completeStep({
      applicationId,
      stepIndex,
      comment,
      userName,
      userRoleId,
      userRole,
      idempotencyKey: idempotencyKey || createIdempotencyKey('workflow-complete-step', [applicationId, stepIndex]),
    });
  },

  rollbackWorkflowStepViaBff: async ({ applicationId, reason, userName, userRole, userRoleId, idempotencyKey }) => {
    if (!BffClient.isEnabled()) return null;
    return BffClient.rollbackStep({
      applicationId,
      reason,
      userName,
      userRoleId,
      userRole,
      idempotencyKey: idempotencyKey || createIdempotencyKey('workflow-rollback-step', [applicationId]),
    });
  },

  reviewWorkflowStageViaBff: async ({ applicationId, action, comment, userName, userRole, userRoleId, idempotencyKey }) => {
    if (!BffClient.isEnabled()) return null;
    if (action === 'APPROVE') {
      return BffClient.reviewApprove({
        applicationId,
        comment,
        userName,
        userRoleId,
        userRole,
        idempotencyKey: idempotencyKey || createIdempotencyKey('workflow-review-approve', [applicationId]),
      });
    }

    return BffClient.reviewReject({
      applicationId,
      reason: comment,
      userName,
      userRoleId,
      userRole,
      idempotencyKey: idempotencyKey || createIdempotencyKey('workflow-review-reject', [applicationId]),
    });
  },

  requestDeclineViaBff: async ({ applicationId, reason, stepIndex, userName, userRole, userRoleId, idempotencyKey }) => {
    if (!BffClient.isEnabled()) return null;
    return BffClient.requestDecline({
      applicationId,
      reason,
      stepIndex,
      userName,
      userRoleId,
      userRole,
      idempotencyKey: idempotencyKey || createIdempotencyKey('workflow-request-decline', [applicationId, stepIndex]),
    });
  },

  declineApplicationViaBff: async ({ applicationId, reason, userName, userRole, userRoleId, idempotencyKey }) => {
    if (!BffClient.isEnabled()) return null;
    return BffClient.declineApplication({
      applicationId,
      reason,
      userName,
      userRoleId,
      userRole,
      idempotencyKey: idempotencyKey || createIdempotencyKey('workflow-decline', [applicationId]),
    });
  },

  returnFromDeclineViaBff: async ({ applicationId, comment, userName, userRole, userRoleId, idempotencyKey }) => {
    if (!BffClient.isEnabled()) return null;
    return BffClient.returnFromDecline({
      applicationId,
      comment,
      userName,
      userRoleId,
      userRole,
      idempotencyKey: idempotencyKey || createIdempotencyKey('workflow-return-from-decline', [applicationId]),
    });
  },

  restoreApplicationViaBff: async ({ applicationId, comment, userName, userRole, userRoleId, idempotencyKey }) => {
    if (!BffClient.isEnabled()) return null;
    return BffClient.restoreApplication({
      applicationId,
      comment,
      userName,
      userRoleId,
      userRole,
      idempotencyKey: idempotencyKey || createIdempotencyKey('workflow-restore', [applicationId]),
    });
  },
});
