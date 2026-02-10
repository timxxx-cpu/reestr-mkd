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
});
