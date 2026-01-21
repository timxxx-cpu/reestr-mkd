import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore'; 
import { db, APP_ID } from '../lib/firebase'; // Импорт нашей БД

const ProjectContext = createContext();

export const useProject = () => useContext(ProjectContext);

export const ProjectProvider = ({ children, projectId, user }) => {
  // Состояния данных
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
  const [parkingPlaces, setParkingPlaces] = useState({}); // В исходнике это называлось parkingData
  
  const [isSyncing, setIsSyncing] = useState(false);
  const saveTimeoutRef = useRef(null);

  // 1. ЗАГРУЗКА И СИНХРОНИЗАЦИЯ (Real-time)
  useEffect(() => {
    if (!user || !projectId) return;

    // Ссылка на документ проекта в БД
    const docRef = doc(db, 'artifacts', APP_ID, 'users', 'shared_demo_user', 'registry_data', `project_${projectId}`);

    // Подписка на обновления
    const unsubscribe = onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
            const d = snap.data();
            // Обновляем стейт, только если данные пришли
            if(d.complexInfo) setComplexInfo(d.complexInfo);
            if(d.participants) setParticipants(d.participants);
            if(d.cadastre) setCadastre(d.cadastre);
            if(d.documents) setDocuments(d.documents);
            if(d.composition) setComposition(d.composition);
            if(d.buildingDetails) setBuildingDetails(d.buildingDetails);
            if(d.floorData) setFloorData(d.floorData);
            if(d.entrancesData) setEntrancesData(d.entrancesData);
            if(d.commonAreasData) setMopData(d.commonAreasData); // В исходнике commonAreasData
            if(d.apartmentsData) setFlatMatrix(d.apartmentsData); // В исходнике apartmentsData
            if(d.parkingData) setParkingPlaces(d.parkingData);
        }
    }, (error) => {
        console.error("Ошибка синхронизации:", error);
    });

    return () => unsubscribe();
  }, [projectId, user]);

  // 2. СОХРАНЕНИЕ (Debounced save)
  const saveData = useCallback((updates = {}) => {
    if (!user || !projectId) return;
    
    // Игнорируем события клика, если они случайно попали в updates
    if (updates && (updates.nativeEvent || updates.type === 'click')) updates = {};

    setIsSyncing(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
        const docRef = doc(db, 'artifacts', APP_ID, 'users', 'shared_demo_user', 'registry_data', `project_${projectId}`);
        
        // Собираем полный объект
        const dataToSave = {
            complexInfo, participants, cadastre, documents, composition,
            buildingDetails, floorData, entrancesData, 
            commonAreasData: mopData, // Мапим наши названия на названия в БД
            apartmentsData: flatMatrix,
            parkingData: parkingPlaces,
            lastModified: new Date().toISOString(),
            ...updates
        };

        try {
            await setDoc(docRef, dataToSave, { merge: true });
            
            // Также обновляем мету в списке проектов (название и статус)
            const metaRef = doc(db, 'artifacts', APP_ID, 'users', 'shared_demo_user', 'registry_data', 'projects_meta');
            // Примечание: обновление списка проектов лучше делать через транзакцию или чтение-запись, 
            // но для простоты оставим обновление внутри компонента App или здесь, если нужно.
            
        } catch (e) {
            console.error("Ошибка сохранения:", e);
        }
        
        setIsSyncing(false);
    }, 1000); // Задержка 1 сек, чтобы не спамить БД
  }, [user, projectId, complexInfo, participants, cadastre, documents, composition, buildingDetails, floorData, entrancesData, mopData, flatMatrix, parkingPlaces]);

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