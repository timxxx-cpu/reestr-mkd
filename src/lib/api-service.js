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
import { createRegistryDomainApi } from './api/registry-domain';
import { createProjectDomainApi } from './api/project-domain';
import { BffClient } from './bff-client';
import { resolveActor, requireBffEnabled, createIdempotencyKey } from './api/api-core';





const LegacyApiService = {
 getSystemUsers: async () => {
    const data = await BffClient.getSystemUsers();

    // Безопасно достаем массив: либо напрямую, либо из поля .users
    const usersArray = Array.isArray(data) ? data : (data?.users || []);

    return usersArray.map(u => ({
      id: u.id,
      code: u.code,
      name: u.name,
      role: u.role,
      group: u.group_name || u.name,
      sortOrder: u.sort_order || 100,
    }));
  },

  // ... дальше идет getProjectsList ...

  // --- DASHBOARD & LISTS ---

  // src/lib/api-service.js

  // [UPDATED] Получить список проектов
  getProjectsPage: async (scope, options = {}) => {
    if (!scope) {
      return {
        items: [],
        page: Number(options?.page || 1),
        limit: Number(options?.limit || 50),
        total: 0,
        totalPages: 0,
      };
    }

    const response = await BffClient.getProjectsList({ scope, ...options });
    
    // Получаем сырой массив проектов
    const rawItems = Array.isArray(response) 
        ? response 
        : (Array.isArray(response?.items) ? response.items : (Array.isArray(response?.data) ? response.data : []));

    // МАППЕР: Переводим плоский snake_case ответ Java во вложенный camelCase для дашборда
    const mappedItems = rawItems.map(item => {
      // Если данные уже имеют старый вложенный формат, оставляем как есть
      if (item.applicationInfo) return item;

      return {
        id: item.id,
        name: item.name,
        ujCode: item.uj_code || item.ujCode, // Фронтенд ждет ujCode
        cadastre: item.cadastre_number || item.cadastre,
        applicationInfo: {
          status: item.status || 'IN_PROGRESS',
          workflowSubstatus: item.workflow_substatus || 'DRAFT',
          assigneeName: item.assignee_name,
          externalSource: item.external_source,
          applicant: item.applicant,
          submissionDate: item.updated_at,
          internalNumber: item.internal_number,
          externalId: item.external_id,
          currentStepIndex: item.current_step || 0
        },
        complexInfo: {
          street: item.address,
          region: item.region,
        }
      };
    });

    if (Array.isArray(response)) {
      const page = Number(options?.page || 1);
      const limit = Number(options?.limit || response.length || 1);
      return {
        items: mappedItems, // Отдаем смапленные данные
        page,
        limit,
        total: response.length,
        totalPages: response.length > 0 ? Math.ceil(response.length / Math.max(limit, 1)) : 0,
      };
    }

    return {
      items: mappedItems, // Отдаем смапленные данные
      page: Number(response?.page || options?.page || 1),
      limit: Number(response?.limit || options?.limit || 50),
      total: Number(response?.total || 0),
      totalPages: Number(response?.totalPages || 0),
    };
  },

  getProjectsList: async (scope, options = {}) => {
    const pageData = await LegacyApiService.getProjectsPage(scope, options);
    return pageData.items;
  },

/**
   * @param {Object} [params]
   * @param {string} [params.scope]
   * @param {string} [params.assignee]
   */

  getProjectsMapOverview: async scope => {
    if (!scope) return { items: [] };
    return BffClient.getProjectsMapOverview({ scope });
  },

/**
   * @param {Object} [params]
   * @param {string} [params.scope]
   * @param {string} [params.assignee]
   */
  getProjectsSummaryCounts: async ({ scope, assignee } = {}) => {
    if (!scope) {
      return {
        work: 0,
        review: 0,
        integration: 0,
        pendingDecline: 0,
        declined: 0,
        registryApplications: 0,
        registryComplexes: 0,
      };
    }

    return BffClient.getProjectsSummaryCounts({ scope, assignee });
  },
  saveStepBlockStatuses: async ({ scope, projectId, stepIndex, statuses }) => {
    requireBffEnabled('project.saveStepBlockStatuses');

    const resolvedActor = resolveActor({});
    return BffClient.saveStepBlockStatuses({
      scope,
      projectId,
      stepIndex,
      statuses,
      userName: resolvedActor.userName,
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
      userRole: resolvedActor.userRole,
    });
  },

  getExternalApplications: async scope => {
    requireBffEnabled('project.getExternalApplications');
    return BffClient.getExternalApplications({ scope });
  },

  // --- WORK LOCK (защита от одновременного редактирования) ---
 acquireApplicationLock: async ({ scope, projectId, userName, userRole, ttlMinutes = 20 }) => {
    requireBffEnabled('locks.acquireApplicationLock');

    const res = await BffClient.resolveApplicationId({ projectId, scope });
    if (!res?.applicationId) return { ok: false, reason: 'NOT_FOUND', message: 'Заявка не найдена' };

    const response = await BffClient.acquireApplicationLock({
      applicationId: res.applicationId,
      userName,
      userRole,
      ttlMinutes,
    });
    return { ...response, applicationId: res.applicationId };
  },


  refreshApplicationLock: async ({ applicationId, userName, userRole = 'technician', ttlMinutes = 20 }) => {
    requireBffEnabled('locks.refreshApplicationLock');
    return BffClient.refreshApplicationLock({ applicationId, userName, userRole, ttlMinutes });
  },


  releaseApplicationLock: async ({ applicationId, userName, userRole = 'technician' }) => {
    if (!applicationId) return { ok: false };

    requireBffEnabled('locks.releaseApplicationLock');
    return BffClient.releaseApplicationLock({ applicationId, userName, userRole });
  },


  completeWorkflowStepViaBff: async ({ applicationId, stepIndex, comment, userName, userRole, idempotencyKey }) => {
    if (!BffClient.isEnabled()) return null;
    return BffClient.completeStep({
      applicationId,
      stepIndex,
      comment,
      userName,
      userRole,
      idempotencyKey: idempotencyKey || createIdempotencyKey('workflow-complete-step', [applicationId, stepIndex]),
    });
  },


  rollbackWorkflowStepViaBff: async ({ applicationId, reason, userName, userRole, idempotencyKey }) => {
    if (!BffClient.isEnabled()) return null;
    return BffClient.rollbackStep({
      applicationId,
      reason,
      userName,
      userRole,
      idempotencyKey: idempotencyKey || createIdempotencyKey('workflow-rollback-step', [applicationId]),
    });
  },

  reviewWorkflowStageViaBff: async ({ applicationId, action, comment, userName, userRole, idempotencyKey }) => {
    if (!BffClient.isEnabled()) return null;
    if (action === 'APPROVE') {
      return BffClient.reviewApprove({
        applicationId,
        comment,
        userName,
        userRole,
        idempotencyKey: idempotencyKey || createIdempotencyKey('workflow-review-approve', [applicationId]),
      });
    }
    return BffClient.reviewReject({
      applicationId,
      reason: comment,
      userName,
      userRole,
      idempotencyKey: idempotencyKey || createIdempotencyKey('workflow-review-reject', [applicationId]),
    });
  },


  requestDeclineViaBff: async ({ applicationId, reason, stepIndex, userName, userRole, idempotencyKey }) => {
    if (!BffClient.isEnabled()) return null;
    return BffClient.requestDecline({
      applicationId,
      reason,
      stepIndex,
      userName,
      userRole,
      idempotencyKey: idempotencyKey || createIdempotencyKey('workflow-request-decline', [applicationId, stepIndex]),
    });
  },

  declineApplicationViaBff: async ({ applicationId, reason, userName, userRole, idempotencyKey }) => {
    if (!BffClient.isEnabled()) return null;
    return BffClient.declineApplication({
      applicationId,
      reason,
      userName,
      userRole,
      idempotencyKey: idempotencyKey || createIdempotencyKey('workflow-decline', [applicationId]),
    });
  },

  returnFromDeclineViaBff: async ({ applicationId, comment, userName, userRole, idempotencyKey }) => {
    if (!BffClient.isEnabled()) return null;
    return BffClient.returnFromDecline({
      applicationId,
      comment,
      userName,
      userRole,
      idempotencyKey: idempotencyKey || createIdempotencyKey('workflow-return-from-decline', [applicationId]),
    });
  },

  restoreApplicationViaBff: async ({ applicationId, comment, userName, userRole, idempotencyKey }) => {
    if (!BffClient.isEnabled()) return null;
    return BffClient.restoreApplication({
      applicationId,
      comment,
      userName,
      userRole,
      idempotencyKey: idempotencyKey || createIdempotencyKey('workflow-restore', [applicationId]),
    });
  },

  // --- STANDARD API METHODS (Existing ones preserved) ---

  ...createRegistryDomainApi({
    BffClient,
    requireBffEnabled,
    resolveActor,
    createIdempotencyKey,
    mapFloorFromDB,
    mapUnitFromDB,
    mapMopFromDB,
  }),


  // --- META & INTEGRATION ---
  ...createProjectDomainApi({
    BffClient,
    requireBffEnabled,
    resolveActor,
    createIdempotencyKey,
    mapProjectAggregate,
    mapBuildingFromDB,
    mapBlockDetailsFromDB,
  }),
  ...createWorkflowDomainApi({ BffClient, requireBffEnabled, resolveActor, createIdempotencyKey }),
  getVersions: async (entityType, entityId) => {
    requireBffEnabled('versions.getVersions');
    return BffClient.getVersions({ entityType, entityId });
  },

  ...createVersionsDomainApi({ BffClient, requireBffEnabled, resolveActor }),

};

export const ApiService = {
  ...LegacyApiService,
  ...createVersionsApi(LegacyApiService),
};
