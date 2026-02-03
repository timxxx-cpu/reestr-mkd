import { getBlocksList } from './utils';
import { BuildingConfigSchema } from './schemas';
import { Validators } from './validators';

const FIELD_NAMES = {
    foundation: "Фундамент",
    walls: "Материал стен",
    slabs: "Перекрытия",
    roof: "Кровля",
    seismicity: "Сейсмичность",
    entrances: "Количество подъездов/входов",
    floorsFrom: "Этажность (с)",
    floorsTo: "Этажность (по)",
    elevators: "Лифты",
    customHouseNumber: "Номер дома блока",
    inputs: "Количество входов",
    vehicleEntries: "Въезды",
    floorsCount: "Количество этажей",
    levelsDepth: "Количество уровней",
    lightStructureType: "Тип конструкции"
};

/**
 * Вспомогательная функция для сбора ошибок по конфигурации здания
 */
const getBuildingErrors = (building, buildingDetails, mode) => {
    const errors = [];
    const blocks = getBlocksList(building);
    
    // Определяем тип здания
    const isParking = building.category === 'parking_separate';
    const isInfra = building.category === 'infrastructure';
    const isResidential = building.category.includes('residential');
    
    // Надежная проверка на подземный тип
    const isUnderground = building.parkingType === 'underground' || building.constructionType === 'underground';

    // Фильтруем блоки (для жилых комплексов)
    const relevantBlocks = blocks.filter(b => {
        if (mode === 'res') return b.type === 'Ж';
        if (mode === 'nonres') return b.type !== 'Ж';
        return true;
    });

    if (relevantBlocks.length === 0) return [];

    for (const block of relevantBlocks) {
        const detailsKey = `${building.id}_${block.id}`;
        const details = buildingDetails[detailsKey] || {};
        
        let blockName = block.tabLabel;
        if (blockName === 'main') blockName = 'Основной блок';
        const contextTitle = `Объект: ${building.label} (Блок: ${blockName})`;

        // 1. Формируем список обязательных полей
        const requiredFields = [];
        
        if (isResidential) {
            requiredFields.push('foundation', 'walls', 'slabs', 'roof', 'seismicity');
            requiredFields.push('entrances', 'floorsFrom', 'floorsTo');
        } else if (isInfra) {
            requiredFields.push('floorsCount', 'inputs', 'foundation', 'walls', 'slabs', 'roof', 'seismicity');
        } else if (isParking) {
            if (building.constructionType === 'capital') {
                 requiredFields.push('foundation', 'walls', 'slabs', 'roof', 'seismicity', 'vehicleEntries', 'inputs');
            } else if (building.constructionType === 'light') {
                requiredFields.push('lightStructureType');
            }
        }

        // 2. Проверяем заполненность обязательных полей
        requiredFields.forEach(field => {
            const val = details[field];
            if (val === undefined || val === '' || val === null) {
                errors.push({
                    title: contextTitle,
                    description: `Поле "${FIELD_NAMES[field] || field}" обязательно для заполнения.`
                });
            }
        });
        
        if (isParking && building.constructionType === 'capital') {
             if (isUnderground) {
                 if (!details.levelsDepth) errors.push({ title: contextTitle, description: "Не указана глубина подземного паркинга." });
             } else {
                 if (!details.floorsCount) errors.push({ title: contextTitle, description: "Не указано количество этажей паркинга." });
             }
        }

        // 3. Валидация Zod
        const validation = BuildingConfigSchema.safeParse(details);
        
        if (!validation.success) {
            validation.error.issues.forEach(issue => {
                const rawField = String(issue.path[0]);
                const isFieldPresent = details[rawField] !== undefined && details[rawField] !== '';
                if (isFieldPresent) {
                    const fieldName = FIELD_NAMES[rawField] || rawField;
                    let message = issue.message;
                    if (message.includes("expected number") || message.includes("NaN")) message = "Содержит ошибку";
                    errors.push({
                        title: contextTitle,
                        description: `Поле "${fieldName}": ${message}`
                    });
                }
            });
        }

        // 4. Проверка лифтов
        if (building.constructionType !== 'light' && !isInfra) {
             const floorsToCheck = details.floorsTo || details.floorsCount || 1;
             const hasElevatorIssue = Validators.elevatorRequirement(
                isParking, isInfra, floorsToCheck, details.elevators || 0
            );

            if (hasElevatorIssue) {
                errors.push({
                    title: contextTitle,
                    description: `Здание выше 5 этажей (${floorsToCheck} эт.) обязано иметь лифт.`
                });
            }
        }
       
        // 5. Адрес
        if (details.hasCustomAddress && (!details.customHouseNumber || details.customHouseNumber.trim() === '')) {
             errors.push({
                title: contextTitle,
                description: `Вы включили опцию "Номер корпуса", но не указали его.`
            });
        }
    }

    // 6. Коммерция
    if (mode === 'res' && building.hasNonResPart) {
        const isCommercialValid = Validators.commercialPresence(building, buildingDetails, blocks, 'res');
        if (!isCommercialValid) {
            errors.push({
                title: `Объект: ${building.label}`,
                description: "В паспорте указано наличие коммерции, но ни в одном жилом блоке не отмечены коммерческие этажи."
            });
        }
    }

    return errors;
};

