import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useToast } from './ToastContext';
import { RegistryService } from '../lib/registry-service';
import { useProjectData } from '../hooks/useProjectData';

/**
 * Импорт типов
 * @typedef {import('../lib/types').ProjectMeta} ProjectMeta
 * @typedef {import('../lib/types').BuildingData} BuildingData
 */

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

export const ProjectProvider = ({ children, projectId, user, customScope }) => {
  const toast = useToast();
  const dbScope = customScope || user?.uid;

  // --- REACT QUERY FETCHING ---
  const { 
      projectMeta: serverMeta, 
      buildingsState: serverBuildings, 
      isLoading,
      refetch 
  } = useProjectData(dbScope, projectId);
  
  // -- LOCAL STATE (Для редактирования) --
  
  // ИСПРАВЛЕНИЕ: Явное приведение типа для начального значения
  const [projectMeta, setProjectMeta] = useState(/** @type {ProjectMeta} */ ({})); 
  
  const [buildingsState, setBuildingsState] = useState({});
  
  const [isSyncing, setIsSyncing] = useState(false);
  const saveTimeoutRef = useRef(null);

  // Синхронизация Server Data -> Local State
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

  // --- СЛИЯНИЕ ДАННЫХ ---
  const mergedState = useMemo(() => {
    // 1. Основа - локальный стейт.
    /** @type {ProjectMeta} */
    const combined = {
      complexInfo: projectMeta.complexInfo || {},
      participants: projectMeta.participants || {},
      cadastre: projectMeta.cadastre || {},
      documents: projectMeta.documents || [],
      composition: projectMeta.composition || [],
      buildingDetails: { ...(projectMeta.buildingDetails || {}) },
      
      floorData: { ...(projectMeta.floorData || {}) },
      entrancesData: { ...(projectMeta.entrancesData || {}) },
      mopData: { ...(projectMeta.mopData || {}) }, 
      flatMatrix: { ...(projectMeta.flatMatrix || {}) },
      parkingPlaces: { ...(projectMeta.parkingPlaces || {}) }
    };

    // 2. Заполняем пробелы данными из базы
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

  // --- СОХРАНЕНИЕ ---
  const saveData = useCallback((updates = {}, showNotification = false) => {
    if (!dbScope || !projectId) return;
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
        // refetch(); // Опционально: обновить данные с сервера
        if (showNotification && toastId) { toast.dismiss(toastId); toast.success("Сохранено!"); }
      } catch (e) {
        console.error("SAVE ERROR:", e);
        if (toastId) toast.dismiss(toastId);
        toast.error("Ошибка: " + e.message);
      } finally {
        setIsSyncing(false);
      }
    }, 500);
  }, [dbScope, projectId, toast, refetch]);

  const saveBuildingData = useCallback(async (buildingId, dataKey, dataVal) => {
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
  }, [dbScope, projectId, toast]);

  const deleteProjectBuilding = useCallback(async (buildingId) => {
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
  }, [dbScope, projectId, mergedState, toast]);

  const createSetter = (key) => (value) => {
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
    setComplexInfo: createSetter('complexInfo'),
    setParticipants: createSetter('participants'),
    setCadastre: createSetter('cadastre'),
    setComposition: createSetter('composition'),
    setDocuments: createSetter('documents'),
    setBuildingDetails: createSetter('buildingDetails'),
    
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