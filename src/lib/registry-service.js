import { supabase } from './supabase';
import { 
    mapProjectAggregate, 
    mapBuildingFromDB, 
    mapBlockDetailsFromDB, 
    mapFloorFromDB, 
    mapUnitFromDB,
    mapMopFromDB
} from './db-mappers';

// --- HELPER: Generate Blocks Payload ---
function generateBlocksPayload(b) {
    if (b.blocks && Array.isArray(b.blocks)) {
        return b.blocks.map(block => ({
            id: block.id,
            building_id: b.id,
            label: block.label,
            type: mapBlockTypeToDB(block.type)
            // [FIX] Убрали floors_count: 1, чтобы не перезатирать данные при сохранении состава
            // БД сама поставит DEFAULT 1 для новых блоков
        }));
    }
    return [];
}

function mapBlockTypeToDB(uiType) {
    if (uiType === 'residential') return 'Ж';
    if (uiType === 'non_residential') return 'Н';
    if (uiType === 'parking') return 'Parking';
    if (uiType === 'infrastructure') return 'Infra';
    return uiType;
}

// --- HELPER: Sync Entrances Table ---
async function syncEntrances(buildingSpecificData) {
    // Эта функция работает с buildingSpecificData, так как данные о подъездах
    // часто приходят в контексте матриц, но может потребоваться и buildingDetails.
    // Оставляем как есть, так как entrances генерируются корректно.
    const entrancesToUpsert = [];
    for (const [bId, bData] of Object.entries(buildingSpecificData)) {
        // Здесь bData.buildingDetails может быть undefined, если данные пришли в корне payload.
        // Но для syncEntrances мы обычно рассчитываем на buildingDetails из контекста.
        // В текущей архитектуре syncEntrances может не найти новые подъезды, если details в корне.
        // Но пока оставим, чтобы не ломать логику матриц.
        if (bData.buildingDetails) {
            for (const [blockKey, details] of Object.entries(bData.buildingDetails)) {
                const parts = blockKey.split('_');
                const blockId = parts[parts.length - 1];
                if (blockId.length > 30) { 
                    const count = parseInt(details.entrances || details.inputs || 1);
                    for (let i = 1; i <= count; i++) {
                        entrancesToUpsert.push({ block_id: blockId, number: i });
                    }
                }
            }
        }
    }
    if (entrancesToUpsert.length === 0) return {};

    const blockIds = [...new Set(entrancesToUpsert.map(e => e.block_id))];
    const { data: existing } = await supabase.from('entrances').select('id, block_id, number').in('block_id', blockIds);
    const existingMap = {};
    existing?.forEach(e => { existingMap[`${e.block_id}_${e.number}`] = e.id; });

    const newEntrances = [];
    entrancesToUpsert.forEach(e => {
        const key = `${e.block_id}_${e.number}`;
        if (!existingMap[key]) {
            const newId = crypto.randomUUID();
            existingMap[key] = newId; 
            newEntrances.push({ id: newId, block_id: e.block_id, number: e.number });
        }
    });

    if (newEntrances.length > 0) await supabase.from('entrances').upsert(newEntrances);
    return existingMap;
}

