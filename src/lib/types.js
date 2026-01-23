/**
 * @fileoverview Глобальные определения типов для проекта Reestr MKD
 * Здесь описаны структуры данных, используемые в Firebase и компонентах.
 */

/**
 * Полная структура данных проекта (Основной документ + локальный стейт)
 * @typedef {Object} ProjectMeta
 * @property {string} [id] - Уникальный ID проекта
 * @property {string} [name] - Название ЖК
 * @property {string} [status] - Статус
 * @property {string} [lastModified] - Дата изменения
 * @property {string} [author] - Автор
 * * // Основные данные
 * @property {Object} [complexInfo] - Паспортные данные
 * @property {Object} [participants] - Участники
 * @property {Object} [cadastre] - Кадастр
 * @property {Array} [documents] - Документы
 * @property {Array<BuildingMeta>} [composition] - Список зданий
 * @property {Object.<string, BuildingConfig>} [buildingDetails] - Конфигурация (этажность, стены)
 * * // Временные поля для локального стейта
 * @property {Object.<string, FloorData>} [floorData]
 * @property {Object.<string, EntranceData>} [entrancesData]
 * @property {Object.<string, Array<MopItem>>} [mopData]
 * @property {Object.<string, UnitData>} [flatMatrix]
 * @property {Object.<string, ParkingPlace>} [parkingPlaces]
 * * // Поля совместимости
 * @property {Object.<string, Array<MopItem>>} [commonAreasData]
 * @property {Object.<string, UnitData>} [apartmentsData]
 * @property {Object.<string, ParkingPlace>} [parkingData]
 */

/**
 * Краткая информация о здании (для списка composition)
 * @typedef {Object} BuildingMeta
 * @property {string} id
 * @property {string} label
 * @property {string} houseNumber
 * @property {'residential' | 'parking_separate' | 'infrastructure'} category
 * @property {string} type
 * @property {string} stage
 * @property {string} [dateStart]
 * @property {string} [dateEnd]
 * @property {number} [resBlocks]
 * @property {number} [nonResBlocks]
 * @property {boolean} [hasNonResPart]
 * @property {string} [parkingType]
 * @property {string} [constructionType]
 * @property {string} [infraType]
 */

/**
 * Полные данные здания (хранятся в под-коллекции 'buildings')
 * @typedef {Object} BuildingData
 * @property {Object.<string, BuildingConfig>} [buildingDetails] - СЛОВАРЬ конфигураций блоков
 * @property {Object.<string, FloorData>} [floorData]
 * @property {Object.<string, EntranceData>} [entrancesData]
 * @property {Object.<string, Array<MopItem>>} [commonAreasData]
 * @property {Object.<string, UnitData>} [apartmentsData]
 * @property {Object.<string, ParkingPlace>} [parkingData]
 */

/**
 * Конфигурация конкретного блока здания
 * @typedef {Object} BuildingConfig
 * @property {number} [floorsFrom]
 * @property {number} [floorsTo]
 * @property {number} [entrances]
 * @property {boolean} [hasBasementFloor]
 * @property {string[]} [technicalFloors]
 * @property {string[]} [commercialFloors]
 * @property {string[]} [parentBlocks]
 * @property {number} [levelsDepth]
 * @property {number} [floorsCount]
 * @property {number} [inputs]
 * @property {number} [vehicleEntries]
 * @property {number} [elevators]
 * @property {Object} [engineering]
 */

/**
 * Данные одного этажа
 * @typedef {Object} FloorData
 * @property {string} height
 * @property {string} areaProj
 * @property {string} areaFact
 * @property {boolean} [isDuplex]
 */

/**
 * Данные подъезда на этаже
 * @typedef {Object} EntranceData
 * @property {number} apts
 * @property {number} units
 * @property {number} mopQty
 */

/**
 * Единица недвижимости
 * @typedef {Object} UnitData
 * @property {string} num
 * @property {string} area
 * @property {'flat' | 'office' | 'pantry' | 'duplex_up' | 'duplex_down'} type
 * @property {number} [rooms]
 */

/**
 * Элемент МОП
 * @typedef {Object} MopItem
 * @property {string|number} id
 * @property {string} type
 * @property {string} area
 */

/**
 * Парковочное место
 * @typedef {Object} ParkingPlace
 * @property {string} number
 * @property {string} area
 * @property {boolean} [isSold]
 * @property {Object} [meta]
 */

export const Types = {};