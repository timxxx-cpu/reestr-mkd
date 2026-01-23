import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useToast } from './ToastContext';
import { RegistryService } from '../lib/registry-service';

/**
 * Импорт типов
 * @typedef {import('../lib/types').ProjectMeta} ProjectMeta
 * @typedef {import('../lib/types').BuildingData} BuildingData
 * @typedef {import('../lib/types').BuildingMeta} BuildingMeta
 * @typedef {import('../lib/types').BuildingConfig} BuildingConfig
 * @typedef {import('../lib/types').FloorData} FloorData
 * @typedef {import('../lib/types').EntranceData} EntranceData
 * @typedef {import('../lib/types').UnitData} UnitData
 * @typedef {import('../lib/types').MopItem} MopItem
 * @typedef {import('../lib/types').ParkingPlace} ParkingPlace
 */

/**
 * Описание всего, что доступно через useProject()
 * @typedef {Object} ProjectContextType
 * * -- Мета-данные --
 * @property {Object} complexInfo - Паспортные данные
 * @property {function(Object): void} setComplexInfo
 * @property {Object} participants - Участники
 * @property {function(Object): void} setParticipants
 * @property {Object} cadastre - Кадастр
 * @property {function(Object): void} setCadastre
 * @property {Array<BuildingMeta>} composition - Список зданий
 * @property {function(Array<BuildingMeta>|function(Array<BuildingMeta>):Array<BuildingMeta>): void} setComposition
 * @property {Array} documents
 * @property {function(Array): void} setDocuments
 * @property {Object.<string, BuildingConfig>} buildingDetails
 * @property {function(Object): void} setBuildingDetails
 * * -- Тяжелые данные (Матрицы) --
 * @property {Object.<string, FloorData>} floorData
 * @property {function(Object): void} setFloorData
 * @property {Object.<string, EntranceData>} entrancesData
 * @property {function(Object): void} setEntrancesData
 * @property {Object.<string, MopItem[]>} mopData
 * @property {function(Object): void} setMopData
 * @property {Object.<string, UnitData>} flatMatrix
 * @property {function(Object): void} setFlatMatrix
 * @property {Object.<string, ParkingPlace>} parkingPlaces
 * @property {function(Object): void} setParkingPlaces
 * * -- Методы --
 * @property {function(Object=, boolean=): void} saveData - Сохранить мета-данные (авто/ручное)
 * @property {function(string, string, any): Promise<void>} saveBuildingData - Сохранить тяжелые данные здания
 * @property {function(string): Promise<void>} deleteProjectBuilding - Удалить здание целиком
 * @property {boolean} isSyncing - Индикатор загрузки
 */

// Создаем контекст с типизацией
const ProjectContext = createContext(/** @type {ProjectContextType | null} */ (null));

export const useProject = () => {
    const context = useContext(ProjectContext);
    if (!context) {
        throw new Error('useProject must be used within a ProjectProvider');
    }
    return context;
};

// Ключи, которые строго запрещено писать в основной файл проекта
const HEAVY_KEYS = [
    'floorData', 'entrancesData', 'mopData', 'flatMatrix', 
    'parkingPlaces', 'commonAreasData', 'apartmentsData', 'parkingData'
];

export const ProjectProvider = ({ children, projectId, user, customScope }) => {
  const toast = useToast();
  
  // -- STATE --
  // Используем кастинг (/** @type {ProjectMeta} */ ({})), чтобы успокоить TS
  const [projectMeta, setProjectMeta] = useState(/** @type {ProjectMeta} */ ({})); 
  
  /** @type {[Object.<string, BuildingData>, function(Object):void]} */
  const [buildingsState, setBuildingsState] = useState({});
  
  const [isSyncing, setIsSyncing] = useState(false);
  const saveTimeoutRef = useRef(null);

  const dbScope = customScope || user?.uid;

  // --- 1. ЗАГРУЗКА ---
  useEffect(() => {
    if (!dbScope || !projectId) return;

    const unsubMeta = RegistryService.subscribeProjectMeta(dbScope, projectId, (data) => {
      // @ts-ignore
      if (data) setProjectMeta(prev => ({ ...prev, ...data }));
    });

    const unsubBuildings = RegistryService.subscribeBuildings(dbScope, projectId, (data) => {
      if (data) setBuildingsState(data);
    });

    return () => {
      unsubMeta();
      unsubBuildings();
    };
  }, [projectId, dbScope]);

  // --- 2. СЛИЯНИЕ ДАННЫХ (БЕЗОПАСНОЕ) ---
  const mergedState = useMemo(() => {
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

    Object.values(buildingsState).forEach(b => {
       if (b.buildingDetails) combined.buildingDetails = { ...b.buildingDetails, ...combined.buildingDetails };
       
       if (b.floorData) combined.floorData = { ...b.floorData, ...combined.floorData };
       if (b.entrancesData) combined.entrancesData = { ...b.entrancesData, ...combined.entrancesData };
       
       if (b.commonAreasData) combined.mopData = { ...b.commonAreasData, ...combined.mopData };
       if (b.apartmentsData) combined.flatMatrix = { ...b.apartmentsData, ...combined.flatMatrix };
       if (b.parkingData) combined.parkingPlaces = { ...b.parkingData, ...combined.parkingPlaces };
    });

    return combined;
  }, [projectMeta, buildingsState]);

  // --- 3. СОХРАНЕНИЕ ОБЩЕЕ (Meta) ---
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
        if (showNotification && toastId) { toast.dismiss(toastId); toast.success("Сохранено!"); }
      } catch (e) {
        console.error(e);
        if (toastId) toast.dismiss(toastId);
        toast.error("Ошибка сохранения");
      } finally { setIsSyncing(false); }
    }, 500);
  }, [dbScope, projectId, toast]);

  // --- 4. СОХРАНЕНИЕ ЗДАНИЯ (Detail) ---
  const saveBuildingData = useCallback(async (buildingId, dataKey, dataVal) => {
      setIsSyncing(true);
      const toastId = toast.loading("Сохранение данных здания...");
      try {
          await RegistryService.saveData(dbScope, projectId, {
              buildingSpecificData: { [buildingId]: { [dataKey]: dataVal } }
          });
          toast.dismiss(toastId);
          toast.success("Успешно");
      } catch(e) {
          console.error(e);
          toast.dismiss(toastId);
          toast.error("Ошибка сохранения");
      } finally { setIsSyncing(false); }
  }, [dbScope, projectId, toast]);

  // --- 5. УДАЛЕНИЕ ---
  const deleteProjectBuilding = useCallback(async (buildingId) => {
      if (!confirm('Удалить объект и все данные?')) return;
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
          toast.success("Объект удален");
      } catch (e) {
          console.error(e);
          toast.error("Ошибка удаления");
      }
  }, [dbScope, projectId, mergedState, toast]);

  // --- 6. СЕТТЕРЫ ---
  const createSetter = (key) => (value) => {
      // @ts-ignore
      const newValue = typeof value === 'function' ? value(mergedState[key]) : value;
      // @ts-ignore
      setProjectMeta(prev => ({ ...prev, [key]: newValue }));
      if (!HEAVY_KEYS.includes(key)) saveData({ [key]: newValue });
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

  // @ts-ignore
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
};