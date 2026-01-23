import { 
  doc, collection, setDoc, getDoc, deleteDoc, 
  onSnapshot, writeBatch, arrayUnion 
} from 'firebase/firestore';
import { db, APP_ID } from './firebase';

/**
 * Импорт типов для JSDoc
 * @typedef {import('./types').ProjectMeta} ProjectMeta
 * @typedef {import('./types').BuildingData} BuildingData
 * @typedef {import('firebase/firestore').Unsubscribe} Unsubscribe
 */

// Генерируем пути
const getUserRoot = (scope) => `artifacts/${APP_ID}/users/${scope}`;
const getProjectRef = (scope, id) => doc(db, `${getUserRoot(scope)}/registry_data/project_${id}`);
const getBuildingsRef = (scope, projectId) => collection(db, `${getUserRoot(scope)}/registry_data/project_${projectId}/buildings`);
const getBuildingDocRef = (scope, projectId, buildingId) => doc(db, `${getUserRoot(scope)}/registry_data/project_${projectId}/buildings/${buildingId}`);
const getMetaListRef = (scope) => doc(db, `${getUserRoot(scope)}/registry_data/projects_meta`);

export const RegistryService = {
  
  // --- ЧТЕНИЕ ---

  /**
   * Подписка на мета-данные проекта (основной файл)
   * @param {string} scope - Область данных (userId или общий scope)
   * @param {string} projectId - ID проекта
   * @param {function(ProjectMeta|null): void} callback - Функция обновления стейта
   * @returns {Unsubscribe} Функция отписки
   */
  subscribeProjectMeta: (scope, projectId, callback) => {
    return onSnapshot(getProjectRef(scope, projectId), (snap) => {
      // @ts-ignore
      callback(snap.exists() ? snap.data() : null);
    });
  },

  /**
   * Подписка на детальные данные зданий (коллекция 'buildings')
   * @param {string} scope 
   * @param {string} projectId 
   * @param {function(Object.<string, BuildingData>): void} callback - Возвращает словарь { buildingId: data }
   * @returns {Unsubscribe}
   */
  subscribeBuildings: (scope, projectId, callback) => {
    return onSnapshot(getBuildingsRef(scope, projectId), (snapshot) => {
      /** @type {Object.<string, BuildingData>} */
      const buildings = {};
      snapshot.forEach(doc => {
          // @ts-ignore
          buildings[doc.id] = doc.data();
      });
      callback(buildings);
    });
  },

  /**
   * Подписка на список всех проектов (для дашборда)
   * @param {string} scope 
   * @param {function(ProjectMeta[]): void} callback 
   * @returns {Unsubscribe}
   */
  subscribeProjectsList: (scope, callback) => {
      return onSnapshot(getMetaListRef(scope), (snap) => {
          // @ts-ignore
          callback(snap.exists() ? snap.data().list || [] : []);
      });
  },

  // --- ЗАПИСЬ ---

  /**
   * Универсальное сохранение данных
   * @param {string} scope 
   * @param {string} projectId 
   * @param {Object} payload - Данные для записи
   * @param {Object.<string, Object>} [payload.buildingSpecificData] - Данные для под-коллекций (тяжелые)
   * @param {ProjectMeta} [payload.complexInfo] - Если нужно обновить список проектов
   */
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

    // В. Синхронизация названия в списке проектов
    if (generalData.complexInfo) {
        await RegistryService._syncDashboardItem(scope, projectId, generalData.complexInfo);
    }
  },

  // --- СОЗДАНИЕ И УДАЛЕНИЕ ---

  /**
   * Создание нового проекта
   * @param {string} scope 
   * @param {ProjectMeta} projectMeta - Данные для списка
   * @param {Object} initialContent - Начальное содержимое проекта
   */
  createProject: async (scope, projectMeta, initialContent) => {
      const batch = writeBatch(db);
      batch.set(getMetaListRef(scope), { list: arrayUnion(projectMeta) }, { merge: true });
      batch.set(getProjectRef(scope, projectMeta.id), initialContent);
      await batch.commit();
  },

  /**
   * Удаление здания и очистка ссылок
   * @param {string} scope 
   * @param {string} projectId 
   * @param {string} buildingId 
   * @param {Object} generalUpdates - Обновленный список composition без этого здания
   */
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