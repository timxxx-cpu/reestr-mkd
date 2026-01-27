import { 
  doc, collection, setDoc, getDoc, deleteDoc, 
  onSnapshot, writeBatch, arrayUnion, getDocs 
} from 'firebase/firestore';
import { db, APP_ID } from './firebase';
import { APP_STATUS } from './constants';

const getUserRoot = (scope) => `artifacts/${APP_ID}/users/${scope}`;
const getProjectRef = (scope, id) => doc(db, `${getUserRoot(scope)}/registry_data/project_${id}`);
const getBuildingsRef = (scope, projectId) => collection(db, `${getUserRoot(scope)}/registry_data/project_${projectId}/buildings`);
const getBuildingDocRef = (scope, projectId, buildingId) => doc(db, `${getUserRoot(scope)}/registry_data/project_${projectId}/buildings/${buildingId}`);
const getMetaListRef = (scope) => doc(db, `${getUserRoot(scope)}/registry_data/projects_meta`);

export const RegistryService = {
  
  getProjectsList: async (scope) => {
    try {
        const snap = await getDoc(getMetaListRef(scope));
        // @ts-ignore
        return snap.exists() ? snap.data().list || [] : [];
    } catch (error) {
        console.error("[RegistryService] Error fetching projects:", error);
        throw error;
    }
  },

  getProjectMeta: async (scope, projectId) => {
    try {
        const snap = await getDoc(getProjectRef(scope, projectId));
        // @ts-ignore
        return snap.exists() ? snap.data() : null;
    } catch (error) {
        console.error("[RegistryService] Error fetching project meta:", error);
        throw error;
    }
  },

  getBuildings: async (scope, projectId) => {
    try {
        const snapshot = await getDocs(getBuildingsRef(scope, projectId));
        const buildings = {};
        snapshot.forEach(doc => {
            // @ts-ignore
            buildings[doc.id] = doc.data();
        });
        return buildings;
    } catch (error) {
        console.error("[RegistryService] Error fetching buildings:", error);
        throw error;
    }
  },

  getExternalApplications: async () => {
      return []; 
  },

  createProjectFromApplication: async (scope, application, user) => {
      const projectId = crypto.randomUUID();
      const now = new Date().toISOString();

      const projectMeta = {
          id: projectId,
          name: `ЖК по заявке ${application.externalId}`,
          status: 'Проектный',
          author: user.name,
          lastModified: now,
          
          applicationInfo: {
              internalNumber: application.id,
              externalSource: application.source,
              externalId: application.externalId,
              applicant: application.applicant,
              landCadastre: application.cadastre,
              submissionDate: application.submissionDate,
              status: APP_STATUS.DRAFT, 
              assignee: user.id,
              assigneeName: user.name,
              currentStage: 1, 
              completedSteps: [], // НОВОЕ ПОЛЕ: Для техника
              verifiedSteps: [],  // Для бригадира
              history: [
                  { 
                      date: now, 
                      status: APP_STATUS.DRAFT, 
                      user: user.name, 
                      comment: 'Заявление принято в работу (Этап 1)' 
                  }
              ]
          },

          complexInfo: {
              name: `Объект на участке ${application.cadastre}`,
              status: 'Проектный',
              street: application.address,
              region: 'Ташкент',
              district: 'Не определен',
              dateStartProject: new Date().toISOString().split('T')[0]
          },
          composition: []
      };

      const initialContent = {
          complexInfo: projectMeta.complexInfo,
          composition: [],
          applicationInfo: projectMeta.applicationInfo
      };

      await RegistryService.createProject(scope, projectMeta, initialContent);
      return projectId;
  },

  subscribeProjectMeta: (scope, projectId, callback) => {
    return onSnapshot(getProjectRef(scope, projectId), (snap) => {
      // @ts-ignore
      callback(snap.exists() ? snap.data() : null);
    });
  },

  subscribeBuildings: (scope, projectId, callback) => {
    return onSnapshot(getBuildingsRef(scope, projectId), (snapshot) => {
      const buildings = {};
      snapshot.forEach(doc => {
          // @ts-ignore
          buildings[doc.id] = doc.data();
      });
      callback(buildings);
    });
  },

  subscribeProjectsList: (scope, callback) => {
      return onSnapshot(getMetaListRef(scope), (snap) => {
          // @ts-ignore
          callback(snap.exists() ? snap.data().list || [] : []);
      });
  },

  saveData: async (scope, projectId, payload) => {
    try {
      const batch = writeBatch(db);
      const { buildingSpecificData, ...generalData } = payload;

      if (Object.keys(generalData).length > 0) {
        batch.set(getProjectRef(scope, projectId), generalData, { merge: true });
      }

      if (buildingSpecificData) {
        Object.entries(buildingSpecificData).forEach(([bId, data]) => {
          batch.set(getBuildingDocRef(scope, projectId, bId), data, { merge: true });
        });
      }

      await batch.commit();

      if (generalData.complexInfo || generalData.applicationInfo) {
          await RegistryService._syncDashboardItem(scope, projectId, generalData);
      }
    } catch (error) {
      console.error("[RegistryService] Save failed:", error);
      throw error;
    }
  },

  updateProject: async (scope, projectId, data) => {
      return RegistryService.saveData(scope, projectId, data);
  },

  createProject: async (scope, projectMeta, initialContent) => {
      try {
        const batch = writeBatch(db);
        batch.set(getMetaListRef(scope), { list: arrayUnion(projectMeta) }, { merge: true });
        batch.set(getProjectRef(scope, projectMeta.id), initialContent);
        await batch.commit();
      } catch (error) {
        console.error("[RegistryService] Create failed:", error);
        throw error;
      }
  },

  deleteBuilding: async (scope, projectId, buildingId, generalUpdates) => {
    try {
      const batch = writeBatch(db);
      batch.update(getProjectRef(scope, projectId), generalUpdates);
      batch.delete(getBuildingDocRef(scope, projectId, buildingId));
      await batch.commit();
    } catch (error) {
      console.error("[RegistryService] Delete building failed:", error);
      throw error;
    }
  },

  deleteProject: async (scope, projectId) => {
      try {
        const listRef = getMetaListRef(scope);
        const snap = await getDoc(listRef);
        if (snap.exists()) {
            const list = snap.data().list || [];
            const newList = list.filter(p => p.id !== projectId);
            await setDoc(listRef, { list: newList });
        }
        await deleteDoc(getProjectRef(scope, projectId));
      } catch (error) {
        console.error("[RegistryService] Delete project failed:", error);
        throw error;
      }
  },

  _syncDashboardItem: async (scope, projectId, data) => {
      const listRef = getMetaListRef(scope);
      const snap = await getDoc(listRef);
      if (snap.exists()) {
          const list = snap.data().list || [];
          const idx = list.findIndex(p => p.id === projectId);
          if (idx !== -1) {
              const item = list[idx];
              let changed = false;
              const newItem = { ...item, lastModified: new Date().toISOString() };
              
              if (data.complexInfo) {
                  const info = data.complexInfo;
                  if (info.name && info.name !== item.name) { newItem.name = info.name; changed = true; }
                  if (info.status && info.status !== item.status) { newItem.status = info.status; changed = true; }
                  if (info.street && info.street !== item.address) { newItem.address = info.street; changed = true; }
              }

              if (data.applicationInfo) {
                  newItem.applicationInfo = {
                      ...item.applicationInfo,
                      ...data.applicationInfo
                  };
                  changed = true;
              }

              if (changed) {
                  list[idx] = newItem;
                  await setDoc(listRef, { list }, { merge: true });
              }
          }
      }
  }
};