import { getBlocksList } from './utils';
import { cleanBlockDetails } from './building-details';
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

// Хелпер для получения виртуального ID из floorKey (для связи с entrancesData)
const getVirtualId = (floorKey) => {
    if (!floorKey) return null;
    if (floorKey.startsWith('floor:')) return `floor_${floorKey.split(':')[1]}`;
    if (floorKey.startsWith('parking:')) {
         const part = floorKey.split(':')[1];
         const level = part.startsWith('-') ? part.substring(1) : part;
         return `level_minus_${level}`;
    }
    if (floorKey.startsWith('basement:')) {
        const parts = floorKey.split(':');
        // Обрабатываем ID вида basement:uuid:depth или просто basement:depth (редко)
        if (parts.length >= 3) {
            const depth = parts[parts.length - 1];
            // Собираем ID подвала обратно (середина)
            const baseId = parts.slice(1, parts.length - 1).join(':'); 
            return `base_${baseId}_L${depth}`;
        }
    }
    if (floorKey.startsWith('tech:')) return `floor_${floorKey.split(':')[1]}_tech`;
    if (['attic', 'loft', 'roof', 'tsokol'].includes(floorKey)) return floorKey;
    
    // Если ключ не распознан, возвращаем как есть (на случай если это простой ID)
    return floorKey;
};

const normalizeNumericDetails = (details) => {
    const normalized = { ...details };
    const invalidFields = new Set();

    NUMERIC_FIELDS.forEach((field) => {
        if (!(field in details)) return;
        const raw = details[field];
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
                invalidFields.add(field);
                delete normalized[field];
                return;
            }
            normalized[field] = num;
            return;
        }
        if (typeof raw === 'number' && Number.isNaN(raw)) {
            invalidFields.add(field);
            delete normalized[field];
        }
    });

    return { normalized, invalidFields };
};

/**
 * Вспомогательная функция для сбора ошибок по конфигурации здания
 */
