import { useQuery } from '@tanstack/react-query';
import { RegistryService } from '../lib/registry-service';
import { ProjectSchema } from '../lib/schemas';

/**
 * Хук для загрузки полных данных проекта (Meta + Buildings)
 * @param {string} scope 
 * @param {string} projectId 
 */
export function useProjectData(scope, projectId) {
    
    // 1. Загрузка Мета-данных (Легкие)
    const metaQuery = useQuery({
        queryKey: ['project', scope, projectId, 'meta'],
        queryFn: async () => {
            const data = await RegistryService.getProjectMeta(scope, projectId);
            if (data) {
                // Валидация при получении
                const result = ProjectSchema.partial().safeParse(data);
                if (!result.success) {
                    console.warn("[ProjectData] Meta validation failed:", result.error.format());
                }
            }
            return data;
        },
        enabled: !!scope && !!projectId,
        staleTime: 1000 * 60 * 5, // Кэш на 5 минут
    });

    // 2. Загрузка Данных зданий (Тяжелые)
    const buildingsQuery = useQuery({
        queryKey: ['project', scope, projectId, 'buildings'],
        queryFn: () => RegistryService.getBuildings(scope, projectId),
        enabled: !!scope && !!projectId,
        staleTime: 1000 * 60 * 5, 
    });

    return {
        projectMeta: metaQuery.data || {},
        buildingsState: buildingsQuery.data || {},
        isLoading: metaQuery.isLoading || buildingsQuery.isLoading,
        isError: metaQuery.isError || buildingsQuery.isError,
        error: metaQuery.error || buildingsQuery.error,
        // Метод для ручного обновления (понадобится после сохранения)
        refetch: () => {
            metaQuery.refetch();
            buildingsQuery.refetch();
        }
    };
}