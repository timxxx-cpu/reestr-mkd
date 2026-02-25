export const createProjectApi = legacyApi => ({
  getSystemUsers: legacyApi.getSystemUsers,
  
  // 👇 ДОБАВИТЬ ЭТИ ДВЕ СТРОЧКИ 👇
  getProjectsPage: legacyApi.getProjectsPage,
  getProjectsSummaryCounts: legacyApi.getProjectsSummaryCounts,
  
  getProjectsList: legacyApi.getProjectsList,
  getExternalApplications: legacyApi.getExternalApplications,
  createProjectFromApplication: legacyApi.createProjectFromApplication,
  deleteProject: legacyApi.deleteProject,
  getProjectFullData: legacyApi.getProjectFullData,
  getProjectDetails: legacyApi.getProjectDetails,
  createProject: legacyApi.createProject,
  updateProjectInfo: legacyApi.updateProjectInfo,
  upsertParticipant: legacyApi.upsertParticipant,
  upsertDocument: legacyApi.upsertDocument,
  deleteDocument: legacyApi.deleteDocument,
  getProjectFullRegistry: legacyApi.getProjectFullRegistry,
  acquireApplicationLock: legacyApi.acquireApplicationLock,
  refreshApplicationLock: legacyApi.refreshApplicationLock,
  releaseApplicationLock: legacyApi.releaseApplicationLock,
});