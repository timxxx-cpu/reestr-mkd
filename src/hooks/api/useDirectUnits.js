import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiService } from '../../lib/api-service';
import { useToast } from '../../context/ToastContext';

export function useDirectUnits(blockId, floorIds = []) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const normalizedFloorIds = Array.isArray(floorIds)
    ? [...new Set(floorIds.filter(Boolean))].sort()
    : [];
  const queryKey = ['direct-units', blockId, normalizedFloorIds];

  // --- READ ---
  const { data: units = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => ApiService.getUnits(blockId, { floorIds: normalizedFloorIds }),
    enabled: !!blockId,
  });

  // --- UPDATE SINGLE ---
  const upsertUnitMutation = useMutation({
    /**
     * @param {{ id?: string, floorId: string, entranceId: string, num: string, type: string, area?: number }} data
     */
    mutationFn: data => ApiService.upsertUnit(data),
    onMutate: async newData => {
      await queryClient.cancelQueries({ queryKey });
      const previousUnits = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, old => {
        // [FIX] Явная проверка типа: если old не массив, берем пустой массив
        const list = Array.isArray(old) ? old : [];

        // Если id нет (новый объект), генерим временный для UI
        const targetId = newData.id;
        if (!targetId) {
          return [...list, { ...newData, id: 'temp-' + Date.now() }];
        }

        const index = list.findIndex(u => u.id === targetId);
        if (index !== -1) {
          const newArr = [...list];
          newArr[index] = { ...list[index], ...newData };
          return newArr;
        }

        // Если не нашли (редкий кейс), добавляем
        return [...list, newData];
      });

      return { previousUnits };
    },
    onError: (err, vars, context) => {
      if (context?.previousUnits) {
        queryClient.setQueryData(queryKey, context.previousUnits);
      }
      toast.error('Ошибка сохранения юнита');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // --- BATCH UPDATE (Auto-numbering) ---
  const batchUpsertMutation = useMutation({
    /** @param {Array<any>} list */
    mutationFn: list => ApiService.batchUpsertUnits(list),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Данные обновлены');
    },
    onError: err => {
      console.error(err);
      toast.error('Ошибка массового обновления');
    },
  });

  /** @type {(list: Array<any>) => Promise<any>} */
  const batchUpsertUnits = batchUpsertMutation.mutateAsync;

  return {
    units,
    isLoading,
    upsertUnit: upsertUnitMutation.mutateAsync,
    batchUpsertUnits,
    isMutating: upsertUnitMutation.isPending || batchUpsertMutation.isPending,
  };
}
