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
    data: buildings = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey,
    queryFn: () => ApiService.getBuildings(projectId),
    enabled: !!projectId,
  });

  // --- CREATE ---
  const createMutation = useMutation({
    /**
     * @param {{ buildingData: any, blocksData: any[] }} params
     */
    mutationFn: ({ buildingData, blocksData }) =>
      ApiService.createBuilding(projectId, buildingData, blocksData),
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
     * @param {{ id: string, data: any }} params
     */
    mutationFn: ({ id, data }) => ApiService.updateBuilding(id, data),
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
     * @param {string} id
     */
    mutationFn: id => ApiService.deleteBuilding(id),
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
