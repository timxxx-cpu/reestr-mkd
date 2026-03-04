import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiService } from '../lib/api-service';

export function useDashboardProjects({
  scope,
  activeTab,
  taskFilter,
  registryFilter,
  assigneeFilter,
  search,
  page,
  limit,
}) {
  const query = useMemo(() => {
    const next = {
      scope,
      search: search || undefined,
      assignee: activeTab === 'workdesk' ? assigneeFilter : undefined,
      page,
      limit,
    };

    if (activeTab === 'workdesk') {
      if (taskFilter === 'work') {
        next.status = 'IN_PROGRESS';
        next.workflowSubstatus = ['DRAFT', 'REVISION', 'RETURNED_BY_MANAGER'].join(',');
      } else if (taskFilter === 'review') {
        next.workflowSubstatus = 'REVIEW';
      } else if (taskFilter === 'integration') {
        next.workflowSubstatus = 'INTEGRATION';
      } else if (taskFilter === 'pending_decline') {
        next.workflowSubstatus = 'PENDING_DECLINE';
      } else if (taskFilter === 'declined') {
        next.status = 'DECLINED';
      }
    }

    if (activeTab === 'registry') {
      if (registryFilter === 'applications') {
        next.status = ['COMPLETED', 'DECLINED'].join(',');
      } else {
        next.status = 'COMPLETED';
      }
      next.assignee = undefined;
    }

    return next;
  }, [scope, activeTab, taskFilter, registryFilter, assigneeFilter, search, page, limit]);

  const projectsQuery = useQuery({
    queryKey: ['dashboard-projects', query],
    queryFn: () => ApiService.getProjectsPage(scope, query),
    enabled: !!scope && activeTab !== 'inbox',
    refetchOnWindowFocus: true,
  });

  // Указываем дефолтный объект со всеми полями, чтобы VS Code не ругался
  const data = projectsQuery.data || { 
    data: [], 
    items: [], 
    page: page || 1, 
    limit: limit || 50, 
    total: 0, 
    totalPages: 0 
  };
  
// Специальный комментарий отключает строгую проверку типов VS Code для этой переменной
  /** @type {any} */
  const rawData = projectsQuery.data || {};
  
  // Берем массив из нового формата (Java) или старого (Node)
  const itemsArray = rawData.data || rawData.items || [];

  return {
    query,
    projects: Array.isArray(itemsArray) ? itemsArray : [],
    page: Number(rawData.page || page || 1),
    limit: Number(rawData.limit || limit || 50),
    total: Number(rawData.total || 0),
    totalPages: Number(rawData.totalPages || 0),
    isLoading: projectsQuery.isLoading,
    isFetching: projectsQuery.isFetching,
    refetch: projectsQuery.refetch,
  };
}
