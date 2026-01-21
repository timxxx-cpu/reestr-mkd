import { useToast } from './ToastContext';
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore'; 
import { db, APP_ID } from '../lib/firebase'; // Импорт нашей БД

const ProjectContext = createContext();

export const useProject = () => useContext(ProjectContext);

export const ProjectProvider = ({ children, projectId, user }) => {
  // Состояния данных
  const toast = useToast();
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

  // 2. СОХРАНЕНИЕ
const saveData = useCallback((updates = {}, showNotification = false) => {
  if (!user || !projectId) return;

  // Фильтр событий клика
  if (updates && (updates.nativeEvent || updates.type === 'click')) {
      updates = {};
      showNotification = true; // Если нажали кнопку - всегда показываем уведомление
  }

  setIsSyncing(true);
  if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

  saveTimeoutRef.current = setTimeout(async () => {
      const docRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'registry_data', `project_${projectId}`);

      const dataToSave = {
          complexInfo, participants, cadastre, documents, composition,
          buildingDetails, floorData, entrancesData, 
          commonAreasData: mopData,
          apartmentsData: flatMatrix,
          parkingData: parkingPlaces,
          lastModified: new Date().toISOString(),
          ...updates
      };

      try {
          await setDoc(docRef, dataToSave, { merge: true });

          if (showNotification) {
              toast.success("Данные успешно сохранены");
          }
      } catch (e) {
          console.error("Ошибка сохранения:", e);
          toast.error("Ошибка сохранения: " + e.message);
      }

      setIsSyncing(false);
  }, 1000); 
}, [user, projectId, complexInfo, participants, cadastre, documents, composition, buildingDetails, floorData, entrancesData, mopData, flatMatrix, parkingPlaces, toast]); // <-- Добавить toast в зависимости
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