// --- ВАЛИДАТОРЫ ИНВЕНТАРИЗАЦИИ ---

const validateFloors = (data) => {
    const { composition, buildingDetails, floorData } = data;
    const errors = [];

    composition.forEach(building => {
        // Пропускаем паркинги легких конструкций/открытые
        if (building.category === 'parking_separate' && building.constructionType !== 'capital' && building.parkingType !== 'underground') return;

        const blocks = getBlocksList(building, buildingDetails);
        blocks.forEach(block => {
            const prefix = `${building.id}_${block.id}`;
            const blockFloorKeys = Object.keys(floorData).filter(k => k.startsWith(prefix));
            
            if (blockFloorKeys.length === 0) {
                errors.push({
                    title: `Объект: ${building.label} (${block.tabLabel})`,
                    description: "Нет данных об этажах. Заполните матрицу высот и площадей."
                });
                return;
            }

            blockFloorKeys.forEach(key => {
                const f = floorData[key];
                const floorLabel = key.includes('level_minus') ? 'Подземный уровень' : 
                                   key.includes('base_') ? 'Подвал' : 
                                   key.includes('floor_') ? `${key.split('floor_')[1]} этаж` : 'Этаж';

                // 1. Высота (не для крыши)
                if (!key.includes('roof')) {
                    if (!f.height) {
                         errors.push({
                            title: `${building.label} (${block.tabLabel})`,
                            description: `${floorLabel}: Не указана высота.`
                        });
                    } else {
                        const heightErr = Validators.floorHeight('standard', f.height); 
                        if (heightErr) { 
                             errors.push({
                                title: `${building.label} (${block.tabLabel})`,
                                description: `${floorLabel}: Недопустимая высота (${f.height}). ${heightErr}`
                            });
                        }
                    }
                }

                // 2. Площадь проектная
                const areaErr = Validators.checkPositive(f.areaProj);
                if (areaErr) {
                    errors.push({
                        title: `${building.label} (${block.tabLabel})`,
                        description: `${floorLabel}: Не указана проектная площадь (S Проект).`
                    });
                }

                // 3. Критическое расхождение площадей (Правило 15%)
                const diffErr = Validators.checkDiff(f.areaProj, f.areaFact);
                if (diffErr) {
                    errors.push({
                        title: `${building.label} (${block.tabLabel})`,
                        description: `${floorLabel}: Критическое расхождение S Проект/Факт (>15%). Уточните замеры.`
                    });
                }
            });
        });
    });
    return errors;
};

