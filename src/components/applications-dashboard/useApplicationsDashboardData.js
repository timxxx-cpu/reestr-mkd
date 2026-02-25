import { useDashboardProjects } from '@hooks/useDashboardProjects';
import { useDashboardCounts } from '@hooks/useDashboardCounts';

export function useApplicationsDashboardData({
  dbScope,
  activeTab,
  taskFilter,
  registryFilter,
  assigneeFilter,
  debouncedSearchTerm,
  projectsPage,
  projectsPageSize,
  incomingApps,
}) {
  const {
    projects: dashboardProjects,
    total: projectsTotal,
    totalPages: projectsTotalPages,
    isLoading: isLoadingProjects,
    isFetching: isFetchingProjects,
    refetch,
  } = useDashboardProjects({
    scope: dbScope,
    activeTab,
    taskFilter,
    registryFilter,
    assigneeFilter,
    search: debouncedSearchTerm,
    page: projectsPage,
    limit: projectsPageSize,
  });

  const { counts } = useDashboardCounts({
    scope: dbScope,
    assignee: assigneeFilter,
  });

  return {
    dashboardProjects,
    projectsTotal,
    projectsTotalPages,
    isLoadingProjects,
    isFetchingProjects,
    refetch,
    counts,
    currentList: activeTab === 'inbox' ? incomingApps : dashboardProjects,
  };
}
