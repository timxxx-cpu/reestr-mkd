import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RegistryService } from '../lib/registry-service';

/**
 * @typedef {import('../lib/types').ProjectMeta} ProjectMeta
 */

export function useProjects(scope) {
    const queryClient = useQueryClient();

    // 1. Получение списка проектов (READ)
    const projectsQuery = useQuery({
        queryKey: ['projects', scope],
        queryFn: () => RegistryService.getProjectsList(scope),
        enabled: !!scope, // Запрос не пойдет, пока нет scope (userId)
    });

    // 2. Создание проекта (CREATE)
    const createMutation = useMutation({
        // ИСПРАВЛЕНИЕ: Убрана деструктуризация из аргументов и добавлен JSDoc
        /**
         * @param {{ meta: ProjectMeta, content: any }} params
         */
        mutationFn: async (params) => {
            const { meta, content } = params;
            return RegistryService.createProject(scope, meta, content);
        },
        onSuccess: () => {
            // После создания инвалидируем кэш, чтобы список обновился сам
            queryClient.invalidateQueries({ queryKey: ['projects', scope] });
        }
    });

    // 3. Удаление проекта (DELETE)
    const deleteMutation = useMutation({
        /**
         * @param {string} id
         */
        mutationFn: async (id) => {
            return RegistryService.deleteProject(scope, id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects', scope] });
        }
    });

    return {
        projects: projectsQuery.data || [],
        isLoading: projectsQuery.isLoading,
        isError: projectsQuery.isError,
        createProject: createMutation.mutateAsync,
        deleteProject: deleteMutation.mutateAsync,
        isCreating: createMutation.isPending
    };
}