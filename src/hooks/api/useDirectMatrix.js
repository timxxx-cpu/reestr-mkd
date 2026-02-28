import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiService } from '../../lib/api-service';
import { AuthService } from '../../lib/auth-service';
import { useToast } from '../../context/ToastContext';

export function useDirectMatrix(blockId) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const currentUser = AuthService.getCurrentUser?.() || null;
  const actor = {
    userName: currentUser?.displayName || currentUser?.email || 'unknown',
    userRole: currentUser?.role || 'technician',
  };

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
      ApiService.upsertMatrixCell(blockId, floorId, entranceNumber, values, actor),

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



  const updateCellsBatchMutation = useMutation({
    /**
     * @param {Array<{ floorId: string, entranceNumber: number, values: any }>} cells
     */
    mutationFn: cells => ApiService.batchUpsertMatrixCells(blockId, cells, actor),
    onMutate: async cells => {
      await queryClient.cancelQueries({ queryKey: keys.matrix });
      const prevMatrix = queryClient.getQueryData(keys.matrix);

      queryClient.setQueryData(keys.matrix, old => {
        const map = old && typeof old === 'object' ? old : {};
        const next = { ...map };
        (Array.isArray(cells) ? cells : []).forEach(cell => {
          const floorId = cell?.floorId;
          const entranceNumber = cell?.entranceNumber;
          const values = cell?.values || {};
          if (!floorId || !Number.isFinite(Number(entranceNumber))) return;
          const cellKey = `${floorId}_${entranceNumber}`;
          const existingCell = next[cellKey] && typeof next[cellKey] === 'object' ? next[cellKey] : {};
          next[cellKey] = { ...existingCell, ...values };
        });
        return next;
      });

      return { prevMatrix };
    },
    onSuccess: (result, cells, context) => {
      const failed = Array.isArray(result?.failed) ? result.failed : [];
      if (failed.length === 0) return;

      if (context?.prevMatrix) {
        queryClient.setQueryData(keys.matrix, old => {
          const current = old && typeof old === 'object' ? old : {};
          const previous = context.prevMatrix && typeof context.prevMatrix === 'object' ? context.prevMatrix : {};
          const next = { ...current };

          failed.forEach(entry => {
            const index = Number(entry?.index);
            if (!Number.isInteger(index) || index < 0) return;
            const cell = cells?.[index];
            const floorId = cell?.floorId;
            const entranceNumber = cell?.entranceNumber;
            if (!floorId || !Number.isFinite(Number(entranceNumber))) return;
            const key = `${floorId}_${entranceNumber}`;
            if (Object.prototype.hasOwnProperty.call(previous, key)) {
              next[key] = previous[key];
            } else {
              delete next[key];
            }
          });

          return next;
        });
      }

      toast.warning(`Часть ячеек матрицы не сохранена (${failed.length})`);
    },
    onError: (err, vars, context) => {
      if (context?.prevMatrix) {
        queryClient.setQueryData(keys.matrix, context.prevMatrix);
      }
      toast.error('Ошибка массового сохранения матрицы');
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
    mutationFn: count => ApiService.syncEntrances(blockId, count, actor),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.entrances }),
  });

  return {
    entrances,
    matrixMap,
    updateCell: updateCellMutation.mutateAsync,
    updateCells: updateCellsBatchMutation.mutateAsync,
    syncEntrances: syncEntrancesMutation.mutateAsync,
    isLoading: updateCellMutation.isPending || updateCellsBatchMutation.isPending,
  };
}
