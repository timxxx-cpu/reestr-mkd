import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiService } from '../../lib/api-service';
import { useToast } from '../../context/ToastContext';

export function useDirectCommonAreas(blockId, floorIds = []) {
    const queryClient = useQueryClient();
    const toast = useToast();
    const normalizedFloorIds = Array.isArray(floorIds) ? [...new Set(floorIds.filter(Boolean))].sort() : [];
    const queryKey = ['direct-mop', blockId, normalizedFloorIds];

    // --- READ ---
    const { data: mops = [], isLoading } = useQuery({
        queryKey,
        queryFn: () => ApiService.getCommonAreas(blockId, { floorIds: normalizedFloorIds }),
        enabled: !!blockId,
    });

    // --- WRITE ---
    const upsertMutation = useMutation({
        /**
         * @param {{ id?: string, floorId: string, entranceId: string, type: string, area: string }} data
         */
        mutationFn: (data) => ApiService.upsertCommonArea(data),
        onMutate: async (newData) => {
            await queryClient.cancelQueries({ queryKey });
            const previousData = queryClient.getQueryData(queryKey);
            
            queryClient.setQueryData(queryKey, (old) => {
                // [FIX] Явная проверка: если old не массив, считаем его пустым массивом
                const list = Array.isArray(old) ? old : [];
                
                const targetId = newData.id; 
                // Если ID нет (создание), добавляем с временным
                if (!targetId) {
                    return [...list, { ...newData, id: 'temp-' + Date.now() }];
                }

                const index = list.findIndex(m => m.id === targetId);
                if (index !== -1) {
                    const newArr = [...list];
                    newArr[index] = { ...list[index], ...newData };
                    return newArr;
                }
                
                // Если ID есть, но в списке нет (редкий кейс), добавляем
                return [...list, newData];
            });
            
            return { previousData };
        },
        onError: (err, vars, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(queryKey, context.previousData);
            }
            toast.error("Ошибка сохранения МОП");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey });
        }
    });

    const deleteMutation = useMutation({
        /**
         * @param {string} id
         */
        mutationFn: (id) => ApiService.deleteCommonArea(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey })
    });

    const clearAllMutation = useMutation({
        mutationFn: () => ApiService.clearCommonAreas(blockId, { floorIds: normalizedFloorIds }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            toast.success("Все данные МОП очищены");
        }
    });

    return {
        mops,
        isLoading,
        upsertMop: upsertMutation.mutateAsync,
        deleteMop: deleteMutation.mutateAsync,
        clearAllMops: clearAllMutation.mutateAsync,
        isMutating: upsertMutation.isPending || deleteMutation.isPending || clearAllMutation.isPending
    };
}