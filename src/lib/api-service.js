import { supabase } from './supabase';

// --- Mappers ---

const mapBuildingToDb = (data, projectId) => ({
    project_id: projectId,
    label: data.label,
    house_number: data.houseNumber,
    category: data.category,
    construction_type: data.constructionType || null,
    parking_type: data.parkingType || null,
    infra_type: data.infraType || null,
    has_non_res_part: data.hasNonResPart || false,
});

const mapBlockToDb = (block, buildingId) => ({
    id: block.id,
    building_id: buildingId,
    label: block.label,
    type: mapBlockTypeToDb(block.type),
    floors_count: block.floorsCount || 0,
    floors_from: 1,
    floors_to: block.floorsCount || 1,
});

function mapBlockTypeToDb(uiType) {
    if (uiType === 'residential') return 'Ж';
    if (uiType === 'non_residential') return 'Н';
    if (uiType === 'parking') return 'Parking';
    if (uiType === 'infrastructure') return 'Infra';
    return uiType;
}

// --- API Methods ---

export const ApiService = {
    // Получить здания с блоками
    getBuildings: async (projectId) => {
        const { data, error } = await supabase
            .from('buildings')
            .select(`
                *,
                building_blocks (*)
            `)
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

    // Создать здание
    createBuilding: async (projectId, buildingData, blocksData) => {
        const { data: building, error: bError } = await supabase
            .from('buildings')
            .insert(mapBuildingToDb(buildingData, projectId))
            .select()
            .single();

        if (bError) throw bError;

        if (blocksData && blocksData.length > 0) {
            const blocksPayload = blocksData.map(b => mapBlockToDb(b, building.id));
            const { error: blError } = await supabase
                .from('building_blocks')
                .insert(blocksPayload);
            
            if (blError) throw blError;
        }

        return building;
    },

    // Обновить здание
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

    // Удалить здание
    deleteBuilding: async (buildingId) => {
        const { error } = await supabase
            .from('buildings')
            .delete()
            .eq('id', buildingId);
        if (error) throw error;
    },

    // --- FLOORS (ЭТАЖИ) ---

    // Получить этажи блока
    getFloors: async (blockId) => {
        const { data, error } = await supabase
            .from('floors')
            .select('*')
            .eq('block_id', blockId)
            .order('index', { ascending: true }); 

        if (error) throw error;

        return data.map(f => ({
            id: f.id,
            blockId: f.block_id,
            index: f.index,
            label: f.label,
            type: f.floor_type,
            height: f.height,
            areaProj: f.area_proj,
            areaFact: f.area_fact,
            isDuplex: f.is_duplex,
            parentFloorIndex: f.parent_floor_index,
            basementId: f.basement_id,
            isTechnical: f.is_technical,
            isCommercial: f.is_commercial,
            isStylobate: f.is_stylobate,
            isBasement: f.is_basement,
            isAttic: f.is_attic,
            isLoft: f.is_loft,
            isRoof: f.is_roof
        }));
    },

    // Обновить один этаж
    updateFloor: async (floorId, updates) => {
        const payload = {};
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

    /**
     * Генерация этажей для блока (Синхронизация)
     */
    generateFloors: async (blockId, floorsFrom, floorsTo, defaultType = 'residential') => {
        const { data: existing, error: fetchErr } = await supabase
            .from('floors')
            .select('id, index')
            .eq('block_id', blockId);
            
        if (fetchErr) throw fetchErr;

        const existingIndices = new Set(existing.map(e => e.index));
        const targetIndices = new Set();
        
        for (let i = floorsFrom; i <= floorsTo; i++) {
            targetIndices.add(i);
        }

        const toDeleteIds = existing.filter(e => !targetIndices.has(e.index)).map(e => e.id);
        const toCreateIndices = Array.from(targetIndices).filter(i => !existingIndices.has(i));

        if (toDeleteIds.length > 0) {
            const { error: delErr } = await supabase.from('floors').delete().in('id', toDeleteIds);
            if (delErr) throw delErr;
        }

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
            
            const { error: insErr } = await supabase.from('floors').insert(payload);
            if (insErr) throw insErr;
        }
    },

    // --- ENTRANCES & MATRIX ---

    // Получить список подъездов блока
    getEntrances: async (blockId) => {
        const { data, error } = await supabase
            .from('entrances')
            .select('*')
            .eq('block_id', blockId)
            .order('number', { ascending: true });

        if (error) throw error;
        return data;
    },

    // Получить данные матрицы (заполненные ячейки)
    getMatrix: async (blockId) => {
        const { data, error } = await supabase
            .from('entrance_matrix')
            .select('*')
            .eq('block_id', blockId);

        if (error) throw error;
        
        // Превращаем массив в объект для быстрого доступа: "floorId_entranceId" -> data
        const map = {};
        data.forEach(row => {
            // Ключ: {ID этажа}_{Номер подъезда}
            map[`${row.floor_id}_${row.entrance_number}`] = {
                id: row.id,
                apts: row.apartments_count,
                units: row.commercial_count,
                mopQty: row.mop_count
            };
        });
        return map;
    },

    // Обновить (или создать) ячейку матрицы
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

        // Используем upsert: если записи нет — создаст, если есть — обновит
        const { data, error } = await supabase
            .from('entrance_matrix')
            .upsert(payload, { onConflict: 'block_id,floor_id,entrance_number' })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Генерация/Синхронизация подъездов (создать N подъездов, если их нет)
    syncEntrances: async (blockId, count) => {
        // 1. Получаем текущие
        const { data: existing } = await supabase.from('entrances').select('id, number').eq('block_id', blockId);
        const existingNums = new Set(existing.map(e => e.number));
        
        // 2. Создаем недостающие
        const toCreate = [];
        for(let i=1; i<=count; i++) {
            if(!existingNums.has(i)) {
                toCreate.push({ block_id: blockId, number: i });
            }
        }
        
        if (toCreate.length > 0) {
            await supabase.from('entrances').insert(toCreate);
        }

        // 3. Удаляем лишние (если уменьшили кол-во)
        const toDeleteIds = existing.filter(e => e.number > count).map(e => e.id);
        if (toDeleteIds.length > 0) {
            await supabase.from('entrances').delete().in('id', toDeleteIds);
        }
    },
    // ... (после методов entrances)

   // --- UNITS (ПОМЕЩЕНИЯ) ---

    // Получить все юниты блока + их комнаты
    getUnits: async (blockId) => {
        // 1. Получаем ID этажей блока
        const { data: floors } = await supabase.from('floors').select('id').eq('block_id', blockId);
        const floorIds = floors.map(f => f.id);
        
        if (floorIds.length === 0) return [];

        // 2. Получаем юниты вместе с комнатами
        const { data: units, error: uError } = await supabase
            .from('units')
            .select(`
                *,
                rooms (*)
            `)
            .in('floor_id', floorIds);
            
        if (uError) throw uError;

        return units.map(u => ({
            id: u.id,
            num: u.number,
            number: u.number,
            type: u.unit_type,
            area: u.total_area,
            floorId: u.floor_id,
            entranceId: u.entrance_id,
            rooms: u.rooms_count,
            buildingId: blockId,
            cadastreNumber: u.cadastre_number,
            isSold: u.status === 'sold',
            
            // Маппинг комнат из БД в UI
            explication: (u.rooms || []).map(r => ({
                id: r.id,
                type: r.room_type,
                area: r.area,
                level: r.level || 1,
                label: r.name // если используете
            })).sort((a, b) => a.type.localeCompare(b.type)) // Сортировка для порядка
        }));
    },

    // Обновить/Создать юнит и его комнаты
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

        // 1. Сохраняем Юнит
        const { data: savedUnit, error: uError } = await supabase
            .from('units')
            .upsert(unitPayload)
            .select()
            .single();

        if (uError) throw uError;

        // 2. Сохраняем Комнаты (Explication)
        // Стратегия: Удаляем старые -> Вставляем новые (самый надежный способ для списков)
        // В реальном продакшене лучше делать diff, но для MVP это ок.
        if (unitData.explication && Array.isArray(unitData.explication)) {
            
            // А. Удаляем старые комнаты этого юнита
            const { error: delError } = await supabase
                .from('rooms')
                .delete()
                .eq('unit_id', savedUnit.id);
            
            if (delError) throw delError;

            // Б. Вставляем актуальные
            if (unitData.explication.length > 0) {
                const roomsPayload = unitData.explication.map(r => ({
                    id: r.id || crypto.randomUUID(),
                    unit_id: savedUnit.id,
                    room_type: r.type,
                    area: r.area || 0,
                    level: r.level || 1,
                    name: r.label || '' // Можно сохранять название типа
                }));

                const { error: rError } = await supabase
                    .from('rooms')
                    .insert(roomsPayload);
                
                if (rError) throw rError;
            }
        }

        return savedUnit;
    },

    // Массовое обновление (для Авто-нумерации)
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
    // --- COMMON AREAS (МОП) ---

    getCommonAreas: async (blockId) => {
        // 1. Получаем ID этажей блока
        const { data: floors } = await supabase.from('floors').select('id').eq('block_id', blockId);
        const floorIds = floors.map(f => f.id);
        
        if (floorIds.length === 0) return [];

        const { data, error } = await supabase
            .from('common_areas')
            .select('*')
            .in('floor_id', floorIds);

        if (error) throw error;

        return data.map(m => ({
            id: m.id,
            type: m.type,
            area: m.area,
            floorId: m.floor_id,
            entranceId: m.entrance_id,
            buildingId: blockId, // Условно
        }));
    },

    upsertCommonArea: async (data) => {
        const payload = {
            id: data.id || crypto.randomUUID(),
            floor_id: data.floorId,
            entrance_id: data.entranceId,
            type: data.type,
            area: data.area,
            // source_step: 'manual' // Можно добавить, если есть в схеме
        };

        const { data: res, error } = await supabase
            .from('common_areas')
            .upsert(payload)
            .select()
            .single();
        
        if (error) throw error;
        return res;
    },

    deleteCommonArea: async (id) => {
        const { error } = await supabase.from('common_areas').delete().eq('id', id);
        if (error) throw error;
    },

    // Очистка всех МОП в блоке (для кнопки "Очистить")
    clearCommonAreas: async (blockId) => {
        // Получаем этажи, чтобы удалить связанные МОП
        const { data: floors } = await supabase.from('floors').select('id').eq('block_id', blockId);
        const floorIds = floors.map(f => f.id);
        
        if (floorIds.length > 0) {
            const { error } = await supabase
                .from('common_areas')
                .delete()
                .in('floor_id', floorIds);
            if (error) throw error;
        }
    },
    // ... (после common areas)

    // --- BASEMENTS & PARKING ---

    // Получить все подвалы проекта (с уровнями парковки)
    getBasements: async (projectId) => {
        const { data, error } = await supabase
            .from('basements')
            .select(`
                *,
                basement_parking_levels (*)
            `)
            .eq('building_id', projectId); // ОШИБКА В ЛОГИКЕ: basements привязаны к building_id, но мы хотим для всего проекта? 
            // В текущей схеме basements имеют building_id. Нам нужно получить все basements для всех зданий проекта.
            // Сделаем join через buildings.
        
        // Правильный запрос:
        const { data: buildings } = await supabase.from('buildings').select('id').eq('project_id', projectId);
        const buildingIds = buildings.map(b => b.id);
        
        if (buildingIds.length === 0) return [];

        const { data: basements, error: bError } = await supabase
            .from('basements')
            .select(`
                *,
                basement_parking_levels (depth_level, is_enabled)
            `)
            .in('building_id', buildingIds);

        if (bError) throw bError;

        return basements.map(b => ({
            id: b.id,
            buildingId: b.building_id,
            blockId: b.block_id,
            depth: b.depth,
            hasParking: b.has_parking,
            // Преобразуем массив уровней в объект { 1: true, 2: false }
            parkingLevels: (b.basement_parking_levels || []).reduce((acc, l) => {
                acc[l.depth_level] = l.is_enabled;
                return acc;
            }, {})
        }));
    },

    // Обновить уровень парковки в подвале (вкл/выкл)
    toggleBasementLevel: async (basementId, level, isEnabled) => {
        const { error } = await supabase
            .from('basement_parking_levels')
            .upsert({ 
                basement_id: basementId, 
                depth_level: level, 
                is_enabled: isEnabled 
            }, { onConflict: 'basement_id,depth_level' });
        
        if (error) throw error;
    },

    // Получить статистику парковочных мест (group by floor/level)
    getParkingCounts: async (projectId) => {
        // Нам нужно посчитать кол-во юнитов типа 'parking_place' для каждого этажа
        // Так как Supabase (PostgREST) не умеет делать сложные GROUP BY count в простом клиенте легко, 
        // мы загрузим упрощенный список id и floor_id для парковок.
        // Для больших проектов лучше использовать RPC функцию, но пока так:
        
        // 1. Получаем ID зданий
        const { data: buildings } = await supabase.from('buildings').select('id').eq('project_id', projectId);
        const buildingIds = buildings.map(b => b.id);
        
        if (buildingIds.length === 0) return {};

        // 2. Получаем ID этажей
        const { data: floors } = await supabase.from('floors').select('id, floor_key').in('block_id', 
            (await supabase.from('building_blocks').select('id').in('building_id', buildingIds)).data.map(b => b.id)
        );
        
        const floorIds = floors.map(f => f.id);
        
        // 3. Считаем юниты
        const { data: units, error } = await supabase
            .from('units')
            .select('floor_id')
            .eq('unit_type', 'parking_place')
            .in('floor_id', floorIds);

        if (error) throw error;

        // Агрегация на клиенте
        const counts = {};
        units.forEach(u => {
            counts[u.floor_id] = (counts[u.floor_id] || 0) + 1;
        });
        
        return counts; // { floorId: count }
    },

    // Синхронизация количества мест (Создать/Удалить)
    syncParkingPlaces: async (floorId, targetCount, buildingId) => {
        // 1. Получаем текущие места на этаже
        const { data: existing } = await supabase
            .from('units')
            .select('id, number')
            .eq('floor_id', floorId)
            .eq('unit_type', 'parking_place');
            
        const currentCount = existing.length;
        
        if (currentCount === targetCount) return;

        if (targetCount > currentCount) {
            // Добавляем
            const toAdd = targetCount - currentCount;
            const newUnits = [];
            // Находим макс номер, чтобы продолжать нумерацию
            let maxNum = 0;
            existing.forEach(u => {
                const n = parseInt(u.number);
                if (!isNaN(n) && n > maxNum) maxNum = n;
            });

            for(let i=1; i<=toAdd; i++) {
                newUnits.push({
                    id: crypto.randomUUID(),
                    floor_id: floorId,
                    building_id: buildingId, // Нужно передать!
                    unit_type: 'parking_place',
                    number: String(maxNum + i),
                    total_area: 13.25, // Дефолт
                    status: 'free',
                    source_step: 'parking_config'
                });
            }
            await supabase.from('units').insert(newUnits);
        } else {
            // Удаляем лишние (с конца)
            // Сортируем, чтобы удалять последние добавленные (по номеру или id)
            // Упрощение: удаляем любые N штук, но лучше последние по номеру
            const sorted = existing.sort((a, b) => parseInt(b.number) - parseInt(a.number));
            const toDelete = sorted.slice(0, currentCount - targetCount).map(u => u.id);
            await supabase.from('units').delete().in('id', toDelete);
        }
    },
    // ... (после getBasements / getParkingCounts)

    // --- INTEGRATION & APP ---

    // Обновить статус интеграции в заявке
    updateIntegrationStatus: async (projectId, field, status) => {
        // 1. Находим заявку
        const { data: app, error: appErr } = await supabase
            .from('applications')
            .select('id, integration_data')
            .eq('project_id', projectId)
            .single();
            
        if (appErr) throw appErr;

        // 2. Обновляем JSONB поле
        const currentData = app.integration_data || {};
        const newData = { ...currentData, [field]: status };

        const { error } = await supabase
            .from('applications')
            .update({ integration_data: newData })
            .eq('id', app.id);

        if (error) throw error;
        return newData;
    },

    // Получить текущие статусы интеграции
    getIntegrationStatus: async (projectId) => {
        const { data, error } = await supabase
            .from('applications')
            .select('integration_data')
            .eq('project_id', projectId)
            .single();
            
        if (error) return {};
        return data.integration_data || {};
    },

    // Сохранить кадастровые номера для зданий (ответ от УЗКАД)
    updateBuildingCadastre: async (buildingId, cadastreNumber) => {
        const { error } = await supabase
            .from('buildings')
            .update({ cadastre_number: cadastreNumber }) // Предполагаем поле cadastre_number
            .eq('id', buildingId);
        if (error) throw error;
    },

    // Сохранить кадастровые номера для юнитов
    updateUnitCadastre: async (unitId, cadastreNumber) => {
        const { error } = await supabase
            .from('units')
            .update({ cadastre_number: cadastreNumber })
            .eq('id', unitId);
        if (error) throw error;
    },

    // Получить ВСЕ данные для реестра (Flat Matrix + Parking)
    // Это "тяжелый" запрос, но нужен для формирования финального списка
    getProjectFullRegistry: async (projectId) => {
        // 1. Здания
        const { data: buildings } = await supabase.from('buildings').select('*').eq('project_id', projectId);
        if (!buildings || buildings.length === 0) return { buildings: [], units: [], parking: [] };
        
        const buildingIds = buildings.map(b => b.id);
        
        // 2. Блоки
        const { data: blocks } = await supabase.from('building_blocks').select('*').in('building_id', buildingIds);
        const blockIds = blocks.map(b => b.id);
        
        // 3. Этажи
        const { data: floors } = await supabase.from('floors').select('*').in('block_id', blockIds);
        const floorIds = floors.map(f => f.id);

        // 4. Юниты
        const { data: units } = await supabase.from('units').select('*').in('floor_id', floorIds);
        
        // 5. Парковки (они тоже в units, но вынесем логически если надо, или отфильтруем)
        
        return {
            buildings: buildings.map(b => ({...b, label: b.label, houseNumber: b.house_number})),
            blocks: blocks.map(b => ({...b, tabLabel: b.label})),
            floors: floors.map(f => ({...f, areaProj: f.area_proj})),
            units: (units || []).map(u => ({
                id: u.id,
                number: u.number,
                type: u.unit_type,
                area: u.total_area,
                floorId: u.floor_id,
                cadastreNumber: u.cadastre_number
            }))
        };
    },// ... (после integration methods)

    // --- PROJECT PASSPORT (ПАСПОРТ ОБЪЕКТА) ---

    // Получить полные данные о проекте
    getProjectDetails: async (projectId) => {
        // 1. Основные инфо
        const { data: project, error: pError } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();
        
        if (pError) throw pError;

        // 2. Участники
        const { data: participants } = await supabase
            .from('project_participants')
            .select('*')
            .eq('project_id', projectId);

        // 3. Документы
        const { data: documents } = await supabase
            .from('project_documents')
            .select('*')
            .eq('project_id', projectId)
            .order('date', { ascending: false });

        // Маппинг для UI
        return {
            complexInfo: {
                name: project.name,
                status: project.status,
                region: project.region,
                district: project.district,
                street: project.address, // В БД обычно address
                landmark: project.landmark,
                dateStartProject: project.date_start,
                dateEndProject: project.date_end,
                dateStartFact: project.fact_start,
                dateEndFact: project.fact_end
            },
            cadastre: {
                number: project.cadastre_number,
                address: project.cadastre_address,
                area: project.site_area // Площадь участка
            },
            participants: (participants || []).reduce((acc, p) => {
                acc[p.role] = { id: p.id, name: p.name, inn: p.inn };
                return acc;
            }, {}),
            documents: (documents || []).map(d => ({
                id: d.id,
                name: d.name,
                type: d.type,
                date: d.date
            }))
        };
    },

    // Обновить основные данные проекта
    updateProjectInfo: async (projectId, info, cadastre) => {
        const payload = {
            name: info.name,
            status: info.status,
            region: info.region,
            district: info.district,
            address: info.street,
            landmark: info.landmark,
            
            date_start: info.dateStartProject,
            date_end: info.dateEndProject,
            fact_start: info.dateStartFact,
            fact_end: info.dateEndFact,

            cadastre_number: cadastre.number,
            cadastre_address: cadastre.address,
            site_area: cadastre.area,
            
            updated_at: new Date()
        };

        const { error } = await supabase
            .from('projects')
            .update(payload)
            .eq('id', projectId);

        if (error) throw error;
    },

    // Обновить участника (Upsert)
    upsertParticipant: async (projectId, role, data) => {
        const { error } = await supabase
            .from('project_participants')
            .upsert({
                project_id: projectId,
                role: role,
                name: data.name,
                inn: data.inn,
                updated_at: new Date()
            }, { onConflict: 'project_id, role' }); // Уникальность по роли в проекте

        if (error) throw error;
    },

    // Документы (CRUD)
    upsertDocument: async (projectId, doc) => {
        const { data, error } = await supabase
            .from('project_documents')
            .upsert({
                id: doc.id || crypto.randomUUID(),
                project_id: projectId,
                name: doc.name,
                type: doc.type,
                date: doc.date
            })
            .select()
            .single();
            
        if (error) throw error;
        return data;
    },

    deleteDocument: async (docId) => {
        const { error } = await supabase
            .from('project_documents')
            .delete()
            .eq('id', docId);
        if (error) throw error;
    },
    // --- PROJECTS LIST (СПИСОК ПРОЕКТОВ) ---

    // Получить список всех проектов (для главной страницы)
    getProjectsList: async () => {
        const { data, error } = await supabase
            .from('projects')
            .select('id, name, address, status, updated_at')
            .order('updated_at', { ascending: false });
            
        if (error) throw error;
        return data;
    },

    // Создать новый проект
    createProject: async (name, address) => {
        const { data, error } = await supabase
            .from('projects')
            .insert({
                name: name || 'Новый проект',
                address: address || '',
                status: 'Проектный',
                created_at: new Date(),
                updated_at: new Date()
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Удалить проект
    deleteProject: async (id) => {
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },
// ... (внутри ApiService)

    // --- WORKFLOW ACTIONS ---

    // Принять заявку в работу и СОЗДАТЬ проект
    acceptApplication: async (applicationId, appData) => {
        // 1. Создаем проект в таблице projects
        // Берем имя из заявки или генерируем дефолтное
        const projectName = appData.object_name || appData.applicant || 'Новый проект';
        const projectAddress = appData.address || '';

        const { data: newProject, error: projError } = await supabase
            .from('projects')
            .insert({
                name: projectName,
                address: projectAddress,
                status: 'Проектный', // Начальный статус
                created_at: new Date(),
                updated_at: new Date()
            })
            .select()
            .single();

        if (projError) throw projError;

        // 2. Обновляем заявку: ставим статус "in_progress" и прописываем project_id
        const { error: appError } = await supabase
            .from('applications')
            .update({ 
                status: 'in_progress',
                project_id: newProject.id, // СВЯЗЬ!
                updated_at: new Date()
            })
            .eq('id', applicationId);

        if (appError) throw appError;

        return newProject;
    },
};

function mapDbTypeToUi(dbType) {
    if (dbType === 'Ж') return 'residential';
    if (dbType === 'Н') return 'non_residential';
    if (dbType === 'Parking') return 'parking';
    if (dbType === 'Infra') return 'infrastructure';
    return dbType;
}