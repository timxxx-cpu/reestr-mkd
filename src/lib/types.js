/**
 * @fileoverview Глобальные определения типов для проекта Reestr MKD
 * Здесь описаны структуры данных, используемые в Firebase и компонентах.
 */

/**
 * Полная структура данных проекта (Основной документ + локальный стейт)
 * @typedef {Object} ProjectMeta
 * @property {string} [id] - Уникальный ID проекта
 * @property {string} [name] - Название ЖК
 * @property {string} [status] - Статус (Проектный, Строящийся, Введенный, Архив)
 * @property {string} [lastModified] - ISO дата последнего изменения
 * @property {string} [author] - Имя автора
 * * // --- НОВОЕ ПОЛЕ: Данные заявления (Процесс) ---
 * @property {Object} [applicationInfo] - Информация о заявке и процессе обработки
 * @property {string} [applicationInfo.internalNumber] - Внутренний номер заявки
 * @property {string} [applicationInfo.externalSource] - Источник (ЕПИГУ, ДХМ...)
 * @property {string} [applicationInfo.externalId] - Номер во внешней системе
 * @property {string} [applicationInfo.applicant] - Заявитель
 * @property {string} [applicationInfo.landCadastre] - Кадастр участка
 * @property {string} [applicationInfo.submissionDate] - Дата подачи
 * @property {string} [applicationInfo.status] - Текущий статус (NEW, DRAFT, REVIEW...)
 * @property {string} [applicationInfo.assignee] - ID исполнителя (Техника)
 * @property {string} [applicationInfo.assigneeName] - Имя исполнителя
 * @property {number} [applicationInfo.currentStage] - Текущий этап проверки
 * @property {Array<number>} [applicationInfo.verifiedSteps] - Список проверенных шагов
 * @property {Array<{date: string, status: string, user: string, comment?: string}>} [applicationInfo.history] - История изменений
 * * // --- Основные данные ---
 * @property {Object} [complexInfo] - Паспортные данные (адрес, район и т.д.)
 * @property {Object} [participants] - Участники строительства
 * @property {Object} [cadastre] - Кадастровая информация
 * @property {Array} [documents] - Список документов
 * @property {Array<BuildingMeta>} [composition] - Список зданий (краткий)
 * @property {Object.<string, any>} [buildingDetails] - Конфигурация (этажность, стены, фичи, фото). Any, т.к. структура динамическая.
 * * // --- Временные поля для локального стейта (могут быть, но не пишутся в основной файл) ---
 * @property {Object.<string, FloorData>} [floorData]
 * @property {Object.<string, EntranceData>} [entrancesData]
 * @property {Object.<string, Array<MopItem>>} [mopData]
 * @property {Object.<string, UnitData>} [flatMatrix]
 * @property {Object.<string, ParkingPlace>} [parkingPlaces]
 * * // --- Поля совместимости (маппинг имен из базы) ---
 * @property {Object.<string, Array<MopItem>>} [commonAreasData]
 * @property {Object.<string, UnitData>} [apartmentsData]
 * @property {Object.<string, ParkingPlace>} [parkingData]
 */

/**
 * Краткая информация о здании (для списка composition)
 * @typedef {Object} BuildingMeta
 * @property {string} id - ID здания (например, "b_1700000000_1")
 * @property {string} label - Название (например, "Корпус 1")
 * @property {string} houseNumber - Номер дома
 * @property {'residential' | 'parking_separate' | 'infrastructure'} category - Категория
 * @property {string} type - Человекочитаемый тип
 * @property {string} stage - Стадия (Проектный, Строящийся)
 * @property {string} [dateStart]
 * @property {string} [dateEnd]
 * @property {number} [resBlocks]
 * @property {number} [nonResBlocks]
 * @property {boolean} [hasNonResPart]
 * @property {string} [parkingType]
 * @property {string} [constructionType]
 * @property {string} [infraType]
 * @property {any} [icon]
 * @property {string} [subLabel]
 */

/**
 * Полные данные здания (хранятся в под-коллекции 'buildings')
 * @typedef {Object} BuildingData
 * @property {Object.<string, any>} [buildingDetails] - СЛОВАРЬ конфигураций (any т.к. там и конфиги, и фичи)
 * @property {Object.<string, FloorData>} [floorData] - Матрица этажей
 * @property {Object.<string, EntranceData>} [entrancesData] - Матрица подъездов
 * @property {Object.<string, Array<MopItem>>} [commonAreasData] - МОПы
 * @property {Object.<string, UnitData>} [apartmentsData] - Квартирография (FlatMatrix)
 * @property {Object.<string, ParkingPlace>} [parkingData] - Машиноместа
 */

/**
 * Конфигурация конкретного блока здания
 * @typedef {Object} BuildingConfig
 * @property {number} [floorsFrom] - Первый этаж
 * @property {number} [floorsTo] - Последний этаж
 * @property {number} [entrances] - Количество подъездов
 * @property {boolean} [hasBasementFloor] - Есть ли цоколь
 * @property {Array<string|number>} [technicalFloors] - Список технических этажей
 * @property {Array<string|number>} [commercialFloors] - Список коммерческих этажей
 * @property {string[]} [parentBlocks] - Для стилобатов
 * @property {number} [levelsDepth] - Глубина паркинга
 * @property {number} [floorsCount] - Этажность
 * @property {number} [inputs] - Входы
 * @property {number} [vehicleEntries] - Въезды
 * @property {number} [elevators] - Лифты
 * @property {Object} [engineering] - Инженерия
 * @property {string} [foundation]
 * @property {string} [walls]
 * @property {string} [slabs]
 * @property {string} [roof]
 * @property {string} [seismicity] - Сейсмичность
 * @property {boolean} [hasCustomAddress] - Флаг ручного изменения адреса блока
 * @property {string} [customHouseNumber] - Отдельный номер дома для блока
 * @property {boolean} [hasAttic]
 * @property {boolean} [hasLoft]
 * @property {boolean} [hasExploitableRoof]
 * @property {boolean} [hasTechnicalFloor]
 * @property {string} [placementType]
 * @property {string} [lightStructureType]
 */

/**
 * Данные одного этажа
 * @typedef {Object} FloorData
 * @property {string} height - Высота потолка (м)
 * @property {string} areaProj - Площадь проектная
 * @property {string} areaFact - Площадь фактическая
 * @property {boolean} [isDuplex] - Является ли двухуровневым
 */

/**
 * Данные подъезда на этаже
 * @typedef {Object} EntranceData
 * @property {number} apts - Количество квартир
 * @property {number} units - Количество нежилых помещений
 * @property {number} mopQty - Количество помещений МОП
 */

/**
 * Единица недвижимости (Квартира/Офис)
 * @typedef {Object} UnitData
 * @property {string} num - Номер помещения
 * @property {string} area - Площадь
 * @property {'flat' | 'office' | 'pantry' | 'duplex_up' | 'duplex_down'} type - Тип
 * @property {number} [rooms] - Количество комнат
 */

/**
 * Элемент МОП
 * @typedef {Object} MopItem
 * @property {string|number} id - ID записи
 * @property {string} type - Тип (Лестница, Коридор, Лифт)
 * @property {string} area - Площадь
 */

/**
 * Парковочное место
 * @typedef {Object} ParkingPlace
 * @property {string} number - Номер места
 * @property {string} area - Площадь
 * @property {boolean} [isSold] - Статус продажи
 * @property {Object} [meta]
 */

/**
 * Конфигурация шага (из constants.js)
 * @typedef {Object} StepConfig
 * @property {string} id
 * @property {string} title
 * @property {string} desc
 * @property {any} icon
 */

export const Types = {};