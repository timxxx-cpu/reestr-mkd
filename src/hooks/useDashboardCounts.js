import { useQuery } from '@tanstack/react-query';
import { ApiService } from '../lib/api-service';

const EMPTY_COUNTS = {
  work: 0,
  review: 0,
  integration: 0,
  pendingDecline: 0,
  declined: 0,
  completed: 0,
  registryApplications: 0,
  registryComplexes: 0,
};

export function useDashboardCounts({ scope, assignee }) {
  const countsQuery = useQuery({
    queryKey: ['dashboard-counts', scope, assignee],
    queryFn: () => ApiService.getProjectsSummaryCounts({ scope, assignee }),
    enabled: !!scope,
    refetchOnWindowFocus: true,
  });

  return {
    counts: { ...EMPTY_COUNTS, ...(countsQuery.data || {}) },
    isLoading: countsQuery.isLoading,
    isFetching: countsQuery.isFetching,
    refetch: countsQuery.refetch,
  };
}
