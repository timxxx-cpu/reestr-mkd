import { getBlocksList } from './utils';

const NUMERIC_FIELDS = [
    'entrances',
    'floorsFrom',
    'floorsTo',
    'elevators',
    'inputs',
    'vehicleEntries',
    'floorsCount',
    'levelsDepth',
    'seismicity'
];

const normalizeNumericFields = (details) => {
    const normalized = { ...details };
    NUMERIC_FIELDS.forEach((field) => {
        if (!(field in normalized)) return;
        const raw = normalized[field];
        if (raw === '' || raw === null || raw === undefined) {
            delete normalized[field];
            return;
        }
        if (typeof raw === 'string') {
            const trimmed = raw.trim();
            if (trimmed === '') {
                delete normalized[field];
                return;
            }
            const num = Number(trimmed);
            if (Number.isNaN(num)) {
                delete normalized[field];
                return;
            }
            normalized[field] = num;
            return;
        }
        if (typeof raw === 'number' && Number.isNaN(raw)) {
            delete normalized[field];
        }
    });
    return normalized;
};

const dropFields = (details, fields) => {
    const cleaned = { ...details };
    fields.forEach((field) => {
        if (field in cleaned) delete cleaned[field];
    });
    return cleaned;
};

export const cleanBlockDetails = (building, block, details) => {
    let cleaned = normalizeNumericFields(details);
    const isInfra = building.category === 'infrastructure' || block?.originalType === 'infrastructure';
    const isParking = building.category === 'parking_separate' || block?.originalType === 'parking';

    if (isInfra) {
        cleaned = dropFields(cleaned, [
            'vehicleEntries',
            'levelsDepth',
            'lightStructureType',
            'parentBlocks',
            'commercialFloors',
            'technicalFloors',
            'hasTechnicalFloor'
        ]);
    } else if (isParking) {
        cleaned = dropFields(cleaned, [
            'commercialFloors',
            'technicalFloors',
            'hasTechnicalFloor'
        ]);
    } else {
        cleaned = dropFields(cleaned, [
            'inputs',
            'vehicleEntries',
            'levelsDepth',
            'floorsCount',
            'lightStructureType'
        ]);
    }

    return cleaned;
};

export const cleanBuildingDetails = (composition, buildingDetails = {}) => {
    if (!composition?.length) return { ...buildingDetails };
    const cleaned = { ...buildingDetails };

    composition.forEach((building) => {
        const blocks = getBlocksList(building, buildingDetails);
        blocks.forEach((block) => {
            const key = `${building.id}_${block.id}`;
            if (!buildingDetails[key]) return;
            cleaned[key] = cleanBlockDetails(building, block, buildingDetails[key]);
        });
    });

    return cleaned;
};
