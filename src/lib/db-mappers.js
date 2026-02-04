/**
 * Утилиты для маппинга данных между БД (Snake_case) и UI (CamelCase/Nested)
 */

// --- 1. PROJECT + APPLICATION ---
// Мы объединяем данные из двух таблиц в один объект ProjectMeta, 
// который ожидает UI (через поля applicationInfo и complexInfo)

export const mapProjectAggregate = (project, app, history = [], steps = [], parts = [], docs = []) => {
    // Формируем списки шагов
    const completedSteps = steps.filter(s => s.is_completed).map(s => s.step_index);
    const verifiedSteps = steps.filter(s => s.is_verified).map(s => s.step_index);

    return {
        id: project.id, // ID проекта
        applicationId: app.id, // ID заявки (сохраняем для API)
        
        name: project.name,
        // UI использует status из заявки для управления доступом, 
        // но отображает статус стройки в паспорте. Разделим их.
        status: project.construction_status, 
        
        lastModified: app.updated_at,
        
        // Данные Заявки (Workflow)
        applicationInfo: {
            id: app.id,
            internalNumber: app.internal_number,
            externalSource: app.external_source,
            externalId: app.external_id,
            applicant: app.applicant,
            submissionDate: app.submission_date,
            
            status: app.status,
            assigneeName: app.assignee_name,
            
            currentStepIndex: app.current_step,
            currentStage: app.current_stage,
            
            completedSteps,
            verifiedSteps,
            
            history: history.map(h => ({
                date: h.created_at,
                user: h.user_name,
                action: h.action,
                status: h.next_status, // для совместимости
                comment: h.comment,
                prevStatus: h.prev_status
           })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        },
        
        // Данные Проекта (Passport)
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

        participants: parts.reduce((acc, part) => {
            acc[part.role] = {
                id: part.id,
                name: part.name,
                inn: part.inn,
                role: part.role
            };
            return acc;
        }, {}),

        cadastre: {
            number: project.cadastre_number
        },

        documents: docs.map(d => ({
            id: d.id,
            name: d.name,
            type: d.doc_type,
            date: d.doc_date,
            number: d.doc_number,
            url: d.file_url
        }))
    };
};

// --- 2. BUILDINGS ---
export const mapBuildingFromDB = (b, blocks = []) => {
    const resBlocksCount = blocks.filter(bl => bl.type === 'Ж').length;
    const nonResBlocksCount = blocks.filter(bl => bl.type === 'Н').length;

    return {
        id: b.id,
        label: b.label,
        houseNumber: b.house_number,
        category: b.category,
        type: mapCategoryToLabel(b.category),
        stage: 'Проектный', // Это поле можно добавить в buildings, если нужно
        
        resBlocks: resBlocksCount,
        nonResBlocks: nonResBlocksCount,
        parkingType: b.parking_type,
        constructionType: b.construction_type,
        infraType: b.infra_type,
        hasNonResPart: nonResBlocksCount > 0,
        
        blocks: blocks.map(bl => ({
            id: bl.id,
            buildingId: b.id,
            label: bl.label,
            type: mapDBTypeToUI(bl.type),
            index: 0
        }))
    };
};

// --- 3. DETAILS ---
export const mapBlockDetailsFromDB = (b, block) => ({
    floorsCount: block.floors_count,
    entrances: block.entrances_count,
    inputs: block.entrances_count,
    elevators: block.elevators_count,
    
    foundation: b.foundation,
    walls: b.walls,
    slabs: b.slabs,
    roof: b.roof,
    seismicity: b.seismicity,
    
    engineering: {
        electricity: b.has_electricity,
        hvs: b.has_water,
        sewerage: b.has_sewerage,
        gas: b.has_gas,
        heating: b.has_heating,
        ventilation: b.has_ventilation,
        firefighting: b.has_firefighting,
        lowcurrent: b.has_lowcurrent
    },

    hasBasementFloor: block.has_basement,
    hasAttic: block.has_attic,
    hasLoft: block.has_loft,
    hasExploitableRoof: block.has_roof_expl,
    
    technicalFloors: [],
    commercialFloors: []
});

// --- 4. FLOORS ---
export const mapFloorFromDB = (f) => ({
    id: f.id,
    label: f.label,
    type: f.floor_type,
    height: f.height,
    areaProj: f.area_proj,
    areaFact: f.area_fact,
    isDuplex: f.is_duplex,
    sortOrder: f.index
});

// --- 5. UNITS ---
export const mapUnitFromDB = (u, rooms = [], entranceMap = {}) => ({
    id: u.id,
    num: u.number,
    number: u.number,
    type: u.type,
    area: u.total_area,
    livingArea: u.living_area,
    usefulArea: u.useful_area,
    rooms: u.rooms_count,
    isSold: u.status === 'sold',
    cadastreNumber: u.cadastre_number,
    floorId: u.floor_id,
    entranceIndex: u.entrance_id ? (entranceMap[u.entrance_id] || 1) : 1,
    entranceId: u.entrance_id,
    
    explication: rooms.map(r => ({
        id: r.id,
        type: r.room_type,
        label: r.name,
        area: r.area,
        level: r.level
    }))
});

// --- 6. MOP ---
export const mapMopFromDB = (m, entranceMap = {}) => ({
    id: m.id,
    type: m.type,
    area: m.area,
    floorId: m.floor_id,
    entranceIndex: m.entrance_id ? (entranceMap[m.entrance_id] || 1) : 1,
    entranceId: m.entrance_id
});

// --- HELPERS ---

function mapCategoryToLabel(cat) {
    const map = {
        'residential': 'Жилой дом',
        'residential_multiblock': 'Жилой комплекс',
        'parking_separate': 'Паркинг',
        'infrastructure': 'Инфраструктура'
    };
    return map[cat] || 'Объект';
}

function mapDBTypeToUI(dbType) {
    if (dbType === 'Ж') return 'residential';
    if (dbType === 'Н') return 'non_residential';
    if (dbType === 'Parking') return 'parking';
    if (dbType === 'Infra') return 'infrastructure';
    return dbType;
}