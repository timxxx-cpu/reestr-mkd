import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useToast } from './ToastContext';
import { RegistryService } from '../lib/registry-service';
import { useProjectData } from '../hooks/useProjectData';
import { ROLES, APP_STATUS, WORKFLOW_STAGES, STEPS_CONFIG } from '../lib/constants';

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
    'parkingPlaces', 'commonAreasData', 'apartmentsData', 'parkingData'
];

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
        verifiedSteps: [],
        completedSteps: [],
        rejectionReason: null,
        history: [], // Гарантируем наличие массива истории
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

  const setStepCompleted = useCallback(async (stepIndex, isCompleted) => {
      // @ts-ignore
      const currentList = mergedState.applicationInfo.completedSteps || [];
      let newList = [];
      if (isCompleted) {
          if (!currentList.includes(stepIndex)) newList = [...currentList, stepIndex]; else return;
      } else {
          newList = currentList.filter(i => i !== stepIndex);
      }
      // @ts-ignore
      const newAppInfo = { ...mergedState.applicationInfo, completedSteps: newList };
      setProjectMeta(prev => ({ ...prev, applicationInfo: newAppInfo }));
      await RegistryService.saveData(dbScope, projectId, { applicationInfo: newAppInfo });
  }, [dbScope, projectId, mergedState.applicationInfo]);

  const setStepVerified = useCallback(async (stepIndex, isVerified) => {
      // @ts-ignore
      const currentList = mergedState.applicationInfo.verifiedSteps || [];
      let newList = [];
      if (isVerified) {
          if (!currentList.includes(stepIndex)) newList = [...currentList, stepIndex]; else return;
      } else {
          newList = currentList.filter(i => i !== stepIndex);
      }
      // @ts-ignore
      const newAppInfo = { ...mergedState.applicationInfo, verifiedSteps: newList };
      setProjectMeta(prev => ({ ...prev, applicationInfo: newAppInfo }));
      await RegistryService.saveData(dbScope, projectId, { applicationInfo: newAppInfo });
  }, [dbScope, projectId, mergedState.applicationInfo]);

  // ОБНОВЛЕННЫЙ МЕТОД СМЕНЫ СТАТУСА (С ЗАПИСЬЮ ИСТОРИИ)
  const updateStatus = useCallback(async (newStatus, newStage = null, comment = null) => {
      // @ts-ignore
      const currentAppInfo = mergedState.applicationInfo;
      const currentStageNum = currentAppInfo.currentStage;

      // 1. Формируем запись истории
      const historyEntry = {
          date: new Date().toISOString(),
          user: userProfile?.name || 'Система',
          role: userProfile?.role || 'system',
          action: newStatus,
          prevStatus: currentAppInfo.status,
          comment: comment || ''
      };

      // 2. Обновляем данные
      const updatedAppInfo = {
          ...currentAppInfo,
          status: newStatus,
          // Добавляем запись в начало массива истории
          history: [historyEntry, ...(currentAppInfo.history || [])],
          ...(newStage && { currentStage: newStage }),
          rejectionReason: newStatus === APP_STATUS.REJECTED ? comment : null 
      };

      // 3. Логика сброса шагов при возврате
      if (newStatus === APP_STATUS.REJECTED) {
          const currentStageConfig = WORKFLOW_STAGES[currentStageNum];
          const prevStageConfig = WORKFLOW_STAGES[currentStageNum - 1];
          
          const startStepIndex = prevStageConfig ? prevStageConfig.lastStepIndex + 1 : 0;
          const endStepIndex = currentStageConfig ? currentStageConfig.lastStepIndex : STEPS_CONFIG.length - 1;

          const stepsInStage = [];
          for (let i = startStepIndex; i <= endStepIndex; i++) stepsInStage.push(i);

          updatedAppInfo.completedSteps = (currentAppInfo.completedSteps || []).filter(s => !stepsInStage.includes(s));
          updatedAppInfo.verifiedSteps = (currentAppInfo.verifiedSteps || []).filter(s => !stepsInStage.includes(s));
      }

      setProjectMeta(prev => ({ ...prev, applicationInfo: updatedAppInfo }));
      await RegistryService.saveData(dbScope, projectId, { applicationInfo: updatedAppInfo });
  }, [dbScope, projectId, mergedState.applicationInfo, userProfile]);

  const saveData = useCallback((updates = {}, showNotification = false, bypassReadOnly = false) => {
    if (!dbScope || !projectId) return;
    if (isReadOnly && !bypassReadOnly) {
        if (showNotification) toast.error("Редактирование запрещено");
        return;
    }
    
    if (updates && (updates.nativeEvent || updates.type === 'click')) { updates = {}; showNotification = true; }
    
    const safeUpdates = { ...updates };
    HEAVY_KEYS.forEach(k => delete safeUpdates[k]);
    
    if (Object.keys(safeUpdates).length === 0 && !showNotification) return;

    pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...safeUpdates };

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
      
      if (Object.keys(payload).length > 0) {
          setIsSyncing(true);
          try {
              await RegistryService.saveData(dbScope, projectId, payload);
          } catch(e) {
              console.error("Force Save Error", e);
              throw e;
          } finally {
              setIsSyncing(false);
          }
      }
  }, [dbScope, projectId]);

  const saveBuildingData = useCallback(async (buildingId, dataKey, dataVal) => {
      if (isReadOnly) { toast.error("Редактирование запрещено"); return; }
      setIsSyncing(true);
      const toastId = toast.loading("Запись данных здания...");
      try {
          const payload = { buildingSpecificData: { [buildingId]: { [dataKey]: dataVal } } };
          await RegistryService.saveData(dbScope, projectId, payload);
          setBuildingsState(prev => ({ ...prev, [buildingId]: { ...(prev[buildingId] || {}), [dataKey]: { ...((prev[buildingId] || {})[dataKey] || {}), ...dataVal } } }));
          toast.dismiss(toastId); toast.success("Данные здания сохранены");
      } catch(e) {
          console.error(e); toast.dismiss(toastId); toast.error("Ошибка сохранения здания");
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

  const createSetter = (key) => (value) => {
      if (isReadOnly) return; 
      const newValue = typeof value === 'function' ? value(mergedState[key]) : value;
      setProjectMeta(prev => ({ ...prev, [key]: newValue }));
      if (!HEAVY_KEYS.includes(key)) saveData({ [key]: newValue });
  };

  const value = {
    ...mergedState,
    isReadOnly,
    userProfile,
    
    setStepVerified,
    setStepCompleted,
    updateStatus,
    
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

    saveData,
    saveProjectImmediate, 
    saveBuildingData, 
    deleteProjectBuilding, 
    isSyncing
  };

  if (isLoading && Object.keys(projectMeta).length === 0) return <div className="h-screen w-full flex items-center justify-center text-slate-400">Загрузка проекта...</div>;

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
};