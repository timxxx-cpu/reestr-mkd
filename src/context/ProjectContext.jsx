import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useToast } from './ToastContext';
import { RegistryService } from '../lib/registry-service';

const ProjectContext = createContext();

export const useProject = () => useContext(ProjectContext);

// Ключи, которые мы ЗАПРЕЩАЕМ писать в основной файл проекта (они идут в файлы зданий)
const HEAVY_KEYS = [
    'floorData', 'entrancesData', 'mopData', 'flatMatrix', 
    'parkingPlaces', 'commonAreasData', 'apartmentsData', 'parkingData'
];

export const ProjectProvider = ({ children, projectId, user, customScope }) => {
  const toast = useToast();
  
  // projectMeta: Легкие данные + Временные локальные правки
  const [projectMeta, setProjectMeta] = useState({}); 
  // buildingsState: Данные, реально пришедшие из базы (только чтение)
  const [buildingsState, setBuildingsState] = useState({});
  
  const [isSyncing, setIsSyncing] = useState(false);
  const saveTimeoutRef = useRef(null);

  const dbScope = customScope || user?.uid;

  // --- 1. ЗАГРУЗКА ---
  useEffect(() => {
    if (!dbScope || !projectId) return;

    // Подписка на шапку
    const unsubMeta = RegistryService.subscribeProjectMeta(dbScope, projectId, (data) => {
      if (data) setProjectMeta(prev => ({ ...prev, ...data }));
    });

    // Подписка на тела зданий
    const unsubBuildings = RegistryService.subscribeBuildings(dbScope, projectId, (data) => {
      if (data) setBuildingsState(data);
    });

    return () => {
      unsubMeta();
      unsubBuildings();
    };
  }, [projectId, dbScope]);

  // --- 2. СБОРКА ЕДИНОГО STATE (MERGE) ---
  const mergedState = useMemo(() => {
    // А. База - это локальный стейт (приоритет у ввода пользователя)
    const combined = {
      complexInfo: projectMeta.complexInfo || {},
      participants: projectMeta.participants || {},
      cadastre: projectMeta.cadastre || {},
      documents: projectMeta.documents || [],
      composition: projectMeta.composition || [],
      // Делаем копии объектов, чтобы не мутировать стейт напрямую
      buildingDetails: { ...(projectMeta.buildingDetails || {}) },
      
      // Инициализируем тяжелые объекты (сначала пустыми или из локального кэша)
      floorData: { ...(projectMeta.floorData || {}) },
      entrancesData: { ...(projectMeta.entrancesData || {}) },
      mopData: { ...(projectMeta.mopData || {}) }, 
      flatMatrix: { ...(projectMeta.flatMatrix || {}) },
      parkingPlaces: { ...(projectMeta.parkingPlaces || {}) }
    };

    // Б. Накладываем данные из базы (заполняем пробелы данными с сервера)
    Object.values(buildingsState).forEach(b => {
       // Конфигурации зданий
       if (b.buildingDetails) {
           combined.buildingDetails = { ...b.buildingDetails, ...combined.buildingDetails };
       }
       
       // Матрицы: Сливаем (Данные из БД) + (Локальные правки поверх)
       if (b.floorData) combined.floorData = { ...b.floorData, ...combined.floorData };
       if (b.entrancesData) combined.entrancesData = { ...b.entrancesData, ...combined.entrancesData };
       
       // Маппинг имен полей (База -> Стейт)
       if (b.commonAreasData) combined.mopData = { ...b.commonAreasData, ...combined.mopData };
       if (b.apartmentsData) combined.flatMatrix = { ...b.apartmentsData, ...combined.flatMatrix };
       if (b.parkingData) combined.parkingPlaces = { ...b.parkingData, ...combined.parkingPlaces };
    });

    return combined;
  }, [projectMeta, buildingsState]);

  // --- 3. СОХРАНЕНИЕ ОБЩЕЕ (Авто-сохранение для Мета-данных) ---
  const saveData = useCallback((updates = {}, showNotification = false) => {
    if (!dbScope || !projectId) return;
    if (updates && (updates.nativeEvent || updates.type === 'click')) { updates = {}; showNotification = true; }

    // ВАЖНО: Фильтруем updates, чтобы тяжелые данные не попали в основной документ
    const safeUpdates = { ...updates };
    HEAVY_KEYS.forEach(k => delete safeUpdates[k]);

    // Если после фильтрации пусто и не просили уведомление - выходим
    if (Object.keys(safeUpdates).length === 0 && !showNotification) return;

    setIsSyncing(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      let toastId = null;
      try {
        if (showNotification) toastId = toast.loading("Сохранение...");
        
        await RegistryService.saveData(dbScope, projectId, safeUpdates);

        if (showNotification && toastId) {
          toast.dismiss(toastId);
          toast.success("Сохранено!");
        }
      } catch (e) {
        console.error("SAVE ERROR:", e);
        if (toastId) toast.dismiss(toastId);
        toast.error("Ошибка: " + e.message);
      } finally {
        setIsSyncing(false);
      }
    }, 500);
  }, [dbScope, projectId, toast]);

  // --- 4. СОХРАНЕНИЕ ЗДАНИЯ (Точечное, для редакторов) ---
  const saveBuildingData = useCallback(async (buildingId, dataKey, dataVal) => {
      setIsSyncing(true);
      const toastId = toast.loading("Запись данных здания...");
      try {
          // Формируем payload для RegistryService
          const payload = {
              buildingSpecificData: {
                  [buildingId]: { [dataKey]: dataVal }
              }
          };
          await RegistryService.saveData(dbScope, projectId, payload);
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

  // --- 5. УДАЛЕНИЕ (С очисткой мусора) ---
  const deleteProjectBuilding = useCallback(async (buildingId) => {
      if (!confirm('Удалить объект и все связанные данные?')) return;
      try {
          // 1. Убираем из списка composition
          const newComposition = mergedState.composition.filter(b => b.id !== buildingId);
          
          // 2. Чистим настройки в buildingDetails
          const newBuildingDetails = { ...mergedState.buildingDetails };
          Object.keys(newBuildingDetails).forEach(k => {
              if (k.startsWith(buildingId)) delete newBuildingDetails[k];
          });

          // Вызываем сервис
          await RegistryService.deleteBuilding(dbScope, projectId, buildingId, { 
              composition: newComposition,
              buildingDetails: newBuildingDetails
          });
          
          toast.success("Объект удален");
      } catch (e) {
          console.error(e);
          toast.error("Ошибка удаления");
      }
  }, [dbScope, projectId, mergedState.composition, mergedState.buildingDetails, toast]);

  // --- 6. УМНЫЕ СЕТТЕРЫ ---
  const createSetter = (key) => (value) => {
      const newValue = typeof value === 'function' ? value(mergedState[key]) : value;
      
      // Обновляем локально (UI реагирует мгновенно)
      setProjectMeta(prev => ({ ...prev, [key]: newValue }));

      // Пишем в базу ТОЛЬКО если это легкие данные. Тяжелые ждут saveBuildingData.
      if (!HEAVY_KEYS.includes(key)) {
          saveData({ [key]: newValue });
      }
  };

  const value = {
    ...mergedState,
    setComplexInfo: createSetter('complexInfo'),
    setParticipants: createSetter('participants'),
    setCadastre: createSetter('cadastre'),
    setComposition: createSetter('composition'),
    setDocuments: createSetter('documents'),
    setBuildingDetails: createSetter('buildingDetails'),
    
    // Сеттеры для тяжелых данных (обновляют только UI, запись по кнопке)
    setFloorData: createSetter('floorData'),
    setEntrancesData: createSetter('entrancesData'),
    setMopData: createSetter('mopData'),
    setFlatMatrix: createSetter('flatMatrix'),
    setParkingPlaces: createSetter('parkingPlaces'),

    saveData,
    saveBuildingData, // <-- Новый метод
    deleteProjectBuilding, // <-- Новый метод
    isSyncing
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
};