import { supabase } from './supabase';

export const RegistryService = {
  
  // Получить список проектов (из таблицы projects)
  getProjectsList: async (scope) => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, status, updated_at, meta')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // Мапим данные обратно в формат, который ждет фронтенд
    return data.map(p => ({
      id: p.id,
      name: p.name,
      status: p.status,
      lastModified: p.updated_at,
      ...p.meta // Распаковываем meta (complexInfo, applicationInfo и т.д.)
    }));
  },

  // Получить один проект
  getProjectMeta: async (scope, projectId) => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) return null;

    return {
      id: data.id,
      name: data.name,
      status: data.status,
      lastModified: data.updated_at,
      ...data.meta
    };
  },

  // Получить здания проекта
  getBuildings: async (scope, projectId) => {
    const { data, error } = await supabase
      .from('buildings')
      .select('id, data')
      .eq('project_id', projectId);

    if (error) throw error;

    // Превращаем массив строк БД в объект { buildingId: buildingData }
    const buildingsMap = {};
    data.forEach(row => {
      buildingsMap[row.id] = row.data;
    });
    return buildingsMap;
  },

  // СОХРАНЕНИЕ (Универсальный метод)
  saveData: async (scope, projectId, payload) => {
    const { buildingSpecificData, ...generalData } = payload;
    const updates = [];

    // 1. Сохраняем общие данные проекта в таблицу projects
    if (Object.keys(generalData).length > 0) {
      const { data: currentProject } = await supabase
        .from('projects')
        .select('meta')
        .eq('id', projectId)
        .single();

      const currentMeta = currentProject?.meta || {};
      
      const topLevelUpdates = {};
      if (generalData.complexInfo?.name) topLevelUpdates.name = generalData.complexInfo.name;
      if (generalData.complexInfo?.status) topLevelUpdates.status = generalData.complexInfo.status;
      
      const newMeta = { ...currentMeta, ...generalData };

      updates.push(
        supabase
          .from('projects')
          .update({ 
            ...topLevelUpdates,
            meta: newMeta,
            updated_at: new Date().toISOString()
          })
          .eq('id', projectId)
      );
    }

    // 2. Сохраняем данные зданий в таблицу buildings
    if (buildingSpecificData) {
      for (const [bId, bData] of Object.entries(buildingSpecificData)) {
        const { data: currentBuilding } = await supabase
          .from('buildings')
          .select('data')
          .eq('id', bId)
          .single();

        const currentData = currentBuilding?.data || {};
        const newData = { ...currentData, ...bData };

        updates.push(
          supabase
            .from('buildings')
            .upsert({
              id: bId,
              project_id: projectId,
              data: newData
            })
        );
      }
    }

    await Promise.all(updates);
  },

  // Создание нового проекта
  createProject: async (scope, projectMeta, initialContent) => {
    const { error } = await supabase
      .from('projects')
      .insert({
        id: projectMeta.id,
        name: projectMeta.name,
        status: projectMeta.status,
        meta: {
            applicationInfo: projectMeta.applicationInfo,
            complexInfo: projectMeta.complexInfo,
            composition: projectMeta.composition,
            participants: {}, 
            documents: []
        }
      });

    if (error) throw error;
  },

  // [ВОССТАНОВЛЕНО] Метод для создания из заявки
  createProjectFromApplication: async (scope, application, user) => {
      const projectId = crypto.randomUUID();
      const now = new Date().toISOString();

      const projectMeta = {
          id: projectId,
          name: `ЖК по заявке ${application.externalId}`,
          status: 'Проектный',
          
          applicationInfo: {
              internalNumber: application.id,
              externalSource: application.source,
              externalId: application.externalId,
              applicant: application.applicant,
              landCadastre: application.cadastre,
              submissionDate: application.submissionDate,
              status: 'DRAFT', 
              assignee: user.id,
              assigneeName: user.name,
              currentStage: 1, 
              completedSteps: [],
              verifiedSteps: [],
              history: [
                  { 
                      date: now, 
                      status: 'DRAFT', 
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

      await RegistryService.createProject(scope, projectMeta);
      return projectId;
  },

  // Удаление
  deleteProject: async (scope, projectId) => {
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) throw error;
  },
  
  deleteBuilding: async (scope, projectId, buildingId, generalUpdates) => {
      await supabase.from('buildings').delete().eq('id', buildingId);
      await RegistryService.saveData(scope, projectId, generalUpdates);
  },

  // Заглушки для методов матриц
  saveUnits: (s, pId, bId, units) => RegistryService.saveData(s, pId, { buildingSpecificData: { [bId]: { apartmentsData: units } } }),
  saveFloors: (s, pId, bId, floors) => RegistryService.saveData(s, pId, { buildingSpecificData: { [bId]: { floorData: floors } } }),
  saveParkingPlaces: (s, pId, bId, places) => RegistryService.saveData(s, pId, { buildingSpecificData: { [bId]: { parkingData: places } } }),
  saveCommonAreas: (s, pId, bId, mopMap) => RegistryService.saveData(s, pId, { buildingSpecificData: { [bId]: { commonAreasData: mopMap } } }),

  // Realtime заглушки 
  subscribeProjectMeta: (scope, projectId, callback) => {
      RegistryService.getProjectMeta(scope, projectId).then(callback);
      return () => {}; 
  },
  subscribeBuildings: (scope, projectId, callback) => {
      RegistryService.getBuildings(scope, projectId).then(callback);
      return () => {};
  },
  subscribeProjectsList: (scope, callback) => {
      RegistryService.getProjectsList(scope).then(callback);
      return () => {};
  },
  
  getExternalApplications: async () => []
};