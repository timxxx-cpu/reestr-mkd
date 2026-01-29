import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useToast } from './ToastContext';
import { RegistryService } from '../lib/registry-service';
import { useProjectData } from '../hooks/useProjectData';
import { ROLES, APP_STATUS, WORKFLOW_STAGES, STEPS_CONFIG } from '../lib/constants';
import { Skeleton } from '../components/ui/Skeleton';

const ProjectContext = createContext(null);

export const useProject = () => {
    const context = useContext(ProjectContext);
    if (!context) {
        throw new Error('useProject must be used within a ProjectProvider');
    }
    return context;
};

const HEAVY_KEYS = [
    'floorData', 'entrancesData', 'mopData', 'flatMatrix', 
    'parkingPlaces', 'commonAreasData', 'apartmentsData', 'parkingData',
    'complexInfo', 'participants', 'cadastre', 'documents', 'buildingDetails', 'composition'
];

// Хелпер для создания записи истории
const createHistoryEntry = (user, action, comment) => ({
    date: new Date().toISOString(),
    user: user.name || 'Unknown',
    role: user.role || 'system',
    action,
    comment
});

export const ProjectProvider = ({ children, projectId, user, customScope, userProfile }) => {
  const toast = useToast();
  const dbScope = customScope || user?.uid;

  const { 
      projectMeta: serverMeta, 
      buildingsState: serverBuildings, 
      isLoading,
      refetch 
  } = useProjectData(dbScope, projectId);
  
  const [projectMeta, setProjectMeta] = useState({}); 
  const [buildingsState, setBuildingsState] = useState({});
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const saveTimeoutRef = useRef(null);
  const pendingUpdatesRef = useRef({});

  useEffect(() => {
      if (serverMeta && Object.keys(serverMeta).length > 0) {
          // @ts-ignore
          setProjectMeta(prev => ({ ...prev, ...serverMeta }));
      }
  }, [serverMeta]);

  useEffect(() => {
      if (serverBuildings && Object.keys(serverBuildings).length > 0) {
          setBuildingsState(prev => ({ ...prev, ...serverBuildings }));
      }
  }, [serverBuildings]);

  const mergedState = useMemo(() => {
    const meta = /** @type {any} */ (projectMeta);
    
    const defaultAppInfo = {
        status: APP_STATUS.DRAFT,
        currentStage: 1,
        currentStepIndex: 0,
        verifiedSteps: [],
        completedSteps: [],
        rejectionReason: null,
        history: [], 
        ...meta.applicationInfo
    };

    /** @type {any} */
    const combined = {
      complexInfo: meta.complexInfo || {},
      participants: meta.participants || {},
      cadastre: meta.cadastre || {},
      documents: meta.documents || [],
      composition: meta.composition || [],
      applicationInfo: defaultAppInfo,
      
      buildingDetails: { ...(meta.buildingDetails || {}) },
      floorData: { ...(meta.floorData || {}) },
      entrancesData: { ...(meta.entrancesData || {}) },
      mopData: { ...(meta.mopData || {}) }, 
      flatMatrix: { ...(meta.flatMatrix || {}) },
      parkingPlaces: { ...(meta.parkingPlaces || {}) }
    };

    Object.values(buildingsState).forEach(b => {
       if (b.buildingDetails) {
           // @ts-ignore
           combined.buildingDetails = { ...b.buildingDetails, ...combined.buildingDetails };
       }
       if (b.floorData) combined.floorData = { ...b.floorData, ...combined.floorData };
       if (b.entrancesData) combined.entrancesData = { ...b.entrancesData, ...combined.entrancesData };
       if (b.commonAreasData) combined.mopData = { ...b.commonAreasData, ...combined.mopData };
       if (b.apartmentsData) combined.flatMatrix = { ...b.apartmentsData, ...combined.flatMatrix };
       if (b.parkingData) combined.parkingPlaces = { ...b.parkingData, ...combined.parkingPlaces };
    });

    return combined;
  }, [projectMeta, buildingsState]);

  const isReadOnly = useMemo(() => {
      if (!userProfile) return true;
      const role = userProfile.role;
      // @ts-ignore
      const status = mergedState.applicationInfo.status;

      if (role === ROLES.ADMIN) return false;
      if (role === ROLES.CONTROLLER) return true;

      if (role === ROLES.TECHNICIAN) {
          if ([APP_STATUS.DRAFT, APP_STATUS.NEW, APP_STATUS.REJECTED].includes(status)) {
              return false;
          }
          return true;
      }
      return true;
  }, [userProfile, mergedState.applicationInfo]);

  // --- МЕТОДЫ ---

  const saveData = useCallback((updates = {}, showNotification = false, bypassReadOnly = false) => {
    if (!dbScope || !projectId) return;
    if (isReadOnly && !bypassReadOnly) {
        if (showNotification) toast.error("Редактирование запрещено");
        return;
    }
    
    if (updates && (updates.nativeEvent || updates.type === 'click')) { updates = {}; showNotification = true; }
    
    const safeUpdates = { ...updates };
    HEAVY_KEYS.forEach(k => delete safeUpdates[k]);
    
    pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...safeUpdates };

    if (Object.keys(pendingUpdatesRef.current).length === 0 && !showNotification) return;

    setIsSyncing(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    saveTimeoutRef.current = setTimeout(async () => {
      const payload = { ...pendingUpdatesRef.current };
      pendingUpdatesRef.current = {}; 

      try {
        if (Object.keys(payload).length > 0) {
            await RegistryService.saveData(dbScope, projectId, payload);
        }
        if (showNotification) toast.success("Сохранено!");
        
        if (showNotification) {
            setHasUnsavedChanges(false);
        }

      } catch (e) {
        console.error("SAVE ERROR:", e);
        toast.error("Ошибка: " + e.message);
      } finally {
        setIsSyncing(false);
      }
    }, 500);
  }, [dbScope, projectId, toast, isReadOnly]);

  const saveProjectImmediate = useCallback(async () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      
      const payload = { ...pendingUpdatesRef.current };
      pendingUpdatesRef.current = {}; 
      
      setIsSyncing(true);
      try {
          if (Object.keys(payload).length > 0) {
              await RegistryService.saveData(dbScope, projectId, payload);
          }
      } catch(e) {
          console.error("Force Save Error", e);
          throw e;
      } finally {
          setIsSyncing(false);
          setHasUnsavedChanges(false);
      }
  }, [dbScope, projectId]);

  // [UPDATED] Завершение задачи с записью в историю
  const completeTask = useCallback(async (currentIndex) => {
      await saveProjectImmediate();

      // @ts-ignore
      const currentAppInfo = mergedState.applicationInfo;
      const nextStepIndex = currentIndex + 1;
      
      const newCompleted = [...(currentAppInfo.completedSteps || [])];
      if (!newCompleted.includes(currentIndex)) {
          newCompleted.push(currentIndex);
      }

      // Создаем запись в истории
      const historyItem = createHistoryEntry(
          userProfile, 
          'Завершение задачи', 
          `Шаг "${STEPS_CONFIG[currentIndex]?.title}" выполнен.`
      );
      const newHistory = [historyItem, ...(currentAppInfo.history || [])];

      const isFinished = nextStepIndex >= STEPS_CONFIG.length;
      const newStatus = isFinished ? APP_STATUS.COMPLETED : currentAppInfo.status;

      const updates = {
          applicationInfo: {
              ...currentAppInfo,
              completedSteps: newCompleted,
              currentStepIndex: nextStepIndex,
              status: newStatus,
              history: newHistory
          }
      };

      setProjectMeta(prev => ({ ...prev, ...updates }));
      await RegistryService.saveData(dbScope, projectId, updates);
      
      return nextStepIndex;
  }, [dbScope, projectId, mergedState, saveProjectImmediate, userProfile]);

  // [UPDATED] Откат задачи с записью в историю
  const rollbackTask = useCallback(async () => {
      await saveProjectImmediate();

      // @ts-ignore
      const currentAppInfo = mergedState.applicationInfo;
      const currentIndex = currentAppInfo.currentStepIndex || 0;

      if (currentIndex <= 0) return 0;

      const prevIndex = currentIndex - 1;
      const newCompleted = (currentAppInfo.completedSteps || []).filter(s => s < prevIndex);

      // Создаем запись в истории
      const historyItem = createHistoryEntry(
          userProfile, 
          'Возврат задачи', 
          `Возврат с шага "${STEPS_CONFIG[currentIndex]?.title}" на "${STEPS_CONFIG[prevIndex]?.title}".`
      );
      const newHistory = [historyItem, ...(currentAppInfo.history || [])];

      const updates = {
          applicationInfo: {
              ...currentAppInfo,
              completedSteps: newCompleted,
              currentStepIndex: prevIndex,
              status: currentAppInfo.status === APP_STATUS.COMPLETED ? APP_STATUS.DRAFT : currentAppInfo.status,
              history: newHistory
          }
      };

      setProjectMeta(prev => ({ ...prev, ...updates }));
      await RegistryService.saveData(dbScope, projectId, updates);

      return prevIndex;
  }, [dbScope, projectId, mergedState, saveProjectImmediate, userProfile]);

  const saveBuildingData = useCallback(async (buildingId, dataKey, dataVal) => {
      if (isReadOnly) { toast.error("Редактирование запрещено"); return; }
      setIsSyncing(true);
      try {
          const payload = { buildingSpecificData: { [buildingId]: { [dataKey]: dataVal } } };
          await RegistryService.saveData(dbScope, projectId, payload);
          setBuildingsState(prev => ({ ...prev, [buildingId]: { ...(prev[buildingId] || {}), [dataKey]: { ...((prev[buildingId] || {})[dataKey] || {}), ...dataVal } } }));
          
          setHasUnsavedChanges(false); 
          
      } catch(e) {
          console.error(e); toast.error("Ошибка сохранения здания");
      } finally { setIsSyncing(false); }
  }, [dbScope, projectId, toast, isReadOnly]);

  const deleteProjectBuilding = useCallback(async (buildingId) => {
      if (isReadOnly) { toast.error("Удаление запрещено"); return; }
      if (!confirm('Удалить объект?')) return;
      try {
          // @ts-ignore
          const newComposition = mergedState.composition.filter(b => b.id !== buildingId);
          await RegistryService.deleteBuilding(dbScope, projectId, buildingId, { composition: newComposition });
          setProjectMeta(prev => ({ ...prev, composition: newComposition }));
          toast.success("Объект удален");
      } catch (e) { toast.error("Ошибка удаления"); }
  }, [dbScope, projectId, mergedState, toast, isReadOnly]);

  const updateStatus = useCallback(async (newStatus, newStage = null, comment = null) => { /* Legacy */ }, []);

  const createSetter = (key) => (value) => {
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
    ...mergedState,
    isReadOnly,
    userProfile,
    
    hasUnsavedChanges,
    setHasUnsavedChanges,

    completeTask,
    rollbackTask,
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
    isSyncing
  };

  if (isLoading && Object.keys(projectMeta).length === 0) {
      return (
          <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-900">
              <div className="w-20 border-r border-border bg-card h-full flex flex-col items-center py-6 gap-6">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div className="flex flex-col gap-4 mt-4">
                      {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="w-10 h-10 rounded-xl" />)}
                  </div>
              </div>
              <div className="flex-1 flex flex-col">
                  <div className="h-16 border-b border-border bg-card px-8 flex items-center justify-between">
                      <div className="flex items-center gap-4"><Skeleton className="w-8 h-8 rounded-full" /><Skeleton className="h-4 w-48" /></div>
                      <Skeleton className="h-9 w-32 rounded-lg" />
                  </div>
                  <div className="p-8 space-y-6">
                      <div className="flex justify-between items-center"><Skeleton className="h-8 w-64" /><Skeleton className="h-10 w-32" /></div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <Skeleton className="h-32 w-full rounded-2xl" /><Skeleton className="h-32 w-full rounded-2xl" /><Skeleton className="h-32 w-full rounded-2xl" />
                      </div>
                      <Skeleton className="h-[400px] w-full rounded-2xl" />
                  </div>
              </div>
          </div>
      );
  }

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
};