# 2. Полная структура БД + соответствие UI + русские наименования

Источник схемы: `db/reset_schema.sql`.

Формат в документе:
- `поле_бд` -> `UI-поле` -> **русское название/разъяснение**.

## 2.1 CORE

### Таблица `projects` — Проект (ЖК)
- `id` -> `projectId` -> **Идентификатор проекта**.
- `scope_id` -> `dbScope` -> **Контур/область данных (tenant/scope)**.
- `uj_code` -> `complexInfo.ujCode` -> **Внутренний код проекта УЖ/УК**.
- `name` -> `complexInfo.name` -> **Наименование жилого комплекса**.
- `region` -> `complexInfo.region` -> **Регион расположения объекта**.
- `district` -> `complexInfo.district` -> **Район расположения объекта**.
- `address` -> `complexInfo.street` -> **Адрес (улица/описание местоположения)**.
- `landmark` -> `complexInfo.landmark` -> **Ориентир**.
- `cadastre_number` -> `cadastre.number` -> **Кадастровый номер комплекса**.
- `construction_status` -> `complexInfo.status` -> **Статус строительства (проектный/строящийся/и т.д.)**.
- `date_start_project` -> `complexInfo.dateStartProject` -> **Плановая дата начала строительства**.
- `date_end_project` -> `complexInfo.dateEndProject` -> **Плановая дата завершения строительства**.
- `date_start_fact` -> `complexInfo.dateStartFact` -> **Фактическая дата начала строительства**.
- `date_end_fact` -> `complexInfo.dateEndFact` -> **Фактическая дата завершения строительства**.
- `integration_data` -> (служебно) -> **JSON-данные интеграционных статусов/меток проекта**.
- `created_at` -> (служебно) -> **Дата и время создания записи проекта**.
- `updated_at` -> (служебно) -> **Дата и время последнего обновления проекта**.

### Таблица `applications` — Заявка (workflow-контур проекта)
- `id` -> `applicationInfo.id` -> **Идентификатор заявки**.
- `project_id` -> (связь с `projects.id`) -> **Проект, к которому относится заявка**.
- `scope_id` -> (служебно) -> **Контур/область данных заявки**.
- `internal_number` -> `applicationInfo.internalNumber` -> **Внутренний номер заявления**.
- `external_source` -> `applicationInfo.externalSource` -> **Источник внешнего заявления (система-источник)**.
- `external_id` -> `applicationInfo.externalId` -> **Номер заявления от внешнего источника**.
- `applicant` -> `applicationInfo.applicant` -> **Заявитель (ФИО/организация)**.
- `submission_date` -> `applicationInfo.submissionDate` -> **Дата подачи заявления**.
- `assignee_name` -> `applicationInfo.assigneeName` -> **Назначенный исполнитель**.
- `status` -> `applicationInfo.status` -> **Текущий статус заявки в workflow**.
- `current_step` -> `applicationInfo.currentStepIndex` -> **Текущий шаг процесса**.
- `current_stage` -> `applicationInfo.currentStage` -> **Текущий этап процесса**.
- `integration_data` -> (служебно) -> **JSON-данные статусов интеграции по заявке**.
- `created_at` -> (служебно) -> **Дата создания заявки**.
- `updated_at` -> (служебно) -> **Дата последнего изменения заявки**.

### Таблица `application_history` — История действий по заявке
- `id` -> (служебно) -> **Идентификатор записи истории**.
- `application_id` -> (связь) -> **Заявка, к которой относится событие**.
- `action` -> `applicationInfo.history[].action` -> **Тип действия (завершение/возврат/проверка)**.
- `prev_status` -> `applicationInfo.history[].prevStatus` -> **Предыдущий статус заявки**.
- `next_status` -> `applicationInfo.history[].nextStatus` -> **Новый статус заявки после действия**.
- `user_name` -> `applicationInfo.history[].user` -> **Пользователь, выполнивший действие**.
- `comment` -> `applicationInfo.history[].comment` -> **Комментарий к действию/причина возврата**.
- `created_at` -> `applicationInfo.history[].date` -> **Дата и время события**.

