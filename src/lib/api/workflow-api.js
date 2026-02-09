export const createWorkflowApi = legacyApi => ({
  getIntegrationStatus: legacyApi.getIntegrationStatus,
  updateIntegrationStatus: legacyApi.updateIntegrationStatus,
  updateBuildingCadastre: legacyApi.updateBuildingCadastre,
  updateUnitCadastre: legacyApi.updateUnitCadastre,
});
