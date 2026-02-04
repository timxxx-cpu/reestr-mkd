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
    const blocks = getBlocksList(building, buildingDetails); // Добавили buildingDetails для корректных названий
    
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
                const rawValue = details[rawField];
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
                                   key.includes('floor_') ? `${key.split('_floor_')[1]} этаж` : 'Этаж';

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
    const { composition, buildingDetails, entrancesData, floorData } = data;
    const errors = [];

    composition.forEach(building => {
        // Уточняем тип паркинга: это должен быть именно отдельный паркинг подземного типа
        const isParking = building.category === 'parking_separate';
        const isUnderground = isParking && building.parkingType === 'underground';
        const isRes = building.category.includes('residential');

        // Пропускаем типы, для которых этот шаг не актуален (Инфраструктура, Наземные паркинги)
        if (!isRes && !isUnderground) return;

        const blocks = getBlocksList(building, buildingDetails);
        
        // Фильтруем блоки: Оставляем только Жилые ('Ж') или Подземный паркинг.
        // Нежилые блоки ('Н') в составе МКД и Инфраструктуру исключаем из проверки.
        const targetBlocks = blocks.filter(b => b.type === 'Ж' || (isParking && isUnderground));

        targetBlocks.forEach(block => {
            const prefix = `${building.id}_${block.id}`;
            const blockEntrancesKeys = Object.keys(entrancesData).filter(k => k.startsWith(prefix));
            const details = buildingDetails[`${building.id}_${block.id}`] || {};
            const commFloors = details.commercialFloors || []; // Список этажей, отмеченных как коммерческие
            
            // Получаем количество подъездов из конфигурации
            const entrancesCount = parseInt(details.entrances || details.inputs || 1);
            const entrancesList = Array.from({ length: entrancesCount }, (_, i) => i + 1);

            // 1. Глобальная проверка: есть ли вообще данные
            let hasAnyData = false;
            blockEntrancesKeys.forEach(k => {
                const item = entrancesData[k];
                const a = parseInt(item.apts) || 0;
                const u = parseInt(item.units) || 0;
                const m = parseInt(item.mopQty) || 0;
                if (a > 0 || u > 0 || m > 0) hasAnyData = true;
            });

            if (!hasAnyData) {
                errors.push({
                    title: `${building.label} (${block.tabLabel})`,
                    description: "Нет данных о квартирах, офисах или МОП. Заполните матрицу."
                });
                return;
            }

            // 2. Детальная проверка по этажам (Только для жилых блоков)
            if (isRes && block.type === 'Ж') {
                // Получаем список этажей из floorData для этого блока
                const blockFloorKeys = Object.keys(floorData).filter(k => k.startsWith(prefix));
                
                blockFloorKeys.forEach(floorKey => {
                    const floor = floorData[floorKey];
                    const floorId = floorKey.substring(prefix.length + 1);
                    
                    // Формирование читаемого названия этажа
                    let floorLabel = floorId;
                    let floorNumForCheck = null; 

                    if (floorId.startsWith('floor_')) {
                        const num = parseInt(floorId.split('_')[1]);
                        floorLabel = `${num} этаж`;
                        floorNumForCheck = num;
                    } 
                    else if (floorId.startsWith('base_')) {
                        const baseId = floorId.split('_')[1];
                        floorLabel = 'Подвал';
                        floorNumForCheck = `basement_${baseId}`;
                    }
                    else if (floorId === 'attic') { floorLabel = 'Мансарда'; floorNumForCheck = 'attic'; }
                    else if (floorId === 'tsokol') { floorLabel = 'Цоколь'; floorNumForCheck = 'tsokol'; }
                    else if (floorId === 'loft') { floorLabel = 'Чердак'; floorNumForCheck = 'loft'; }
                    else if (floorId === 'roof') { floorLabel = 'Кровля'; floorNumForCheck = 'roof'; }

                    // Проверяем, является ли этаж коммерческим (Смешанным)
                    const isMixed = floor.type === 'mixed' || (floorNumForCheck && commFloors.includes(floorNumForCheck));

                    // Игнорируемые типы для жилой проверки
                    const ignorableTypes = [
                        'technical', 'parking_floor', 'stylobate', 'office',
                        'basement', 'tsokol', 'roof', 'loft'
                    ];

                    // А. Проверка Коммерческого/Смешанного этажа
                    if (isMixed) {
                        // Суммируем данные по всем подъездам
                        let totalApts = 0;
                        let totalUnits = 0;
                        
                        entrancesList.forEach(e => {
                            const entKey = `${prefix}_ent${e}_${floorId}`;
                            const item = entrancesData[entKey] || {};
                            totalApts += parseInt(item.apts) || 0;
                            totalUnits += parseInt(item.units) || 0;
                        });

                        // Разрешаем смешанный этаж, если на нем есть ХОТЯ БЫ что-то (квартиры или офисы)
                        if (totalUnits === 0 && totalApts === 0) {
                             errors.push({
                                title: `${building.label} (${block.tabLabel})`,
                                description: `${floorLabel}: Отмечен как нежилой/смешанный, но не указаны помещения.`
                            });
                        } 
                    }
                    // Б. Проверка Жилого этажа (ОБЯЗАТЕЛЬНОЕ НАЛИЧИЕ КВАРТИР В КАЖДОМ ПОДЪЕЗДЕ)
                    else {
                        if (!ignorableTypes.includes(floor.type)) {
                            // Проверяем КАЖДЫЙ подъезд на этом этаже
                            entrancesList.forEach(e => {
                                const entKey = `${prefix}_ent${e}_${floorId}`;
                                const item = entrancesData[entKey] || {};
                                const aptCount = parseInt(item.apts) || 0;
                                const mopCount = parseInt(item.mopQty) || 0;

                                if (aptCount === 0) {
                                    // Если квартир нет, проверяем, не дуплекс ли это (второй свет)
                                    let isExtensionOfDuplex = false;
                                    
                                    if (floorId.startsWith('floor_')) {
                                        const floorNum = parseInt(floorId.split('_')[1]);
                                        if (floorNum > 1) {
                                            const prevFloorKey = `${prefix}_floor_${floorNum - 1}`;
                                            const prevFloor = floorData[prevFloorKey];
                                            if (prevFloor && prevFloor.isDuplex) {
                                                isExtensionOfDuplex = true;
                                            }
                                        }
                                    }

                                    // Ошибка только если нет квартир, это не дуплекс И нет МОП
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
            }
        });
    });
    return errors;
};

const validateApartments = (data) => {
    // ВАЖНО: Достаем floorData для проверки флага isDuplex
    const { flatMatrix, entrancesData, composition, buildingDetails, floorData } = data;
    const errors = [];
    const numbersMap = {};
    const emptyUnits = [];

    // 1. Проверка на дубликаты (среди СОХРАНЕННЫХ/ВВЕДЕННЫХ)
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
            
            // --- ПРОВЕРКА ДУПЛЕКСОВ ---
            // Находим все этажи этого блока, которые помечены как isDuplex
            const blockFloorKeys = Object.keys(floorData).filter(k => k.startsWith(prefix));
            
            blockFloorKeys.forEach(floorKey => {
                 const floor = floorData[floorKey];
                 if (floor && floor.isDuplex) {
                     // [FIX] Надежное извлечение ID. floorKey = prefix + '_' + floorId
                     // Проверяем, что ключ длиннее префикса и разделителя
                     if (floorKey.length > prefix.length + 1) {
                         const floorId = floorKey.substring(prefix.length + 1);
                         
                         let hasUnitsOnFloor = false;
                         let hasDuplexUnit = false;

                         // Ищем все подъезды, которые пересекаются с этим этажом
                         Object.keys(entrancesData).forEach(entKey => {
                             // Проверяем: это данные для текущего блока и текущего этажа?
                             // Используем точное совпадение суффикса
                             if (entKey.startsWith(prefix) && entKey.endsWith(`_${floorId}`)) {
                                 const entry = entrancesData[entKey];
                                 const aptCount = parseInt(entry.apts || 0);
                                 
                                 if (aptCount > 0) {
                                     hasUnitsOnFloor = true;
                                     
                                     // Извлекаем индекс подъезда
                                     // Формат: ..._entX_floorId
                                     const match = entKey.match(/_ent(\d+)_(.*)$/);
                                     if (match) {
                                         const entIndex = match[1];
                                         // Проверяем каждую квартиру на наличие типа duplex
                                         for (let i = 0; i < aptCount; i++) {
                                             const unitKey = `${prefix}_e${entIndex}_f${floorId}_i${i}`;
                                             const unit = flatMatrix[unitKey];
                                             if (unit && (unit.type === 'duplex_up' || unit.type === 'duplex_down')) {
                                                 hasDuplexUnit = true;
                                             }
                                         }
                                     }
                                 }
                             }
                         });

                         if (hasUnitsOnFloor && !hasDuplexUnit) {
                             const fLabel = floor.label || floorId;
                             errors.push({
                                 title: "Ошибка дуплекса",
                                 description: `Блок "${block.tabLabel}", этаж ${fLabel}: отмечен как "Дуплексный", но не выбрано ни одной двухуровневой квартиры (Верх/Низ).`
                             });
                         }
                     }
                 }
            });
            // --- КОНЕЦ ПРОВЕРКИ ДУПЛЕКСОВ ---


            // --- ПРОВЕРКА ПУСТЫХ НОМЕРОВ ---
            Object.keys(entrancesData).forEach(entKey => {
                if (entKey.startsWith(prefix)) {
                    const entry = entrancesData[entKey];
                    const aptCount = parseInt(entry.apts || 0);
                    
                    if (aptCount > 0) {
                        const match = entKey.match(/_ent(\d+)_(.*)$/);
                        if (match) {
                            const entIndex = match[1];
                            const floorId = match[2];
                            
                            for (let i = 0; i < aptCount; i++) {
                                const unitKey = `${prefix}_e${entIndex}_f${floorId}_i${i}`;
                                const unit = flatMatrix[unitKey];
                                const num = unit?.num ? String(unit.num).trim() : '';
                                
                                if (!unit || num === '') {
                                    emptyUnits.push(unitKey); 
                                }
                            }
                        }
                    }
                }
            });
        });
    });

    if (emptyUnits.length > 0) {
        errors.push({
            title: "Незаполненные номера",
            description: `Обнаружено ${emptyUnits.length} помещений без номера. Введите номера для всех квартир.`
        });
    }

    return errors;
};

const validateMop = (data) => {
    const { mopData, entrancesData, buildingDetails, composition, floorData } = data;
    const errors = [];

    composition.forEach(building => {
        // Проверяем только жилые дома и подземные паркинги
        const isUnderground = building.parkingType === 'underground';
        const isRes = building.category.includes('residential');
        if (!isRes && !isUnderground) return;

        const blocks = getBlocksList(building, buildingDetails);
        const targetBlocks = blocks.filter(b => b.type === 'Ж' || isUnderground);

        targetBlocks.forEach(block => {
            const prefix = `${building.id}_${block.id}`;
            const details = buildingDetails[prefix] || {};
            // Для подземного паркинга inputs, для жилого entrances
            const entrancesCount = parseInt(details.entrances || details.inputs || 1);
            const entrancesList = Array.from({ length: entrancesCount }, (_, i) => i + 1);

            // Получаем список этажей
            const blockFloorKeys = Object.keys(floorData).filter(k => k.startsWith(prefix));
            
            blockFloorKeys.forEach(floorKey => {
                const floorId = floorKey.substring(prefix.length + 1);
                // Исключаем крыши
                if (floorId.includes('roof')) return; 

                // Формируем читаемое название
                let floorLabel = floorId;
                if (floorId.startsWith('floor_')) floorLabel = `${floorId.split('_')[1]} этаж`;
                else if (floorId.startsWith('base_')) floorLabel = 'Подвал';
                else if (floorId.startsWith('level_minus_')) floorLabel = `Уровень -${floorId.split('_')[2]}`;

                entrancesList.forEach(e => {
                    const entKey = `${prefix}_ent${e}_${floorId}`;
                    const targetQty = parseInt(entrancesData[entKey]?.mopQty || 0);
                    
                    if (targetQty > 0) {
                        const mopKey = `${prefix}_e${e}_f${floorId}_mops`;
                        const mops = mopData[mopKey] || [];
                        
                        // Проверка 1: Количество
                        if (mops.length < targetQty) {
                            errors.push({
                                title: `${building.label} (${block.tabLabel})`,
                                description: `${floorLabel} (Подъезд ${e}): Заявлено ${targetQty} МОП, а заполнено ${mops.length}.`
                            });
                        }

                        // Проверка 2: Качество
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
    
    // Удаляем дубликаты ошибок (для чистоты UI)
    return errors.filter((v,i,a)=>a.findIndex(t=>(t.description===v.description))===i);
};

const validateParkingConfig = (data) => {
    const { composition, buildingDetails, parkingPlaces } = data;
    const errors = [];

    composition.forEach(building => {
        const blocks = getBlocksList(building, buildingDetails);

        // 1. ОТДЕЛЬНЫЙ ПАРКИНГ
        if (building.category === 'parking_separate') {
            const isCapital = building.constructionType === 'capital';
            const isUnderground = building.parkingType === 'underground';
            const details = buildingDetails[`${building.id}_main`] || {};

            // Валидация конфигурации
            if (isUnderground && !details.levelsDepth) {
                errors.push({ title: building.label, description: "Не указана глубина подземного паркинга." });
            }
            if (!isUnderground && isCapital && !details.floorsCount) {
                errors.push({ title: building.label, description: "Не указана этажность паркинга." });
            }

            // Проверка мест (только для капитальных)
            // Ищем все места, привязанные к этому зданию (buildingId совпадает с ключом)
            // Ключи паркинга: buildingId_main_level...
            const hasPlaces = Object.keys(parkingPlaces).some(k => k.startsWith(`${building.id}_main`) && k.includes('_place'));
            
            if (isCapital || isUnderground) {
                if (!hasPlaces) {
                    errors.push({ title: building.label, description: "Не создано ни одного машиноместа." });
                }
            }
        } 
        
        // 2. ЖИЛОЙ ДОМ (Подземный паркинг в подвалах)
        else if (building.category.includes('residential')) {
            const features = buildingDetails[`${building.id}_features`] || {};
            const basements = features.basements || [];

            // Пробегаем по блокам
            blocks.forEach(block => {
                // Ищем подвалы этого блока
                const blockBasements = basements.filter(b => b.blocks?.includes(block.id));
                
                blockBasements.forEach(base => {
                    // Если паркинг глобально выключен в подвале - пропускаем
                    if (!base.hasParking) return;

                    const depth = parseInt(base.depth || 1);
                    for (let d = 1; d <= depth; d++) {
                        // Проверяем статус конкретного уровня
                        let isLevelEnabled = true; // По умолчанию включен, если hasParking=true (старый формат)
                        if (base.parkingLevels && base.parkingLevels[d] !== undefined) {
                            isLevelEnabled = base.parkingLevels[d];
                        }

                        if (isLevelEnabled) {
                            // Формируем ключ для проверки количества мест
                            // Ключ: {blockFullId}_base_{baseId}_L{d}_meta
                            const levelId = `base_${base.id}_L${d}`;
                            const metaKey = `${block.fullId}_${levelId}_meta`;
                            
                            const countVal = parkingPlaces[metaKey]?.count;
                            const count = parseInt(countVal || 0);

                            if (!countVal || count <= 0) {
                                errors.push({
                                    title: `${building.label} (${block.tabLabel})`,
                                    description: `Подвал (Уровень -${d}): Паркинг отмечен активным, но количество мест не указано (или 0).`
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
