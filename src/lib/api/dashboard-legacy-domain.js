export const createDashboardLegacyApi = ({ BffClient, normalizeUserRole }) => ({
  getSystemUsers: async () => {
    const data = await BffClient.getSystemUsers();
    const usersArray = Array.isArray(data) ? data : (data?.items || data?.users || []);

    return usersArray.map(u => ({
      id: u.id,
      code: u.code,
      name: u.name,
      roleId: u.roleId ?? u.role_id ?? null,
      role: normalizeUserRole(u)?.role ?? u.role ?? null,
      group: u.group_name || u.name,
      sortOrder: u.sort_order || 100,
    }));
  },

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
    const rawItems = Array.isArray(response)
      ? response
      : (Array.isArray(response?.items) ? response.items : (Array.isArray(response?.data) ? response.data : []));

    const mappedItems = rawItems.map(item => {
      if (item.applicationInfo) return item;

      return {
        id: item.id,
        name: item.name,
        ujCode: item.uj_code || item.ujCode,
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
          currentStepIndex: item.current_step || 0,
        },
        complexInfo: {
          street: item.address,
          region: item.region,
        },
      };
    });

    if (Array.isArray(response)) {
      const page = Number(options?.page || 1);
      const limit = Number(options?.limit || response.length || 1);
      return {
        items: mappedItems,
        page,
        limit,
        total: response.length,
        totalPages: response.length > 0 ? Math.ceil(response.length / Math.max(limit, 1)) : 0,
      };
    }

    return {
      items: mappedItems,
      page: Number(response?.page || options?.page || 1),
      limit: Number(response?.limit || options?.limit || 50),
      total: Number(response?.total || 0),
      totalPages: Number(response?.totalPages || 0),
    };
  },

  getProjectsList: async function getProjectsList(scope, options = {}) {
    const pageData = await this.getProjectsPage(scope, options);
    return pageData.items;
  },

  getProjectsMapOverview: async scope => {
    if (!scope) return { items: [] };
    return BffClient.getProjectsMapOverview({ scope });
  },

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

  getExternalApplications: async scope => BffClient.getExternalApplications({ scope }),
});
