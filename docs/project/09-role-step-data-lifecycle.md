# 9. Роли, шаги и жизненный цикл данных (расширенно)

Цель: дать полную расшифровку **кто**, **когда**, **в какие таблицы/поля БД** пишет, и **как это поле называется/понимается в UI на русском**.

## 9.1 Роли

- `admin` -> **Полные права на контент и workflow**.
- `technician` -> **Основной ввод/редактирование данных объекта**.
- `controller` -> **Проверка этапов и решения approve/reject**.

## 9.2 Шаг `passport`

### Таблицы и поля
- `projects.name` -> `complexInfo.name` -> **Наименование ЖК**.
- `projects.construction_status` -> `complexInfo.status` -> **Статус строительства проекта**.
- `projects.region` -> `complexInfo.region` -> **Регион**.
- `projects.district` -> `complexInfo.district` -> **Район**.
- `projects.address` -> `complexInfo.street` -> **Адрес проекта**.
- `projects.landmark` -> `complexInfo.landmark` -> **Ориентир**.
- `projects.date_start_project/date_end_project` -> `complexInfo.*` -> **Плановые даты**.
- `projects.date_start_fact/date_end_fact` -> `complexInfo.*` -> **Фактические даты**.
- `projects.cadastre_number` -> `cadastre.number` -> **Кадастровый номер комплекса**.
- `project_participants.role` -> `participants[role]` -> **Роль участника**.
- `project_participants.name` -> `participants[role].name` -> **Наименование/ФИО участника**.
- `project_participants.inn` -> `participants[role].inn` -> **ИНН участника**.
- `project_documents.name` -> `documents[].name` -> **Название документа**.
- `project_documents.doc_type` -> `documents[].type` -> **Тип документа**.
- `project_documents.doc_number` -> `documents[].number` -> **Номер документа**.
- `project_documents.doc_date` -> `documents[].date` -> **Дата документа**.
- `project_documents.file_url` -> `documents[].url` -> **Ссылка/файл документа**.

## 9.3 Шаг `composition`

- `buildings.label` -> `composition[].label` -> **Наименование объекта**.
- `buildings.house_number` -> `composition[].houseNumber` -> **Номер дома/корпуса**.
- `buildings.category` -> `composition[].category` -> **Категория объекта**.
- `buildings.parking_type` -> `composition[].parkingType` -> **Тип паркинга**.
- `buildings.construction_type` -> `composition[].constructionType` -> **Конструктив паркинга/объекта**.
- `buildings.infra_type` -> `composition[].infraType` -> **Тип инфраструктуры**.
- `buildings.has_non_res_part` -> `composition[].hasNonResPart` -> **Наличие нежилой части**.
- `building_blocks.label` -> `composition[].blocks[].label` -> **Название блока**.
- `building_blocks.type` -> `composition[].blocks[].type` -> **Тип блока**.

## 9.4 Шаги `registry_res` / `registry_nonres`

- `building_blocks.floors_from/floors_to` -> `buildingDetails` -> **Диапазон этажности**.
- `building_blocks.floors_count` -> `buildingDetails.floorsCount` -> **Количество этажей**.
- `building_blocks.entrances_count` -> `buildingDetails.entrances` -> **Количество подъездов**.
- `building_blocks.elevators_count` -> `buildingDetails.elevators` -> **Количество лифтов**.
- `building_blocks.vehicle_entries` -> `buildingDetails.vehicleEntries` -> **Количество въездов**.
- `building_blocks.levels_depth` -> `buildingDetails.levelsDepth` -> **Глубина подземных уровней**.
- `building_blocks.parent_blocks` -> `buildingDetails.parentBlocks` -> **Связанные родительские блоки**.
- `building_blocks.has_custom_address` -> `buildingDetails.hasCustomAddress` -> **Флаг отдельного номера блока**.
- `building_blocks.custom_house_number` -> `buildingDetails.customHouseNumber` -> **Номер корпуса блока**.
- `block_construction.foundation` -> `buildingDetails.foundation` -> **Фундамент**.
- `block_construction.walls` -> `buildingDetails.walls` -> **Материал стен**.
- `block_construction.slabs` -> `buildingDetails.slabs` -> **Перекрытия**.
- `block_construction.roof` -> `buildingDetails.roof` -> **Кровля**.
- `block_construction.seismicity` -> `buildingDetails.seismicity` -> **Сейсмичность**.
- `block_engineering.has_electricity` -> `engineering.electricity` -> **Электроснабжение**.
- `block_engineering.has_water` -> `engineering.hvs` -> **ХВС**.
- `block_engineering.has_hot_water` -> `engineering.gvs` -> **ГВС**.
- `block_engineering.has_sewerage` -> `engineering.sewerage` -> **Канализация**.
- `block_engineering.has_gas` -> `engineering.gas` -> **Газ**.
- `block_engineering.has_heating` -> `engineering.heating` -> **Отопление**.
- `block_engineering.has_ventilation` -> `engineering.ventilation` -> **Вентиляция**.
- `block_engineering.has_firefighting` -> `engineering.firefighting` -> **Пожаротушение**.
- `block_engineering.has_lowcurrent` -> `engineering.lowcurrent` -> **Слаботочные сети**.

## 9.5 Шаг `floors`

