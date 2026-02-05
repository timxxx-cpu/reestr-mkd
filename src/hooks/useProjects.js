import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiService } from '../lib/api-service';

export function useProjects(scope) {
    const queryClient = useQueryClient();

    // 1. Получение списка проектов
    const projectsQuery = useQuery({
        queryKey: ['projects', scope],
        queryFn: () => ApiService.getProjectsList(scope),
        enabled: !!scope,
    });

    // 2. Создание (Адаптер для вызова из UI)
    const createMutation = useMutation({
        /**
         * @param {{ name: string, address: string, user: any }} params
         */
        mutationFn: async (params) => {
            // Формируем структуру заявки для API
            const appData = {
                source: 'MANUAL',
                externalId: '-',
                applicant: params.name, // Используем название проекта как заявителя для простоты
                address: params.address || '',
                cadastre: '',
                submissionDate: new Date()
            };
            // Передаем также объект пользователя (для поля assignee_name)
            const user = params.user || { name: 'Admin', role: 'admin' };
            
            return ApiService.createProjectFromApplication(scope, appData, user);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects', scope] });
        }
    });

    // 3. Удаление
    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            return ApiService.deleteProject(scope, id);
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