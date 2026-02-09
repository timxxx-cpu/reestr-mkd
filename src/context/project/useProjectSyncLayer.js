import { useCallback, useRef } from 'react';
import { ApiService } from '../../lib/api-service';
import { cleanBuildingDetails } from '../../lib/building-details';
import { HEAVY_MODEL_KEYS, UI_TO_BUILDING_DB_MATRIX_KEYS } from '../../lib/model-keys';

export const useProjectSyncLayer = ({
  dbScope,
  projectId,
  isReadOnly,
  toast,
  refetch,
  mergedComposition,
  setProjectMeta,
  setIsSyncing,
  setHasUnsavedChanges,
  pendingUpdatesRef,
  saveTimeoutRef,
}) => {
  const saveQueueRef = useRef(Promise.resolve());
  const refetchRequestedRef = useRef(false);

  const saveData = useCallback(
    (updates = {}, showNotification = false, bypassReadOnly = false) => {
      if (!dbScope || !projectId) return;
      if (isReadOnly && !bypassReadOnly) {
        if (showNotification) toast.error('Редактирование запрещено');
        return;
      }

      if (updates && (updates.nativeEvent || updates.type === 'click')) {
        updates = {};
      }

      const safeUpdates = { ...updates };
      const heavyKeys = HEAVY_MODEL_KEYS;
      heavyKeys.forEach(k => delete safeUpdates[k]);

      pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...safeUpdates };

      if (Object.keys(pendingUpdatesRef.current).length > 0) {
        setHasUnsavedChanges(true);
      }
    },
    [dbScope, projectId, isReadOnly, toast, pendingUpdatesRef, setHasUnsavedChanges]
  );

  const persistPendingChanges = useCallback(async () => {
    while (true) {
      const changes = /** @type {any} */ ({ ...pendingUpdatesRef.current });
      pendingUpdatesRef.current = {};

      if (Object.keys(changes).length === 0) {
        break;
      }

      const buildingUpdates = {};

      const addToBuilding = (bId, key, data) => {
        if (!buildingUpdates[bId]) buildingUpdates[bId] = {};
        if (!buildingUpdates[bId][key]) buildingUpdates[bId][key] = {};

        Object.keys(data).forEach(k => {
          if (k.startsWith(bId)) {
            buildingUpdates[bId][key][k] = data[k];
          }
        });
      };

      const matrixKeys = UI_TO_BUILDING_DB_MATRIX_KEYS;

      Object.keys(changes).forEach(changeKey => {
        if (matrixKeys[changeKey]) {
          const firebaseKey = matrixKeys[changeKey];
          const fullData = changes[changeKey];
          mergedComposition.forEach(b => {
            addToBuilding(b.id, firebaseKey, fullData);
          });
          delete changes[changeKey];
        }
      });

      if (changes.buildingDetails) {
        const cleanedDetails = cleanBuildingDetails(mergedComposition, changes.buildingDetails);
        changes.buildingDetails = cleanedDetails;
        setProjectMeta(prev => ({ ...prev, buildingDetails: cleanedDetails }));
      }

      if (Object.keys(changes).length > 0) {
        await ApiService.saveData(dbScope, projectId, changes);
      }

      const buildingPromises = Object.entries(buildingUpdates).map(([bId, bData]) => {
        const hasData = Object.values(bData).some(val => Object.keys(val).length > 0);
        if (!hasData) return Promise.resolve();

        return ApiService.saveData(dbScope, projectId, {
          buildingSpecificData: {
            [bId]: bData,
          },
        });
      });

      await Promise.all(buildingPromises);
    }
  }, [pendingUpdatesRef, mergedComposition, setProjectMeta, dbScope, projectId]);

  const saveProjectImmediate = useCallback(
    async (options = {}) => {
      const { shouldRefetch = true } = options;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      refetchRequestedRef.current = refetchRequestedRef.current || shouldRefetch;

      const runSave = async () => {
        setIsSyncing(true);
        try {
          await persistPendingChanges();

          if (refetchRequestedRef.current) {
            refetchRequestedRef.current = false;
            await refetch();
          }

          setHasUnsavedChanges(Object.keys(pendingUpdatesRef.current).length > 0);
        } catch (e) {
          console.error('Force Save Error', e);
          toast.error('Ошибка сохранения данных');
          throw e;
        } finally {
          setIsSyncing(false);
        }
      };

      const queuedSave = saveQueueRef.current.then(runSave, runSave);
      saveQueueRef.current = queuedSave.catch(() => {});
      return queuedSave;
    },
    [
      saveTimeoutRef,
      persistPendingChanges,
      refetch,
      setHasUnsavedChanges,
      pendingUpdatesRef,
      toast,
      setIsSyncing,
    ]
  );

  return {
    saveData,
    saveProjectImmediate,
  };
};
