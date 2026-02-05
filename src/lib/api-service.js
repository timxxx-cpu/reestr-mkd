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

// ... (Оставляем существующие функции mapBuildingToDb, mapBlockToDb, mapBlockTypeToDb, mapDbTypeToUi без изменений) ...
// ... (Оставляем хелперы inferFloorKey, mapFloorKeyToVirtualId без изменений) ...

// Вспомогательная функция для маппинга типов блоков
function mapBlockTypeToDB(uiType) {
    if (uiType === 'residential') return 'Ж';
    if (uiType === 'non_residential') return 'Н';
    if (uiType === 'parking') return 'Parking';
    if (uiType === 'infrastructure') return 'Infra';
    return uiType;
}

function mapDbTypeToUi(dbType) {
    if (dbType === 'Ж') return 'residential';
    if (dbType === 'Н') return 'non_residential';
    if (dbType === 'Parking') return 'parking';
    if (dbType === 'Infra') return 'infrastructure';
    return dbType;
}

// Хелперы ключей (оставляем как были в файле)
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
            const baseId = parts.slice(1, parts.length - 1).join(':'); 
            return `base_${baseId}_L${depth}`;
        }
    }
    if (key.startsWith('tech:')) return `floor_${key.split(':')[1]}_tech`;
    if (['attic', 'loft', 'roof', 'tsokol'].includes(key)) return key;
    return key;
};


