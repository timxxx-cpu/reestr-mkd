import { useToast } from './ToastContext';
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore'; 
import { db, APP_ID } from '../lib/firebase';

const ProjectContext = createContext();

export const useProject = () => useContext(ProjectContext);

export const ProjectProvider = ({ children, projectId, user, customScope }) => {
  const toast = useToast();
  
  // Состояния данных проекта
  const [complexInfo, setComplexInfo] = useState({});
  const [participants, setParticipants] = useState({});
  const [cadastre, setCadastre] = useState({});
  const [composition, setComposition] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [buildingDetails, setBuildingDetails] = useState({});
  const [floorData, setFloorData] = useState({});
  const [entrancesData, setEntrancesData] = useState({});
  const [mopData, setMopData] = useState({});
  const [flatMatrix, setFlatMatrix] = useState({});
  const [parkingPlaces, setParkingPlaces] = useState({});
  
  const [isSyncing, setIsSyncing] = useState(false);
  const saveTimeoutRef = useRef(null);

  // Определяем область видимости (папку)
  const dbScope = customScope || user?.uid;

  // 1. ЗАГРУЗКА ДАННЫХ ПРОЕКТА
  useEffect(() => {
    if (!dbScope || !projectId) return;

    const docRef = doc(db, 'artifacts', APP_ID, 'users', dbScope, 'registry_data', `project_${projectId}`);

    const unsubscribe = onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
            const d = snap.data();
            // Аккуратно обновляем стейт
            if(d.complexInfo) setComplexInfo(d.complexInfo);
            if(d.participants) setParticipants(d.participants);
            if(d.cadastre) setCadastre(d.cadastre);
            if(d.documents) setDocuments(d.documents);
            if(d.composition) setComposition(d.composition);
            if(d.buildingDetails) setBuildingDetails(d.buildingDetails);
            if(d.floorData) setFloorData(d.floorData);
            if(d.entrancesData) setEntrancesData(d.entrancesData);
            if(d.commonAreasData) setMopData(d.commonAreasData);
            if(d.apartmentsData) setFlatMatrix(d.apartmentsData);
            if(d.parkingData) setParkingPlaces(d.parkingData);
        }
    }, (error) => {
        console.error("FIREBASE ERROR:", error);
    });

    return () => unsubscribe();
  }, [projectId, dbScope]);

  // 2. СОХРАНЕНИЕ (И ОБНОВЛЕНИЕ СПИСКА)
  const saveData = useCallback((updates = {}, showNotification = false) => {
    if (!dbScope || !projectId) return;

    // Фильтр событий клика
    if (updates && (updates.nativeEvent || updates.type === 'click')) {
        updates = {};
        showNotification = true;
    }

    setIsSyncing(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    // 1. Подготовка данных для ФАЙЛА ПРОЕКТА
    // Если в updates пришли новые данные, они перекроют текущий стейт
    const currentComplexInfo = updates.complexInfo || complexInfo;
    
    const dataToSave = {
        complexInfo, participants, cadastre, documents, composition,
        buildingDetails, floorData, entrancesData, 
        commonAreasData: mopData,
        apartmentsData: flatMatrix,
        parkingData: parkingPlaces,
        
        lastModified: new Date().toISOString(),
        lastEditor: user?.displayName || user?.email || 'unknown',
        
        ...updates 
    };

    saveTimeoutRef.current = setTimeout(async () => {
        try {
            // А. Сохраняем сам файл проекта
            const docRef = doc(db, 'artifacts', APP_ID, 'users', dbScope, 'registry_data', `project_${projectId}`);
            await setDoc(docRef, dataToSave, { merge: true });

            // Б. ОБНОВЛЯЕМ ОБЩИЙ СПИСОК (чтобы на дашборде обновилось имя и адрес)
            const metaRef = doc(db, 'artifacts', APP_ID, 'users', dbScope, 'registry_data', 'projects_meta');
            const metaSnap = await getDoc(metaRef);
            
            if (metaSnap.exists()) {
                const list = metaSnap.data().list || [];
                const index = list.findIndex(p => p.id === projectId);
                
                if (index !== -1) {
                    // Обновляем поля в списке
                    const updatedItem = {
                        ...list[index],
                        name: currentComplexInfo.name || list[index].name,
                        status: currentComplexInfo.status || list[index].status,
                        // Формируем адрес из улицы и района
                        address: currentComplexInfo.street || list[index].address || '',
                        lastModified: new Date().toISOString(),
                        author: user?.displayName || list[index].author // Обновляем автора последнего изменения
                    };
                    
                    list[index] = updatedItem;
                    await setDoc(metaRef, { list }, { merge: true });
                    console.log("Список проектов обновлен (Sync)");
                }
            }

            if (showNotification) {
                toast?.success("Данные сохранены");
            }
        } catch (e) {
            console.error("SAVE ERROR:", e);
            toast?.error("Ошибка сохранения");
        }
        setIsSyncing(false);
    }, 500); 
  }, [dbScope, projectId, complexInfo, participants, cadastre, documents, composition, buildingDetails, floorData, entrancesData, mopData, flatMatrix, parkingPlaces, user]);

  const value = {
    complexInfo, setComplexInfo,
    participants, setParticipants,
    cadastre, setCadastre,
    composition, setComposition,
    documents, setDocuments,
    buildingDetails, setBuildingDetails,
    floorData, setFloorData,
    entrancesData, setEntrancesData,
    mopData, setMopData,
    flatMatrix, setFlatMatrix,
    parkingPlaces, setParkingPlaces,
    
    saveData, 
    isSyncing
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
};