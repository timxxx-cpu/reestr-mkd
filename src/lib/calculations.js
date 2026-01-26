/**
 * Утилиты для расчета ТЭП (Технико-Экономических Показателей)
 */

/**
 * Подсчет показателей для КОНКРЕТНОГО здания
 * @param {import('./types').BuildingMeta} building 
 * @param {Object} context - Данные из ProjectContext (floorData, flatMatrix и т.д.)
 */
export const getBuildingStats = (building, context) => {
    const { floorData = {}, flatMatrix = {}, buildingDetails = {}, mopData = {}, parkingPlaces = {} } = context;
    
    const stats = {
        floors: 0,
        areaProj: 0,
        areaFact: 0,
        flats: 0,
        offices: 0,
        mopArea: 0,
        parking: 0,
        id: building.id,
        label: building.label
    };

    const blockPrefix = building.id;

    // 1. Этажность (из конфига)
    // Ищем конфиги блоков, относящихся к этому зданию
    Object.keys(buildingDetails).forEach(key => {
        if (key.startsWith(blockPrefix) && buildingDetails[key].floorsTo) {
            // Берем максимальную этажность среди блоков здания
            const h = parseInt(buildingDetails[key].floorsTo);
            if (h > stats.floors) stats.floors = h;
        }
    });

    // 2. Площади этажей (FloorData)
    Object.keys(floorData).forEach(key => {
        if (key.startsWith(blockPrefix)) {
            const f = floorData[key];
            stats.areaProj += parseFloat(f.areaProj) || 0;
            if (f.areaFact) stats.areaFact += parseFloat(f.areaFact) || 0;
        }
    });

    // 3. Квартиры/Офисы (FlatMatrix)
    Object.keys(flatMatrix).forEach(key => {
        if (key.startsWith(blockPrefix)) {
            const unit = flatMatrix[key];
            if (unit.type === 'flat' || unit.type === 'duplex_up' || unit.type === 'duplex_down') {
                stats.flats++;
            } else if (unit.type === 'office') {
                stats.offices++;
            }
        }
    });

    // 4. Парковки
    Object.keys(parkingPlaces).forEach(key => {
        if (key.startsWith(blockPrefix) && key.includes('_place')) {
            stats.parking++;
        }
    });

    // 5. МОП
    Object.keys(mopData).forEach(key => {
        if (key.startsWith(blockPrefix)) {
            const mops = mopData[key];
            if (Array.isArray(mops)) {
                mops.forEach(m => stats.mopArea += parseFloat(m.area) || 0);
            }
        }
    });

    return stats;
};

/**
 * Расчет СВОДНЫХ показателей по всему проекту
 */
export const calculateTEP = (projectContext) => {
    const { composition = [] } = projectContext;

    // Инициализация счетчиков
    const totalStats = {
        totalAreaProj: 0,
        totalAreaFact: 0,
        livingAreaProj: 0, // Это нужно считать отдельно через сумму площадей квартир
        livingAreaFact: 0,
        commercialArea: 0,
        flatsCount: 0,
        officesCount: 0,
        parkingCount: 0,
        buildingsCount: composition.length,
        floorsTotal: 0, // Макс этажность или сумма? Обычно сумма
        mopArea: 0
    };

    // Проходим по каждому зданию и суммируем
    composition.forEach(building => {
        const bStats = getBuildingStats(building, projectContext);
        
        totalStats.totalAreaProj += bStats.areaProj;
        totalStats.totalAreaFact += bStats.areaFact;
        totalStats.flatsCount += bStats.flats;
        totalStats.officesCount += bStats.offices;
        totalStats.parkingCount += bStats.parking;
        totalStats.mopArea += bStats.mopArea;
        // Для простоты здесь этажность суммируем, хотя это странная метрика
        totalStats.floorsTotal += bStats.floors;
    });

    // Дополнительный проход для точного расчета жилой/коммерческой площади по типам помещений
    // (так как getBuildingStats считает кол-во, но не сумму площадей юнитов для быстродействия)
    const { flatMatrix = {} } = projectContext;
    Object.values(flatMatrix).forEach(unit => {
        const area = parseFloat(unit.area) || 0;
        if (unit.type === 'flat' || unit.type?.includes('duplex')) {
            totalStats.livingAreaProj += area;
        } else if (unit.type === 'office') {
            totalStats.commercialArea += area;
        }
    });

    const diff = totalStats.totalAreaFact > 0 ? totalStats.totalAreaFact - totalStats.totalAreaProj : 0;
    const diffPercent = totalStats.totalAreaProj > 0 ? (diff / totalStats.totalAreaProj) * 100 : 0;

    return {
        ...totalStats,
        diff,
        diffPercent: diffPercent.toFixed(2)
    };
};

export const getChartData = (context) => {
    const stats = calculateTEP(context);
    
    return {
        areaDistribution: [
            { name: 'Жилая', value: stats.livingAreaProj, color: '#3b82f6' },
            { name: 'Коммерция', value: stats.commercialArea, color: '#10b981' },
            { name: 'МОП', value: stats.mopArea, color: '#64748b' },
        ],
        projectVsFact: [
            { name: 'Проект', S: stats.totalAreaProj },
            { name: 'Факт', S: stats.totalAreaFact > 0 ? stats.totalAreaFact : 0 },
        ]
    };
};