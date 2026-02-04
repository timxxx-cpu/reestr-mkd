import { supabase } from './supabase';
import { 
    mapProjectFromDB, 
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
            type: mapBlockTypeToDB(block.type),
            floors_count: 1, 
            entrances_count: 1
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
    const entranceMap = {}; 
    const entrancesToUpsert = [];

    for (const [bId, bData] of Object.entries(buildingSpecificData)) {
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
    const { data: existing } = await supabase
        .from('entrances')
        .select('id, block_id, number')
        .in('block_id', blockIds);

    const existingMap = {};
    existing?.forEach(e => {
        existingMap[`${e.block_id}_${e.number}`] = e.id;
    });

    const newEntrances = [];
    entrancesToUpsert.forEach(e => {
        const key = `${e.block_id}_${e.number}`;
        if (!existingMap[key]) {
            const newId = crypto.randomUUID();
            existingMap[key] = newId; 
            newEntrances.push({ id: newId, block_id: e.block_id, number: e.number });
        }
    });

    if (newEntrances.length > 0) {
        await supabase.from('entrances').upsert(newEntrances);
    }

    return existingMap;
}

export const RegistryService = {

  // --- READ ---

  getProjectsList: async (scope) => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, status, region, address, updated_at')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return data.map(p => ({
      id: p.id,
      name: p.name,
      status: p.status,
      lastModified: p.updated_at,
      complexInfo: { name: p.name, region: p.region, street: p.address }
    }));
  },

  getProjectMeta: async (scope, projectId) => {
    const [ pRes, partsRes, docsRes, buildingsRes ] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase.from('project_participants').select('*').eq('project_id', projectId),
        supabase.from('project_documents').select('*').eq('project_id', projectId),
        supabase.from('buildings').select('*, building_blocks(*)').eq('project_id', projectId)
    ]);

    if (pRes.error) return null;

    const projectData = mapProjectFromDB(pRes.data, partsRes.data || [], docsRes.data || []);
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

    // 1. Загружаем блоки, этажи и подъезды
    const { data: allBlocks } = await supabase
        .from('building_blocks')
        .select(`
            id, label, building_id,
            floors (*),
            entrances (*)
        `)
        .in('building_id', buildingIds);

    const floorIds = (allBlocks || []).flatMap(b => b.floors.map(f => f.id));
    
    // 2. Загружаем юниты и МОП (по floor_id)
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
        if (!result[bId]) {
            result[bId] = {
                floorData: {},
                apartmentsData: {}, 
                parkingData: {},
                entrancesData: {}, 
                commonAreasData: {} 
            };
        }

        // Карта: UUID Входа -> Номер Входа
        const entranceMap = {}; 
        block.entrances.forEach(e => {
            entranceMap[e.id] = e.number;
        });

        // --- ВОССТАНОВЛЕНИЕ AGGREGATED STATE (ENTRANCES DATA) ---
        // Проходим по этажам и считаем, что там есть
        block.floors.forEach(f => {
            const floorKey = `${bId}_${block.id}_${f.id}`;
            result[bId].floorData[floorKey] = mapFloorFromDB(f);

            // Фильтруем юниты и МОПы для этого этажа
            const floorUnits = allUnits.filter(u => u.floor_id === f.id);
            const floorMops = allMops.filter(m => m.floor_id === f.id);

            // Группируем по подъездам для статистики
            const statsByEntrance = {}; // { 1: { apts: 0, units: 0, mops: 0 } }

            // Инициализируем статистику для всех существующих подъездов
            block.entrances.forEach(e => {
                statsByEntrance[e.number] = { apts: 0, units: 0, mops: 0, id: crypto.randomUUID() };
            });

            // Считаем юниты
            floorUnits.forEach(u => {
                // Маппим юнит
                const unitMapped = mapUnitFromDB(u, u.rooms, entranceMap);
                const unitKey = u.id; 
                if (u.type === 'parking_place') result[bId].parkingData[unitKey] = unitMapped;
                else result[bId].apartmentsData[unitKey] = unitMapped;

                // Считаем агрегаты для entrancesData
                const entNum = unitMapped.entranceIndex;
                if (statsByEntrance[entNum]) {
                    if (['flat', 'duplex_up', 'duplex_down'].includes(u.type)) {
                        statsByEntrance[entNum].apts++;
                    } else if (['office', 'pantry'].includes(u.type)) {
                        statsByEntrance[entNum].units++;
                    }
                }
            });

            // Считаем МОПы
            floorMops.forEach(m => {
                const mopMapped = mapMopFromDB(m, entranceMap);
                const entNum = mopMapped.entranceIndex;
                const mopKey = `${bId}_${block.id}_e${entNum}_f${f.id}_mops`;
                
                if (!result[bId].commonAreasData[mopKey]) {
                    result[bId].commonAreasData[mopKey] = [];
                }
                result[bId].commonAreasData[mopKey].push(mopMapped);

                if (statsByEntrance[entNum]) {
                    statsByEntrance[entNum].mops++;
                }
            });

            // Заполняем result[bId].entrancesData
            // Ключ: {BlockFullId}_ent{Number}_{FloorId}
            Object.entries(statsByEntrance).forEach(([entNum, stats]) => {
                // Если есть хоть какие-то данные (или если это явный этаж с подъездами)
                // Для консистентности лучше восстанавливать запись, даже если нули, если этаж существует
                const entKey = `${bId}_${block.id}_ent${entNum}_${f.id}`;
                result[bId].entrancesData[entKey] = {
                    id: stats.id,
                    buildingId: bId,
                    blockId: block.id,
                    floorId: f.id,
                    entranceIndex: parseInt(entNum),
                    apts: stats.apts,
                    units: stats.units,
                    mopQty: stats.mops
                };
            });
        });
    });

    return result;
  },

  // --- WRITE ---

  saveData: async (scope, projectId, payload) => {
    const { buildingSpecificData, ...generalData } = payload;
    const promises = [];

    if (generalData.complexInfo) {
        const ci = generalData.complexInfo;
        promises.push(supabase.from('projects').update({
            name: ci.name,
            status: ci.status,
            region: ci.region,
            district: ci.district,
            address: ci.street,
            date_start_project: ci.dateStartProject || null,
            date_end_project: ci.dateEndProject || null,
            date_start_fact: ci.dateStartFact || null,
            date_end_fact: ci.dateEndFact || null,
            updated_at: new Date()
        }).eq('id', projectId));
    }

    if (generalData.participants) {
        for (const [role, data] of Object.entries(generalData.participants)) {
            if (data.id) {
                promises.push(supabase.from('project_participants').upsert({
                    id: data.id,
                    project_id: projectId,
                    role: role,
                    name: data.name,
                    inn: data.inn
                }));
            }
        }
    }

    if (generalData.composition) {
        for (const b of generalData.composition) {
            await supabase.from('buildings').upsert({
                id: b.id,
                project_id: projectId,
                label: b.label,
                house_number: b.houseNumber,
                category: b.category,
                construction_type: b.constructionType,
                parking_type: b.parkingType,
                infra_type: b.infraType
            });
            const blocksPayload = generateBlocksPayload(b);
            if (blocksPayload.length > 0) {
                await supabase.from('building_blocks').upsert(blocksPayload);
            }
        }
    }

    if (buildingSpecificData) {
        const entrancesMap = await syncEntrances(buildingSpecificData);

        for (const [bId, bData] of Object.entries(buildingSpecificData)) {
            
            if (bData.floorData) {
                const floors = Object.values(bData.floorData).map(f => ({
                    id: f.id,
                    block_id: f.blockId,
                    index: f.sortOrder || 0,
                    label: f.label,
                    floor_type: f.type,
                    height: parseFloat(f.height) || 0,
                    area_proj: parseFloat(f.areaProj) || 0,
                    area_fact: parseFloat(f.areaFact) || 0,
                    is_duplex: f.isDuplex || false
                }));
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
                        mopPayload.push({
                            id: m.id,
                            floor_id: m.floorId,
                            entrance_id: entranceUUID,
                            type: m.type,
                            area: parseFloat(m.area) || 0
                        });
                    }
                });
                if (mopPayload.length > 0) promises.push(supabase.from('common_areas').upsert(mopPayload));
            }

            if (bData.buildingDetails) {
                for (const [blockKey, details] of Object.entries(bData.buildingDetails)) {
                    const parts = blockKey.split('_');
                    if (parts.length >= 2) {
                        const blockId = parts[parts.length - 1];
                        if (blockId.length > 30) { 
                            promises.push(supabase.from('building_blocks').update({
                                floors_count: parseInt(details.floorsCount) || 0,
                                entrances_count: parseInt(details.entrances || details.inputs) || 0,
                                elevators_count: parseInt(details.elevators) || 0,
                                has_basement: details.hasBasementFloor,
                                has_attic: details.hasAttic,
                                has_loft: details.hasLoft,
                                has_roof_expl: details.hasExploitableRoof
                            }).eq('id', blockId));
                            
                            promises.push(supabase.from('buildings').update({
                                foundation: details.foundation,
                                walls: details.walls,
                                slabs: details.slabs,
                                roof: details.roof,
                                seismicity: parseInt(details.seismicity) || 0,
                                has_electricity: details.engineering?.electricity,
                                has_water: details.engineering?.hvs,
                                has_sewerage: details.engineering?.sewerage,
                                has_gas: details.engineering?.gas,
                                has_heating: details.engineering?.heating,
                                has_ventilation: details.engineering?.ventilation,
                                has_firefighting: details.engineering?.firefighting,
                                has_lowcurrent: details.engineering?.lowcurrent
                            }).eq('id', bId));
                        }
                    }
                }
            }
        }
    }

    await Promise.all(promises);
  },

  // --- LEGACY ---
  createProject: async (scope, meta) => {
      const { data, error } = await supabase.from('projects').insert({
          id: meta.id,
          name: meta.complexInfo?.name || 'Новый проект',
          status: meta.status || 'Проектный'
      }).select().single();
      if (error) throw error;
      return data;
  },
  
  createProjectFromApplication: async (scope, app, user) => {
      const pId = crypto.randomUUID();
      await supabase.from('projects').insert({
          id: pId,
          name: `Заявка ${app.externalId}`,
          address: app.address,
          cadastre_number: app.cadastre,
          status: 'Проектный'
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
  getExternalApplications: async () => []
};