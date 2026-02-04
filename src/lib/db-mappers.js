/**
 * Утилиты для маппинга данных между БД (Snake_case) и UI (CamelCase/Nested)
 */

// --- 1. PROJECT & META ---

export const mapProjectFromDB = (p, parts = [], docs = []) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    lastModified: p.updated_at,
    
    complexInfo: {
        name: p.name,
        status: p.status,
        region: p.region,
        district: p.district,
        street: p.address,
        landmark: p.landmark,
        dateStartProject: p.date_start_project,
        dateEndProject: p.date_end_project,
        dateStartFact: p.date_start_fact,
        dateEndFact: p.date_end_fact
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
        number: p.cadastre_number
    },

    documents: docs.map(d => ({
        id: d.id,
        name: d.name,
        type: d.doc_type,
        date: d.doc_date,
        number: d.doc_number,
        url: d.file_url
    })),

    applicationInfo: {
        status: p.status === 'Проектный' ? 'DRAFT' : 'NEW', 
        history: [] 
    }
});

// --- 2. BUILDINGS & CONFIG ---

export const mapBuildingFromDB = (b, blocks = []) => {
    // Подсчет типов для старых полей конфигурации (для совместимости)
    const resBlocksCount = blocks.filter(bl => bl.type === 'Ж').length;
    const nonResBlocksCount = blocks.filter(bl => bl.type === 'Н').length;

    return {
        id: b.id,
        label: b.label,
        houseNumber: b.house_number,
        category: b.category,
        type: mapCategoryToLabel(b.category),
        stage: 'Проектный',
        
        resBlocks: resBlocksCount,
        nonResBlocks: nonResBlocksCount,
        parkingType: b.parking_type,
        constructionType: b.construction_type,
        infraType: b.infra_type,
        hasNonResPart: nonResBlocksCount > 0,
        
        // Возвращаем массив блоков обратно в структуру UI
        blocks: blocks.map(bl => ({
            id: bl.id,
            buildingId: b.id,
            label: bl.label,
            type: mapDBTypeToUI(bl.type), // Обратный маппинг типов (Ж -> residential)
            index: 0
        }))
    };
};

export const mapBlockDetailsFromDB = (b, block) => {
    // Собираем конфиг для конкретного блока
    return {
        // Геометрия
        floorsCount: block.floors_count,
        entrances: block.entrances_count,
        inputs: block.entrances_count, // Синоним для инфры/паркингов
        elevators: block.elevators_count,
        
        // Конструктив (общий на здание)
        foundation: b.foundation,
        walls: b.walls,
        slabs: b.slabs,
        roof: b.roof,
        seismicity: b.seismicity,
        
        // Инженерия (общая на здание)
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

        // Флаги блока
        hasBasementFloor: block.has_basement,
        hasAttic: block.has_attic,
        hasLoft: block.has_loft,
        hasExploitableRoof: block.has_roof_expl,
        
        technicalFloors: [],
        commercialFloors: []
    };
};

// --- 3. MATRICES ---

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

// [UPDATED] Добавлен entranceMap для преобразования ID -> Номер
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
    
    // Преобразуем UUID входа обратно в номер (1, 2, 3...), если он есть в карте
    entranceIndex: u.entrance_id ? (entranceMap[u.entrance_id] || 1) : 1,
    // Сохраняем и оригинальный ID на всякий случай
    entranceId: u.entrance_id,
    
    explication: rooms.map(r => ({
        id: r.id,
        type: r.room_type,
        label: r.name,
        area: r.area,
        level: r.level
    }))
});

// [NEW] Маппер для МОП
export const mapMopFromDB = (m, entranceMap = {}) => ({
    id: m.id,
    type: m.type,
    area: m.area,
    floorId: m.floor_id,
    // Маппим UUID входа в номер
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