export const RegistryService = {

  // --- READ ---

  getProjectsList: async (scope) => {
    const { data, error } = await supabase
      .from('applications')
      .select(`*, projects (name, region, address)`)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return data.map(app => ({
      id: app.project_id,
      applicationId: app.id,
      name: app.projects?.name,
      status: app.status,
      lastModified: app.updated_at,
      applicationInfo: {
          status: app.status,
          internalNumber: app.internal_number,
          externalSource: app.external_source,
          externalId: app.external_id,
          applicant: app.applicant,
          submissionDate: app.submission_date,
          assigneeName: app.assignee_name,
          currentStage: app.current_stage,
          currentStepIndex: app.current_step
      },
      complexInfo: { 
          name: app.projects?.name, 
          region: app.projects?.region, 
          street: app.projects?.address 
      }
    }));
  },

  getProjectMeta: async (scope, projectId) => {
    const { data: app, error: appError } = await supabase
        .from('applications')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
    if (appError) {
        console.error("App not found for project", projectId);
        return null;
    }

    const [ pRes, partsRes, docsRes, buildingsRes, historyRes, stepsRes ] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase.from('project_participants').select('*').eq('project_id', projectId),
        supabase.from('project_documents').select('*').eq('project_id', projectId),
        supabase.from('buildings').select('*, building_blocks(*)').eq('project_id', projectId),
        supabase.from('application_history').select('*').eq('application_id', app.id),
        supabase.from('application_steps').select('*').eq('application_id', app.id)
    ]);

    if (pRes.error) return null;

    const projectData = mapProjectAggregate(
        pRes.data, app, historyRes.data || [], stepsRes.data || [], partsRes.data || [], docsRes.data || []
    );
    
    const composition = [];
    const buildingDetails = {};

    (buildingsRes.data || []).forEach(b => {
        composition.push(mapBuildingFromDB(b, b.building_blocks));
        b.building_blocks.forEach(block => {
            const uiKey = `${b.id}_${block.id}`;
            buildingDetails[uiKey] = mapBlockDetailsFromDB(b, block);
        });
    });

    return { ...projectData, composition, buildingDetails };
  },

  getBuildings: async (scope, projectId) => {
    const { data: bIds } = await supabase.from('buildings').select('id').eq('project_id', projectId);
    const buildingIds = (bIds || []).map(b => b.id);
    if (buildingIds.length === 0) return {};

    const { data: allBlocks } = await supabase
        .from('building_blocks')
        .select(`id, label, building_id, floors (*), entrances (*)`)
        .in('building_id', buildingIds);

    const floorIds = (allBlocks || []).flatMap(b => b.floors.map(f => f.id));
    
    let allUnits = [];
    let allMops = [];

    if (floorIds.length > 0) {
        const [unitsRes, mopsRes] = await Promise.all([
            supabase.from('units').select('*, rooms(*)').in('floor_id', floorIds),
            supabase.from('common_areas').select('*').in('floor_id', floorIds)
        ]);
        allUnits = unitsRes.data || [];
        allMops = mopsRes.data || [];
    }

    const result = {};

    allBlocks?.forEach(block => {
        const bId = block.building_id;
        if (!result[bId]) result[bId] = { floorData: {}, apartmentsData: {}, parkingData: {}, entrancesData: {}, commonAreasData: {} };

        const entranceMap = {}; 
        block.entrances.forEach(e => { entranceMap[e.id] = e.number; });

        block.floors.forEach(f => {
            const floorKey = `${bId}_${block.id}_${f.id}`;
            result[bId].floorData[floorKey] = mapFloorFromDB(f);

            const floorUnits = allUnits.filter(u => u.floor_id === f.id);
            const floorMops = allMops.filter(m => m.floor_id === f.id);
            const statsByEntrance = {}; 
            
            block.entrances.forEach(e => { statsByEntrance[e.number] = { apts: 0, units: 0, mops: 0, id: crypto.randomUUID() }; });

            floorUnits.forEach(u => {
                const unitMapped = mapUnitFromDB(u, u.rooms, entranceMap);
                const unitKey = u.id; 
                if (u.type === 'parking_place') result[bId].parkingData[unitKey] = unitMapped;
                else result[bId].apartmentsData[unitKey] = unitMapped;

                const entNum = unitMapped.entranceIndex;
                if (statsByEntrance[entNum]) {
                    if (['flat', 'duplex_up', 'duplex_down'].includes(u.type)) statsByEntrance[entNum].apts++;
                    else if (['office', 'pantry'].includes(u.type)) statsByEntrance[entNum].units++;
                }
            });

            floorMops.forEach(m => {
                const mopMapped = mapMopFromDB(m, entranceMap);
                const entNum = mopMapped.entranceIndex;
                const mopKey = `${bId}_${block.id}_e${entNum}_f${f.id}_mops`;
                if (!result[bId].commonAreasData[mopKey]) result[bId].commonAreasData[mopKey] = [];
                result[bId].commonAreasData[mopKey].push(mopMapped);
                if (statsByEntrance[entNum]) statsByEntrance[entNum].mops++;
            });

            Object.entries(statsByEntrance).forEach(([entNum, stats]) => {
                const entKey = `${bId}_${block.id}_ent${entNum}_${f.id}`;
                result[bId].entrancesData[entKey] = {
                    id: stats.id, buildingId: bId, blockId: block.id, floorId: f.id, entranceIndex: parseInt(entNum),
                    apts: stats.apts, units: stats.units, mopQty: stats.mops
                };
            });
        });
    });
    return result;
  },

  // --- WRITE ---

  saveData: async (scope, projectId, payload) => {
    // ВАЖНО: buildingDetails обычно находится в корне payload (generalData), а не в buildingSpecificData
    const { buildingSpecificData, ...generalData } = payload;
    const promises = [];

    const { data: app } = await supabase.from('applications').select('id').eq('project_id', projectId).single();
    const appId = app?.id;

    if (generalData.complexInfo) {
        const ci = generalData.complexInfo;
        const updatePayload = {
            name: ci.name,
            construction_status: ci.status,
            region: ci.region,
            district: ci.district,
            address: ci.street,
            date_start_project: ci.dateStartProject || null,
            date_end_project: ci.dateEndProject || null,
            date_start_fact: ci.dateStartFact || null,
            date_end_fact: ci.dateEndFact || null,
            updated_at: new Date()
        };
        promises.push(supabase.from('projects').update(updatePayload).eq('id', projectId));
    }

    if (generalData.applicationInfo && appId) {
        const info = generalData.applicationInfo;
        const appUpdates = {
            updated_at: new Date(),
            status: info.status,
            current_step: info.currentStepIndex,
            current_stage: info.currentStage,
            assignee_name: info.assigneeName
        };
        promises.push(supabase.from('applications').update(appUpdates).eq('id', appId));

        if (info.completedSteps) {
             const stepsToUpsert = info.completedSteps.map(idx => ({
                 application_id: appId,
                 step_index: idx,
                 is_completed: true
             }));
             if (stepsToUpsert.length) promises.push(supabase.from('application_steps').upsert(stepsToUpsert, { onConflict: 'application_id, step_index' }));
        }
    }

    if (generalData.participants) {
        for (const [role, data] of Object.entries(generalData.participants)) {
            if (data.id) {
                promises.push(supabase.from('project_participants').upsert({ id: data.id, project_id: projectId, role: role, name: data.name, inn: data.inn }));
            }
        }
    }

    if (generalData.composition) {
        for (const b of generalData.composition) {
            await supabase.from('buildings').upsert({ id: b.id, project_id: projectId, label: b.label, house_number: b.houseNumber, category: b.category, construction_type: b.constructionType, parking_type: b.parkingType, infra_type: b.infraType });
            const blocksPayload = generateBlocksPayload(b);
            if (blocksPayload.length > 0) await supabase.from('building_blocks').upsert(blocksPayload);
        }
    }

    // [FIX] СОХРАНЕНИЕ ДЕТАЛЕЙ БЛОКА (Конструктив + Инженерия)
    // Мы берем данные из generalData.buildingDetails, так как React Context хранит их на верхнем уровне
    if (generalData.buildingDetails) {
        for (const [blockKey, details] of Object.entries(generalData.buildingDetails)) {
            const parts = blockKey.split('_');
            if (parts.length >= 2) {
                const blockId = parts[parts.length - 1];
                if (blockId.length > 30) {
                    // Собираем полный апдейт для БЛОКА
                    const updatePayload = {
                        // Геометрия
                        floors_count: parseInt(details.floorsCount) || 0,
                        entrances_count: parseInt(details.entrances || details.inputs) || 0,
                        elevators_count: parseInt(details.elevators) || 0,
                        vehicle_entries: parseInt(details.vehicleEntries) || 0,
                        levels_depth: parseInt(details.levelsDepth) || 0,
                        light_structure_type: details.lightStructureType,
                        floors_from: parseInt(details.floorsFrom) || 1,
                        floors_to: parseInt(details.floorsTo) || parseInt(details.floorsCount),
                        
                        // Флаги этажей
                        has_basement: details.hasBasementFloor,
                        has_attic: details.hasAttic,
                        has_loft: details.hasLoft,
                        has_roof_expl: details.hasExploitableRoof,

                        // Конструктив -> пишем в building_blocks
                        foundation: details.foundation,
                        walls: details.walls,
                        slabs: details.slabs,
                        roof: details.roof,
                        seismicity: parseInt(details.seismicity) || 0
                    };

                    // Инженерия -> пишем в building_blocks
                    if (details.engineering) {
                        updatePayload.has_electricity = details.engineering.electricity;
                        updatePayload.has_water = details.engineering.hvs;
                        updatePayload.has_sewerage = details.engineering.sewerage;
                        updatePayload.has_gas = details.engineering.gas;
                        updatePayload.has_heating = details.engineering.heating;
                        updatePayload.has_ventilation = details.engineering.ventilation;
                        updatePayload.has_firefighting = details.engineering.firefighting;
                        updatePayload.has_lowcurrent = details.engineering.lowcurrent;
                    }

                    promises.push(supabase.from('building_blocks').update(updatePayload).eq('id', blockId));
                }
            }
        }
    }

    if (buildingSpecificData) {
        // Если нужен syncEntrances, его можно вызвать, но он требует buildingDetails.
        // Если в payload buildingDetails лежит отдельно (в generalData), 
        // то нужно передать объединенный объект, если syncEntrances этого требует.
        // Для простоты оставим как есть, так как syncEntrances в основном нужен для матриц.
        const entrancesMap = await syncEntrances(buildingSpecificData);

        for (const [bId, bData] of Object.entries(buildingSpecificData)) {
            if (bData.floorData) {
                const floors = Object.values(bData.floorData).map(f => ({ id: f.id, block_id: f.blockId, index: f.sortOrder || 0, label: f.label, floor_type: f.type, height: parseFloat(f.height)||0, area_proj: parseFloat(f.areaProj)||0, area_fact: parseFloat(f.areaFact)||0, is_duplex: f.isDuplex||false }));
                if (floors.length) promises.push(supabase.from('floors').upsert(floors));
            }

            const unitsPayload = [];
            const roomsPayload = [];
            
            const processUnit = (u) => {
                const entNum = u.entrance || u.entranceIndex;
                const entKey = `${u.blockId}_${entNum}`;
                const entranceUUID = entrancesMap[entKey] || null;

                unitsPayload.push({
                    id: u.id,
                    floor_id: u.floorId,
                    entrance_id: entranceUUID,
                    number: u.num || u.number,
                    type: u.type,
                    status: u.isSold ? 'sold' : 'free',
                    total_area: parseFloat(u.area) || 0,
                    living_area: parseFloat(u.livingArea) || 0,
                    useful_area: parseFloat(u.usefulArea) || 0,
                    rooms_count: u.rooms || 0,
                    cadastre_number: u.cadastreNumber
                });
                if (u.explication && Array.isArray(u.explication)) {
                    u.explication.forEach(r => {
                        roomsPayload.push({
                            id: r.id || crypto.randomUUID(),
                            unit_id: u.id,
                            room_type: r.type,
                            name: r.label, 
                            area: parseFloat(r.area) || 0,
                            level: parseInt(r.level) || 1
                        });
                    });
                }
            };

            if (bData.apartmentsData) Object.values(bData.apartmentsData).forEach(processUnit);
            if (bData.parkingData) Object.values(bData.parkingData).forEach(processUnit);

            if (unitsPayload.length > 0) promises.push(supabase.from('units').upsert(unitsPayload));
            if (roomsPayload.length > 0) promises.push(supabase.from('rooms').upsert(roomsPayload));

            if (bData.commonAreasData) {
                const mopPayload = [];
                Object.values(bData.commonAreasData).flat().forEach(m => {
                    const entNum = m.entranceIndex;
                    const entKey = `${m.blockId}_${entNum}`;
                    const entranceUUID = entrancesMap[entKey];
                    if (entranceUUID && m.floorId) {
                        mopPayload.push({ id: m.id, floor_id: m.floorId, entrance_id: entranceUUID, type: m.type, area: parseFloat(m.area)||0 });
                    }
                });
                if (mopPayload.length > 0) promises.push(supabase.from('common_areas').upsert(mopPayload));
            }
        }
    }

    await Promise.all(promises);
    
    if (generalData.applicationInfo && generalData.applicationInfo.history && generalData.applicationInfo.history.length > 0) {
         const lastItem = generalData.applicationInfo.history[0];
         if (new Date().getTime() - new Date(lastItem.date).getTime() < 5000) {
             await supabase.from('application_history').insert({
                 application_id: appId,
                 action: lastItem.action,
                 prev_status: lastItem.prevStatus,
                 next_status: lastItem.status,
                 user_name: lastItem.user,
                 comment: lastItem.comment,
                 created_at: lastItem.date
             });
         }
    }
  },

  createProjectFromApplication: async (scope, app, user) => {
      const pId = crypto.randomUUID();
      const appId = crypto.randomUUID();
      
      await supabase.from('projects').insert({
          id: pId,
          name: `ЖК по заявке ${app.externalId}`, 
          address: app.address,
          cadastre_number: app.cadastre,
          construction_status: 'Проектный'
      });
      
      await supabase.from('applications').insert({
          id: appId,
          project_id: pId,
          internal_number: app.id,
          external_source: app.source,
          external_id: app.externalId,
          applicant: app.applicant,
          submission_date: app.submissionDate,
          assignee_name: user.name,
          status: 'DRAFT'
      });
      
      return pId;
  },

  deleteProject: async (scope, id) => {
      await supabase.from('projects').delete().eq('id', id);
  },
  
  deleteBuilding: async (scope, pId, bId) => {
      await supabase.from('buildings').delete().eq('id', bId);
  },

  saveUnits: async () => {}, 
  saveFloors: async () => {},
  saveParkingPlaces: async () => {},
  
  getExternalApplications: async () => [
    {
        id: '10239', 
        source: 'EPIGU', 
        externalId: 'EP-2026-9912', 
        applicant: 'ООО "Golden House"', 
        submissionDate: new Date().toISOString(), 
        cadastre: '11:01:02:03:0044', 
        address: 'г. Ташкент, Шайхантахурский р-н, ул. Навои, 12'
    }
  ]
};