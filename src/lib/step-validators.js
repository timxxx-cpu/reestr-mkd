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
 * Вспомогательная функция для сбора ошибок по одному зданию
 */
const getBuildingErrors = (building, buildingDetails, mode) => {
    const errors = [];
    const blocks = getBlocksList(building);
    
    // Определяем тип здания
    const isParking = building.category === 'parking_separate';
    const isInfra = building.category === 'infrastructure';
    const isResidential = building.category.includes('residential');
    
    // Надежная проверка на подземный тип (учитываем разные возможные значения в модели)
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
            // Общие поля для всех блоков в жилом комплексе (Ж и Н)
            requiredFields.push('foundation', 'walls', 'slabs', 'roof', 'seismicity');
            
            // И для жилых, и для нежилых блоков в ЖК нужны подъезды (или входы) и этажность
            requiredFields.push('entrances', 'floorsFrom', 'floorsTo');
        } else if (isInfra) {
            // Инфраструктура
            requiredFields.push('floorsCount', 'inputs', 'foundation', 'walls', 'slabs', 'roof', 'seismicity');
        } else if (isParking) {
            // Паркинги
            if (building.constructionType === 'capital') {
                 // Капитальный
                 requiredFields.push('foundation', 'walls', 'slabs', 'roof', 'seismicity', 'vehicleEntries', 'inputs');
            } else if (building.constructionType === 'light') {
                // Легкие конструкции
                requiredFields.push('lightStructureType');
            }
        }

        // 2. Проверяем заполненность обязательных полей (Наши жесткие правила)
        requiredFields.forEach(field => {
            const val = details[field];
            if (val === undefined || val === '' || val === null) {
                errors.push({
                    title: contextTitle,
                    description: `Поле "${FIELD_NAMES[field] || field}" обязательно для заполнения.`
                });
            }
        });
        
        // Спец. проверка для капитальных паркингов (этажность/глубина)
        if (isParking && building.constructionType === 'capital') {
             if (isUnderground) {
                 if (!details.levelsDepth) errors.push({ title: contextTitle, description: "Не указана глубина подземного паркинга." });
             } else {
                 if (!details.floorsCount) errors.push({ title: contextTitle, description: "Не указано количество этажей паркинга." });
             }
        }

        // 3. Валидация Zod (проверка типов и диапазонов)
        // Схема Zod теперь relaxed (все optional), поэтому она ругается только на некорректные данные (например, "текст" в поле числа),
        // а не на отсутствие полей.
        const validation = BuildingConfigSchema.safeParse(details);
        
        if (!validation.success) {
            validation.error.issues.forEach(issue => {
                const rawField = String(issue.path[0]);
                
                // Проверяем, есть ли поле физически (даже если пустое)
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
                description: `Вы указали "Свой номер дома", но не ввели его.`
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
            if (building.category === 'residential_multiblock') {
                const blocks = getBlocksList(building);
                if (blocks.length > 0) {
                    const allCustom = blocks.every(block => {
                        const key = `${building.id}_${block.id}`;
                        const details = buildingDetails[key];
                        return details?.hasCustomAddress === true;
                    });
                    if (allCustom) {
                        allErrors.push({
                            title: `Объект: ${building.label}`,
                            description: "Ошибка адресации: Все блоки имеют индивидуальный номер дома. Минимум один блок должен наследовать основной номер."
                        });
                    }
                }
            }
            const configErrors = getBuildingErrors(building, buildingDetails, 'res');
            allErrors = [...allErrors, ...configErrors];
        }
        return allErrors;
    },

    'registry_nonres': (data) => {
        const { composition, buildingDetails } = data;
        let allErrors = [];
        for (const building of composition) {
            const configErrors = getBuildingErrors(building, buildingDetails, 'nonres');
            allErrors = [...allErrors, ...configErrors];
        }
        return allErrors;
    },
};

export const validateStepCompletion = (stepId, contextData) => {
    const validator = STEP_VALIDATORS[stepId];
    if (!validator) return null;
    const errors = validator(contextData);
    return errors.length > 0 ? errors : null;
};