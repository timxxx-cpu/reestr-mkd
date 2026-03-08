import {
  mapProjectAggregate,
  mapBuildingFromDB,
  mapBlockDetailsFromDB,
  mapFloorFromDB,
  mapUnitFromDB,
  mapMopFromDB,
} from './db-mappers';
import { createVersionsApi } from './api/versions-api-factory';
import { createVersionsDomainApi } from './api/versions-domain';
import { createWorkflowDomainApi } from './api/workflow-domain';
import { createWorkflowSupportApi } from './api/workflow-support-domain';
import { createRegistryDomainApi } from './api/registry-domain';
import { createProjectDomainApi } from './api/project-domain';
import { createDashboardLegacyApi } from './api/dashboard-legacy-domain';
import { BffClient } from './bff-client';
import { resolveActor, requireBffEnabled, createIdempotencyKey } from './api/api-core';
import { normalizeUserRole } from './roles';

const LegacyApiService = {
  ...createDashboardLegacyApi({ BffClient, normalizeUserRole }),
  ...createWorkflowSupportApi({
    BffClient,
    requireBffEnabled,
    resolveActor,
    createIdempotencyKey,
  }),
  ...createRegistryDomainApi({
    BffClient,
    requireBffEnabled,
    resolveActor,
    createIdempotencyKey,
    mapFloorFromDB,
    mapUnitFromDB,
    mapMopFromDB,
  }),
  ...createProjectDomainApi({
    BffClient,
    requireBffEnabled,
    resolveActor,
    createIdempotencyKey,
    mapProjectAggregate,
    mapBuildingFromDB,
    mapBlockDetailsFromDB,
  }),
  ...createWorkflowDomainApi({
    BffClient,
    requireBffEnabled,
    resolveActor,
    createIdempotencyKey,
  }),

  getVersions: async (entityType, entityId) => {
    requireBffEnabled('versions.getVersions');
    return BffClient.getVersions({ entityType, entityId });
  },

  ...createVersionsDomainApi({
    BffClient,
    requireBffEnabled,
    resolveActor,
  }),
};

export const ApiService = {
  ...LegacyApiService,
  ...createVersionsApi(LegacyApiService),
};
