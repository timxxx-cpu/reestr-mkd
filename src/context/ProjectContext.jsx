import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useToast } from './ToastContext';
import { RegistryService } from '../lib/registry-service';
import { useProjectData } from '../hooks/useProjectData';
import { ROLES, APP_STATUS } from '../lib/constants';

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
    // Приводим к any, чтобы избежать ошибок TS
    const meta = /** @type {any} */ (projectMeta);
    
    // Значения по умолчанию для applicationInfo, чтобы кнопки не пропадали
    const defaultAppInfo = {
        status: APP_STATUS.DRAFT,
        currentStage: 1,
        verifiedSteps: [],
        ...meta.applicationInfo
    };

    /** @type {any} */
    const combined = {
      complexInfo: meta.complexInfo || {},
      participants: meta.participants || {},
      cadastre: meta.cadastre || {},
      documents: meta.documents || [],
      composition: meta.composition || [],
      applicationInfo: defaultAppInfo, // Используем объект с дефолтами
      
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

  // --- ЛОГИКА READ-ONLY ---
  const isReadOnly = useMemo(() => {
      if (!userProfile) return true;
      const role = userProfile.role;
      // @ts-ignore
      const status = mergedState.applicationInfo.status; // Теперь статус точно есть

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

  // --- МЕТОДЫ УПРАВЛЕНИЯ ---

  // 1. Верификация шага
  const setStepVerified = useCallback(async (stepIndex, isVerified) => {
      // @ts-ignore
      const currentVerified = mergedState.applicationInfo.verifiedSteps || [];
      let newVerified = [];
      
      if (isVerified) {
          if (!currentVerified.includes(stepIndex)) {
              newVerified = [...currentVerified, stepIndex];
          } else return;
      } else {
          newVerified = currentVerified.filter(i => i !== stepIndex);
      }

      // @ts-ignore
      const newAppInfo = { ...mergedState.applicationInfo, verifiedSteps: newVerified };
      
      // @ts-ignore
      setProjectMeta(prev => ({ ...prev, applicationInfo: newAppInfo }));
      
      await RegistryService.saveData(dbScope, projectId, { applicationInfo: newAppInfo });
      
  }, [dbScope, projectId, mergedState.applicationInfo]);

  // 2. Смена статуса
  const updateStatus = useCallback(async (newStatus, newStage = null, comment = '') => {
      // @ts-ignore
      const currentAppInfo = mergedState.applicationInfo;
      const updatedAppInfo = {
          ...currentAppInfo,
          status: newStatus,
          ...(newStage && { currentStage: newStage }),
      };

      // @ts-ignore
      setProjectMeta(prev => ({ ...prev, applicationInfo: updatedAppInfo }));
      
      await RegistryService.saveData(dbScope, projectId, { applicationInfo: updatedAppInfo });
  }, [dbScope, projectId, mergedState.applicationInfo]);

  // --- СОХРАНЕНИЕ ---
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

    setIsSyncing(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      let toastId = null;
      try {
        if (showNotification) toastId = toast.loading("Сохранение...");
        await RegistryService.saveData(dbScope, projectId, safeUpdates);
        if (showNotification && toastId) { toast.dismiss(toastId); toast.success("Сохранено!"); }
      } catch (e) {
        console.error("SAVE ERROR:", e);
        if (toastId) toast.dismiss(toastId);
        toast.error("Ошибка: " + e.message);
      } finally {
        setIsSyncing(false);
      }
    }, 500);
  }, [dbScope, projectId, toast, isReadOnly]);

  const saveBuildingData = useCallback(async (buildingId, dataKey, dataVal) => {
      if (isReadOnly) {
          toast.error("Редактирование запрещено");
          return;
      }

      setIsSyncing(true);
      const toastId = toast.loading("Запись данных здания...");
      try {
          const payload = {
              buildingSpecificData: {
                  [buildingId]: { [dataKey]: dataVal }
              }
          };
          await RegistryService.saveData(dbScope, projectId, payload);
          
          setBuildingsState(prev => ({
              ...prev,
              [buildingId]: {
                  ...(prev[buildingId] || {}),
                  [dataKey]: { ...((prev[buildingId] || {})[dataKey] || {}), ...dataVal }
              }
          }));
          toast.dismiss(toastId);
          toast.success("Данные здания сохранены");
      } catch(e) {
          console.error(e);
          toast.dismiss(toastId);
          toast.error("Ошибка сохранения здания");
      } finally {
          setIsSyncing(false);
      }
  }, [dbScope, projectId, toast, isReadOnly]);

  const deleteProjectBuilding = useCallback(async (buildingId) => {
      if (isReadOnly) {
          toast.error("Удаление запрещено");
          return;
      }
      if (!confirm('Удалить объект и все связанные данные?')) return;
      try {
          // @ts-ignore
          const newComposition = mergedState.composition.filter(b => b.id !== buildingId);
          const newBuildingDetails = { ...mergedState.buildingDetails };
          Object.keys(newBuildingDetails).forEach(k => {
              if (k.startsWith(buildingId)) delete newBuildingDetails[k];
          });

          await RegistryService.deleteBuilding(dbScope, projectId, buildingId, { 
              composition: newComposition,
              buildingDetails: newBuildingDetails
          });
          
          // @ts-ignore
          setProjectMeta(prev => ({
              ...prev,
              composition: newComposition,
              buildingDetails: newBuildingDetails
          }));
          
          toast.success("Объект удален");
      } catch (e) {
          console.error(e);
          toast.error("Ошибка удаления");
      }
  }, [dbScope, projectId, mergedState, toast, isReadOnly]);

  const createSetter = (key) => (value) => {
      if (isReadOnly) return; 
      // @ts-ignore
      const newValue = typeof value === 'function' ? value(mergedState[key]) : value;
      // @ts-ignore
      setProjectMeta(prev => ({ ...prev, [key]: newValue }));
      if (!HEAVY_KEYS.includes(key)) {
          saveData({ [key]: newValue });
      }
  };

  const value = {
    // @ts-ignore
    ...mergedState,
    isReadOnly,
    
    setStepVerified,
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
    saveBuildingData, 
    deleteProjectBuilding, 
    isSyncing
  };

  if (isLoading && Object.keys(projectMeta).length === 0) {
       return <div className="h-screen w-full flex items-center justify-center text-slate-400">Загрузка проекта...</div>;
  }

  // @ts-ignore
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
};