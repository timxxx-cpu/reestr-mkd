// src/hooks/api/useDirectBuildings.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiService } from '../../lib/api-service';
import { useToast } from '../../context/ToastContext';

export function useDirectBuildings(projectId) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const queryKey = ['direct-buildings', projectId];

  // --- READ ---
  const {
    data = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await ApiService.getBuildings(projectId);
      // Гарантируем, что всегда возвращается массив
      return Array.isArray(res) ? res : (res?.data || res?.items || []);
    },
    enabled: !!projectId,
  });

  // Дополнительная защита на случай, если data испортится в кэше
  const buildings = Array.isArray(data) ? data : [];

  // --- CREATE ---
  const createMutation = useMutation({
    /**
     * @param {{ buildingData: any, blocksData: any[], actor?: any }} params
     */
    mutationFn: ({ buildingData, blocksData, actor }) =>
      ApiService.createBuilding(projectId, buildingData, blocksData, actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Объект успешно создан');
    },
    onError: err => {
      console.error(err);
      toast.error('Ошибка при создании объекта');
    },
  });

  // --- UPDATE ---
  const updateMutation = useMutation({
    /**
     * @param {{ id: string, data: any, actor?: any, blocksData?: any[] }} params
     */
    mutationFn: ({ id, data, actor, blocksData }) =>
      ApiService.updateBuilding(id, data, actor, blocksData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Объект обновлен');
    },
    onError: err => {
      console.error(err);
      toast.error('Ошибка при обновлении');
    },
  });

  // --- DELETE ---
  const deleteMutation = useMutation({
    /**
     * @param {{ id: string, actor?: any }} params
     */
    mutationFn: ({ id, actor }) => ApiService.deleteBuilding(id, actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Объект удален');
    },
    onError: err => {
      console.error(err);
      toast.error('Ошибка при удалении');
    },
  });
  
  return {
    buildings,
    isLoading,
    isError,
    createBuilding: createMutation.mutateAsync,
    updateBuilding: updateMutation.mutateAsync,
    deleteBuilding: deleteMutation.mutateAsync,
    isMutating: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}