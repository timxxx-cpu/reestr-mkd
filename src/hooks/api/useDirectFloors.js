import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiService } from '../../lib/api-service';
import { AuthService } from '../../lib/auth-service';
import { useToast } from '../../context/ToastContext';

export function useDirectFloors(blockId) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const currentUser = AuthService.getCurrentUser?.() || null;
  const actor = {
    userName: currentUser?.displayName || currentUser?.email || 'unknown',
    userRole: currentUser?.role || 'technician',
  };
  const queryKey = ['direct-floors', blockId];

  // --- READ ---
  const {
    data: floors = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey,
    queryFn: () => ApiService.getFloors(blockId),
    enabled: !!blockId,
  });

  // --- UPDATE SINGLE FLOOR ---
  const updateMutation = useMutation({
    /**
     * @param {{ id: string, updates: any }} params
     */
    mutationFn: ({ id, updates }) => ApiService.updateFloor(id, updates, actor),
    onMutate: async ({ id, updates }) => {
      // Optimistic Update
      await queryClient.cancelQueries({ queryKey });
      const previousFloors = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, old => {
        const list = Array.isArray(old) ? old : [];
        return list.map(f => (f.id === id ? { ...f, ...updates } : f));
      });

      return { previousFloors };
    },
    onError: (err, newTodo, context) => {
      if (context?.previousFloors) {
        queryClient.setQueryData(queryKey, context.previousFloors);
      }
      toast.error('Ошибка обновления этажа');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

 // --- GENERATE FLOORS (SYNC) ---
  const generateMutation = useMutation({
    // Параметры floorsFrom/floorsTo больше не нужны, бэкенд берет их из БД
    mutationFn: () =>
      // В ApiService.generateFloors мы можем передавать undefined/null для старых параметров, 
      // главное передать blockId и actor.
      ApiService.generateFloors(blockId, null, null, null, actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Сетка этажей синхронизирована с конфигурацией');
    },
    onError: err => {
      console.error(err);
      toast.error('Ошибка синхронизации этажей');
    },
  });

  return {
    floors,
    isLoading,
    isError,
    updateFloor: updateMutation.mutateAsync,
    generateFloors: generateMutation.mutateAsync,
    isMutating: updateMutation.isPending || generateMutation.isPending,
  };
}
