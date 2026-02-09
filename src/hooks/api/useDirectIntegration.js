import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiService } from '../../lib/api-service';
import { useToast } from '../../context/ToastContext';

export function useDirectIntegration(projectId) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const keys = {
    status: ['integration-status', projectId],
    registry: ['project-registry', projectId],
  };

  // --- READ ---
  const { data: integrationStatus = {} } = useQuery({
    queryKey: keys.status,
    queryFn: () => ApiService.getIntegrationStatus(projectId),
    enabled: !!projectId,
  });

  const { data: fullRegistry, isLoading: loadingRegistry } = useQuery({
    queryKey: keys.registry,
    queryFn: () => ApiService.getProjectFullRegistry(projectId),
    enabled: !!projectId,
  });

  // --- WRITE ---
  const updateStatusMutation = useMutation({
    /**
     * @param {{ field: string, status: string }} params
     */
    mutationFn: ({ field, status }) => ApiService.updateIntegrationStatus(projectId, field, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.status }),
  });

  const updateBuildingCadastreMutation = useMutation({
    /**
     * @param {{ id: string, cadastre: string }} params
     */
    mutationFn: ({ id, cadastre }) => ApiService.updateBuildingCadastre(id, cadastre),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['direct-buildings'] });
      toast.success('Кадастровый номер сохранен');
    },
  });

  const updateUnitCadastreMutation = useMutation({
    /**
     * @param {{ id: string, cadastre: string }} params
     */
    mutationFn: ({ id, cadastre }) => ApiService.updateUnitCadastre(id, cadastre),
    // Не инвалидируем всё сразу, чтобы не моргало
  });

  return {
    integrationStatus,
    fullRegistry,
    loadingRegistry,
    setIntegrationStatus: updateStatusMutation.mutateAsync,
    setBuildingCadastre: updateBuildingCadastreMutation.mutateAsync,
    setUnitCadastre: updateUnitCadastreMutation.mutateAsync,
  };
}
