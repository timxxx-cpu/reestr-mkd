import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { useToast } from './ToastContext';
import { ApiService } from '../lib/api-service';
import { useProjectData } from '../hooks/useProjectData';
import { Skeleton } from '../components/ui/Skeleton';
import { HEAVY_MODEL_KEYS } from '../lib/model-keys';
import { useProjectDataLayer } from './project/useProjectDataLayer';
import { useProjectSyncLayer } from './project/useProjectSyncLayer';
import { useProjectWorkflowLayer } from './project/useProjectWorkflowLayer';

const ProjectContext = createContext(null);

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};

const HEAVY_KEYS = HEAVY_MODEL_KEYS;

export const ProjectProvider = ({ children, projectId, user, customScope, userProfile }) => {
  const toast = useToast();
  const dbScope = customScope || user?.uid;

  const { projectMeta: serverData, isLoading, refetch } = useProjectData(dbScope, projectId);

  const [projectMeta, setProjectMeta] = useState({});
  const [buildingsState, setBuildingsState] = useState({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const saveTimeoutRef = useRef(null);
  const pendingUpdatesRef = useRef({});

  const { mergedState, isReadOnly, getValidationSnapshot } = useProjectDataLayer({
    serverData,
    projectMeta,
    setProjectMeta,
    buildingsState,
    userProfile,
  });

  const { saveData, saveProjectImmediate } = useProjectSyncLayer({
    dbScope,
    projectId,
    isReadOnly,
    toast,
    refetch,
    mergedComposition: mergedState.composition,
    setProjectMeta,
    setIsSyncing,
    setHasUnsavedChanges,
    pendingUpdatesRef,
    saveTimeoutRef,
  });

  const { completeTask, rollbackTask, reviewStage } = useProjectWorkflowLayer({
    dbScope,
    projectId,
    mergedState,
    userProfile,
    refetch,
    saveProjectImmediate,
    setProjectMeta,
  });

  const saveBuildingData = useCallback(
    async (buildingId, dataKey, dataVal) => {
      if (isReadOnly) {
        toast.error('Редактирование запрещено');
        return;
      }

      setIsSyncing(true);
      try {
        let promise;

        if (dataKey === 'apartmentsData') {
          const unitsArray = Object.values(dataVal);
          promise = ApiService.batchUpsertUnits(unitsArray);
        } else {
          promise = ApiService.saveData(dbScope, projectId, {
            buildingSpecificData: {
              [buildingId]: { [dataKey]: dataVal },
            },
          });
        }

        await promise;

        setBuildingsState(prev => ({
          ...prev,
          [buildingId]: {
            ...(prev[buildingId] || {}),
            [dataKey]: {
              ...((prev[buildingId] || {})[dataKey] || {}),
              ...dataVal,
            },
          },
        }));

        setHasUnsavedChanges(false);
      } catch (e) {
        console.error(e);
        toast.error('Ошибка сохранения здания');
      } finally {
        setIsSyncing(false);
      }
    },
    [isReadOnly, toast, dbScope, projectId]
  );

  const deleteProjectBuilding = useCallback(
    async buildingId => {
      if (isReadOnly) {
        toast.error('Удаление запрещено');
        return;
      }
      if (!confirm('Удалить объект?')) return;

      try {
        await ApiService.deleteBuilding(buildingId);
        const newComposition = mergedState.composition.filter(b => b.id !== buildingId);
        setProjectMeta(prev => ({ ...prev, composition: newComposition }));
        toast.success('Объект удален');
      } catch (_e) {
        toast.error('Ошибка удаления');
      }
    },
    [isReadOnly, toast, mergedState.composition]
  );

  const updateStatus = useCallback(async (_newStatus, _newStage = null, _comment = null) => {
    /* ... */
  }, []);

  const createSetter = key => value => {
    if (isReadOnly) return;

    const newValue = typeof value === 'function' ? value(mergedState[key]) : value;
    setProjectMeta(prev => ({ ...prev, [key]: newValue }));

    if (HEAVY_KEYS.includes(key)) {
      setHasUnsavedChanges(true);
      pendingUpdatesRef.current = { ...pendingUpdatesRef.current, [key]: newValue };
    } else {
      saveData({ [key]: newValue });
    }
  };

  const value = {
    projectId,
    ...mergedState,
    isReadOnly,
    userProfile,

    hasUnsavedChanges,
    setHasUnsavedChanges,

    completeTask,
    rollbackTask,
    reviewStage,
    saveProjectImmediate,
    saveData,
    saveBuildingData,
    deleteProjectBuilding,

    setComplexInfo: createSetter('complexInfo'),
    setParticipants: createSetter('participants'),
    setCadastre: createSetter('cadastre'),
    setComposition: createSetter('composition'),
    setDocuments: createSetter('documents'),
    setBuildingDetails: createSetter('buildingDetails'),
    setApplicationInfo: createSetter('applicationInfo'),

    setFloorData: createSetter('floorData'),
    setEntrancesData: createSetter('entrancesData'),
    setMopData: createSetter('mopData'),
    setFlatMatrix: createSetter('flatMatrix'),
    setParkingPlaces: createSetter('parkingPlaces'),

    updateStatus,
    isSyncing,
    refetch,
    getValidationSnapshot,
    setProjectId: id => {
      window.location.href = `/project/${id}`;
    },
  };

  if (isLoading && Object.keys(projectMeta).length === 0) {
    return (
      <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-900">
        <div className="w-20 border-r border-border bg-card h-full flex flex-col items-center py-6 gap-6">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="flex flex-col gap-4 mt-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="w-10 h-10 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="flex-1 flex flex-col">
          <div className="h-16 border-b border-border bg-card px-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="w-8 h-8 rounded-full" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-9 w-32 rounded-lg" />
          </div>
          <div className="p-8 space-y-6">
            <div className="flex justify-between items-center">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-10 w-32" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
            </div>
            <Skeleton className="h-[400px] w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
};