### Таблица `application_steps` — Флаги шагов заявки
- `id` -> (служебно) -> **Идентификатор записи шага**.
- `application_id` -> (связь) -> **Заявка**.
- `step_index` -> (индекс шага) -> **Порядковый номер шага workflow**.
- `is_completed` -> `applicationInfo.completedSteps` -> **Флаг: шаг выполнен**.
- `is_verified` -> `applicationInfo.verifiedSteps` -> **Флаг: шаг подтвержден контролером**.
- `created_at` -> (служебно) -> **Дата создания записи шага**.
- `updated_at` -> (служебно) -> **Дата обновления записи шага**.

### Таблица `project_participants` — Участники проекта
- `id` -> `participants[role].id` -> **Идентификатор участника**.
- `project_id` -> (связь) -> **Проект участника**.
- `role` -> `participants[role]` -> **Роль участника (застройщик/подрядчик/заказчик и т.п.)**.
- `name` -> `participants[role].name` -> **Наименование/ФИО участника**.
- `inn` -> `participants[role].inn` -> **ИНН участника**.
- `created_at` -> (служебно) -> **Дата добавления участника**.
- `updated_at` -> (служебно) -> **Дата изменения участника**.

### Таблица `project_documents` — Документы проекта
- `id` -> `documents[].id` -> **Идентификатор документа**.
- `project_id` -> (связь) -> **Проект документа**.
- `name` -> `documents[].name` -> **Наименование документа**.
- `doc_type` -> `documents[].type` -> **Тип документа**.
- `doc_date` -> `documents[].date` -> **Дата документа**.
- `doc_number` -> `documents[].number` -> **Номер документа**.
- `file_url` -> `documents[].url` -> **Ссылка на файл документа**.
- `created_at` -> (служебно) -> **Дата добавления документа**.
- `updated_at` -> (служебно) -> **Дата изменения документа**.

## 2.2 BUILDINGS + BLOCKS

### Таблица `buildings` — Здания/сооружения
- `id` -> `composition[].id` -> **Идентификатор здания**.
- `project_id` -> (связь) -> **Проект, в состав которого входит здание**.
- `building_code` -> `composition[].buildingCode` -> **Код здания в системе**.
- `label` -> `composition[].label` -> **Наименование здания/объекта**.
- `house_number` -> `composition[].houseNumber` -> **Номер дома/корпуса**.
- `category` -> `composition[].category` -> **Категория объекта (жилой/паркинг/инфра)**.
- `stage` -> `composition[].stage` -> **Стадия объекта**.
- `date_start` -> `composition[].dateStart` -> **Дата начала строительства объекта**.
- `date_end` -> `composition[].dateEnd` -> **Дата завершения строительства объекта**.
- `construction_type` -> `composition[].constructionType` -> **Тип конструкции (особенно для паркинга)**.
- `parking_type` -> `composition[].parkingType` -> **Тип паркинга (подземный/наземный)**.
- `infra_type` -> `composition[].infraType` -> **Тип инфраструктурного объекта**.
- `has_non_res_part` -> `composition[].hasNonResPart` -> **Признак наличия нежилой части в жилом объекте**.
- `cadastre_number` -> (интеграция) -> **Кадастровый номер здания**.
- `created_at` -> (служебно) -> **Дата создания здания**.
- `updated_at` -> (служебно) -> **Дата изменения здания**.

### Таблица `building_blocks` — Блоки здания
- `id` -> `composition[].blocks[].id` -> **Идентификатор блока**.
- `building_id` -> (связь) -> **Родительское здание блока**.
- `label` -> `block.label/tabLabel` -> **Название/обозначение блока**.
- `type` -> `block.type` -> **Тип блока (жилой/нежилой/паркинг/инфра)**.
- `floors_count` -> `buildingDetails[*].floorsCount` -> **Количество этажей (фиксированное)**.
- `floors_from` -> `buildingDetails[*].floorsFrom` -> **Нижняя граница этажности**.
- `floors_to` -> `buildingDetails[*].floorsTo` -> **Верхняя граница этажности**.
- `entrances_count` -> `buildingDetails[*].entrances` -> **Количество подъездов/входов**.
- `elevators_count` -> `buildingDetails[*].elevators` -> **Количество лифтов**.
- `vehicle_entries` -> `buildingDetails[*].vehicleEntries` -> **Количество въездов для транспорта**.
- `levels_depth` -> `buildingDetails[*].levelsDepth` -> **Глубина подземных уровней**.
- `light_structure_type` -> `buildingDetails[*].lightStructureType` -> **Тип легкой конструкции**.
- `parent_blocks` -> `buildingDetails[*].parentBlocks` -> **Связанные/родительские блоки (для стилобатов/связей)**.
- `has_basement` -> `buildingDetails[*].hasBasementFloor` -> **Признак наличия подвального уровня**.
- `has_attic` -> `buildingDetails[*].hasAttic` -> **Признак наличия чердака**.
- `has_loft` -> `buildingDetails[*].hasLoft` -> **Признак наличия мансарды**.
- `has_roof_expl` -> `buildingDetails[*].hasExploitableRoof` -> **Признак эксплуатируемой кровли**.
- `has_custom_address` -> `buildingDetails[*].hasCustomAddress` -> **Используется отдельный номер корпуса для блока**.
- `custom_house_number` -> `buildingDetails[*].customHouseNumber` -> **Индивидуальный номер корпуса блока**.
- `created_at` -> (служебно) -> **Дата создания блока**.
- `updated_at` -> (служебно) -> **Дата изменения блока**.

