import { supabase } from './supabase';

/**
 * Сервис-адаптер для работы с PostgreSQL структурой.
 * Преобразует плоские данные из БД в структуру, ожидаемую ProjectContext.
 */
export const RegistryService = {

  // --- ЧТЕНИЕ ДАННЫХ (READ) ---

  // 1. Список проектов
  getProjectsList: async (scope) => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, status, updated_at, meta, address, region')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return data.map(p => ({
      id: p.id,
      name: p.name,
      status: p.status,
      lastModified: p.updated_at,
      ...p.meta,
      complexInfo: {
          ...(p.meta?.complexInfo || {}),
          name: p.name,
          status: p.status,
          region: p.region || p.meta?.complexInfo?.region,
          street: p.address || p.meta?.complexInfo?.address
      }
    }));
  },

  // 2. Полные данные одного проекта
  getProjectMeta: async (scope, projectId) => {
    const { data: project, error: pError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (pError) return null;

    const { data: buildings, error: bError } = await supabase
      .from('buildings')
      .select('*')
      .eq('project_id', projectId);

    if (bError) throw bError;

    const composition = buildings.map(b => ({
      id: b.id,
      label: b.label,
      houseNumber: b.house_number,
      category: b.category,
      type: b.type,
      stage: b.stage,
      ...b.config 
    }));

    return {
      id: project.id,
      name: project.name,
      status: project.status,
      lastModified: project.updated_at,
      ...project.meta,
      complexInfo: {
          ...(project.meta?.complexInfo || {}),
          name: project.name,
          status: project.status,
          street: project.address,
          region: project.region,
          district: project.district
      },
      composition: composition
    };
  },

  // 3. Загрузка матриц
  getBuildings: async (scope, projectId) => {
    const [ floorsRes, unitsRes, buildingsRes ] = await Promise.all([
        supabase.from('floors').select('*').eq('project_id', projectId),
        supabase.from('units').select('*').eq('project_id', projectId),
        supabase.from('buildings').select('id, config').eq('project_id', projectId)
    ]);

    if (floorsRes.error) throw floorsRes.error;
    if (unitsRes.error) throw unitsRes.error;

    const result = {};

    buildingsRes.data.forEach(b => {
        result[b.id] = {
            buildingDetails: b.config || {},
            floorData: {},
            apartmentsData: {},
            parkingData: {},
            commonAreasData: {},
            entrancesData: {}
        };
        if (b.config?.entrancesData) result[b.id].entrancesData = b.config.entrancesData;
        if (b.config?.mopData) result[b.id].commonAreasData = b.config.mopData;
    });

    floorsRes.data.forEach(f => {
        if (!result[f.building_id]) return;
        result[f.building_id].floorData[f.ui_key] = {
            id: f.id,
            ui_key: f.ui_key,
            label: f.label,
            type: f.type,
            height: f.height,
            areaProj: f.area_proj,
            areaFact: f.area_fact,
            isDuplex: f.is_duplex,
            ...f.data
        };
    });

    unitsRes.data.forEach(u => {
        if (!result[u.building_id]) return;
        
        const unitObj = {
            id: u.id,
            num: u.number,
            number: u.number,
            type: u.type,
            area: u.area,
            rooms: u.rooms,
            isSold: u.status === 'sold',
            cadastreNumber: u.cadastre_number,
            floorId: u.floor_ui_key,
            entranceIndex: u.entrance_index,
            ...u.data
        };

        if (u.type === 'parking_place') {
            result[u.building_id].parkingData[u.ui_key] = unitObj;
        } else {
            result[u.building_id].apartmentsData[u.ui_key] = unitObj;
        }
    });

    return result;
  },

  // --- ЗАПИСЬ ДАННЫХ (WRITE) ---

  saveData: async (scope, projectId, payload) => {
    const { buildingSpecificData, ...generalData } = payload;
    const promises = [];

    // 1. Проекты
    if (generalData.composition) {
        const buildingsRows = generalData.composition.map(b => ({
            id: b.id,
            project_id: projectId,
            label: b.label,
            house_number: b.houseNumber,
            category: b.category,
            type: b.type,
            stage: b.stage,
            config: {
                resBlocks: b.resBlocks,
                nonResBlocks: b.nonResBlocks,
                dateStart: b.dateStart,
                dateEnd: b.dateEnd,
                parkingType: b.parkingType,
                constructionType: b.constructionType,
                infraType: b.infraType,
                hasNonResPart: b.hasNonResPart
            }
        }));
        promises.push(supabase.from('buildings').upsert(buildingsRows));
        delete generalData.composition;
    }

    if (Object.keys(generalData).length > 0) {
        const updatePayload = { updated_at: new Date().toISOString() };
        if (generalData.complexInfo) {
            if (generalData.complexInfo.name) updatePayload.name = generalData.complexInfo.name;
            if (generalData.complexInfo.status) updatePayload.status = generalData.complexInfo.status;
            if (generalData.complexInfo.region) updatePayload.region = generalData.complexInfo.region;
            if (generalData.complexInfo.district) updatePayload.district = generalData.complexInfo.district;
            if (generalData.complexInfo.street) updatePayload.address = generalData.complexInfo.street;
        }

        promises.push((async () => {
            const { data: current } = await supabase.from('projects').select('meta').eq('id', projectId).single();
            const newMeta = { ...(current?.meta || {}), ...generalData };
            return supabase.from('projects').update({ ...updatePayload, meta: newMeta }).eq('id', projectId);
        })());
    }

    // 2. Здания
    if (buildingSpecificData) {
        for (const [bId, bData] of Object.entries(buildingSpecificData)) {
            
            if (bData.floorData) {
                const floorRows = Object.entries(bData.floorData).map(([key, f]) => ({
                    id: f.id,
                    project_id: projectId,
                    building_id: bId,
                    ui_key: key,
                    label: f.label,
                    type: f.type,
                    height: parseFloat(f.height) || 0,
                    area_proj: parseFloat(f.areaProj) || 0,
                    area_fact: parseFloat(f.areaFact) || 0,
                    is_duplex: f.isDuplex || false,
                    data: {
                        isComm: f.isComm,
                        isStylobate: f.isStylobate,
                        stylobateLabel: f.stylobateLabel,
                        sortOrder: f.sortOrder
                    }
                }));
                promises.push(supabase.from('floors').upsert(floorRows));
            }

            const unitsToSave = [];
            const processUnits = (sourceData, defaultType) => {
                Object.entries(sourceData).forEach(([key, u]) => {
                    unitsToSave.push({
                        id: u.id,
                        project_id: projectId,
                        building_id: bId,
                        ui_key: key,
                        number: u.num || u.number,
                        type: u.type || defaultType,
                        area: parseFloat(u.area) || 0,
                        rooms: u.rooms || 0,
                        status: u.isSold ? 'sold' : 'free',
                        cadastre_number: u.cadastreNumber,
                        floor_ui_key: u.floorId,
                        entrance_index: u.entrance || u.entranceIndex,
                        data: {
                            explication: u.explication,
                            livingArea: u.livingArea,
                            usefulArea: u.usefulArea,
                            blockLabel: u.blockLabel
                        }
                    });
                });
            };

            if (bData.apartmentsData) processUnits(bData.apartmentsData, 'flat');
            if (bData.parkingData) processUnits(bData.parkingData, 'parking_place');

            if (unitsToSave.length > 0) {
                promises.push(supabase.from('units').upsert(unitsToSave));
            }

            const configUpdates = {};
            if (bData.entrancesData) configUpdates.entrancesData = bData.entrancesData;
            if (bData.commonAreasData) configUpdates.mopData = bData.commonAreasData;

            if (Object.keys(configUpdates).length > 0 || bData.buildingDetails) {
                promises.push((async () => {
                    const { data: curr } = await supabase.from('buildings').select('config').eq('id', bId).single();
                    const newConfig = { 
                        ...(curr?.config || {}), 
                        ...configUpdates,
                        ...bData.buildingDetails 
                    };
                    return supabase.from('buildings').update({ config: newConfig }).eq('id', bId);
                })());
            }
        }
    }

    await Promise.all(promises);
  },

  // --- СОЗДАНИЕ И УДАЛЕНИЕ ---

  createProject: async (scope, projectMeta) => {
    const { data, error } = await supabase
      .from('projects')
      .insert({
        id: projectMeta.id,
        name: projectMeta.name,
        status: projectMeta.status,
        address: projectMeta.complexInfo?.street,
        region: projectMeta.complexInfo?.region || 'Ташкент',
        meta: {
            applicationInfo: projectMeta.applicationInfo,
            complexInfo: projectMeta.complexInfo,
            participants: {}, 
            documents: []
        }
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // [ADDED] Метод для создания из заявки (ApplicationsDashboard)
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

  deleteProject: async (scope, projectId) => {
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) throw error;
  },
  
  deleteBuilding: async (scope, projectId, buildingId) => {
      await supabase.from('buildings').delete().eq('id', buildingId);
  },

  // --- СОВМЕСТИМОСТЬ ---

  saveUnits: (s, pId, bId, unitsArray) => {
      const dataObj = {};
      unitsArray.forEach(u => {
          const key = u.id || u.key; 
          dataObj[key] = u;
      });
      return RegistryService.saveData(s, pId, { buildingSpecificData: { [bId]: { apartmentsData: dataObj } } });
  },

  saveFloors: (s, pId, bId, floorsArray) => {
      const dataObj = {};
      floorsArray.forEach(f => {
          const key = f.legacyKey || f.ui_key || f.id;
          dataObj[key] = f;
      });
      return RegistryService.saveData(s, pId, { buildingSpecificData: { [bId]: { floorData: dataObj } } });
  },

  saveParkingPlaces: (s, pId, bId, placesArray) => {
      const dataObj = {};
      placesArray.forEach(p => {
          const key = p.legacyKey || p.id;
          dataObj[key] = p;
      });
      return RegistryService.saveData(s, pId, { buildingSpecificData: { [bId]: { parkingData: dataObj } } });
  },

  getExternalApplications: async () => []
};