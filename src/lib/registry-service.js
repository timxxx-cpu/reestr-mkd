import { supabase } from './supabase';
import { 
    mapProjectAggregate, 
    mapBuildingFromDB, 
    mapBlockDetailsFromDB, 
    mapFloorFromDB, 
    mapUnitFromDB,
    mapMopFromDB
} from './db-mappers';
import { buildFloorList } from './floor-utils';
import { getBlocksList } from './utils';

function mapBlockTypeToDB(uiType) {
    if (uiType === 'residential') return 'Ж';
    if (uiType === 'non_residential') return 'Н';
    if (uiType === 'parking') return 'Parking';
    if (uiType === 'infrastructure') return 'Infra';
    return uiType;
}

// Хелпер для восстановления floor_key из ID (floor_1 -> floor:1) для ЗАПИСИ
const inferFloorKey = (id) => {
    if (!id) return null;
    if (id.startsWith('floor_')) {
        if (id.includes('_tech')) return `tech:${id.split('_')[1]}`;
        return `floor:${id.split('_')[1]}`;
    }
    if (id.startsWith('level_minus_')) return `parking:-${id.split('_')[2]}`;
    if (id.startsWith('base_')) {
        const parts = id.split('_');
        const depth = parts[parts.length-1].replace('L','');
        const baseId = parts.slice(1, parts.length-1).join('_');
        return `basement:${baseId}:${depth}`;
    }
    if (['attic', 'loft', 'roof', 'tsokol'].includes(id)) return id;
    return id;
};

// Хелпер для восстановления ID из floor_key (floor:1 -> floor_1) для ЧТЕНИЯ
const mapFloorKeyToVirtualId = (key) => {
    if (!key) return null;
    if (key.startsWith('floor:')) return `floor_${key.split(':')[1]}`;
    if (key.startsWith('parking:')) {
         const part = key.split(':')[1];
         const level = part.startsWith('-') ? part.substring(1) : part;
         return `level_minus_${level}`;
    }
    if (key.startsWith('basement:')) {
        const parts = key.split(':'); 
        if (parts.length >= 3) {
            const depth = parts[parts.length - 1];
            // Собираем ID подвала обратно, если он содержал двоеточия (маловероятно, но безопасно)
            const baseId = parts.slice(1, parts.length - 1).join(':'); 
            return `base_${baseId}_L${depth}`;
        }
    }
    if (key.startsWith('tech:')) return `floor_${key.split(':')[1]}_tech`;
    if (['attic', 'loft', 'roof', 'tsokol'].includes(key)) return key;
    return key;
};