### Таблица `block_construction` — Конструктив блока
- `id` -> (служебно) -> **Идентификатор конструктива блока**.
- `block_id` -> (связь 1:1) -> **Блок, к которому относится конструктив**.
- `foundation` -> `buildingDetails[*].foundation` -> **Тип фундамента**.
- `walls` -> `buildingDetails[*].walls` -> **Материал стен**.
- `slabs` -> `buildingDetails[*].slabs` -> **Тип перекрытий**.
- `roof` -> `buildingDetails[*].roof` -> **Тип кровли**.
- `seismicity` -> `buildingDetails[*].seismicity` -> **Сейсмичность (баллы)**.
- `created_at` -> (служебно) -> **Дата создания записи**.
- `updated_at` -> (служебно) -> **Дата изменения записи**.

### Таблица `block_engineering` — Инженерия блока
- `id` -> (служебно) -> **Идентификатор инженерной записи**.
- `block_id` -> (связь 1:1) -> **Блок, к которому относится инженерия**.
- `has_electricity` -> `engineering.electricity` -> **Наличие электроснабжения**.
- `has_water` -> `engineering.hvs` -> **Наличие холодного водоснабжения**.
- `has_hot_water` -> `engineering.gvs` -> **Наличие горячего водоснабжения**.
- `has_sewerage` -> `engineering.sewerage` -> **Наличие канализации**.
- `has_gas` -> `engineering.gas` -> **Наличие газоснабжения**.
- `has_heating` -> `engineering.heating` -> **Наличие отопления**.
- `has_ventilation` -> `engineering.ventilation` -> **Наличие вентиляции**.
- `has_firefighting` -> `engineering.firefighting` -> **Наличие противопожарной системы**.
- `has_lowcurrent` -> `engineering.lowcurrent` -> **Наличие слаботочных систем**.
- `created_at` -> (служебно) -> **Дата создания записи**.
- `updated_at` -> (служебно) -> **Дата изменения записи**.

### Таблица `basements` — Подвалы
- `id` -> `buildingDetails[buildingId_features].basements[].id` -> **Идентификатор подвала**.
- `building_id` -> (связь) -> **Здание, где расположен подвал**.
- `block_id` -> (связь) -> **Блок, где расположен подвал**.
- `depth` -> `basements[].depth` -> **Глубина подвала (количество уровней)**.
- `has_parking` -> `basements[].hasParking` -> **Признак размещения паркинга в подвале**.
- `created_at` -> (служебно) -> **Дата создания записи подвала**.
- `updated_at` -> (служебно) -> **Дата изменения записи подвала**.

### Таблица `basement_parking_levels` — Уровни подземного паркинга
- `id` -> (служебно) -> **Идентификатор уровня**.
- `basement_id` -> `basements[].id` -> **Подвал, к которому относится уровень**.
- `depth_level` -> `basements[].parkingLevels[level]` -> **Номер подземного уровня**.
- `is_enabled` -> `basements[].parkingLevels[level]` -> **Признак активного уровня паркинга**.
- `created_at` -> (служебно) -> **Дата создания записи уровня**.
- `updated_at` -> (служебно) -> **Дата изменения записи уровня**.

