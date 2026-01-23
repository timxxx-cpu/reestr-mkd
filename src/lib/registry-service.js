import { 
  doc, collection, setDoc, getDoc, deleteDoc, 
  onSnapshot, writeBatch, arrayUnion 
} from 'firebase/firestore';
import { db, APP_ID } from './firebase';

// Генерируем пути
const getUserRoot = (scope) => `artifacts/${APP_ID}/users/${scope}`;
const getProjectRef = (scope, id) => doc(db, `${getUserRoot(scope)}/registry_data/project_${id}`);
const getBuildingsRef = (scope, projectId) => collection(db, `${getUserRoot(scope)}/registry_data/project_${projectId}/buildings`);
const getBuildingDocRef = (scope, projectId, buildingId) => doc(db, `${getUserRoot(scope)}/registry_data/project_${projectId}/buildings/${buildingId}`);
const getMetaListRef = (scope) => doc(db, `${getUserRoot(scope)}/registry_data/projects_meta`);

export const RegistryService = {
  
  // --- ЧТЕНИЕ ---

  // 1. Получение шапки проекта (название, конфиги, списки)
  subscribeProjectMeta: (scope, projectId, callback) => {
    return onSnapshot(getProjectRef(scope, projectId), (snap) => {
      callback(snap.exists() ? snap.data() : null);
    });
  },

  // 2. Получение тяжелых данных зданий (каждое здание - отдельный документ)
  subscribeBuildings: (scope, projectId, callback) => {
    return onSnapshot(getBuildingsRef(scope, projectId), (snapshot) => {
      const buildings = {};
      snapshot.forEach(doc => {
          buildings[doc.id] = doc.data();
      });
      callback(buildings);
    });
  },

  // 3. Получение списка проектов для дашборда
  subscribeProjectsList: (scope, callback) => {
      return onSnapshot(getMetaListRef(scope), (snap) => {
          callback(snap.exists() ? snap.data().list || [] : []);
      });
  },

  // --- ЗАПИСЬ ---

  // 4. Умное сохранение: раскладывает данные по разным документам
  saveData: async (scope, projectId, payload) => {
    const batch = writeBatch(db);
    const { buildingSpecificData, ...generalData } = payload;

    // А. Мета-данные проекта (пишем в основной файл)
    if (Object.keys(generalData).length > 0) {
      batch.set(getProjectRef(scope, projectId), generalData, { merge: true });
    }

    // Б. Тяжелые данные (пишем в файлы зданий)
    if (buildingSpecificData) {
      Object.entries(buildingSpecificData).forEach(([bId, data]) => {
        batch.set(getBuildingDocRef(scope, projectId, bId), data, { merge: true });
      });
    }

    await batch.commit();

    // В. Синхронизация названия в списке проектов (эмуляция SQL UPDATE)
    if (generalData.complexInfo) {
        await RegistryService._syncDashboardItem(scope, projectId, generalData.complexInfo);
    }
  },

  // --- СОЗДАНИЕ И УДАЛЕНИЕ ---

  createProject: async (scope, projectMeta, initialContent) => {
      const batch = writeBatch(db);
      batch.set(getMetaListRef(scope), { list: arrayUnion(projectMeta) }, { merge: true });
      batch.set(getProjectRef(scope, projectMeta.id), initialContent);
      await batch.commit();
  },

  deleteBuilding: async (scope, projectId, buildingId, generalUpdates) => {
    const batch = writeBatch(db);
    // Удаляем настройки здания из основного файла
    batch.update(getProjectRef(scope, projectId), generalUpdates);
    // Удаляем файл с данными здания
    batch.delete(getBuildingDocRef(scope, projectId, buildingId));
    await batch.commit();
  },

  deleteProject: async (scope, projectId) => {
      const listRef = getMetaListRef(scope);
      const snap = await getDoc(listRef);
      if (snap.exists()) {
          const list = snap.data().list || [];
          const newList = list.filter(p => p.id !== projectId);
          await setDoc(listRef, { list: newList });
      }
      await deleteDoc(getProjectRef(scope, projectId));
  },

  // Внутренний хелпер
  _syncDashboardItem: async (scope, projectId, info) => {
      const listRef = getMetaListRef(scope);
      const snap = await getDoc(listRef);
      if (snap.exists()) {
          const list = snap.data().list || [];
          const idx = list.findIndex(p => p.id === projectId);
          if (idx !== -1) {
              const item = list[idx];
              let changed = false;
              const newItem = { ...item, lastModified: new Date().toISOString() };
              
              if (info.name && info.name !== item.name) { newItem.name = info.name; changed = true; }
              if (info.status && info.status !== item.status) { newItem.status = info.status; changed = true; }
              if (info.street && info.street !== item.address) { newItem.address = info.street; changed = true; }

              if (changed) {
                  list[idx] = newItem;
                  await setDoc(listRef, { list }, { merge: true });
              }
          }
      }
  }
};