const getBuildingErrors = (building, buildingDetails, mode) => {
    const errors = [];
    const blocks = getBlocksList(building, buildingDetails); 
    
    const isParking = building.category === 'parking_separate';
    const isInfra = building.category === 'infrastructure';
    const isResidential = building.category.includes('residential');
    const isUnderground = building.parkingType === 'underground' || building.constructionType === 'underground';

    const relevantBlocks = blocks.filter(b => {
        if (mode === 'res') return b.type === 'Ж';
        if (mode === 'nonres') return b.type !== 'Ж';
        return true;
    });

    if (relevantBlocks.length === 0) return [];

    for (const block of relevantBlocks) {
        const detailsKey = `${building.id}_${block.id}`;
        const details = buildingDetails[detailsKey] || {};
        const { normalized: normalizedDetails, invalidFields } = normalizeNumericDetails(details);
        let cleanedDetails = cleanBlockDetails(building, block, normalizedDetails);
        
        let blockName = block.tabLabel;
        if (blockName === 'main') blockName = 'Основной блок';
        const contextTitle = `Объект: ${building.label} (Блок: ${blockName})`;

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

            if (building.parkingType !== 'underground' && building.constructionType !== 'capital') {
                cleanedDetails = { ...cleanedDetails };
                delete cleanedDetails.seismicity;
                delete cleanedDetails.vehicleEntries;
                delete cleanedDetails.inputs;
            }
        }

        if (isParking) {
            if (isUnderground) {
                cleanedDetails = { ...cleanedDetails };
                delete cleanedDetails.floorsCount;
            } else {
                cleanedDetails = { ...cleanedDetails };
                delete cleanedDetails.levelsDepth;
            }
        }

        requiredFields.forEach(field => {
            const val = cleanedDetails[field];
            if (val === undefined || val === '' || val === null) {
                errors.push({
                    title: contextTitle,
                    description: `Поле "${FIELD_NAMES[field] || field}" обязательно для заполнения.`
                });
            }
        });
        
        if (isParking && building.constructionType === 'capital') {
             if (isUnderground) {
                 if (!cleanedDetails.levelsDepth) errors.push({ title: contextTitle, description: "Не указана глубина подземного паркинга." });
             } else {
                 if (!cleanedDetails.floorsCount) errors.push({ title: contextTitle, description: "Не указано количество этажей паркинга." });
             }
        }

        const validation = BuildingConfigSchema.safeParse(cleanedDetails);
        
        if (!validation.success) {
            validation.error.issues.forEach(issue => {
                const rawField = String(issue.path[0]);
                const rawValue = cleanedDetails[rawField];
                const isFieldPresent = rawValue !== undefined
                    && rawValue !== ''
                    && rawValue !== null
                    && rawValue !== false
                    && !(typeof rawValue === 'number' && Number.isNaN(rawValue));
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
        invalidFields.forEach((field) => {
            if (requiredFields.includes(field) && field in cleanedDetails) {
                const fieldName = FIELD_NAMES[field] || field;
                errors.push({
                    title: contextTitle,
                    description: `Поле "${fieldName}": Содержит ошибку.`
                });
            }
        });

        if (building.constructionType !== 'light' && !isInfra) {
             const floorsToCheck = cleanedDetails.floorsTo || cleanedDetails.floorsCount || 1;
             const hasElevatorIssue = Validators.elevatorRequirement(
                isParking, isInfra, floorsToCheck, cleanedDetails.elevators || 0
            );

            if (hasElevatorIssue) {
                errors.push({
                    title: contextTitle,
                    description: `Здание выше 5 этажей (${floorsToCheck} эт.) обязано иметь лифт.`
                });
            }
        }
       
        if (details.hasCustomAddress && (!details.customHouseNumber || details.customHouseNumber.trim() === '')) {
             errors.push({
                title: contextTitle,
                description: `Вы включили опцию "Номер корпуса", но не указали его.`
            });
        }
    }

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
                // Используем label из данных этажа для сообщения об ошибке
                const floorLabel = f.label || key.split('_').pop();

                // 1. Высота (не для крыши)
                if (!['roof'].includes(f.type) && !key.includes('roof')) {
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
    const { composition, buildingDetails, entrancesData, floorData } = data;
    const errors = [];

    composition.forEach(building => {
        const isParking = building.category === 'parking_separate';
        const isUnderground = isParking && building.parkingType === 'underground';
        const isRes = building.category.includes('residential');

        if (!isRes && !isUnderground) return;

        const blocks = getBlocksList(building, buildingDetails);
        const targetBlocks = blocks.filter(b => b.type === 'Ж' || (isParking && isUnderground));

        targetBlocks.forEach(block => {
            const prefix = `${building.id}_${block.id}`;
            const details = buildingDetails[`${building.id}_${block.id}`] || {};
            const commFloors = details.commercialFloors || []; 
            const entrancesCount = parseInt(details.entrances || details.inputs || 1);
            const entrancesList = Array.from({ length: entrancesCount }, (_, i) => i + 1);

            const blockFloorKeys = Object.keys(floorData).filter(k => k.startsWith(prefix));
            
            if (blockFloorKeys.length === 0) return;

            blockFloorKeys.forEach(floorKey => {
                const floor = floorData[floorKey];
                
                // [FIX] Умный поиск виртуального ID
                let virtualFloorId = getVirtualId(floor.floorKey);
                
                // Fallback: Если floorKey нет или он не распознан, пробуем восстановить по индексу или хвосту
                if (!virtualFloorId || (virtualFloorId.length > 30 && !virtualFloorId.startsWith('base'))) {
                    // Если это обычный этаж
                    if (['residential', 'mixed', 'office', 'parking_floor'].includes(floor.type) && floor.index > 0) {
                        virtualFloorId = `floor_${floor.index}`;
                    }
                    // Если тех этаж
                    else if (floor.type === 'technical' && floor.parentFloorIndex > 0) {
                        virtualFloorId = `floor_${floor.parentFloorIndex}_tech`;
                    } else {
                        virtualFloorId = floorKey.split('_').pop();
                    }
                }

                // Красивое название для ошибки
                const floorLabel = floor.label || (floor.index ? `${floor.index} этаж` : virtualFloorId);
                
                // Тип для проверки
                let floorTypeCheck = floor.type;
                if (!floorTypeCheck && floor.floorKey) {
                     if (floor.floorKey.includes('basement')) floorTypeCheck = 'basement';
                     else if (floor.floorKey === 'tsokol') floorTypeCheck = 'tsokol';
                     else if (floor.floorKey === 'attic') floorTypeCheck = 'attic';
                     else if (floor.floorKey === 'loft') floorTypeCheck = 'loft';
                     else if (floor.floorKey === 'roof') floorTypeCheck = 'roof';
                }

                let isMixed = floor.type === 'mixed';
                if (!isMixed) {
                    if (commFloors.includes(virtualFloorId)) isMixed = true;
                    if (virtualFloorId && virtualFloorId.startsWith('floor_') && !virtualFloorId.includes('tech')) {
                        const num = virtualFloorId.split('_')[1];
                        if (commFloors.includes(num)) isMixed = true;
                    }
                }

                const ignorableTypes = [
                    'technical', 'parking_floor', 'stylobate', 'office',
                    'basement', 'tsokol', 'roof', 'loft'
                ];

                // А. Проверка Коммерческого/Смешанного этажа
                if (isMixed) {
                    let totalApts = 0;
                    let totalUnits = 0;
                    
                    entrancesList.forEach(e => {
                        const entKey = `${prefix}_ent${e}_${virtualFloorId}`;
                        const item = entrancesData[entKey] || {};
                        totalApts += parseInt(item.apts) || 0;
                        totalUnits += parseInt(item.units) || 0;
                    });

                    if (totalUnits === 0 && totalApts === 0) {
                            errors.push({
                            title: `${building.label} (${block.tabLabel})`,
                            description: `${floorLabel}: Отмечен как нежилой/смешанный, но не указаны помещения.`
                        });
                    } 
                }
                // Б. Проверка Жилого этажа
                else {
                    if (!ignorableTypes.includes(floor.type) && !ignorableTypes.includes(floorTypeCheck)) {
                        entrancesList.forEach(e => {
                            const entKey = `${prefix}_ent${e}_${virtualFloorId}`;
                            const item = entrancesData[entKey] || {};
                            const aptCount = parseInt(item.apts) || 0;
                            const mopCount = parseInt(item.mopQty) || 0;

                            if (aptCount === 0) {
                                let isExtensionOfDuplex = false;
                                if (floor.index > 1) {
                                     // Попытка найти этаж ниже
                                     const prevFloors = Object.values(floorData).filter(f => f.blockId === block.id && f.index === floor.index - 1);
                                     if (prevFloors.length > 0 && prevFloors[0].isDuplex) isExtensionOfDuplex = true;
                                }

                                if (!isExtensionOfDuplex && mopCount === 0) {
                                    errors.push({
                                        title: `${building.label} (${block.tabLabel})`,
                                        description: `${floorLabel} (Подъезд ${e}): Не указано количество квартир.`
                                    });
                                }
                            }
                        });
                    }
                }
            });
        });
    });
    return errors;
};

const validateApartments = (data) => {
    const { flatMatrix, entrancesData, composition, buildingDetails, floorData } = data;
    const errors = [];
    const numbersMap = {};
    const emptyUnits = [];

    // 1. Проверка на дубликаты
    Object.values(flatMatrix).forEach(unit => {
        if (!unit.buildingId) return;
        const num = String(unit.num || '').trim();
        if (num !== '') {
            const key = `${unit.buildingId}_${num}`;
            if (numbersMap[key]) {
                if (!errors.some(e => e.title === "Дубликаты номеров" && e.description.includes(unit.buildingId.slice(-4)) && e.description.includes(num))) {
                     errors.push({
                        title: "Дубликаты номеров",
                        description: `В здании (ID: ...${unit.buildingId.slice(-4)}) обнаружен повторяющийся номер: "${num}".`
                    });
                }
            }
            numbersMap[key] = true;
        }
    });

    // 2. Проверка на наличие пустых номеров и ЛОГИКА ДУПЛЕКСОВ
    composition.forEach(building => {
        if (!building.category.includes('residential')) return;

        const blocks = getBlocksList(building, buildingDetails);
        const residentialBlocks = blocks.filter(b => b.type === 'Ж');

        residentialBlocks.forEach(block => {
            const prefix = `${building.id}_${block.id}`;
            const blockFloorKeys = Object.keys(floorData).filter(k => k.startsWith(prefix));
            
            // ПРОВЕРКА ДУПЛЕКСОВ
            blockFloorKeys.forEach(floorKey => {
                 const floor = floorData[floorKey];
                 if (floor && floor.isDuplex) {
                     let virtualFloorId = getVirtualId(floor.floorKey);
                     if (!virtualFloorId && floor.index > 0) virtualFloorId = `floor_${floor.index}`;
                     if (!virtualFloorId) virtualFloorId = floorKey.split('_').pop();
                     
                     let hasUnitsOnFloor = false;
                     let hasDuplexUnit = false;

                     Object.keys(entrancesData).forEach(entKey => {
                         if (entKey.startsWith(prefix) && entKey.endsWith(`_${virtualFloorId}`)) {
                             const entry = entrancesData[entKey];
                             const aptCount = parseInt(entry.apts || 0);
                             
                             if (aptCount > 0) {
                                 hasUnitsOnFloor = true;
                                 const match = entKey.match(/_ent(\d+)_(.*)$/);
                                 if (match) {
                                     Object.values(flatMatrix).forEach(u => {
                                         if (u.blockId === block.id && 
                                            (u.floorId === floor.id || u.floorId === virtualFloorId) && 
                                            (u.type === 'duplex_up' || u.type === 'duplex_down')) {
                                             hasDuplexUnit = true;
                                         }
                                     });
                                 }
                             }
                         }
                     });

                     if (hasUnitsOnFloor && !hasDuplexUnit) {
                         const fLabel = floor.label || virtualFloorId;
                         errors.push({
                             title: "Ошибка дуплекса",
                             description: `Блок "${block.tabLabel}", этаж ${fLabel}: отмечен как "Дуплексный", но не выбрано ни одной двухуровневой квартиры.`
                         });
                     }
                 }
            });

            // ПРОВЕРКА ПУСТЫХ НОМЕРОВ
            Object.values(flatMatrix).forEach(u => {
                if (u.blockId === block.id && u.type !== 'office' && u.type !== 'pantry') {
                    if (!u.num || String(u.num).trim() === '') {
                        emptyUnits.push(u.id);
                    }
                }
            });
        });
    });

    if (emptyUnits.length > 0) {
        errors.push({
            title: "Незаполненные номера",
            description: `Обнаружено ${emptyUnits.length} помещений без номера.`
        });
    }

    return errors;
};

const validateMop = (data) => {
    const { mopData, entrancesData, buildingDetails, composition, floorData } = data;
    const errors = [];

    composition.forEach(building => {
        const isUnderground = building.parkingType === 'underground';
        const isRes = building.category.includes('residential');
        if (!isRes && !isUnderground) return;

        const blocks = getBlocksList(building, buildingDetails);
        const targetBlocks = blocks.filter(b => b.type === 'Ж' || isUnderground);

        targetBlocks.forEach(block => {
            const prefix = `${building.id}_${block.id}`;
            const details = buildingDetails[prefix] || {};
            const entrancesCount = parseInt(details.entrances || details.inputs || 1);
            const entrancesList = Array.from({ length: entrancesCount }, (_, i) => i + 1);

            const blockFloorKeys = Object.keys(floorData).filter(k => k.startsWith(prefix));
            
            blockFloorKeys.forEach(floorKey => {
                const floor = floorData[floorKey];
                let virtualFloorId = getVirtualId(floor.floorKey);
                if (!virtualFloorId && floor.index > 0) virtualFloorId = `floor_${floor.index}`;
                if (!virtualFloorId) virtualFloorId = floorKey.split('_').pop();
                
                if (virtualFloorId.includes('roof')) return; 

                const floorLabel = floor.label || virtualFloorId;

                entrancesList.forEach(e => {
                    const entKey = `${prefix}_ent${e}_${virtualFloorId}`;
                    const targetQty = parseInt(entrancesData[entKey]?.mopQty || 0);
                    
                    if (targetQty > 0) {
                        const mopKey = `${prefix}_e${e}_f${virtualFloorId}_mops`;
                        const mops = mopData[mopKey] || [];
                        
                        if (mops.length < targetQty) {
                            errors.push({
                                title: `${building.label} (${block.tabLabel})`,
                                description: `${floorLabel} (Подъезд ${e}): Заявлено ${targetQty} МОП, а заполнено ${mops.length}.`
                            });
                        }

                        mops.slice(0, targetQty).forEach((m, idx) => {
                            if (!m.type || !m.area || parseFloat(m.area) <= 0) {
                                errors.push({
                                    title: `${building.label} (${block.tabLabel})`,
                                    description: `${floorLabel} (Подъезд ${e}): У помещения №${idx + 1} не заполнен тип или площадь.`
                                });
                            }
                        });
                    }
                });
            });
        });
    });
    
    return errors.filter((v,i,a)=>a.findIndex(t=>(t.description===v.description))===i);
};

const validateParkingConfig = (data) => {
    const { composition, buildingDetails, parkingPlaces } = data;
    const errors = [];

    composition.forEach(building => {
        const blocks = getBlocksList(building, buildingDetails);

        if (building.category === 'parking_separate') {
            const isCapital = building.constructionType === 'capital';
            const isUnderground = building.parkingType === 'underground';
            const details = buildingDetails[`${building.id}_main`] || {};

            if (isUnderground && !details.levelsDepth) {
                errors.push({ title: building.label, description: "Не указана глубина подземного паркинга." });
            }
            if (!isUnderground && isCapital && !details.floorsCount) {
                errors.push({ title: building.label, description: "Не указана этажность паркинга." });
            }

            const hasPlaces = Object.keys(parkingPlaces).some(k => k.startsWith(`${building.id}_main`) && k.includes('_place'));
            
            if (isCapital || isUnderground) {
                if (!hasPlaces) {
                    errors.push({ title: building.label, description: "Не создано ни одного машиноместа." });
                }
            }
        } 
        
        else if (building.category.includes('residential')) {
            const features = buildingDetails[`${building.id}_features`] || {};
            const basements = features.basements || [];

            blocks.forEach(block => {
                const blockBasements = basements.filter(b => b.blocks?.includes(block.id));
                
                blockBasements.forEach(base => {
                    if (!base.hasParking) return;

                    const depth = parseInt(base.depth || 1);
                    for (let d = 1; d <= depth; d++) {
                        let isLevelEnabled = true;
                        if (base.parkingLevels && base.parkingLevels[d] !== undefined) {
                            isLevelEnabled = base.parkingLevels[d];
                        }

                        if (isLevelEnabled) {
                            const levelId = `base_${base.id}_L${d}`;
                            const metaKey = `${block.fullId}_${levelId}_meta`;
                            
                            const countVal = parkingPlaces[metaKey]?.count;
                            const count = parseInt(countVal || 0);

                            if (!countVal || count <= 0) {
                                errors.push({
                                    title: `${building.label} (${block.tabLabel})`,
                                    description: `Подвал (Уровень -${d}): Паркинг отмечен активным, но количество мест не указано.`
                                });
                            }
                        }
                    }
                });
            });
        }
    });

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
    'parking_config': validateParkingConfig
};

export const validateStepCompletion = (stepId, contextData) => {
    const validator = STEP_VALIDATORS[stepId];
    if (!validator) return null;
    const errors = validator(contextData);
    return errors.length > 0 ? errors : null;
};