const validateEntrances = (data) => {
    const { composition, buildingDetails, entrancesData } = data;
    const errors = [];

    composition.forEach(building => {
        // Проверяем жилые дома и подземные паркинги
        const isUnderground = building.parkingType === 'underground';
        const isRes = building.category.includes('residential');
        if (!isRes && !isUnderground) return;

        const blocks = getBlocksList(building, buildingDetails);
        const targetBlocks = blocks.filter(b => b.type === 'Ж' || isUnderground);

        targetBlocks.forEach(block => {
            const prefix = `${building.id}_${block.id}`;
            const blockKeys = Object.keys(entrancesData).filter(k => k.startsWith(prefix));
            
            // [FIX] Проверяем сумму значений, а не просто наличие ключей
            let totalApts = 0;
            let totalUnits = 0;
            let totalMop = 0;
            let hasAnyData = false;

            blockKeys.forEach(k => {
                const item = entrancesData[k];
                const a = parseInt(item.apts) || 0;
                const u = parseInt(item.units) || 0;
                const m = parseInt(item.mopQty) || 0;
                
                totalApts += a;
                totalUnits += u;
                totalMop += m;
                
                if (a > 0 || u > 0 || m > 0) hasAnyData = true;
            });

            if (!hasAnyData) {
                errors.push({
                    title: `${building.label} (${block.tabLabel})`,
                    description: "Нет данных о квартирах, офисах или МОП. Заполните матрицу подъездов."
                });
                return;
            }

            // Для жилых блоков обязательно наличие квартир
            if (isRes && block.type === 'Ж') {
                if (totalApts === 0) {
                    errors.push({
                        title: `${building.label} (${block.tabLabel})`,
                        description: "В жилом блоке не указано ни одной квартиры."
                    });
                }
            }
        });
    });
    return errors;
};

const validateApartments = (data) => {
    const { flatMatrix } = data;
    const errors = [];
    const numbersMap = {};

    Object.values(flatMatrix).forEach(unit => {
        if (!unit.num || !unit.buildingId) return;
        const key = `${unit.buildingId}_${unit.num}`;
        if (numbersMap[key]) {
            if (!errors.some(e => e.title.includes(unit.buildingId))) {
                 errors.push({
                    title: "Дубликаты номеров",
                    description: `В здании (ID: ...${unit.buildingId.slice(-4)}) обнаружены повторяющиеся номера помещений: ${unit.num}. Исправьте нумерацию.`
                });
            }
        }
        numbersMap[key] = true;
    });

    return errors;
};

const validateMop = (data) => {
    const { mopData } = data;
    const errors = [];
    
    Object.entries(mopData).forEach(([key, mops]) => {
        if (Array.isArray(mops)) {
            mops.forEach((m, idx) => {
                if (!m.type || !m.area || parseFloat(m.area) <= 0) {
                    if (errors.length < 5) {
                        errors.push({
                            title: "Ошибка в МОП",
                            description: `Обнаружено незаполненное помещение (Тип или Площадь) в одной из записей.`
                        });
                    }
                }
            });
        }
    });
    
    return errors.filter((v,i,a)=>a.findIndex(t=>(t.description===v.description))===i);
};

export const STEP_VALIDATORS = {
    'composition': (data) => {
        const { composition } = data;
        const errors = [];
        const hasResidential = composition.some(c => c.category.includes('residential'));
        if (!hasResidential) {
            errors.push({
                title: "Критическая ошибка состава",
                description: "В проекте отсутствует жилой дом. Необходимо добавить хотя бы один объект типа 'Жилой дом' или 'Многоблочный'."
            });
        }
        return errors;
    },

    'registry_res': (data) => {
        const { composition, buildingDetails } = data;
        let allErrors = [];
        const targetBuildings = composition.filter(b => b.category.includes('residential'));
        for (const building of targetBuildings) {
            allErrors = [...allErrors, ...getBuildingErrors(building, buildingDetails, 'res')];
        }
        return allErrors;
    },

    'registry_nonres': (data) => {
        const { composition, buildingDetails } = data;
        let allErrors = [];
        for (const building of composition) {
            allErrors = [...allErrors, ...getBuildingErrors(building, buildingDetails, 'nonres')];
        }
        return allErrors;
    },

    'floors': validateFloors,
    'entrances': validateEntrances,
    'apartments': validateApartments,
    'mop': validateMop,
    'parking_config': (data) => [] 
};

export const validateStepCompletion = (stepId, contextData) => {
    const validator = STEP_VALIDATORS[stepId];
    if (!validator) return null;
    const errors = validator(contextData);
    return errors.length > 0 ? errors : null;
};