export const RegistryService = {

  // --- READ ---

  getProjectsList: async (scope) => {
    if (!scope) return [];
    const { data, error } = await supabase
      .from('applications')
      .select(`*, projects (name, region, address)`)
      .eq('scope_id', scope)
      .order('updated_at', { ascending: false });

    if (error) {
        console.error("Error fetching projects:", error);
        throw error;
    }

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
    if (!scope) return null;
    const { data: app, error: appError } = await supabase
        .from('applications')
        .select('*')
        .eq('project_id', projectId)
        .eq('scope_id', scope)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
    if (appError) {
        console.warn("App not found:", appError);
        return null;
    }

    const [ pRes, partsRes, docsRes, buildingsRes, historyRes, stepsRes ] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).eq('scope_id', scope).single(),
        supabase.from('project_participants').select('*').eq('project_id', projectId),
        supabase.from('project_documents').select('*').eq('project_id', projectId),
        supabase.from('buildings')
            .select(`
                *, 
                building_blocks (
                    *,
                    block_construction (*),
                    block_engineering (*)
                )
            `)
            .eq('project_id', projectId),
        supabase.from('application_history').select('*').eq('application_id', app.id),
        supabase.from('application_steps').select('*').eq('application_id', app.id)
    ]);

    if (pRes.error) {
        console.error("Error loading project:", pRes.error);
        return null;
    }

    const projectData = mapProjectAggregate(
        pRes.data, app, historyRes.data || [], stepsRes.data || [], partsRes.data || [], docsRes.data || []
    );
    
    const composition = [];
    const buildingDetails = {};

    const buildingIds = (buildingsRes.data || []).map(b => b.id);
    const blockIds = (buildingsRes.data || []).flatMap(b => (b.building_blocks || []).map(block => block.id));
    const technicalFloorsMap = {};
    const commercialFloorsMap = {};
    if (blockIds.length > 0) {
        const { data: floorsData } = await supabase
            .from('floors')
            .select('block_id, index, floor_type, parent_floor_index, is_commercial, is_technical, is_attic, is_loft, is_roof, basement_id')
            .in('block_id', blockIds);

        (floorsData || []).forEach(row => {
            if (row.is_technical && row.parent_floor_index !== null && row.parent_floor_index !== undefined) {
                if (!technicalFloorsMap[row.block_id]) technicalFloorsMap[row.block_id] = new Set();
                technicalFloorsMap[row.block_id].add(row.parent_floor_index);
            }

            if (!row.is_commercial) return;
            if (!commercialFloorsMap[row.block_id]) commercialFloorsMap[row.block_id] = new Set();

            if (row.floor_type === 'basement' && row.basement_id) {
                commercialFloorsMap[row.block_id].add(`basement_${row.basement_id}`);
            } else if (row.floor_type === 'tsokol') {
                commercialFloorsMap[row.block_id].add('tsokol');
            } else if (row.floor_type === 'attic' || row.is_attic) {
                commercialFloorsMap[row.block_id].add('attic');
            } else if (row.floor_type === 'loft' || row.is_loft) {
                commercialFloorsMap[row.block_id].add('loft');
            } else if (row.floor_type === 'roof' || row.is_roof) {
                commercialFloorsMap[row.block_id].add('roof');
            } else if (row.floor_type === 'technical' && row.parent_floor_index !== null && row.parent_floor_index !== undefined) {
                commercialFloorsMap[row.block_id].add(`${row.parent_floor_index}-Т`);
            } else if (row.index !== null && row.index !== undefined) {
                commercialFloorsMap[row.block_id].add(String(row.index));
            }
        });
    }
    let featuresMap = {};
    if (buildingIds.length > 0) {
        const { data: basementsData } = await supabase
            .from('basements')
            .select('id, building_id, block_id, depth, has_parking')
            .in('building_id', buildingIds);
        const basementIds = (basementsData || []).map(b => b.id);
        let parkingLevelsMap = {};
        if (basementIds.length > 0) {
            const { data: levelsData } = await supabase
                .from('basement_parking_levels')
                .select('basement_id, depth_level, is_enabled')
                .in('basement_id', basementIds);
            parkingLevelsMap = (levelsData || []).reduce((acc, level) => {
                if (!acc[level.basement_id]) acc[level.basement_id] = {};
                acc[level.basement_id][level.depth_level] = level.is_enabled;
                return acc;
            }, {});
        }
        (basementsData || []).forEach(base => {
            if (!featuresMap[base.building_id]) {
                featuresMap[base.building_id] = { basements: [], exploitableRoofs: [] };
            }
            featuresMap[base.building_id].basements.push({
                id: base.id,
                depth: base.depth,
                hasParking: base.has_parking,
                parkingLevels: parkingLevelsMap[base.id] || {},
                blocks: [base.block_id],
                buildingId: base.building_id,
                blockId: base.block_id
            });
        });
    }

    (buildingsRes.data || []).forEach(b => {
        composition.push(mapBuildingFromDB(b, b.building_blocks));
        b.building_blocks.forEach(block => {
            const uiKey = `${b.id}_${block.id}`;
            const mapped = mapBlockDetailsFromDB(b, block);
            mapped.technicalFloors = Array.from(technicalFloorsMap[block.id] || []);
            mapped.commercialFloors = Array.from(commercialFloorsMap[block.id] || []);
            buildingDetails[uiKey] = mapped;
        });
        if (featuresMap[b.id]) {
            buildingDetails[`${b.id}_features`] = featuresMap[b.id];
        }
    });

    return { ...projectData, composition, buildingDetails };
  },

  getBuildings: async (scope, projectId) => {
    if (!scope) return {};
    const { data: scopedProject } = await supabase
        .from('projects')
        .select('id')
        .eq('id', projectId)
        .eq('scope_id', scope)
        .single();
    if (!scopedProject) return {};
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
    let allEntranceMatrix = [];

    if (floorIds.length > 0) {
        const blockIds = (allBlocks || []).map(b => b.id);
        const [unitsRes, mopsRes, matrixRes] = await Promise.all([
            supabase.from('units').select('*, rooms(*)').in('floor_id', floorIds),
            supabase.from('common_areas').select('*').in('floor_id', floorIds),
            supabase.from('entrance_matrix').select('*').in('block_id', blockIds)
        ]);
        allUnits = unitsRes.data || [];
        allMops = mopsRes.data || [];
        allEntranceMatrix = matrixRes.data || [];
    }

    const result = {};

    allBlocks?.forEach(block => {
        const bId = block.building_id;
        if (!result[bId]) result[bId] = { floorData: {}, apartmentsData: {}, parkingData: {}, entrancesData: {}, commonAreasData: {} };

        const entranceMap = {}; 
        block.entrances.forEach(e => { entranceMap[e.id] = e.number; });

        block.floors.forEach(f => {
            const floorKey = `${bId}_${block.id}_${f.id}`;
            result[bId].floorData[floorKey] = mapFloorFromDB(f, bId, block.id);

            const floorUnits = allUnits.filter(u => u.floor_id === f.id);
            const floorMops = allMops.filter(m => m.floor_id === f.id);
            const floorMatrix = allEntranceMatrix.filter(m => m.block_id === block.id && m.floor_id === f.id);

            floorUnits.forEach(u => {
                const unitMapped = mapUnitFromDB(u, u.rooms, entranceMap, bId, block.id);
                const unitKey = u.id;

                if (u.unit_type === 'parking_place') {
                    result[bId].parkingData[unitKey] = unitMapped;
                } else {
                    result[bId].apartmentsData[unitKey] = unitMapped;
                }
            });

            floorMops.forEach(m => {
                const mopMapped = mapMopFromDB(m, entranceMap, bId, block.id);
                const entNum = mopMapped.entranceIndex;
                
                // [FIX] Use Virtual ID for key
                const virtualFloorId = mapFloorKeyToVirtualId(f.floor_key) || f.id;
                const mopKey = `${bId}_${block.id}_e${entNum}_f${virtualFloorId}_mops`;
                
                if (!result[bId].commonAreasData[mopKey]) result[bId].commonAreasData[mopKey] = [];
                result[bId].commonAreasData[mopKey].push(mopMapped);
            });

            if (floorMatrix.length > 0) {
                floorMatrix.forEach(row => {
                    // [FIX] Use Virtual ID for key
                    const virtualFloorId = mapFloorKeyToVirtualId(f.floor_key) || f.id;
                    const entKey = `${bId}_${block.id}_ent${row.entrance_number}_${virtualFloorId}`;
                    
                    result[bId].entrancesData[entKey] = {
                        id: row.id,
                        buildingId: bId,
                        blockId: block.id,
                        floorId: f.id, // Store real UUID here if needed for back-reference
                        entranceIndex: row.entrance_number,
                        apts: row.apartments_count || 0,
                        units: row.commercial_count || 0,
                        mopQty: row.mop_count || 0
                    };
                });
            } else {
                const fallbackStats = {};
                block.entrances.forEach(e => {
                    fallbackStats[e.number] = { apts: 0, units: 0, mops: 0, id: crypto.randomUUID() };
                });

                floorUnits.forEach(u => {
                    const unitMapped = mapUnitFromDB(u, u.rooms, entranceMap, bId, block.id);
                    const entNum = unitMapped.entranceIndex;
                    if (!fallbackStats[entNum]) return;
                    if (['flat', 'duplex_up', 'duplex_down'].includes(u.unit_type)) fallbackStats[entNum].apts++;
                    else if (['office', 'pantry'].includes(u.unit_type)) fallbackStats[entNum].units++;
                });

                floorMops.forEach(m => {
                    const mopMapped = mapMopFromDB(m, entranceMap, bId, block.id);
                    const entNum = mopMapped.entranceIndex;
                    if (fallbackStats[entNum]) fallbackStats[entNum].mops++;
                });

                Object.entries(fallbackStats).forEach(([entNum, stats]) => {
                    // [FIX] Use Virtual ID for key
                    const virtualFloorId = mapFloorKeyToVirtualId(f.floor_key) || f.id;
                    const entKey = `${bId}_${block.id}_ent${entNum}_${virtualFloorId}`;
                    
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
            }
        });
    });
    return result;
  },

  // --- WRITE ---

  saveData: async (scope, projectId, payload) => {
    if (!scope) return;
    const { buildingSpecificData, ...generalData } = payload;
    const promises = [];

    // 1. PROJECT & APP
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
        promises.push(supabase.from('projects').update(updatePayload).eq('id', projectId).eq('scope_id', scope));
    }

    const { data: app } = await supabase
        .from('applications')
        .select('id')
        .eq('project_id', projectId)
        .eq('scope_id', scope)
        .single();
    const appId = app?.id;

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
             const steps = info.completedSteps.map(idx => ({ application_id: appId, step_index: idx, is_completed: true }));
             if (steps.length > 0) promises.push(supabase.from('application_steps').upsert(steps, { onConflict: 'application_id, step_index' }));
        }
    }

    // 2. PARTICIPANTS
    if (generalData.participants) {
        for (const [role, data] of Object.entries(generalData.participants)) {
            if (data.id) promises.push(supabase.from('project_participants').upsert({ id: data.id, project_id: projectId, role, name: data.name, inn: data.inn }));
        }
    }

    // 3. BUILDINGS & BLOCKS (Structure)
    if (generalData.composition) {
        for (const b of generalData.composition) {
            await supabase.from('buildings').upsert({ 
                id: b.id, project_id: projectId, label: b.label, house_number: b.houseNumber, 
                category: b.category, construction_type: b.constructionType, parking_type: b.parkingType, infra_type: b.infraType,
                has_non_res_part: !!b.hasNonResPart
            });
            if (b.blocks?.length) {
                const blocksPayload = b.blocks.map(block => ({
                    id: block.id, building_id: b.id, label: block.label, type: mapBlockTypeToDB(block.type)
                }));
                if (blocksPayload.length > 0) {
                    await supabase.from('building_blocks').upsert(blocksPayload);
                    const blockIds = blocksPayload.map(block => `'${block.id}'`).join(',');
                    await supabase
                        .from('building_blocks')
                        .delete()
                        .eq('building_id', b.id)
                        .not('id', 'in', `(${blockIds})`);
                }
            } else {
                await supabase.from('building_blocks').delete().eq('building_id', b.id);
            }
        }
    }

    // 4. BLOCK DETAILS
    if (generalData.buildingDetails) {
        const featureEntries = [];
        for (const [blockKey, details] of Object.entries(generalData.buildingDetails)) {
            if (blockKey.endsWith('_features')) {
                featureEntries.push([blockKey, details]);
                continue;
            }
            if (blockKey.endsWith('_photo')) continue;
            const parts = blockKey.split('_');
            if (parts.length >= 2) {
                let blockId = parts[parts.length - 1];
                const buildingId = parts[0];

                if (blockId && blockId.length === 36) {
                    const blockUpdate = {
                        floors_count: parseInt(details.floorsCount)||0,
                        entrances_count: parseInt(details.entrances || details.inputs)||0,
                        elevators_count: parseInt(details.elevators)||0,
                        vehicle_entries: parseInt(details.vehicleEntries)||0,
                        levels_depth: parseInt(details.levelsDepth)||0,
                        light_structure_type: details.lightStructureType,
                        floors_from: parseInt(details.floorsFrom)||1,
                        floors_to: parseInt(details.floorsTo)||parseInt(details.floorsCount),
                        has_basement: details.hasBasementFloor,
                        has_attic: details.hasAttic,
                        has_loft: details.hasLoft,
                        has_roof_expl: details.hasExploitableRoof,
                        has_custom_address: details.hasCustomAddress,
                        custom_house_number: details.customHouseNumber
                    };
                    promises.push(supabase.from('building_blocks').update(blockUpdate).eq('id', blockId));

                    let building = (generalData.composition || []).find(item => item.id === buildingId);
                    if (!building) {
                        const { data: buildingRes } = await supabase
                            .from('buildings')
                            .select('*, building_blocks (*)')
                            .eq('id', buildingId)
                            .limit(1)
                            .maybeSingle();
                        if (buildingRes) {
                            building = mapBuildingFromDB(buildingRes, buildingRes.building_blocks || []);
                        }
                    }
                    
                    if (building) {
                        const blocks = getBlocksList(building, generalData.buildingDetails || {});
                        const currentBlock = blocks.find(b => b.id === blockId);
                        if (currentBlock) {
                            const floorList = buildFloorList(building, currentBlock, generalData.buildingDetails || {});
                            const existingFloorsRes = await supabase
                                .from('floors')
                                .select('id, block_id, floor_key')
                                .eq('block_id', blockId);
                            const existingFloors = existingFloorsRes.data || [];
                            const existingByKey = new Map(existingFloors.map(f => [f.floor_key, f.id]));

                            const floorsPayload = floorList.map(floor => ({
                                id: existingByKey.get(floor.floorKey) || crypto.randomUUID(),
                                block_id: blockId,
                                floor_key: floor.floorKey,
                                basement_id: floor.basementId || null,
                                index: Number.isFinite(floor.index) ? floor.index : floor.sortOrder || 0,
                                label: floor.label,
                                floor_type: floor.type,
                                parent_floor_index: floor.parentFloorIndex ?? null,
                                is_technical: !!floor.flags?.isTechnical,
                                is_commercial: !!floor.flags?.isCommercial,
                                is_stylobate: !!floor.flags?.isStylobate,
                                is_basement: !!floor.flags?.isBasement,
                                is_attic: !!floor.flags?.isAttic,
                                is_loft: !!floor.flags?.isLoft,
                                is_roof: !!floor.flags?.isRoof
                            }));

                         if (floorsPayload.length) {
                            // 1. Ждем, пока этажи физически запишутся в БД
                            const { error: floorError } = await supabase
                                .from('floors')
                                .upsert(floorsPayload, { onConflict: 'block_id,floor_key' });
                            
                            if (floorError) console.error("Floors save error:", floorError);

                            // 2. Только теперь удаляем лишние (это можно в фоне)
                            const floorKeys = floorsPayload.map(item => `'${item.floor_key}'`).join(',');
                            if (floorKeys.length > 0) {
                                promises.push(
                                    supabase
                                        .from('floors')
                                        .delete()
                                        .eq('block_id', blockId)
                                        .not('floor_key', 'in', `(${floorKeys})`)
                                );
                            }
                        }
                        }
                    }

                    const constructionData = {
                        block_id: blockId,
                        foundation: details.foundation || null,
                        walls: details.walls || null,
                        slabs: details.slabs || null,
                        roof: details.roof || null,
                        seismicity: parseInt(details.seismicity) || null
                    };
                    promises.push(
                        supabase.from('block_construction')
                            .upsert(constructionData, { onConflict: 'block_id' })
                            .then(({ error }) => { if (error) console.error("Error saving construction:", error, constructionData); })
                    );

                    if (details.engineering) {
                        const engData = {
                            block_id: blockId,
                            has_electricity: !!details.engineering.electricity,
                            has_water: !!details.engineering.hvs,
                            has_hot_water: !!details.engineering.gvs,
                            has_sewerage: !!details.engineering.sewerage,
                            has_gas: !!details.engineering.gas,
                            has_heating: !!details.engineering.heating,
                            has_ventilation: !!details.engineering.ventilation,
                            has_firefighting: !!details.engineering.firefighting,
                            has_lowcurrent: !!details.engineering.lowcurrent
                        };
                        promises.push(
                            supabase.from('block_engineering')
                                .upsert(engData, { onConflict: 'block_id' })
                                .then(({ error }) => { if (error) console.error("Error saving engineering:", error, engData); })
                        );
                    }
                }
            }
        }
        for (const [featureKey, featureData] of featureEntries) {
            const buildingId = featureKey.replace(/_features$/, '');
            if (!buildingId) continue;
            const basements = featureData?.basements || [];
            const basementIds = basements.map(b => b.id).filter(Boolean);
            const basementsPayload = basements.map(b => ({
                id: b.id,
                building_id: buildingId,
                block_id: b.blockId || (b.blocks ? b.blocks[0] : null),
                depth: parseInt(b.depth) || 1,
                has_parking: !!b.hasParking,
                updated_at: new Date()
            })).filter(b => b.block_id);
            if (basementsPayload.length) {
                promises.push(supabase.from('basements').upsert(basementsPayload));
            }
            if (basementIds.length > 0) {
                promises.push(
                    supabase
                        .from('basements')
                        .delete()
                        .eq('building_id', buildingId)
                        .not('id', 'in', `(${basementIds.join(',')})`)
                );
            } else {
                promises.push(
                    supabase
                        .from('basements')
                        .delete()
                        .eq('building_id', buildingId)
                );
            }
            for (const base of basements) {
                if (!base.id) continue;
                const levels = base.parkingLevels || {};
                const levelEntries = Object.entries(levels);
                const levelPayload = levelEntries.map(([depthLevel, isEnabled]) => ({
                    basement_id: base.id,
                    depth_level: parseInt(depthLevel),
                    is_enabled: !!isEnabled
                })).filter(item => !Number.isNaN(item.depth_level));
                if (levelPayload.length) {
                    promises.push(
                        supabase
                            .from('basement_parking_levels')
                            .upsert(levelPayload, { onConflict: 'basement_id, depth_level' })
                    );
                }
                if (levelEntries.length > 0) {
                    const levelIds = levelEntries
                        .map(([depthLevel]) => parseInt(depthLevel))
                        .filter(val => !Number.isNaN(val));
                    if (levelIds.length > 0) {
                        promises.push(
                            supabase
                                .from('basement_parking_levels')
                                .delete()
                                .eq('basement_id', base.id)
                                .not('depth_level', 'in', `(${levelIds.join(',')})`)
                        );
                    }
                } else {
                    promises.push(
                        supabase
                            .from('basement_parking_levels')
                            .delete()
                            .eq('basement_id', base.id)
                    );
                }
            }
        }
    }

    // 5. MATRICES
    if (buildingSpecificData) {
        // --- СБОР ID БЛОКОВ ---
        const involvedBlockIds = new Set();
        Object.values(buildingSpecificData).forEach(bData => {
            const collectIds = (dataObj) => {
                if (!dataObj) return;
                Object.values(dataObj).forEach(item => {
                    if (item.blockId) involvedBlockIds.add(item.blockId);
                    if (item.block_id) involvedBlockIds.add(item.block_id);
                });
            };
            collectIds(bData.floorData);
            collectIds(bData.entrancesData);
            collectIds(bData.apartmentsData);
            collectIds(bData.parkingData);
        });

        // --- ЗАГРУЗКА ДАННЫХ ДЛЯ МАППИНГА ---
        // 1. Загружаем подъезды
        const { data: existingEntrances } = await supabase
            .from('entrances')
            .select('id, block_id, number')
            .in('block_id', Array.from(involvedBlockIds));
        
        // 2. Загружаем этажи (чтобы мапить floor_1 -> UUID)
        const { data: dbFloors } = await supabase
            .from('floors')
            .select('id, block_id, floor_key')
            .in('block_id', Array.from(involvedBlockIds));

        const entranceMap = {}; 
        existingEntrances?.forEach(e => { entranceMap[`${e.block_id}_${e.number}`] = e.id; });

        // Создаем карту: {blockId}_{floorKey} -> UUID
        const floorUuidMap = {};
        dbFloors?.forEach(f => {
            floorUuidMap[`${f.block_id}_${f.floor_key}`] = f.id;
        });

        for (const [bId, bData] of Object.entries(buildingSpecificData)) {
            if (bData.floorData) {
                const floors = Object.values(bData.floorData).map(f => ({ 
                    id: f.id,
                    block_id: f.blockId,
                    floor_key: f.floorKey || f.floor_key || f.legacyKey || f.id,
                    // ... other fields
                    height: parseFloat(f.height)||0,
                    area_proj: parseFloat(f.areaProj)||0,
                    area_fact: parseFloat(f.areaFact)||0,
                    is_duplex: f.isDuplex||false,
                    // Fix: Add necessary flags
                    floor_type: f.type,
                    label: f.label,
                    index: f.index,
                    is_technical: !!f.flags?.isTechnical,
                    is_commercial: !!f.flags?.isCommercial,
                    is_stylobate: !!f.flags?.isStylobate,
                    is_basement: !!f.flags?.isBasement,
                    is_attic: !!f.flags?.isAttic,
                    is_loft: !!f.flags?.isLoft,
                    is_roof: !!f.flags?.isRoof
                }));
                
                if (floors.length) {
                    // Синхронная запись этажей (на случай если она не прошла в разделе 4)
                    const { error } = await supabase.from('floors').upsert(floors, { onConflict: 'block_id,floor_key' });
                    if (!error) {
                        // Обновляем карту ID, так как могли создаться новые
                        floors.forEach(f => {
                            floorUuidMap[`${f.block_id}_${f.floor_key}`] = f.id;
                        });
                    }
                }
            }

            const neededEntrances = new Set();
            const collect = (list) => Object.values(list).forEach(u => {
                const n = u.entrance || u.entranceIndex;
                if (u.blockId && n) neededEntrances.add(`${u.blockId}_${n}`);
            });
            if (bData.apartmentsData) collect(bData.apartmentsData);
            if (bData.parkingData) collect(bData.parkingData);
            if (bData.entrancesData) collect(bData.entrancesData);
            
            const newEnts = [];
            neededEntrances.forEach(key => {
                if (!entranceMap[key]) {
                    const [blId, num] = key.split('_');
                    const newId = crypto.randomUUID();
                    entranceMap[key] = newId; 
                    newEnts.push({ id: newId, block_id: blId, number: parseInt(num) });
                }
            });
            if (newEnts.length > 0) await supabase.from('entrances').upsert(newEnts);

            if (bData.entrancesData) {
                const matrixRows = [];
                const generatedUnits = [];
                const generatedMops = [];

                Object.values(bData.entrancesData).forEach(row => {
                    const entranceNumber = parseInt(row.entranceIndex || row.entrance || 0);
                    if (!row.blockId || !row.floorId || !entranceNumber) return;

                    // --- ИСПРАВЛЕННОЕ РАЗРЕШЕНИЕ ID ЭТАЖА ---
                    let realFloorId = null;

                    // 1. Пробуем найти через виртуальный ключ (floor_1 -> floor:1 -> UUID)
                    const floorKey = inferFloorKey(row.floorId);
                    const mappedUuid = floorUuidMap[`${row.blockId}_${floorKey}`];

                    if (mappedUuid) {
                        realFloorId = mappedUuid;
                    } else {
                        // 2. Если не нашли, проверяем: вдруг row.floorId это уже и есть реальный UUID?
                        // (Это происходит с данными, которые были загружены из БД и не менялись)
                        const isKnownUuid = Object.values(floorUuidMap).includes(row.floorId);
                        if (isKnownUuid) {
                            realFloorId = row.floorId;
                        } else if (row.floorId.length > 30) {
                             // 3. Если похож на UUID (длинный), верим на слово (fallback)
                             realFloorId = row.floorId;
                        }
                    }

                    if (!realFloorId) {
                        console.warn(`Floor UUID not found for ${row.floorId} (key: ${floorKey})`);
                        return; 
                    }
                    // ---------------------------

                    const apartmentsCount = Math.max(0, parseInt(row.apts) || 0);
                    const commercialCount = Math.max(0, parseInt(row.units) || 0);
                    const mopCount = Math.max(0, parseInt(row.mopQty) || 0);

                    matrixRows.push({
                        id: row.id || crypto.randomUUID(),
                        block_id: row.blockId,
                        floor_id: realFloorId, // Используем найденный UUID
                        entrance_number: entranceNumber,
                        apartments_count: apartmentsCount,
                        commercial_count: commercialCount,
                        mop_count: mopCount,
                        updated_at: new Date().toISOString()
                    });
                    
                    // ... (дальше код без изменений: const entId = ...) ...

                    const entId = entranceMap[`${row.blockId}_${entranceNumber}`] || null;
                    if (!entId) return;

                    for (let i = 1; i <= apartmentsCount; i++) {
                        generatedUnits.push({
                            id: crypto.randomUUID(),
                            floor_id: realFloorId, // Используем UUID
                            entrance_id: entId,
                            unit_type: 'flat',
                            number: `AUTO-F-${entranceNumber}-${i}`,
                            status: 'free',
                            total_area: 0,
                            living_area: 0,
                            useful_area: 0,
                            rooms_count: 0,
                            source_step: 'entrances'
                        });
                    }

                    for (let i = 1; i <= commercialCount; i++) {
                        generatedUnits.push({
                            id: crypto.randomUUID(),
                            floor_id: realFloorId, // Используем UUID
                            entrance_id: entId,
                            unit_type: 'office',
                            number: `AUTO-C-${entranceNumber}-${i}`,
                            status: 'free',
                            total_area: 0,
                            living_area: 0,
                            useful_area: 0,
                            rooms_count: 0,
                            source_step: 'entrances'
                        });
                    }

                    for (let i = 1; i <= mopCount; i++) {
                        generatedMops.push({
                            id: crypto.randomUUID(),
                            floor_id: realFloorId, // Используем UUID
                            entrance_id: entId,
                            type: 'Другое',
                            area: 0,
                            source_step: 'entrances'
                        });
                    }
                });

                if (matrixRows.length) {
                    const blockIdsToReplace = [...new Set(matrixRows.map(r => r.block_id))];
                    const floorIdsToReplace = [...new Set(matrixRows.map(r => r.floor_id))];

                    promises.push((async () => {
                        await supabase.from('entrance_matrix').delete().in('block_id', blockIdsToReplace).in('floor_id', floorIdsToReplace);
                        await supabase.from('entrance_matrix').upsert(matrixRows, { onConflict: 'block_id,floor_id,entrance_number' });

                        await supabase.from('units').delete().in('floor_id', floorIdsToReplace).eq('source_step', 'entrances');
                        await supabase.from('common_areas').delete().in('floor_id', floorIdsToReplace).eq('source_step', 'entrances');

                        if (generatedUnits.length) await supabase.from('units').insert(generatedUnits);
                        if (generatedMops.length) await supabase.from('common_areas').insert(generatedMops);
                    })());
                }
            }

            const unitsPayload = [];
            const roomsPayload = [];
            
            const processUnit = (u) => {
                const entKey = `${u.blockId}_${u.entrance || u.entranceIndex}`;
                // Также резолвим этаж для ручных юнитов
                const floorKey = inferFloorKey(u.floorId);
                const realFloorId = floorUuidMap[`${u.blockId}_${floorKey}`] || u.floorId;

                unitsPayload.push({
                    id: u.id,
                    floor_id: realFloorId,
                    entrance_id: entranceMap[entKey] || null,
                    number: u.num || u.number,
                    unit_type: u.type,
                    status: u.isSold ? 'sold' : 'free',
                    total_area: parseFloat(u.area)||0,
                    living_area: parseFloat(u.livingArea)||0,
                    useful_area: parseFloat(u.usefulArea)||0,
                    rooms_count: u.rooms||0,
                    cadastre_number: u.cadastreNumber,
                    source_step: 'manual'
                });
                if (u.explication) {
                    u.explication.forEach(r => {
                        roomsPayload.push({
                            id: r.id || crypto.randomUUID(), unit_id: u.id, room_type: r.type, name: r.label, 
                            area: parseFloat(r.area)||0, level: parseInt(r.level)||1
                        });
                    });
                }
            };

            if (bData.apartmentsData) Object.values(bData.apartmentsData).forEach(processUnit);
            if (bData.parkingData) Object.values(bData.parkingData).forEach(processUnit);

            if (unitsPayload.length) promises.push(supabase.from('units').upsert(unitsPayload));
            if (roomsPayload.length) promises.push(supabase.from('rooms').upsert(roomsPayload));

            if (bData.commonAreasData) {
                const mops = [];
                Object.values(bData.commonAreasData).flat().forEach(m => {
                    const entKey = `${m.blockId}_${m.entranceIndex}`;
                    const floorKey = inferFloorKey(m.floorId);
                    const realFloorId = floorUuidMap[`${m.blockId}_${floorKey}`] || m.floorId;

                    if (entranceMap[entKey] && realFloorId) {
                        mops.push({ id: m.id, floor_id: realFloorId, entrance_id: entranceMap[entKey], type: m.type, area: parseFloat(m.area)||0, source_step: 'manual' });
                    }
                });
                if (mops.length) promises.push(supabase.from('common_areas').upsert(mops));
            }
        }
    }

    await Promise.all(promises);
    
    // History
    if (generalData.applicationInfo && generalData.applicationInfo.history && generalData.applicationInfo.history.length > 0) {
         const lastItem = generalData.applicationInfo.history[0];
         if (new Date().getTime() - new Date(lastItem.date).getTime() < 10000) {
             if (appId) {
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
    }
  },

  createProjectFromApplication: async (scope, app, user) => {
      if (!scope) return null;
      const pId = crypto.randomUUID();
      const appId = crypto.randomUUID();
      await supabase.from('projects').insert({
          id: pId, scope_id: scope, name: `ЖК по заявке ${app.externalId}`, address: app.address, cadastre_number: app.cadastre, construction_status: 'Проектный'
      });
      await supabase.from('applications').insert({
          id: appId, project_id: pId, scope_id: scope, internal_number: app.id, external_source: app.source, external_id: app.externalId, applicant: app.applicant, submission_date: app.submissionDate, assignee_name: user.name, status: 'DRAFT'
      });
      return pId;
  },

  deleteProject: async (scope, id) => {
      if (!scope) return;
      await supabase.from('projects').delete().eq('id', id).eq('scope_id', scope);
  },
  
  deleteBuilding: async (scope, pId, bId, extraData = {}) => {
      await supabase.from('buildings').delete().eq('id', bId);
  },

  // Адаптеры для обратной совместимости с ProjectContext
  saveUnits: async (scope, projectId, buildingId, units) => {
      return RegistryService.saveData(scope, projectId, {
          buildingSpecificData: {
              [buildingId]: { apartmentsData: units }
          }
      });
  },
  
  saveFloors: async (scope, projectId, buildingId, floors) => {
      return RegistryService.saveData(scope, projectId, {
          buildingSpecificData: {
              [buildingId]: { floorData: floors }
          }
      });
  },
  
  saveParkingPlaces: async (scope, projectId, buildingId, parking) => {
      return RegistryService.saveData(scope, projectId, {
          buildingSpecificData: {
              [buildingId]: { parkingData: parking }
          }
      });
  },
  
  getExternalApplications: async () => [{
      id: '10239', source: 'EPIGU', externalId: 'EP-2026-9912', applicant: 'ООО "Golden House"', submissionDate: new Date().toISOString(), cadastre: '11:01:02:03:0044', address: 'г. Ташкент, Шайхантахурский р-н, ул. Навои, 12'
  }]
};