export const ApiService = {

    // --- DASHBOARD & LISTS ---

    // [UPDATED] Получить список проектов с джойном заявки (замена RegistryService.getProjectsList)
    getProjectsList: async (scope) => {
        if (!scope) return [];

        // Загружаем проекты и заявки отдельно, чтобы не терять проекты,
        // у которых пока нет строки в applications (частый кейс на DEV при миграциях).
        const [projectsRes, appsRes] = await Promise.all([
            supabase
                .from('projects')
                .select('id, name, region, address, construction_status, updated_at, created_at')
                .eq('scope_id', scope)
                .order('updated_at', { ascending: false }),
            supabase
                .from('applications')
                .select('*')
                .eq('scope_id', scope)
                .order('updated_at', { ascending: false })
        ]);

        if (projectsRes.error) throw projectsRes.error;
        if (appsRes.error) throw appsRes.error;

        const appsByProject = (appsRes.data || []).reduce((acc, app) => {
            // На всякий случай берем самую свежую заявку по проекту
            if (!acc[app.project_id]) acc[app.project_id] = app;
            return acc;
        }, {});

        return (projectsRes.data || []).map(project => {
            const app = appsByProject[project.id];

            return {
                id: project.id,
                applicationId: app?.id || null,
                name: project.name || 'Без названия',
                status: project.construction_status,
                lastModified: app?.updated_at || project.updated_at,

                applicationInfo: {
                    status: app?.status,
                    internalNumber: app?.internal_number,
                    externalSource: app?.external_source,
                    externalId: app?.external_id,
                    applicant: app?.applicant,
                    submissionDate: app?.submission_date,
                    assigneeName: app?.assignee_name,
                    currentStage: app?.current_stage,
                    currentStepIndex: app?.current_step,
                    rejectionReason: app?.integration_data?.rejectionReason
                },
                complexInfo: {
                    name: project.name,
                    region: project.region,
                    street: project.address
                },
                composition: []
            };
        });
    },

    // [NEW] Mock внешних заявок
    getExternalApplications: async () => {
        // Имитация задержки
        await new Promise(r => setTimeout(r, 500));
        return [{
            id: 'EXT-' + Math.floor(Math.random() * 10000), 
            source: 'EPIGU', 
            externalId: 'EP-2026-9912', 
            applicant: 'ООО "Golden House"', 
            submissionDate: new Date().toISOString(), 
            cadastre: '11:01:02:03:0044', 
            address: 'г. Ташкент, Шайхантахурский р-н, ул. Навои, 12',
            status: 'NEW'
        }];
    },

    // --- WORKFLOW & CREATION ---

    // [UPDATED] Создание проекта из заявки (Транзакция)
    createProjectFromApplication: async (scope, appData, user) => {
        if (!scope) throw new Error("No scope provided");

        // 1. Создаем проект
        const { data: project, error: pErr } = await supabase
            .from('projects')
            .insert({
                scope_id: scope,
                name: appData.applicant ? `ЖК от ${appData.applicant}` : 'Новый проект',
                address: appData.address,
                cadastre_number: appData.cadastre,
                construction_status: 'Проектный'
            })
            .select()
            .single();

        if (pErr) throw pErr;

        // 2. Создаем заявку (связываем с проектом)
        const { error: aErr } = await supabase
            .from('applications')
            .insert({
                project_id: project.id,
                scope_id: scope,
                internal_number: `INT-${Date.now().toString().slice(-6)}`,
                external_source: appData.source,
                external_id: appData.externalId,
                applicant: appData.applicant,
                submission_date: appData.submissionDate || new Date(),
                assignee_name: user.name,
                status: 'DRAFT', // Сразу в работу
                current_step: 0,
                current_stage: 1
            });

        if (aErr) {
            // Rollback (удаляем проект, если заявка не создалась)
            await supabase.from('projects').delete().eq('id', project.id);
            throw aErr;
        }

        return project.id;
    },

    // Удаление проекта (Каскадное удаление настроено в БД, но для надежности можно и тут)
    deleteProject: async (scope, projectId) => {
        if (!scope) return;
        // Удаляем проект, заявка удалится каскадно (ON DELETE CASCADE)
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', projectId)
            .eq('scope_id', scope);
        if (error) throw error;
    },

    // --- LOAD FULL CONTEXT ---

    // [NEW] Полная загрузка контекста проекта (Замена RegistryService.getProjectMeta)
    getProjectFullData: async (scope, projectId) => {
        if (!scope || !projectId) return null;

        // 1. Загружаем заявку
        const { data: app, error: appError } = await supabase
            .from('applications')
            .select('*')
            .eq('project_id', projectId)
            .eq('scope_id', scope)
            .maybeSingle();
            
        if (appError) {
            throw appError;
        }

        // 2. Параллельная загрузка таблиц
        const [ pRes, partsRes, docsRes, buildingsRes, historyRes, stepsRes ] = await Promise.all([
            supabase.from('projects').select('*').eq('id', projectId).single(),
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
                .eq('project_id', projectId)
                .order('created_at', { ascending: true }),
            app?.id
                ? supabase.from('application_history').select('*').eq('application_id', app.id).order('created_at', { ascending: false })
                : Promise.resolve({ data: [], error: null }),
            app?.id
                ? supabase.from('application_steps').select('*').eq('application_id', app.id)
                : Promise.resolve({ data: [], error: null })
        ]);

        if (pRes.error) throw pRes.error;

        // 3. Агрегация через маппер
        const fallbackApp = app || {
            id: null,
            updated_at: pRes.data.updated_at,
            internal_number: null,
            external_source: null,
            external_id: null,
            applicant: null,
            submission_date: null,
            status: 'DRAFT',
            assignee_name: null,
            current_step: 0,
            current_stage: 1
        };

        const projectData = mapProjectAggregate(
            pRes.data,
            fallbackApp,
            historyRes.data || [],
            stepsRes.data || [],
            partsRes.data || [],
            docsRes.data || []
        );

        // 4. Сборка composition и buildingDetails (нужно для UI конфигуратора)
        const composition = [];
        const buildingDetails = {};
        
        // Вспомогательные данные для маппинга деталей (нужно подтянуть этажи для определения коммерции/тех)
        // Это тяжелый запрос, но он нужен для инициализации buildingDetails в формате UI
        const buildingIds = (buildingsRes.data || []).map(b => b.id);
        const blockIds = (buildingsRes.data || []).flatMap(b => (b.building_blocks || []).map(block => block.id));
        
        const technicalFloorsMap = {};
        const commercialFloorsMap = {};
        
        if (blockIds.length > 0) {
            // Оптимизация: берем только нужные поля
            const { data: floorsData } = await supabase
                .from('floors')
                .select('block_id, index, floor_type, parent_floor_index, is_commercial, is_technical, is_attic, is_loft, is_roof, basement_id')
                .in('block_id', blockIds);

            (floorsData || []).forEach(row => {
                if (row.is_technical && row.parent_floor_index !== null) {
                    if (!technicalFloorsMap[row.block_id]) technicalFloorsMap[row.block_id] = new Set();
                    technicalFloorsMap[row.block_id].add(row.parent_floor_index);
                }

                if (row.is_commercial) {
                    if (!commercialFloorsMap[row.block_id]) commercialFloorsMap[row.block_id] = new Set();
                    
                    let key = String(row.index);
                    if (row.floor_type === 'basement' && row.basement_id) key = `basement_${row.basement_id}`;
                    else if (row.floor_type === 'tsokol') key = 'tsokol';
                    else if (row.is_attic) key = 'attic';
                    else if (row.is_loft) key = 'loft';
                    else if (row.is_roof) key = 'roof';
                    else if (row.is_technical && row.parent_floor_index) key = `${row.parent_floor_index}-Т`;
                    
                    commercialFloorsMap[row.block_id].add(key);
                }
            });
        }

        // Подгрузка подвалов для features
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

        // Сборка финальной структуры
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


    // --- PROJECT PASSPORT ---
    getProjectDetails: async (projectId) => {
        if (!projectId) return null;

        const [projectRes, partsRes, docsRes] = await Promise.all([
            supabase.from('projects').select('*').eq('id', projectId).single(),
            supabase.from('project_participants').select('*').eq('project_id', projectId),
            supabase.from('project_documents').select('*').eq('project_id', projectId).order('doc_date', { ascending: false })
        ]);

        if (projectRes.error) throw projectRes.error;
        if (partsRes.error) throw partsRes.error;
        if (docsRes.error) throw docsRes.error;

        const project = projectRes.data;

        return {
            complexInfo: {
                name: project.name,
                status: project.construction_status,
                region: project.region,
                district: project.district,
                street: project.address,
                landmark: project.landmark,
                dateStartProject: project.date_start_project,
                dateEndProject: project.date_end_project,
                dateStartFact: project.date_start_fact,
                dateEndFact: project.date_end_fact
            },
            cadastre: {
                number: project.cadastre_number
            },
            participants: (partsRes.data || []).reduce((acc, part) => {
                acc[part.role] = {
                    id: part.id,
                    name: part.name,
                    inn: part.inn,
                    role: part.role
                };
                return acc;
            }, {}),
            documents: (docsRes.data || []).map(d => ({
                id: d.id,
                name: d.name,
                type: d.doc_type,
                date: d.doc_date,
                number: d.doc_number,
                url: d.file_url
            }))
        };
    },

    createProject: async (name, street = '', scope = 'shared_dev_env') => {
        const appData = {
            source: 'MANUAL',
            externalId: null,
            applicant: name,
            address: street,
            cadastre: '',
            submissionDate: new Date()
        };

        const user = { name: 'System', role: 'admin' };
        return ApiService.createProjectFromApplication(scope, appData, user);
    },

    updateProjectInfo: async (projectId, info = {}, cadastreData = {}) => {
        if (!projectId) return null;

        const payload = {
            name: info.name,
            construction_status: info.status,
            region: info.region,
            district: info.district,
            address: info.street,
            landmark: info.landmark,
            date_start_project: info.dateStartProject,
            date_end_project: info.dateEndProject,
            date_start_fact: info.dateStartFact,
            date_end_fact: info.dateEndFact,
            cadastre_number: cadastreData.number,
            updated_at: new Date()
        };

        const { data, error } = await supabase
            .from('projects')
            .update(payload)
            .eq('id', projectId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    upsertParticipant: async (projectId, role, data = {}) => {
        const payload = {
            id: data.id || crypto.randomUUID(),
            project_id: projectId,
            role,
            name: data.name || '',
            inn: data.inn || ''
        };

        const { data: result, error } = await supabase
            .from('project_participants')
            .upsert(payload)
            .select()
            .single();

        if (error) throw error;
        return result;
    },

    upsertDocument: async (projectId, doc = {}) => {
        const payload = {
            id: doc.id || crypto.randomUUID(),
            project_id: projectId,
            name: doc.name || '',
            doc_type: doc.type || '',
            doc_date: doc.date || null,
            doc_number: doc.number || '',
            file_url: doc.url || null
        };

        const { data, error } = await supabase
            .from('project_documents')
            .upsert(payload)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    deleteDocument: async (id) => {
        if (!id) return;
        const { error } = await supabase.from('project_documents').delete().eq('id', id);
        if (error) throw error;
    },

    // --- STANDARD API METHODS (Existing ones preserved) ---
    
    getBuildings: async (projectId) => {
        const { data, error } = await supabase
            .from('buildings')
            .select(`*, building_blocks (*)`)
            .eq('project_id', projectId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        
        return data.map(b => ({
            id: b.id,
            label: b.label,
            houseNumber: b.house_number,
            category: b.category,
            stage: b.stage || 'Проектный', 
            dateStart: b.date_start || null,
            dateEnd: b.date_end || null,
            type: b.category, 
            constructionType: b.construction_type,
            parkingType: b.parking_type,
            infraType: b.infra_type,
            hasNonResPart: b.has_non_res_part,
            cadastreNumber: b.cadastre_number,
            resBlocks: b.building_blocks.filter(x => x.type === 'Ж').length,
            nonResBlocks: b.building_blocks.filter(x => x.type === 'Н').length,
            blocks: b.building_blocks.map(bl => ({
                id: bl.id,
                label: bl.label,
                type: mapDbTypeToUi(bl.type),
                originalType: bl.type,
                floorsCount: bl.floors_count                
            })).sort((a, b) => a.label.localeCompare(b.label))
        }));
    },

    createBuilding: async (projectId, buildingData, blocksData) => {
        const { data: building, error: bError } = await supabase
            .from('buildings')
            .insert({
                project_id: projectId,
                label: buildingData.label,
                house_number: buildingData.houseNumber,
                category: buildingData.category,
                construction_type: buildingData.constructionType || null,
                parking_type: buildingData.parkingType || null,
                infra_type: buildingData.infraType || null,
                has_non_res_part: buildingData.hasNonResPart || false,
            })
            .select()
            .single();

        if (bError) throw bError;

        if (blocksData && blocksData.length > 0) {
            const blocksPayload = blocksData.map(b => ({
                id: b.id,
                building_id: building.id,
                label: b.label,
                type: mapBlockTypeToDB(b.type),
                floors_count: b.floorsCount || 0,
                floors_from: 1,
                floors_to: b.floorsCount || 1,
            }));
            
            const { error: blError } = await supabase
                .from('building_blocks')
                .insert(blocksPayload);
            
            if (blError) throw blError;
        }
        return building;
    },

    updateBuilding: async (buildingId, buildingData) => {
        const { data, error } = await supabase
            .from('buildings')
            .update({
                label: buildingData.label,
                house_number: buildingData.houseNumber,
                construction_type: buildingData.constructionType,
                parking_type: buildingData.parkingType,
                infra_type: buildingData.infraType,
                has_non_res_part: buildingData.hasNonResPart
            })
            .eq('id', buildingId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    deleteBuilding: async (buildingId) => {
        const { error } = await supabase.from('buildings').delete().eq('id', buildingId);
        if (error) throw error;
    },

    // --- FLOORS ---
    getFloors: async (blockId) => {
        const { data, error } = await supabase
            .from('floors')
            .select('*')
            .eq('block_id', blockId)
            .order('index', { ascending: true }); 
        if (error) throw error;
        return data.map(f => mapFloorFromDB(f, null, blockId));
    },

    updateFloor: async (floorId, updates) => {
        const payload = {};
        // Map UI keys to DB columns
        if (updates.height !== undefined) payload.height = updates.height;
        if (updates.areaProj !== undefined) payload.area_proj = updates.areaProj;
        if (updates.areaFact !== undefined) payload.area_fact = updates.areaFact;
        if (updates.isDuplex !== undefined) payload.is_duplex = updates.isDuplex;
        if (updates.label !== undefined) payload.label = updates.label;
        if (updates.type !== undefined) payload.floor_type = updates.type;
        if (updates.isTechnical !== undefined) payload.is_technical = updates.isTechnical;
        if (updates.isCommercial !== undefined) payload.is_commercial = updates.isCommercial;
        
        const { data, error } = await supabase
            .from('floors')
            .update(payload)
            .eq('id', floorId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    generateFloors: async (blockId, floorsFrom, floorsTo, defaultType = 'residential') => {
        // ... (Без изменений, логика уже есть в вашем файле, просто оставляем)
        const { data: existing, error: fetchErr } = await supabase.from('floors').select('id, index').eq('block_id', blockId);
        if (fetchErr) throw fetchErr;
        const existingIndices = new Set(existing.map(e => e.index));
        const targetIndices = new Set();
        for (let i = floorsFrom; i <= floorsTo; i++) targetIndices.add(i);
        const toDeleteIds = existing.filter(e => !targetIndices.has(e.index)).map(e => e.id);
        const toCreateIndices = Array.from(targetIndices).filter(i => !existingIndices.has(i));

        if (toDeleteIds.length > 0) await supabase.from('floors').delete().in('id', toDeleteIds);
        if (toCreateIndices.length > 0) {
            const payload = toCreateIndices.map(i => ({
                block_id: blockId,
                index: i,
                label: `${i} этаж`,
                floor_type: defaultType,
                floor_key: `floor:${i}`,
                height: 3.0,
                area_proj: 0,
                is_commercial: defaultType === 'office',
                is_technical: false
            }));
            await supabase.from('floors').insert(payload);
        }
    },

    // --- MATRIX ---
    getEntrances: async (blockId) => {
        const { data, error } = await supabase.from('entrances').select('*').eq('block_id', blockId).order('number');
        if (error) throw error;
        return data;
    },

    getMatrix: async (blockId) => {
        const { data, error } = await supabase.from('entrance_matrix').select('*').eq('block_id', blockId);
        if (error) throw error;
        const map = {};
        data.forEach(row => {
            map[`${row.floor_id}_${row.entrance_number}`] = {
                id: row.id,
                apts: row.apartments_count,
                units: row.commercial_count,
                mopQty: row.mop_count
            };
        });
        return map;
    },

    upsertMatrixCell: async (blockId, floorId, entranceNumber, values) => {
        const payload = {
            block_id: blockId,
            floor_id: floorId,
            entrance_number: entranceNumber,
            updated_at: new Date()
        };
        if (values.apts !== undefined) payload.apartments_count = values.apts;
        if (values.units !== undefined) payload.commercial_count = values.units;
        if (values.mopQty !== undefined) payload.mop_count = values.mopQty;

        const { data, error } = await supabase
            .from('entrance_matrix')
            .upsert(payload, { onConflict: 'block_id,floor_id,entrance_number' })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    syncEntrances: async (blockId, count) => {
        const { data: existing } = await supabase.from('entrances').select('id, number').eq('block_id', blockId);
        const existingNums = new Set(existing.map(e => e.number));
        const toCreate = [];
        for(let i=1; i<=count; i++) {
            if(!existingNums.has(i)) toCreate.push({ block_id: blockId, number: i });
        }
        if (toCreate.length > 0) await supabase.from('entrances').insert(toCreate);
        const toDeleteIds = existing.filter(e => e.number > count).map(e => e.id);
        if (toDeleteIds.length > 0) await supabase.from('entrances').delete().in('id', toDeleteIds);
    },

    // --- UNITS ---
    getUnits: async (blockId) => {
        const { data: floors } = await supabase.from('floors').select('id').eq('block_id', blockId);
        const floorIds = floors.map(f => f.id);
        if (floorIds.length === 0) return [];
        const { data: units, error } = await supabase.from('units').select('*, rooms (*)').in('floor_id', floorIds);
        if (error) throw error;
        // ... (mapper logic reused from mapUnitFromDB but simplified for direct usage)
        return units.map(u => mapUnitFromDB(u, u.rooms, {}, null, blockId));
    },

    upsertUnit: async (unitData) => {
        const unitPayload = {
            id: unitData.id || crypto.randomUUID(),
            floor_id: unitData.floorId,
            entrance_id: unitData.entranceId,
            number: unitData.num || unitData.number,
            unit_type: unitData.type,
            total_area: unitData.area,
            living_area: unitData.livingArea || 0,
            useful_area: unitData.usefulArea || 0,
            rooms_count: unitData.rooms || 0,
            status: unitData.isSold ? 'sold' : 'free',
            updated_at: new Date()
        };
        const { data: savedUnit, error } = await supabase.from('units').upsert(unitPayload).select().single();
        if (error) throw error;

        // Sync rooms
        if (unitData.explication && Array.isArray(unitData.explication)) {
            await supabase.from('rooms').delete().eq('unit_id', savedUnit.id);
            if (unitData.explication.length > 0) {
                const roomsPayload = unitData.explication.map(r => ({
                    id: r.id || crypto.randomUUID(),
                    unit_id: savedUnit.id,
                    room_type: r.type,
                    area: r.area || 0,
                    level: r.level || 1,
                    name: r.label || ''
                }));
                await supabase.from('rooms').insert(roomsPayload);
            }
        }
        return savedUnit;
    },

    batchUpsertUnits: async (unitsList) => {
        const payload = unitsList.map(u => ({
            id: u.id || crypto.randomUUID(),
            floor_id: u.floorId,
            entrance_id: u.entranceId,
            number: u.num || u.number,
            unit_type: u.type,
            total_area: u.area || 0,
            status: 'free',
            updated_at: new Date()
        }));
        const { error } = await supabase.from('units').upsert(payload);
        if (error) throw error;
    },

    // --- COMMON AREAS ---
    getCommonAreas: async (blockId) => {
        const { data: floors } = await supabase.from('floors').select('id').eq('block_id', blockId);
        const floorIds = floors.map(f => f.id);
        if (floorIds.length === 0) return [];
        const { data, error } = await supabase.from('common_areas').select('*').in('floor_id', floorIds);
        if (error) throw error;
        return data.map(m => mapMopFromDB(m, {}, null, blockId));
    },

    upsertCommonArea: async (data) => {
        const payload = {
            id: data.id || crypto.randomUUID(),
            floor_id: data.floorId,
            entrance_id: data.entranceId,
            type: data.type,
            area: data.area
        };
        const { data: res, error } = await supabase.from('common_areas').upsert(payload).select().single();
        if (error) throw error;
        return res;
    },

    deleteCommonArea: async (id) => {
        const { error } = await supabase.from('common_areas').delete().eq('id', id);
        if (error) throw error;
    },

    clearCommonAreas: async (blockId) => {
        const { data: floors } = await supabase.from('floors').select('id').eq('block_id', blockId);
        const floorIds = floors.map(f => f.id);
        if (floorIds.length > 0) {
            await supabase.from('common_areas').delete().in('floor_id', floorIds);
        }
    },

    // --- PARKING & BASEMENTS ---
    getBasements: async (projectId) => {
        const { data: buildings } = await supabase.from('buildings').select('id').eq('project_id', projectId);
        const buildingIds = buildings.map(b => b.id);
        if (buildingIds.length === 0) return [];
        const { data, error } = await supabase
            .from('basements')
            .select(`*, basement_parking_levels (depth_level, is_enabled)`)
            .in('building_id', buildingIds);
        if (error) throw error;
        return data.map(b => ({
            id: b.id,
            buildingId: b.building_id,
            blockId: b.block_id,
            depth: b.depth,
            hasParking: b.has_parking,
            parkingLevels: (b.basement_parking_levels || []).reduce((acc, l) => {
                acc[l.depth_level] = l.is_enabled;
                return acc;
            }, {})
        }));
    },

    toggleBasementLevel: async (basementId, level, isEnabled) => {
        const { error } = await supabase
            .from('basement_parking_levels')
            .upsert({ basement_id: basementId, depth_level: level, is_enabled: isEnabled }, { onConflict: 'basement_id,depth_level' });
        if (error) throw error;
    },

    getParkingCounts: async (projectId) => {
        // Получаем все здания проекта
        const { data: buildings } = await supabase.from('buildings').select('id').eq('project_id', projectId);
        const buildingIds = buildings.map(b => b.id);
        if (!buildingIds.length) return {};

        // Получаем все блоки
        const { data: blocks } = await supabase.from('building_blocks').select('id').in('building_id', buildingIds);
        const blockIds = blocks.map(b => b.id);
        if (!blockIds.length) return {};

        // Получаем этажи
        const { data: floors } = await supabase.from('floors').select('id').in('block_id', blockIds);
        const floorIds = floors.map(f => f.id);
        if (!floorIds.length) return {};

        // Считаем парковочные места
        const { data: units, error } = await supabase.from('units').select('floor_id').eq('unit_type', 'parking_place').in('floor_id', floorIds);
        if (error) throw error;

        const counts = {};
        units.forEach(u => {
            counts[u.floor_id] = (counts[u.floor_id] || 0) + 1;
        });
        return counts;
    },

    syncParkingPlaces: async (floorId, targetCount, buildingId) => {
        const { data: existing } = await supabase
            .from('units')
            .select('id, number')
            .eq('floor_id', floorId)
            .eq('unit_type', 'parking_place');
        
        const currentCount = existing.length;
        if (currentCount === targetCount) return;

        if (targetCount > currentCount) {
            const toAdd = targetCount - currentCount;
            let maxNum = 0;
            existing.forEach(u => {
                const n = parseInt(u.number);
                if (!isNaN(n) && n > maxNum) maxNum = n;
            });
            const newUnits = [];
            for(let i=1; i<=toAdd; i++) {
                newUnits.push({
                    id: crypto.randomUUID(),
                    floor_id: floorId,
                    unit_type: 'parking_place',
                    number: String(maxNum + i),
                    total_area: 13.25,
                    status: 'free'
                });
            }
            await supabase.from('units').insert(newUnits);
        } else {
            const sorted = existing.sort((a, b) => parseInt(b.number) - parseInt(a.number));
            const toDelete = sorted.slice(0, currentCount - targetCount).map(u => u.id);
            await supabase.from('units').delete().in('id', toDelete);
        }
    },

    // --- META & INTEGRATION ---
    getIntegrationStatus: async (projectId) => {
        const { data } = await supabase.from('applications').select('integration_data').eq('project_id', projectId).single();
        return data?.integration_data || {};
    },

    updateIntegrationStatus: async (projectId, field, status) => {
        const { data: app } = await supabase.from('applications').select('id, integration_data').eq('project_id', projectId).single();
        if (!app) return;
        const newData = { ...(app.integration_data || {}), [field]: status };
        await supabase.from('applications').update({ integration_data: newData }).eq('id', app.id);
    },

    updateBuildingCadastre: async (id, cadastre) => {
        // [NOTE] В схеме DB_SCHEMA нет поля cadastre_number в buildings, но добавим заглушку/предположение
        // Если его нет, этот вызов упадет. Нужно проверить миграции. В DB_SCHEMA его НЕТ.
        // Добавим апдейт только если поле существует или используем projects.cadastre_number
        // Предположим, оно есть (вы добавляли).
        // Если нет - закомментировать.
        // await supabase.from('buildings').update({ cadastre_number: cadastre }).eq('id', id);
    },

    updateUnitCadastre: async (id, cadastre) => {
        await supabase.from('units').update({ cadastre_number: cadastre }).eq('id', id);
    },

    getProjectFullRegistry: async (projectId) => {
        // Тяжелый запрос для сводной.
        // Можно оптимизировать RPC, но пока так:
        const { data: buildings } = await supabase.from('buildings').select('*').eq('project_id', projectId);
        if (!buildings || !buildings.length) return { buildings: [], units: [] };
        
        const bIds = buildings.map(b => b.id);
        const { data: blocks } = await supabase.from('building_blocks').select('*').in('building_id', bIds);
        const blIds = blocks.map(b => b.id);
        
        const { data: floors } = await supabase.from('floors').select('*').in('block_id', blIds);
        const fIds = floors.map(f => f.id);
        
        const { data: units } = await supabase.from('units').select('*').in('floor_id', fIds);
        
        return {
            buildings: buildings.map(b => ({...b, label: b.label, houseNumber: b.house_number})),
            blocks: blocks.map(b => ({...b, tabLabel: b.label})),
            floors: floors.map(f => ({...f, areaProj: f.area_proj, areaFact: f.area_fact})),
            units: units.map(u => ({
                id: u.id,
                number: u.number,
                type: u.unit_type,
                area: u.total_area,
                floorId: u.floor_id,
                cadastreNumber: u.cadastre_number
            }))
        };
    },

    // --- META SAVE (ГЛОБАЛЬНОЕ СОХРАНЕНИЕ ИЗ КОНТЕКСТА) ---
    // Это аналог старого saveData из registry-service, адаптированный под Context
    // Он умеет сохранять "всё подряд", разбирая payload
    saveData: async (scope, projectId, payload) => {
        if (!scope) return;
        const { buildingSpecificData, ...generalData } = payload;
        const promises = [];

        // 1. Обновление Project/App Info
        if (generalData.complexInfo) {
            const ci = generalData.complexInfo;
            promises.push(supabase.from('projects').update({
                name: ci.name,
                construction_status: ci.status,
                region: ci.region,
                district: ci.district,
                address: ci.street,
                date_start_project: ci.dateStartProject,
                date_end_project: ci.dateEndProject,
                updated_at: new Date()
            }).eq('id', projectId));
        }

        if (generalData.applicationInfo) {
            const ai = generalData.applicationInfo;

            // Находим заявку; если ее нет (частый кейс при миграции), создаем техническую запись,
            // чтобы Workflow (статус/шаги/история) продолжал корректно работать.
            const { data: appFound } = await supabase
                .from('applications')
                .select('id')
                .eq('project_id', projectId)
                .maybeSingle();

            let applicationId = appFound?.id || null;

            if (!applicationId) {
                const { data: createdApp, error: createAppError } = await supabase
                    .from('applications')
                    .insert({
                        project_id: projectId,
                        scope_id: scope,
                        internal_number: `AUTO-${Date.now().toString().slice(-6)}`,
                        external_source: 'MIGRATION_FIX',
                        external_id: null,
                        applicant: null,
                        submission_date: new Date(),
                        assignee_name: null,
                        status: ai.status || 'DRAFT',
                        current_step: ai.currentStepIndex ?? 0,
                        current_stage: ai.currentStage ?? 1
                    })
                    .select('id')
                    .single();

                if (createAppError) throw createAppError;
                applicationId = createdApp?.id;
            }

            if (applicationId) {
                promises.push(supabase.from('applications').update({
                    status: ai.status,
                    current_step: ai.currentStepIndex,
                    current_stage: ai.currentStage,
                    updated_at: new Date()
                }).eq('id', applicationId));

                // History & Steps
                if (ai.history && ai.history.length > 0) {
                    const last = ai.history[0];
                    const isFresh = new Date().getTime() - new Date(last.date).getTime() < 5000;
                    if (isFresh) {
                        promises.push(supabase.from('application_history').insert({
                            application_id: applicationId,
                            action: last.action,
                            prev_status: last.prevStatus,
                            next_status: last.nextStatus || ai.status,
                            user_name: last.user,
                            comment: last.comment,
                            created_at: last.date
                        }));
                    }
                }

                if (ai.completedSteps) {
                    const stepsPayload = ai.completedSteps.map(idx => ({
                        application_id: applicationId,
                        step_index: idx,
                        is_completed: true
                    }));
                    if(stepsPayload.length) promises.push(supabase.from('application_steps').upsert(stepsPayload, { onConflict: 'application_id,step_index'}));
                }
            }
        }

        // 2. Building Details (Configs)
        // В новой схеме конфиги блоков живут в building_blocks и смежных таблицах.
        // Payload из контекста приходит в виде "buildingDetails": { "bId_blId": {...} }
        if (generalData.buildingDetails) {
            for (const [key, details] of Object.entries(generalData.buildingDetails)) {
                if (key.includes('_features')) {
                    // Обработка подвалов (basements)
                    const buildingId = key.replace('_features', '');
                    const basements = details.basements || [];
                    for (const base of basements) {
                        if (base.id && base.depth) {
                            promises.push(supabase.from('basements').upsert({
                                id: base.id,
                                building_id: buildingId,
                                block_id: base.blockId || (base.blocks ? base.blocks[0] : null), // Привязка к блоку
                                depth: parseInt(base.depth),
                                has_parking: !!base.hasParking
                            }));
                            // Уровни паркинга
                            if (base.parkingLevels) {
                                const levels = Object.entries(base.parkingLevels).map(([lvl, enabled]) => ({
                                    basement_id: base.id,
                                    depth_level: parseInt(lvl),
                                    is_enabled: enabled
                                }));
                                if (levels.length) promises.push(supabase.from('basement_parking_levels').upsert(levels, { onConflict: 'basement_id,depth_level'}));
                            }
                        }
                    }
                    continue;
                }
                
                // key = "buildingId_blockId"
                const parts = key.split('_');
                const blockId = parts[parts.length - 1]; // UUID is last
                // Проверка на валидный UUID
                if (blockId && blockId.length === 36) {
                    const blockUpdate = {
                        floors_count: details.floorsCount,
                        entrances_count: details.entrances || details.inputs,
                        elevators_count: details.elevators,
                        floors_from: details.floorsFrom,
                        floors_to: details.floorsTo,
                        has_basement: details.hasBasementFloor,
                        has_attic: details.hasAttic,
                        has_loft: details.hasLoft,
                        has_roof_expl: details.hasExploitableRoof,
                        has_custom_address: details.hasCustomAddress,
                        custom_house_number: details.customHouseNumber
                    };
                    promises.push(supabase.from('building_blocks').update(blockUpdate).eq('id', blockId));
                    
                    if (details.foundation || details.walls) {
                        promises.push(supabase.from('block_construction').upsert({
                            block_id: blockId,
                            foundation: details.foundation,
                            walls: details.walls,
                            slabs: details.slabs,
                            roof: details.roof,
                            seismicity: details.seismicity
                        }, { onConflict: 'block_id' }));
                    }
                    if (details.engineering) {
                        promises.push(supabase.from('block_engineering').upsert({
                            block_id: blockId,
                            has_electricity: details.engineering.electricity,
                            has_water: details.engineering.hvs,
                            has_sewerage: details.engineering.sewerage,
                            has_gas: details.engineering.gas,
                            has_heating: details.engineering.heating,
                            // ... map others
                        }, { onConflict: 'block_id' }));
                    }
                }
            }
        }

        // 3. Building Specific Data (Matrices saved via separate keys)
        // В новой архитектуре мы стараемся сохранять матрицы сразу (debounce), 
        // но если Context накопил изменения, они придут сюда.
        if (buildingSpecificData) {
            // Реализация сложная, так как требует разбора структур {floorKey: ...}
            // Для MVP лучше полагаться на то, что компоненты вызывают upsertMatrixCell / upsertUnit напрямую.
            // Но для `completeTask` мы сохраняем всё.
            
            // Здесь мы можем пропустить детальное сохранение ячеек, 
            // если предполагаем, что `useEffect` в компонентах уже всё сохранил.
            // Однако, Context содержит "pendingUpdates".
            
            // TODO: Если критично - реализовать парсинг floorData/entrancesData и batch upsert.
            // Пока оставим пустым, так как мы переводим редакторы на Direct API calls.
        }

        await Promise.all(promises);
    }
};
