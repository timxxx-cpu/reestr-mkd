import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore'; 
import { db, APP_ID } from '../lib/firebase';
import { useToast } from './ToastContext'; // <-- Подключили тосты

const ProjectContext = createContext();

export const useProject = () => useContext(ProjectContext);

export const ProjectProvider = ({ children, projectId, user, customScope }) => {
  const toast = useToast(); // <-- Хук уведомлений
  
  // Состояния
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

  const dbScope = customScope || user?.uid;

  // 1. ЗАГРУЗКА
  useEffect(() => {
    if (!dbScope || !projectId) return;

    const docRef = doc(db, 'artifacts', APP_ID, 'users', dbScope, 'registry_data', `project_${projectId}`);

    const unsubscribe = onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
            const d = snap.data();
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
        console.error("FIREBASE READ ERROR:", error);
        toast.error("Ошибка чтения данных: " + error.message);
    });

    return () => unsubscribe();
  }, [projectId, dbScope, toast]); // Добавил toast в зависимости

  // 2. СОХРАНЕНИЕ
  const saveData = useCallback((updates = {}, showNotification = false) => {
    if (!dbScope || !projectId) return;

    // Игнорируем события клика, если они случайно попали в аргументы
    if (updates && (updates.nativeEvent || updates.type === 'click')) {
        updates = {};
        showNotification = true; // Если вызвано кнопкой - всегда показываем уведомление
    }

    setIsSyncing(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    // Берем актуальные данные для сохранения
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
        let toastId = null;

        try {
            // А. Если это ручное сохранение (кнопка) - показываем "Сохранение..."
            if (showNotification) {
                toastId = toast.loading("Запись в базу данных...");
            }

            // Б. Пишем в Firebase
            const docRef = doc(db, 'artifacts', APP_ID, 'users', dbScope, 'registry_data', `project_${projectId}`);
            await setDoc(docRef, dataToSave, { merge: true });

            // В. Обновляем мета-список (для дашборда)
            const metaRef = doc(db, 'artifacts', APP_ID, 'users', dbScope, 'registry_data', 'projects_meta');
            const metaSnap = await getDoc(metaRef);
            
            if (metaSnap.exists()) {
                const list = metaSnap.data().list || [];
                const index = list.findIndex(p => p.id === projectId);
                
                if (index !== -1) {
                    const updatedItem = {
                        ...list[index],
                        name: currentComplexInfo.name || list[index].name,
                        status: currentComplexInfo.status || list[index].status,
                        address: currentComplexInfo.street || list[index].address || '',
                        lastModified: new Date().toISOString(),
                        author: user?.displayName || list[index].author
                    };
                    list[index] = updatedItem;
                    await setDoc(metaRef, { list }, { merge: true });
                }
            }

            // Г. Убираем лоадер и показываем успех
            if (showNotification && toastId) {
                toast.dismiss(toastId); // Убираем спиннер
                toast.success("Успешно сохранено!");
            }

        } catch (e) {
            console.error("SAVE ERROR:", e);
            if (toastId) toast.dismiss(toastId);
            toast.error("Ошибка сохранения: " + e.message);
        } finally {
            setIsSyncing(false);
        }
    }, 500); // Debounce 500ms
  }, [dbScope, projectId, complexInfo, participants, cadastre, documents, composition, buildingDetails, floorData, entrancesData, mopData, flatMatrix, parkingPlaces, user, toast]);

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