import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useToast } from './ToastContext';
import { ApiService } from '../lib/api-service';
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

  // Используем обновленный хук, который возвращает полные данные в projectMeta
  const { 
      projectMeta: serverData, 
      isLoading,
      refetch 
  } = useProjectData(dbScope, projectId);
  
  /** @type {[any, Function]} */
  const [projectMeta, setProjectMeta] = useState({}); 
  /** @type {[any, Function]} */
  const [buildingsState, setBuildingsState] = useState({}); 
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const saveTimeoutRef = useRef(null);
  const pendingUpdatesRef = useRef({});

  // Единый эффект инициализации
  useEffect(() => {
      if (serverData && Object.keys(serverData).length > 0) {
          setProjectMeta(prev => ({ ...prev, ...serverData }));
      }
  }, [serverData]);

  const mergedState = useMemo(() => {
    // Явное приведение типа для устранения ошибок TS
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

    const combined = {
      complexInfo: meta.complexInfo || {},
      participants: meta.participants || {},
      cadastre: meta.cadastre || {},
      documents: meta.documents || [],
      composition: meta.composition || [],
      applicationInfo: defaultAppInfo,
      
      buildingDetails: { ...(meta.buildingDetails || {}) },
      // Данные матриц могут быть в serverData, если они там загружаются, 
      // или подгружаться компонентами. Здесь мы объединяем все источники.
      floorData: { ...(meta.floorData || {}) },
      entrancesData: { ...(meta.entrancesData || {}) },
      mopData: { ...(meta.mopData || {}) }, 
      flatMatrix: { ...(meta.flatMatrix || {}) },
      parkingPlaces: { ...(meta.parkingPlaces || {}) }
    };

    // Мержим легаси стейт (если используется saveBuildingData)
    Object.values(buildingsState).forEach(b => {
       const build = /** @type {any} */ (b);
       if (build.buildingDetails) combined.buildingDetails = { ...build.buildingDetails, ...combined.buildingDetails };
       if (build.floorData) combined.floorData = { ...build.floorData, ...combined.floorData };
       if (build.entrancesData) combined.entrancesData = { ...build.entrancesData, ...combined.entrancesData };
       if (build.commonAreasData) combined.mopData = { ...build.commonAreasData, ...combined.mopData };
       if (build.apartmentsData) combined.flatMatrix = { ...build.apartmentsData, ...combined.flatMatrix };
       if (build.parkingData) combined.parkingPlaces = { ...build.parkingData, ...combined.parkingPlaces };
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
    
    // @ts-ignore
    pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...safeUpdates };
    
    if (Object.keys(pendingUpdatesRef.current).length > 0) {
        setHasUnsavedChanges(true);
    }
  }, [dbScope, projectId, toast, isReadOnly]);

  const saveProjectImmediate = useCallback(async () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      
      const changes = /** @type {any} */ ({ ...pendingUpdatesRef.current });
      pendingUpdatesRef.current = {}; 
      
      setIsSyncing(true);
      try {
          if (Object.keys(changes).length > 0) {
              
              // 1. ОТДЕЛЯЕМ ТЯЖЕЛЫЕ ДАННЫЕ (МАТРИЦЫ)
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
                      
                      // @ts-ignore
                      mergedState.composition.forEach(b => {
                          addToBuilding(b.id, firebaseKey, fullData);
                      });
                      
                      delete changes[changeKey];
                  }
              });

              // 2. Очистка buildingDetails
              if (changes.buildingDetails) {
                  // @ts-ignore
                  const cleanedDetails = cleanBuildingDetails(mergedState.composition, changes.buildingDetails);
                  changes.buildingDetails = cleanedDetails;
                  setProjectMeta(prev => ({ ...prev, buildingDetails: cleanedDetails }));
              }

              // 3. Сохраняем общие данные через ApiService
              if (Object.keys(changes).length > 0) {
                  await ApiService.saveData(dbScope, projectId, changes);
              }

              // 4. Сохраняем данные зданий (если есть)
              const buildingPromises = Object.entries(buildingUpdates).map(([bId, bData]) => {
                  const hasData = Object.values(bData).some(val => Object.keys(val).length > 0);
                  if (!hasData) return Promise.resolve();

                  const payload = {
                      buildingSpecificData: {
                          [bId]: bData
                      }
                  };
                  return ApiService.saveData(dbScope, projectId, payload);
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
          // Обновляем данные с сервера, чтобы синхронизировать состояние
          refetch();
      }
  }, [dbScope, projectId, mergedState.composition, refetch]);

  const completeTask = useCallback(async (currentIndex) => {
      // Сначала сохраняем всё, что есть в буфере
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
              prevStatus: currentAppInfo.status,
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
      await ApiService.saveData(dbScope, projectId, updates);
      
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
      await ApiService.saveData(dbScope, projectId, updates);

      return prevIndex;
  }, [dbScope, projectId, mergedState, saveProjectImmediate, userProfile]);

  const reviewStage = useCallback(async (action, comment = '') => {
      // @ts-ignore
      const currentAppInfo = mergedState.applicationInfo;
      const isApprove = action === 'APPROVE';
      
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
              prevStatus: currentAppInfo.status,
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
      await ApiService.saveData(dbScope, projectId, updates);
      
      return newStepIndex;
  }, [dbScope, projectId, mergedState, userProfile]);

  // Адаптеры для совместимости
  const saveBuildingData = useCallback(async (buildingId, dataKey, dataVal) => {
      if (isReadOnly) { toast.error("Редактирование запрещено"); return; }
      setIsSyncing(true);
      try {
          let promise;
          
          if (dataKey === 'apartmentsData') {
              const unitsArray = Object.values(dataVal);
              promise = ApiService.saveUnits(dbScope, projectId, buildingId, unitsArray);
          } else if (dataKey === 'floorData') {
              const floorsArray = Object.entries(dataVal).map(([k, v]) => ({ ...v, legacyKey: k }));
              promise = ApiService.saveFloors(dbScope, projectId, buildingId, floorsArray);
          } else if (dataKey === 'parkingData') {
              const parkingArray = Object.entries(dataVal).map(([k, v]) => ({ ...v, legacyKey: k }));
              promise = ApiService.saveParkingPlaces(dbScope, projectId, buildingId, parkingArray);
          } else {
              const payload = { buildingSpecificData: { [buildingId]: { [dataKey]: dataVal } } };
              promise = ApiService.saveData(dbScope, projectId, payload);
          }

          await promise;
          
          // Для обратной совместимости обновляем локальный стейт
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
          await ApiService.deleteBuilding(buildingId);
          // @ts-ignore
          const newComposition = mergedState.composition.filter(b => b.id !== buildingId);
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
          // @ts-ignore
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
    isSyncing,
    refetch,
    // [NEW] Установить ID проекта (для PassportEditor при создании)
    setProjectId: (id) => window.location.href = `/project/${id}` // Грубый, но рабочий редирект на созданный проект
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