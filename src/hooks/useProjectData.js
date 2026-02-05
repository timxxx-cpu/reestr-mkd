import { useQuery } from '@tanstack/react-query';
import { ApiService } from '../lib/api-service';

export function useProjectData(scope, projectId) {
    
    // 1. Загрузка полных данных проекта
    const fullQuery = useQuery({
        queryKey: ['project-full', scope, projectId],
        queryFn: async () => {
            const data = await ApiService.getProjectFullData(scope, projectId);
            return data;
        },
        enabled: !!scope && !!projectId,
        staleTime: 1000 * 60 * 5, 
    });

    const data = fullQuery.data || {};

    return {
        projectMeta: data,
        buildingsState: {}, // Больше не используется, всё внутри projectMeta
        isLoading: fullQuery.isLoading,
        isError: fullQuery.isError,
        error: fullQuery.error,
        refetch: fullQuery.refetch
    };
}