### Таблица `block_floor_markers` — Маркеры этажей блока
- `id` -> (служебно) -> **Идентификатор маркера**.
- `block_id` -> (связь) -> **Блок маркера**.
- `marker_key` -> (служебно/UI ключ) -> **Ключ маркера для идентификации этажа/состояния**.
- `marker_type` -> (служебно) -> **Тип маркера (`floor`/`technical`/`special`/`basement`)**.
- `floor_index` -> (UI логика этажа) -> **Номер этажа, к которому относится маркер**.
- `parent_floor_index` -> (UI логика тех.этажа) -> **Родительский этаж (для технических уровней)**.
- `is_technical` -> `technicalFloors` -> **Признак технического этажа**.
- `is_commercial` -> `commercialFloors` -> **Признак коммерческого этажа**.
- `created_at` -> (служебно) -> **Дата создания маркера**.
- `updated_at` -> (служебно) -> **Дата изменения маркера**.

## 2.3 FLOORS / ENTRANCES / UNITS / MOP

### Таблица `floors` — Этажи
- `id` -> `floorData[*].id` -> **Идентификатор этажа**.
- `block_id` -> `floorData[*].blockId` -> **Блок этажа**.
- `index` -> `floorData[*].index` -> **Порядковый индекс/номер этажа**.
- `floor_key` -> `floorData[*].floorKey` -> **Системный ключ этажа**.
- `label` -> `floorData[*].label` -> **Подпись этажа в UI (например, "5 этаж")**.
- `floor_type` -> `floorData[*].type` -> **Тип этажа (жилой/тех/подвал/и т.д.)**.
- `height` -> `floorData[*].height` -> **Высота этажа**.
- `area_proj` -> `floorData[*].areaProj` -> **Проектная площадь этажа**.
- `area_fact` -> `floorData[*].areaFact` -> **Фактическая площадь этажа**.
- `is_duplex` -> `floorData[*].isDuplex` -> **Признак дуплексного уровня**.
- `parent_floor_index` -> `floorData[*].parentFloorIndex` -> **Родительский этаж для составных уровней**.
- `basement_id` -> `floorData[*].basementId` -> **Связь с подвальным контуром**.
- `is_technical` -> `floorData[*].flags.isTechnical` -> **Технический этаж**.
- `is_commercial` -> `floorData[*].flags.isCommercial` -> **Коммерческий этаж**.
- `is_stylobate` -> `floorData[*].flags.isStylobate` -> **Этаж стилобата**.
- `is_basement` -> `floorData[*].flags.isBasement` -> **Подвальный этаж**.
- `is_attic` -> `floorData[*].flags.isAttic` -> **Чердачный этаж**.
- `is_loft` -> `floorData[*].flags.isLoft` -> **Мансардный этаж**.
- `is_roof` -> `floorData[*].flags.isRoof` -> **Кровля/эксплуатируемая крыша**.
- `created_at` -> (служебно) -> **Дата создания этажа**.
- `updated_at` -> (служебно) -> **Дата изменения этажа**.

### Таблица `entrances` — Подъезды/входы
- `id` -> `entranceId` -> **Идентификатор подъезда**.
- `block_id` -> (связь) -> **Блок, к которому относится подъезд**.
- `number` -> `entranceIndex` -> **Номер подъезда в блоке**.
- `created_at` -> (служебно) -> **Дата создания подъезда**.
- `updated_at` -> (служебно) -> **Дата изменения подъезда**.

### Таблица `entrance_matrix` — Матрица «этаж × подъезд»
- `id` -> (служебно) -> **Идентификатор ячейки матрицы**.
- `block_id` -> (связь) -> **Блок матрицы**.
- `floor_id` -> (связь) -> **Этаж матрицы**.
- `entrance_number` -> `entrancesData[*]` -> **Номер подъезда для строки матрицы**.
- `flats_count` -> `entrancesData[*].apts` -> **Плановое количество квартир**.
- `commercial_count` -> `entrancesData[*].units` -> **Плановое количество нежилых/коммерческих помещений**.
- `mop_count` -> `entrancesData[*].mopQty` -> **Плановое количество МОП**.
- `created_at` -> (служебно) -> **Дата создания ячейки**.
- `updated_at` -> (служебно) -> **Дата изменения ячейки**.

