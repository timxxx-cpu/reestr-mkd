export const createWorkflowApi = legacyApi => ({
  getIntegrationStatus: legacyApi.getIntegrationStatus,
  updateIntegrationStatus: legacyApi.updateIntegrationStatus,
  updateBuildingCadastre: legacyApi.updateBuildingCadastre,
  updateUnitCadastre: legacyApi.updateUnitCadastre,

  // workflow actions
  declineApplication: legacyApi.declineApplication,
  requestDecline: legacyApi.requestDecline,
  returnFromDecline: legacyApi.returnFromDecline,
  assignTechnician: legacyApi.assignTechnician,
  restoreApplication: legacyApi.restoreApplication,

  // --- ДОБАВЛЕНО: BFF методы и Locks ---
  acquireApplicationLock: legacyApi.acquireApplicationLock,
  refreshApplicationLock: legacyApi.refreshApplicationLock,
  releaseApplicationLock: legacyApi.releaseApplicationLock,
  completeWorkflowStepViaBff: legacyApi.completeWorkflowStepViaBff,
  rollbackWorkflowStepViaBff: legacyApi.rollbackWorkflowStepViaBff,
  reviewWorkflowStageViaBff: legacyApi.reviewWorkflowStageViaBff,
  requestDeclineViaBff: legacyApi.requestDeclineViaBff,
  declineApplicationViaBff: legacyApi.declineApplicationViaBff,
  returnFromDeclineViaBff: legacyApi.returnFromDeclineViaBff,
  restoreApplicationViaBff: legacyApi.restoreApplicationViaBff,
});