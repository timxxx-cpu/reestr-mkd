import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiService } from '../../lib/api-service';
import { useToast } from '../../context/ToastContext';

export function useDirectMatrix(blockId) {
  const queryClient = useQueryClient();
  const toast = useToast();

  // Ключи для кэша
  const keys = {
    entrances: ['direct-entrances', blockId],
    matrix: ['direct-matrix', blockId],
  };

  // --- READ ---

  const { data: entrances = [] } = useQuery({
    queryKey: keys.entrances,
    queryFn: () => ApiService.getEntrances(blockId),
    enabled: !!blockId,
  });

  const { data: matrixMap = {} } = useQuery({
    queryKey: keys.matrix,
    queryFn: () => ApiService.getMatrix(blockId),
    enabled: !!blockId,
  });

  // --- WRITE ---

  // Обновление ячейки (debounced input будет вызывать это)
  const updateCellMutation = useMutation({
    /**
     * @param {{ floorId: string, entranceNumber: number, values: any }} params
     */
    mutationFn: ({ floorId, entranceNumber, values }) =>
      ApiService.upsertMatrixCell(blockId, floorId, entranceNumber, values),

    onMutate: async ({ floorId, entranceNumber, values }) => {
      await queryClient.cancelQueries({ queryKey: keys.matrix });
      const prevMatrix = queryClient.getQueryData(keys.matrix);

      // [FIXED] Явная проверка типа для успокоения линтера (TS2698)
      queryClient.setQueryData(keys.matrix, old => {
        const map = old && typeof old === 'object' ? old : {};
        const cellKey = `${floorId}_${entranceNumber}`;

        // Проверяем, что map[cellKey] тоже объект
        const existingCell = map[cellKey] && typeof map[cellKey] === 'object' ? map[cellKey] : {};

        return {
          ...map,
          [cellKey]: {
            ...existingCell,
            ...values,
          },
        };
      });

      return { prevMatrix };
    },
    onError: (err, vars, context) => {
      if (context?.prevMatrix) {
        queryClient.setQueryData(keys.matrix, context.prevMatrix);
      }
      toast.error('Ошибка сохранения ячейки');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: keys.matrix });
    },
  });

  // Синхронизация количества подъездов (вызывается при изменении конфига блока)
  const syncEntrancesMutation = useMutation({
    /**
     * @param {number} count
     */
    mutationFn: count => ApiService.syncEntrances(blockId, count),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.entrances }),
  });

  return {
    entrances,
    matrixMap,
    updateCell: updateCellMutation.mutateAsync,
    syncEntrances: syncEntrancesMutation.mutateAsync,
    isLoading: updateCellMutation.isPending,
  };
}
