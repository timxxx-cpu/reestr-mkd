/**
 * Единый словарь ключей и идентификаторов моделей (UI/DB/виртуальные floor IDs).
 */

export const MODEL_DATA_KEYS = Object.freeze({
    FLOOR_DATA: 'floorData',
    ENTRANCES_DATA: 'entrancesData',
    MOP_DATA: 'mopData',
    FLAT_MATRIX: 'flatMatrix',
    PARKING_PLACES: 'parkingPlaces',
    COMMON_AREAS_DATA: 'commonAreasData',
    APARTMENTS_DATA: 'apartmentsData',
    PARKING_DATA: 'parkingData',
    COMPLEX_INFO: 'complexInfo',
    PARTICIPANTS: 'participants',
    CADASTRE: 'cadastre',
    DOCUMENTS: 'documents',
    BUILDING_DETAILS: 'buildingDetails',
    COMPOSITION: 'composition'
});

export const HEAVY_MODEL_KEYS = Object.freeze([
    MODEL_DATA_KEYS.FLOOR_DATA,
    MODEL_DATA_KEYS.ENTRANCES_DATA,
    MODEL_DATA_KEYS.MOP_DATA,
    MODEL_DATA_KEYS.FLAT_MATRIX,
    MODEL_DATA_KEYS.PARKING_PLACES,
    MODEL_DATA_KEYS.COMMON_AREAS_DATA,
    MODEL_DATA_KEYS.APARTMENTS_DATA,
    MODEL_DATA_KEYS.PARKING_DATA,
    MODEL_DATA_KEYS.COMPLEX_INFO,
    MODEL_DATA_KEYS.PARTICIPANTS,
    MODEL_DATA_KEYS.CADASTRE,
    MODEL_DATA_KEYS.DOCUMENTS,
    MODEL_DATA_KEYS.BUILDING_DETAILS,
    MODEL_DATA_KEYS.COMPOSITION
]);

export const UI_TO_BUILDING_DB_MATRIX_KEYS = Object.freeze({
    [MODEL_DATA_KEYS.FLOOR_DATA]: MODEL_DATA_KEYS.FLOOR_DATA,
    [MODEL_DATA_KEYS.ENTRANCES_DATA]: MODEL_DATA_KEYS.ENTRANCES_DATA,
    [MODEL_DATA_KEYS.MOP_DATA]: MODEL_DATA_KEYS.COMMON_AREAS_DATA,
    [MODEL_DATA_KEYS.FLAT_MATRIX]: MODEL_DATA_KEYS.APARTMENTS_DATA,
    [MODEL_DATA_KEYS.PARKING_PLACES]: MODEL_DATA_KEYS.PARKING_DATA
});

export const SPECIAL_FLOOR_IDS = Object.freeze(['attic', 'loft', 'roof', 'tsokol']);

export const floorKeyToVirtualId = (key) => {
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
    if (SPECIAL_FLOOR_IDS.includes(key)) return key;
    return key;
};

export const inferFloorKeyFromVirtualId = (id) => {
    if (!id) return null;
    if (id.startsWith('floor_')) {
        if (id.includes('_tech')) return `tech:${id.split('_')[1]}`;
        return `floor:${id.split('_')[1]}`;
    }
    if (id.startsWith('level_minus_')) return `parking:-${id.split('_')[2]}`;
    if (id.startsWith('base_')) {
        const parts = id.split('_');
        const depth = parts[parts.length - 1].replace('L', '');
        const baseId = parts.slice(1, parts.length - 1).join('_');
        return `basement:${baseId}:${depth}`;
    }
    if (SPECIAL_FLOOR_IDS.includes(id)) return id;
    return id;
};
