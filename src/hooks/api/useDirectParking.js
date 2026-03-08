import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiService } from '../../lib/api-service';
import { getCurrentActor } from '../../lib/actor';
import { useToast } from '../../context/ToastContext';

export function useDirectParking(projectId) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const actor = getCurrentActor();

  const keys = {
    basements: ['direct-basements', projectId],
    counts: ['direct-parking-counts', projectId],
  };

  const { data: basements = [], isLoading: loadingBasements } = useQuery({
    queryKey: keys.basements,
    queryFn: () => ApiService.getBasements(projectId),
    enabled: !!projectId,
  });

  const { data: counts = {}, isLoading: loadingCounts } = useQuery({
    queryKey: keys.counts,
    queryFn: () => ApiService.getParkingCounts(projectId),
    enabled: !!projectId,
  });

  const toggleLevelMutation = useMutation({
    /**
     * @param {{ basementId: string, level: number, isEnabled: boolean, floorId?: string }} params
     */
    mutationFn: ({ basementId, level, isEnabled }) =>
      ApiService.toggleBasementLevel(basementId, level, isEnabled),

    onMutate: async ({ basementId, level, isEnabled, floorId }) => {
      await queryClient.cancelQueries({ queryKey: keys.basements });
      const prevBasements = queryClient.getQueryData(keys.basements);
      let prevCounts;

      queryClient.setQueryData(keys.basements, old => {
        const list = Array.isArray(old) ? old : [];
        return list.map(base => {
          if (String(base?.id) !== String(basementId)) return base;
          const levels =
            base?.parkingLevels && typeof base.parkingLevels === 'object' ? base.parkingLevels : {};
          return {
            ...base,
            parkingLevels: {
              ...levels,
              [String(level)]: isEnabled,
            },
          };
        });
      });

      if (!isEnabled && floorId) {
        await queryClient.cancelQueries({ queryKey: keys.counts });
        prevCounts = queryClient.getQueryData(keys.counts);
        queryClient.setQueryData(keys.counts, old => {
          const map = old && typeof old === 'object' ? old : {};
          return {
            ...map,
            [floorId]: 0,
          };
        });
      }

      return { prevBasements, prevCounts };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prevBasements !== undefined) {
        queryClient.setQueryData(keys.basements, ctx.prevBasements);
      }
      if (ctx?.prevCounts !== undefined) {
        queryClient.setQueryData(keys.counts, ctx.prevCounts);
      }
      toast.error('РћС€РёР±РєР° РѕР±РЅРѕРІР»РµРЅРёСЏ СѓСЂРѕРІРЅСЏ');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: keys.basements });
      queryClient.invalidateQueries({ queryKey: keys.counts });
    },
  });

  const syncPlacesMutation = useMutation({
    /**
     * @param {{ floorId: string, count: number, buildingId: string }} params
     */
    mutationFn: ({ floorId, count, buildingId }) =>
      ApiService.syncParkingPlaces(floorId, count, buildingId, actor),

    onMutate: async ({ floorId, count }) => {
      await queryClient.cancelQueries({ queryKey: keys.counts });
      const prev = queryClient.getQueryData(keys.counts);

      queryClient.setQueryData(keys.counts, old => {
        const map = old && typeof old === 'object' ? old : {};
        return {
          ...map,
          [floorId]: count,
        };
      });

      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(keys.counts, ctx.prev);
      toast.error('РћС€РёР±РєР° СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё РјРµСЃС‚');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.counts }),
  });

  return {
    basements,
    counts,
    isLoading: loadingBasements || loadingCounts,
    toggleLevel: toggleLevelMutation.mutateAsync,
    setPlacesCount: syncPlacesMutation.mutateAsync,
    isMutating: toggleLevelMutation.isPending || syncPlacesMutation.isPending,
  };
}