- `floors.index` -> `floorData.index` -> **Номер/индекс этажа**.
- `floors.floor_key` -> `floorData.floorKey` -> **Системный ключ этажа**.
- `floors.label` -> `floorData.label` -> **Название этажа в интерфейсе**.
- `floors.floor_type` -> `floorData.type` -> **Тип этажа**.
- `floors.height` -> `floorData.height` -> **Высота этажа**.
- `floors.area_proj` -> `floorData.areaProj` -> **Проектная площадь этажа**.
- `floors.area_fact` -> `floorData.areaFact` -> **Фактическая площадь этажа**.
- `floors.is_duplex` -> `floorData.isDuplex` -> **Дуплексный этаж**.
- `floors.is_technical` -> `floorData.flags.isTechnical` -> **Технический этаж**.
- `floors.is_commercial` -> `floorData.flags.isCommercial` -> **Коммерческий этаж**.

## 9.6 Шаг `entrances`

- `entrances.number` -> UI номера подъездов -> **Номер подъезда в блоке**.
- `entrance_matrix.flats_count` -> `entrancesData.apts` -> **Количество квартир по ячейке матрицы**.
- `entrance_matrix.commercial_count` -> `entrancesData.units` -> **Количество нежилых помещений по ячейке**.
- `entrance_matrix.mop_count` -> `entrancesData.mopQty` -> **Количество МОП по ячейке**.

## 9.7 Шаг `apartments`

- `units.number` -> `flatMatrix.num/number` -> **Номер помещения**.
- `units.unit_type` -> `flatMatrix.type` -> **Тип помещения**.
- `units.total_area` -> `flatMatrix.area` -> **Общая площадь помещения**.
- `units.living_area` -> `flatMatrix.livingArea` -> **Жилая площадь**.
- `units.useful_area` -> `flatMatrix.usefulArea` -> **Полезная площадь**.
- `units.rooms_count` -> `flatMatrix.rooms` -> **Количество комнат**.
- `units.status` -> `flatMatrix.isSold` -> **Статус помещения (свободно/продано)**.
- `units.unit_code` -> `flatMatrix.unitCode` -> **Системный код помещения**.
- `rooms.room_type` -> `explication.type` -> **Тип комнаты/зоны**.
- `rooms.name` -> `explication.label` -> **Название комнаты/зоны**.
- `rooms.area` -> `explication.area` -> **Площадь комнаты/зоны**.
- `rooms.level` -> `explication.level` -> **Уровень комнаты**.

## 9.8 Шаг `mop`

- `common_areas.type` -> `mopData.type` -> **Тип МОП**.
- `common_areas.area` -> `mopData.area` -> **Площадь МОП**.
- `common_areas.floor_id` -> `mopData.floorId` -> **Этаж МОП**.
- `common_areas.entrance_id` -> `mopData.entranceId` -> **Подъезд МОП**.

## 9.9 Шаг `parking_config`

- `basements.has_parking` -> UI флаг -> **Есть ли паркинг в подвале**.
- `basements.depth` -> UI глубина -> **Количество подземных уровней**.
- `basement_parking_levels.depth_level` -> UI уровень -> **Номер подземного уровня**.
- `basement_parking_levels.is_enabled` -> UI чекбокс -> **Уровень активен для паркинга**.
- `units.unit_type='parking_place'` -> UI машиноместо -> **Запись машиноместа**.

## 9.10 Шаги интеграции

- `applications.integration_data` -> UI статус интеграции -> **Состояния отправки/получения интеграционных операций**.
- `buildings.cadastre_number` -> UI интеграции зданий -> **Кадастровый номер здания**.
- `units.cadastre_number` -> UI интеграции помещений -> **Кадастровый номер помещения**.

## 9.11 Действия контролера (`APPROVE` / `REJECT`)

### Что меняется при `APPROVE`
- `applications.status` -> **Новый статус после принятия этапа**.
- `applications.current_step/current_stage` -> **Точка продолжения работ**.
- `application_steps.is_verified` -> **Подтверждение шагов этапа**.
- `application_history.action/comment/user_name` -> **Фиксация решения контролера**.

### Что меняется при `REJECT`
- `applications.status='REJECTED'` -> **Возврат на доработку**.
- `applications.current_step/current_stage` -> **Откат шага/этапа**.
- `application_history.comment` -> **Причина возврата**.

## 9.12 Справочники (где используются)

- `dict_project_statuses` -> `projects.construction_status` -> **Статус проекта**.
- `dict_parking_types` -> `buildings.parking_type` -> **Тип паркинга**.
- `dict_parking_construction_types` -> `buildings.construction_type` -> **Конструкция паркинга**.
- `dict_infra_types` -> `buildings.infra_type` -> **Тип инфраструктуры**.
- `dict_foundations/dict_wall_materials/dict_slab_types/dict_roof_types` -> `block_construction.*` -> **Конструктивные характеристики**.
- `dict_mop_types` -> `common_areas.type` -> **Тип МОП**.
- `dict_unit_types` -> `units.unit_type` -> **Тип помещения**.
- `dict_room_types` -> `rooms.room_type` -> **Тип комнаты**.
- `dict_external_systems` -> `applications.external_source` -> **Источник заявления**.
- `dict_application_statuses` -> `applications.status` -> **Справочные статусы заявки**.
