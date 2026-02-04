import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useToast } from './ToastContext';
import { RegistryService } from '../lib/registry-service';
import { cleanBuildingDetails } from '../lib/building-details';
import { useProjectData } from '../hooks/useProjectData';
import { ROLES, APP_STATUS, WORKFLOW_STAGES, STEPS_CONFIG } from '../lib/constants';
import { Skeleton } from '../components/ui/Skeleton';
import { getStepStage } from '../lib/workflow-utils';

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

const createHistoryEntry = (user, action, comment, details = {}) => ({
    date: new Date().toISOString(),
    user: user.name || 'Unknown',
    role: user.role || 'system',
    action,
    comment,
    ...details
});

const getStageStepRange = (stageNum) => {
    const prevStage = WORKFLOW_STAGES[stageNum - 1];
    const currentStage = WORKFLOW_STAGES[stageNum];
    const startIndex = stageNum <= 1 ? 0 : (prevStage?.lastStepIndex ?? -1) + 1;
    const endIndex = currentStage?.lastStepIndex ?? STEPS_CONFIG.length - 1;
    return { startIndex, endIndex };
};

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
       // @ts-ignore
       if (b.buildingDetails) {
           // @ts-ignore
           combined.buildingDetails = { ...b.buildingDetails, ...combined.buildingDetails };
       }
       // @ts-ignore
       if (b.floorData) combined.floorData = { ...b.floorData, ...combined.floorData };
       // @ts-ignore
       if (b.entrancesData) combined.entrancesData = { ...b.entrancesData, ...combined.entrancesData };
       // @ts-ignore
       if (b.commonAreasData) combined.mopData = { ...b.commonAreasData, ...combined.mopData };
       // @ts-ignore
       if (b.apartmentsData) combined.flatMatrix = { ...b.apartmentsData, ...combined.flatMatrix };
       // @ts-ignore
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
          if ([APP_STATUS.DRAFT, APP_STATUS.NEW, APP_STATUS.REJECTED, APP_STATUS.INTEGRATION].includes(status)) {
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
    
    if (updates && (updates.nativeEvent || updates.type === 'click')) { updates = {}; }
    
    const safeUpdates = { ...updates };
    HEAVY_KEYS.forEach(k => delete safeUpdates[k]);
    
    pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...safeUpdates };
    
    if (Object.keys(pendingUpdatesRef.current).length > 0) {
        setHasUnsavedChanges(true);
    }
  }, [dbScope, projectId, toast, isReadOnly]);

  const saveProjectImmediate = useCallback(async () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      
      // Копируем изменения для сохранения
      const changes = { ...pendingUpdatesRef.current };
      pendingUpdatesRef.current = {}; 
      
      setIsSyncing(true);
      try {
          if (Object.keys(changes).length > 0) {
              
              // 1. ОТДЕЛЯЕМ ТЯЖЕЛЫЕ ДАННЫЕ (МАТРИЦЫ)
              const buildingUpdates = {};

              // Хелпер
              const addToBuilding = (bId, key, data) => {
                  if (!buildingUpdates[bId]) buildingUpdates[bId] = {};
                  if (!buildingUpdates[bId][key]) buildingUpdates[bId][key] = {};
                  
                  // Фильтрация данных только для текущего здания
                  Object.keys(data).forEach(k => {
                      if (k.startsWith(bId)) {
                          buildingUpdates[bId][key][k] = data[k];
                      }
                  });
              };

              // Список ключей, которые должны уйти в sub-collections
              const MATRIX_KEYS = {
                  'floorData': 'floorData',
                  'entrancesData': 'entrancesData',
                  'mopData': 'commonAreasData',
                  'flatMatrix': 'apartmentsData',
                  'parkingPlaces': 'parkingData'
              };

              Object.keys(changes).forEach(changeKey => {
                  if (MATRIX_KEYS[changeKey]) {
                      const firebaseKey = MATRIX_KEYS[changeKey];
                      const fullData = changes[changeKey];
                      
                      // Пробегаемся по всем зданиям проекта (берем из текущего состояния)
                      // @ts-ignore
                      mergedState.composition.forEach(b => {
                          addToBuilding(b.id, firebaseKey, fullData);
                      });
                      
                      // Удаляем этот ключ из general updates
                      delete changes[changeKey];
                  }
              });

              // 2. Очистка мусорных значений в конфигурации блоков
              if (changes.buildingDetails) {
                  const cleanedDetails = cleanBuildingDetails(mergedState.composition, changes.buildingDetails);
                  changes.buildingDetails = cleanedDetails;
                  setProjectMeta(prev => ({ ...prev, buildingDetails: cleanedDetails }));
              }

              // 3. Сохраняем общие данные в документ проекта
              if (Object.keys(changes).length > 0) {
                  await RegistryService.saveData(dbScope, projectId, changes);
              }

              // 4. Сохраняем данные зданий в подколлекции
              const buildingPromises = Object.entries(buildingUpdates).map(([bId, bData]) => {
                  // Проверяем, есть ли что сохранять для этого здания
                  const hasData = Object.values(bData).some(val => Object.keys(val).length > 0);
                  if (!hasData) return Promise.resolve();

                  const payload = {
                      buildingSpecificData: {
                          [bId]: bData
                      }
                  };
                  return RegistryService.saveData(dbScope, projectId, payload);
              });

              await Promise.all(buildingPromises);
          }
      } catch(e) {
          console.error("Force Save Error", e);
          toast.error("Ошибка сохранения данных");
          throw e;
      } finally {
          setIsSyncing(false);
          setHasUnsavedChanges(false);
      }
  }, [dbScope, projectId, mergedState.composition]);

  const completeTask = useCallback(async (currentIndex) => {
      await saveProjectImmediate();

      // @ts-ignore
      const currentAppInfo = mergedState.applicationInfo;
      const nextStepIndex = currentIndex + 1;
      
      const newCompleted = [...(currentAppInfo.completedSteps || [])];
      if (!newCompleted.includes(currentIndex)) {
          newCompleted.push(currentIndex);
      }

      const isLastStepGlobal = nextStepIndex >= STEPS_CONFIG.length;
      
      const currentStageNum = getStepStage(currentIndex);
      const stageConfig = WORKFLOW_STAGES[currentStageNum];
      const isStageBoundary = stageConfig && stageConfig.lastStepIndex === currentIndex;

      const INTEGRATION_START_IDX = 12;

      const prevStatus = currentAppInfo.status;
      let newStatus = currentAppInfo.status;
      let newStage = currentAppInfo.currentStage;
      let historyComment = `Шаг "${STEPS_CONFIG[currentIndex]?.title}" выполнен.`;

      if (isLastStepGlobal) {
          newStatus = APP_STATUS.COMPLETED;
          historyComment = `Проект полностью завершен и переведен в статус "${APP_STATUS.COMPLETED}".`;
      } 
      else if (isStageBoundary) {
          newStatus = APP_STATUS.REVIEW;
          newStage = currentStageNum + 1; 
          historyComment = `Этап ${currentStageNum} завершен. Отправлен на проверку (REVIEW).`;
      }
      else if (nextStepIndex === INTEGRATION_START_IDX) {
          newStatus = APP_STATUS.INTEGRATION;
          historyComment = `Переход к этапу интеграции с УЗКАД. Статус изменен на "${APP_STATUS.INTEGRATION}".`;
      }

      const historyItem = createHistoryEntry(
          userProfile,
          isStageBoundary ? 'Отправка на проверку' : (nextStepIndex === INTEGRATION_START_IDX ? 'Старт интеграции' : 'Завершение задачи'),
          historyComment,
          {
              prevStatus,
              nextStatus: newStatus,
              stage: getStepStage(currentIndex),
              stepIndex: currentIndex
          }
      );
      const newHistory = [historyItem, ...(currentAppInfo.history || [])];

      const updates = {
          applicationInfo: {
              ...currentAppInfo,
              completedSteps: newCompleted,
              currentStepIndex: nextStepIndex,
              status: newStatus,
              currentStage: isStageBoundary ? newStage : currentAppInfo.currentStage,
              history: newHistory
          }
      };

      setProjectMeta(prev => ({ ...prev, ...updates }));
      await RegistryService.saveData(dbScope, projectId, updates);
      
      return nextStepIndex;
  }, [dbScope, projectId, mergedState, saveProjectImmediate, userProfile]);

  const rollbackTask = useCallback(async () => {
      await saveProjectImmediate();

      // @ts-ignore
      const currentAppInfo = mergedState.applicationInfo;
      const currentIndex = currentAppInfo.currentStepIndex || 0;

      if (currentIndex <= 0) return 0;

      const prevIndex = currentIndex - 1;
      const newCompleted = (currentAppInfo.completedSteps || []).filter(s => s < prevIndex);

      const historyItem = createHistoryEntry(
          userProfile,
          'Возврат задачи',
          `Возврат с шага "${STEPS_CONFIG[currentIndex]?.title}" на "${STEPS_CONFIG[prevIndex]?.title}".`,
          {
              prevStatus: currentAppInfo.status,
              nextStatus: [APP_STATUS.COMPLETED, APP_STATUS.REVIEW].includes(currentAppInfo.status) ? APP_STATUS.DRAFT : currentAppInfo.status,
              stage: getStepStage(prevIndex),
              stepIndex: prevIndex
          }
      );
      const newHistory = [historyItem, ...(currentAppInfo.history || [])];

      const updates = {
          applicationInfo: {
              ...currentAppInfo,
              completedSteps: newCompleted,
              currentStepIndex: prevIndex,
              status: [APP_STATUS.COMPLETED, APP_STATUS.REVIEW].includes(currentAppInfo.status) ? APP_STATUS.DRAFT : currentAppInfo.status,
              currentStage: getStepStage(prevIndex),
              history: newHistory
          }
      };

      setProjectMeta(prev => ({ ...prev, ...updates }));
      await RegistryService.saveData(dbScope, projectId, updates);

      return prevIndex;
  }, [dbScope, projectId, mergedState, saveProjectImmediate, userProfile]);

  const reviewStage = useCallback(async (action, comment = '') => {
      // @ts-ignore
      const currentAppInfo = mergedState.applicationInfo;
      const isApprove = action === 'APPROVE';
      
      const prevStatus = currentAppInfo.status;
      let newStatus = currentAppInfo.status;
      let newStepIndex = currentAppInfo.currentStepIndex;
      let newStage = currentAppInfo.currentStage;
      let historyAction = isApprove ? 'Этап принят' : 'Возврат на доработку';
      
      const reviewedStage = Math.max(1, currentAppInfo.currentStage - 1);
      const { startIndex, endIndex } = getStageStepRange(reviewedStage);
      const reviewedStepIndexes = Array.from({ length: endIndex - startIndex + 1 }, (_, i) => startIndex + i);
      let updatedVerifiedSteps = [...(currentAppInfo.verifiedSteps || [])];

      if (isApprove) {
          newStatus = APP_STATUS.DRAFT;
          updatedVerifiedSteps = Array.from(new Set([...updatedVerifiedSteps, ...reviewedStepIndexes]));
          if (newStepIndex === 12) {
              newStatus = APP_STATUS.INTEGRATION;
          }
      } else {
          newStage = Math.max(1, currentAppInfo.currentStage - 1);
          const prevStageConfig = WORKFLOW_STAGES[newStage];
          if (prevStageConfig) {
              newStepIndex = prevStageConfig.lastStepIndex;
          } else {
              newStepIndex = 0;
          }
          newStatus = APP_STATUS.REJECTED;
          updatedVerifiedSteps = updatedVerifiedSteps.filter((idx) => idx < startIndex || idx > endIndex);
      }

      const historyItem = createHistoryEntry(
          userProfile,
          historyAction,
          comment || (isApprove ? `Этап ${reviewedStage} проверен и одобрен.` : `Этап ${reviewedStage} возвращен на доработку.`),
          {
              prevStatus,
              nextStatus: newStatus,
              stage: reviewedStage,
              stepIndex: newStepIndex
          }
      );
      const newHistory = [historyItem, ...(currentAppInfo.history || [])];

      const updates = {
          applicationInfo: {
              ...currentAppInfo,
              status: newStatus,
              currentStage: newStage,
              currentStepIndex: newStepIndex,
              history: newHistory,
              rejectionReason: !isApprove ? comment : null,
              verifiedSteps: updatedVerifiedSteps
          }
      };

      setProjectMeta(prev => ({ ...prev, ...updates }));
      await RegistryService.saveData(dbScope, projectId, updates);
      
      return newStepIndex;
  }, [dbScope, projectId, mergedState, userProfile]);

  // Сохранено для совместимости (если вдруг используется напрямую)
  const saveBuildingData = useCallback(async (buildingId, dataKey, dataVal) => {
      if (isReadOnly) { toast.error("Редактирование запрещено"); return; }
      setIsSyncing(true);
      try {
          let promise;
          
          if (dataKey === 'apartmentsData') {
              const unitsArray = Object.values(dataVal);
              promise = RegistryService.saveUnits(dbScope, projectId, buildingId, unitsArray);
          } else if (dataKey === 'floorData') {
              const floorsArray = Object.entries(dataVal).map(([k, v]) => ({ ...v, legacyKey: k }));
              promise = RegistryService.saveFloors(dbScope, projectId, buildingId, floorsArray);
          } else if (dataKey === 'parkingData') {
              const parkingArray = Object.entries(dataVal).map(([k, v]) => ({ ...v, legacyKey: k }));
              promise = RegistryService.saveParkingPlaces(dbScope, projectId, buildingId, parkingArray);
          } else {
              const payload = { buildingSpecificData: { [buildingId]: { [dataKey]: dataVal } } };
              promise = RegistryService.saveData(dbScope, projectId, payload);
          }

          await promise;
          
          setBuildingsState(prev => ({ 
              ...prev, 
              [buildingId]: { 
                  ...(prev[buildingId] || {}), 
                  [dataKey]: { 
                      // @ts-ignore
                      ...((prev[buildingId] || {})[dataKey] || {}), 
                      ...dataVal 
                  } 
              } 
          }));
          
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

  const updateStatus = useCallback(async (newStatus, newStage = null, comment = null) => { /* ... */ }, []);

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