### Таблица `units` — Помещения (квартиры/офисы/машиноместа)
- `id` -> `flatMatrix[*].id` -> **Идентификатор помещения**.
- `floor_id` -> `flatMatrix[*].floorId` -> **Этаж помещения**.
- `entrance_id` -> `flatMatrix[*].entranceId` -> **Подъезд помещения**.
- `unit_code` -> `flatMatrix[*].unitCode` -> **Уникальный код помещения**.
- `number` -> `flatMatrix[*].num/number` -> **Номер помещения (квартиры/офиса/места)**.
- `unit_type` -> `flatMatrix[*].type` -> **Тип помещения**.
- `total_area` -> `flatMatrix[*].area` -> **Общая площадь помещения**.
- `living_area` -> `flatMatrix[*].livingArea` -> **Жилая площадь**.
- `useful_area` -> `flatMatrix[*].usefulArea` -> **Полезная площадь**.
- `rooms_count` -> `flatMatrix[*].rooms` -> **Количество комнат/секций**.
- `status` -> `flatMatrix[*].isSold` -> **Статус помещения (`free`/`sold`)**.
- `cadastre_number` -> `flatMatrix[*].cadastreNumber` -> **Кадастровый номер помещения**.
- `created_at` -> (служебно) -> **Дата создания помещения**.
- `updated_at` -> (служебно) -> **Дата изменения помещения**.

### Таблица `rooms` — Экспликация помещения
- `id` -> `flatMatrix[*].explication[].id` -> **Идентификатор строки экспликации**.
- `unit_id` -> (связь) -> **Помещение, к которому относится строка**.
- `room_type` -> `explication[].type` -> **Тип комнаты/зоны помещения**.
- `name` -> `explication[].label` -> **Наименование комнаты/зоны**.
- `area` -> `explication[].area` -> **Площадь комнаты/зоны**.
- `level` -> `explication[].level` -> **Уровень комнаты (для дуплексов/многоуровневых)**.
- `created_at` -> (служебно) -> **Дата создания строки экспликации**.
- `updated_at` -> (служебно) -> **Дата изменения строки экспликации**.

### Таблица `common_areas` — МОП (места общего пользования)
- `id` -> `mopData[*].id` -> **Идентификатор МОП**.
- `floor_id` -> `mopData[*].floorId` -> **Этаж расположения МОП**.
- `entrance_id` -> `mopData[*].entranceId` -> **Подъезд расположения МОП**.
- `type` -> `mopData[*].type` -> **Тип МОП (лестница/коридор/тех.помещение и т.д.)**.
- `area` -> `mopData[*].area` -> **Площадь МОП**.
- `created_at` -> (служебно) -> **Дата создания записи МОП**.
- `updated_at` -> (служебно) -> **Дата изменения записи МОП**.

## 2.4 Справочники `dict_*` — общая структура

Общие поля:
- `id` -> (служебно) -> **Идентификатор записи справочника**.
- `code` -> (используется в БД/логике) -> **Машинный код значения**.
- `label` -> (используется в UI) -> **Отображаемое русское название значения**.
- `sort_order` -> (UI порядок) -> **Приоритет сортировки в списках**.
- `is_active` -> (фильтр) -> **Признак доступности значения для выбора**.

Ключевые справочники и назначение:
- `dict_project_statuses` -> для `projects.construction_status` -> **Статусы проекта**.
- `dict_application_statuses` -> для `applications.status` -> **Статусы заявки**.
- `dict_external_systems` -> для `applications.external_source` -> **Внешние системы-источники**.
- `dict_foundations` -> `block_construction.foundation` -> **Типы фундаментов**.
- `dict_wall_materials` -> `block_construction.walls` -> **Материалы стен**.
- `dict_slab_types` -> `block_construction.slabs` -> **Типы перекрытий**.
- `dict_roof_types` -> `block_construction.roof` -> **Типы кровли**.
- `dict_light_structure_types` -> `building_blocks.light_structure_type` -> **Типы легких конструкций**.
- `dict_parking_types` -> `buildings.parking_type` -> **Типы паркинга**.
- `dict_parking_construction_types` -> `buildings.construction_type` -> **Типы конструкций паркинга**.
- `dict_infra_types` -> `buildings.infra_type` -> **Типы инфраструктуры**.
- `dict_mop_types` -> `common_areas.type` -> **Типы МОП**.
- `dict_unit_types` -> `units.unit_type` -> **Типы помещений**.
- `dict_room_types` -> `rooms.room_type` -> **Типы комнат/зон экспликации**.
- `dict_system_users` -> UI логин/роли -> **Системные пользователи DEV-контура**.
