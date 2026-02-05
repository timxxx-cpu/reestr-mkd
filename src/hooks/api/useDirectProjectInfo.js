import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiService } from '../../lib/api-service';
import { useToast } from '../../context/ToastContext';

export function useDirectProjectInfo(projectId) {
    const queryClient = useQueryClient();
    const toast = useToast();
    const queryKey = ['project-info', projectId];

    // Чтение (пропускаем, если ID нет)
    const { data, isLoading } = useQuery({
        queryKey,
        queryFn: () => ApiService.getProjectDetails(projectId),
        enabled: !!projectId && projectId !== 'undefined',
    });

    const complexInfo = data?.complexInfo || {};
    const cadastre = data?.cadastre || {};
    const participants = data?.participants || {};
    const documents = data?.documents || [];

    // --- МУТАЦИИ ---

    // 1. СОЗДАНИЕ
    const createProjectMutation = useMutation({
        /**
         * @param {{ name: string, street: string }} params
         */
        mutationFn: (params) => ApiService.createProject(params.name, params.street),
        onSuccess: () => {
            toast.success("Проект успешно создан");
        },
        onError: (err) => toast.error("Ошибка создания: " + err.message)
    });

    // 2. ОБНОВЛЕНИЕ
    const updateInfoMutation = useMutation({
        /**
         * @param {{ info: any, cadastreData: any }} params
         */
        mutationFn: (params) => {
            if (!projectId || projectId === 'undefined') return Promise.resolve();
            return ApiService.updateProjectInfo(projectId, params.info, params.cadastreData);
        },
        onSuccess: () => {
            if (projectId) queryClient.invalidateQueries({ queryKey });
        }
    });

    // 3. УЧАСТНИКИ
    const updateParticipantMutation = useMutation({
        /**
         * @param {{ role: string, data: any }} params
         */
        mutationFn: (params) => {
            if (!projectId) return Promise.resolve();
            return ApiService.upsertParticipant(projectId, params.role, params.data);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey })
    });

    // 4. ДОКУМЕНТЫ (Создание)
    const upsertDocumentMutation = useMutation({
        /**
         * @param {object} doc
         */
        mutationFn: (doc) => {
             if (!projectId) return Promise.resolve();
             return ApiService.upsertDocument(projectId, doc);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey })
    });

    // 5. ДОКУМЕНТЫ (Удаление)
    const deleteDocumentMutation = useMutation({
        /**
         * @param {string} id
         */
        mutationFn: (id) => ApiService.deleteDocument(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey })
    });

    return {
        complexInfo,
        cadastre,
        participants,
        documents,
        isLoading,
        // Экспортируем методы
        createProject: createProjectMutation.mutateAsync, 
        updateProjectInfo: updateInfoMutation.mutateAsync,
        updateParticipant: updateParticipantMutation.mutateAsync,
        upsertDocument: upsertDocumentMutation.mutateAsync,
        deleteDocument: deleteDocumentMutation.mutateAsync,
        isSaving: updateInfoMutation.isPending || createProjectMutation.isPending
    };
}