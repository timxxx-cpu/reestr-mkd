/**
 * UJ Identifier System
 * * Трёхуровневая система идентификации объектов недвижимости
 * Формат: UJ000000-ZD00-EL000
 * * Уровень I: Проект (UJ000000)
 * Уровень II: Здание (ZR00, ZM00, ZP00, ZI00)
 * Уровень III: Помещение (EF000, EO000, EP000)
 */

// Маппинг категорий зданий на префиксы ZD
export const BUILDING_TYPE_PREFIXES = {
  residential_single: 'ZR', // Жилой дом (одноблочный)
  residential_multi: 'ZM', // Многоблочный жилой дом
  parking_separate: 'ZP', // Паркинг (отдельно стоящий)
  parking_integrated: 'ZP', // Паркинг (встроенный/пристроенный)
  infrastructure: 'ZI', // Инфраструктура
};

// Маппинг типов помещений на префиксы EL
export const UNIT_TYPE_PREFIXES = {
  flat: 'EF', // Квартира
  duplex_up: 'EF', // Дуплекс (верхний) - тоже квартира
  duplex_down: 'EF', // Дуплекс (нижний) - тоже квартира
  office: 'EO', // Офис/коммерция
  office_inventory: 'EO', // Нежилое помещение
  non_res_block: 'EO', // Нежилой блок
  infrastructure: 'EO', // Инфраструктура (как помещение)
  parking_place: 'EP', // Машиноместо
};

/**
 * Генерация кода проекта (Уровень I)
 * @param {number} sequenceNumber - Порядковый номер проекта в scope
 * @returns {string} Код формата UJ000000
 */
export const generateProjectCode = sequenceNumber => {
  const num = parseInt(String(sequenceNumber), 10) || 0; // FIX: добавлен String()
  return `UJ${String(num).padStart(6, '0')}`;
};

/**
 * Определение префикса здания по категории
 * @param {string} category - Категория здания из БД
 * @param {boolean} hasMultipleBlocks - Есть ли несколько блоков
 * @returns {string} Префикс ZR, ZM, ZP или ZI
 */
export const getBuildingPrefix = (category, hasMultipleBlocks = false) => {
  // Для жилых зданий определяем одноблочный или многоблочный
  if (category === 'residential' || category === 'residential_main') {
    return hasMultipleBlocks ? 'ZM' : 'ZR';
  }

  // Для остальных используем маппинг
  return BUILDING_TYPE_PREFIXES[category] || 'ZR';
};

/**
 * Генерация кода здания (Уровень II)
 * @param {string} prefix - Префикс типа здания (ZR, ZM, ZP, ZI)
 * @param {number} sequenceNumber - Порядковый номер здания данного типа в проекте
 * @returns {string} Код формата ZD00
 */
export const generateBuildingCode = (prefix, sequenceNumber) => {
  const num = parseInt(String(sequenceNumber), 10) || 0; // FIX: добавлен String()
  return `${prefix}${String(num).padStart(2, '0')}`;
};

/**
 * Определение префикса помещения по типу
 * @param {string} unitType - Тип помещения из БД
 * @returns {string} Префикс EF, EO или EP
 */
export const getUnitPrefix = unitType => {
  return UNIT_TYPE_PREFIXES[unitType] || 'EF';
};

/**
 * Генерация кода помещения (Уровень III)
 * @param {string} prefix - Префикс типа помещения (EF, EO, EP)
 * @param {number} sequenceNumber - Порядковый номер помещения данного типа в здании
 * @returns {string} Код формата EL000
 */
export const generateUnitCode = (prefix, sequenceNumber) => {
  const num = parseInt(String(sequenceNumber), 10) || 0; // FIX: добавлен String()
  return `${prefix}${String(num).padStart(3, '0')}`;
};

/**
 * Формирование полного идентификатора
 * @param {string} projectCode - Код проекта (UJ000000)
 * @param {string} buildingCode - Код здания (ZD00)
 * @param {string} unitCode - Код помещения (EL000)
 * @returns {string} Полный код формата UJ000000-ZD00-EL000
 */
export const formatFullIdentifier = (projectCode, buildingCode = null, unitCode = null) => {
  if (!projectCode) {
    return '';
  }

  const normalizedBuildingCode = buildingCode ? String(buildingCode).split('-').pop() : null;
  const normalizedUnitCode = unitCode
    ? (() => {
        const unitParts = String(unitCode).split('-').filter(Boolean);

        if (!normalizedBuildingCode || unitParts.length === 1) {
          return unitParts[unitParts.length - 1] || null;
        }

        if (unitParts[0] === normalizedBuildingCode) {
          return unitParts[unitParts.length - 1] || null;
        }

        return unitParts[unitParts.length - 1] || null;
      })()
    : null;

  if (!normalizedBuildingCode) {
    return projectCode;
  }

  const parts = [projectCode, normalizedBuildingCode];
  if (normalizedUnitCode) {
    parts.push(normalizedUnitCode);
  }

  return parts.join('-');
};

/**
 * Парсинг идентификатора
 * @param {string} identifier - Полный идентификатор
 * @returns {object} Объект с компонентами идентификатора
 */
export const parseIdentifier = identifier => {
  if (!identifier) {
    return { projectCode: null, buildingCode: null, unitCode: null };
  }

  const parts = String(identifier).split('-');

  return {
    projectCode: parts[0] || null,
    buildingCode: parts[1] || null,
    unitCode: parts[2] || null,
  };
};

/**
 * Валидация кода проекта
 * @param {string} code - Код проекта
 * @returns {boolean}
 */
export const isValidProjectCode = code => {
  return /^UJ\d{6}$/.test(code);
};

/**
 * Валидация кода здания
 * @param {string} code - Код здания
 * @returns {boolean}
 */
export const isValidBuildingCode = code => {
  return /^Z[RMPI]\d{2}$/.test(code);
};

/**
 * Валидация кода помещения
 * @param {string} code - Код помещения
 * @returns {boolean}
 */
export const isValidUnitCode = code => {
  return /^E[FOP]\d{3}$/.test(code);
};

/**
 * Извлечение номера из кода
 * @param {string} code - Любой код (UJ000000, ZR01, EF001)
 * @returns {number} Числовая часть кода
 */
export const extractNumber = code => {
  if (!code) return 0;
  const match = String(code).match(/\d+$/);
  return match ? parseInt(match[0], 10) : 0;
};

/**
 * Получение следующего номера для кода
 * @param {string[]} existingCodes - Массив существующих кодов
 * @param {string} prefix - Префикс (опционально, для фильтрации)
 * @returns {number} Следующий доступный номер
 */
export const getNextSequenceNumber = (existingCodes, prefix = null) => {
  if (!existingCodes || existingCodes.length === 0) {
    return 1;
  }

  // Фильтруем по префиксу если указан
  const filtered = prefix
    ? existingCodes.filter(code => String(code).startsWith(prefix))
    : existingCodes;

  if (filtered.length === 0) {
    return 1;
  }

  // Извлекаем все числа
  const numbers = filtered.map(extractNumber).filter(n => n > 0);

  if (numbers.length === 0) {
    return 1;
  }

  // Возвращаем максимум + 1
  return Math.max(...numbers) + 1;
};