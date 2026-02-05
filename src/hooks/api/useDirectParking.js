import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiService } from '../../lib/api-service';
import { useToast } from '../../context/ToastContext';

export function useDirectParking(projectId) {
    const queryClient = useQueryClient();
    const toast = useToast();
    
    const keys = {
        basements: ['direct-basements', projectId],
        counts: ['direct-parking-counts', projectId]
    };

    // --- READ ---
    const { data: basements = [], isLoading: loadingBasements } = useQuery({
        queryKey: keys.basements,
        queryFn: () => ApiService.getBasements(projectId),
        enabled: !!projectId
    });

    const { data: counts = {}, isLoading: loadingCounts } = useQuery({
        queryKey: keys.counts,
        queryFn: () => ApiService.getParkingCounts(projectId),
        enabled: !!projectId
    });

    // --- WRITE ---
    
    // Включение/выключение уровня в подвале
    const toggleLevelMutation = useMutation({
        /**
         * @param {{ basementId: string, level: number, isEnabled: boolean }} params
         */
        mutationFn: ({ basementId, level, isEnabled }) => 
            ApiService.toggleBasementLevel(basementId, level, isEnabled),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.basements }),
        onError: () => toast.error("Ошибка обновления уровня")
    });

    // Изменение количества мест
    const syncPlacesMutation = useMutation({
        /**
         * @param {{ floorId: string, count: number, buildingId: string }} params
         */
        mutationFn: ({ floorId, count, buildingId }) => 
            ApiService.syncParkingPlaces(floorId, count, buildingId),
        
        onMutate: async ({ floorId, count }) => {
            // Оптимистичное обновление счетчика
            await queryClient.cancelQueries({ queryKey: keys.counts });
            const prev = queryClient.getQueryData(keys.counts);
            
            // [FIX] Добавлена проверка типа для old
            queryClient.setQueryData(keys.counts, (old) => {
                const map = (old && typeof old === 'object') ? old : {};
                return {
                    ...map,
                    [floorId]: count
                };
            });
            
            return { prev };
        },
        onError: (err, vars, ctx) => {
            if(ctx?.prev) queryClient.setQueryData(keys.counts, ctx.prev);
            toast.error("Ошибка синхронизации мест");
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: keys.counts })
    });

    return {
        basements,
        counts,
        isLoading: loadingBasements || loadingCounts,
        toggleLevel: toggleLevelMutation.mutateAsync,
        setPlacesCount: syncPlacesMutation.mutateAsync,
        isMutating: toggleLevelMutation.isPending || syncPlacesMutation.isPending
    };
}