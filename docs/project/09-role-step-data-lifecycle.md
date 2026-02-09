# 9. Роли, шаги и жизненный цикл данных (полное описание)

**Цель**: Полная расшифровка **кто**, **когда**, **в какие таблицы/поля БД** пишет данные, **какая логика работает**, **откуда берутся значения** из справочников, и **как это поле называется/понимается в UI на русском**.

## 9.1 Роли и права доступа

### Таблица ролей и их действий

| Роль | Чтение | Создание | Редактирование | Удаление | Workflow-операции |
|------|--------|---------|---------------|----------|-------------------|
| **Admin** | ✅ Все | ✅ Все | ✅ Все | ✅ Все | ✅ Complete, Rollback, Approve, Reject |
| **Technician** | ✅ Все | ✅ Данные | ✅ Данные (в DRAFT/REJECTED/INTEGRATION) | ✅ Данные | ✅ Complete, Rollback |
| **Controller** | ✅ Все | ❌ Нет | ❌ Нет | ❌ Нет | ✅ Approve, Reject |

### Детализация по ролям

#### Admin (Администратор)

**Может делать**:
- Создавать проекты и заявки
- Редактировать любые данные в любом статусе
- Выполнять все workflow-операции
- Изменять статусы вручную
- Удалять любые объекты
- Обходить валидацию (с записью в историю)

**Доступ к таблицам**: Все таблицы, полный доступ

#### Technician (Техник-инвентаризатор)

**Может делать**:
- Создавать и редактировать данные в статусах: DRAFT, NEW, REJECTED, INTEGRATION
- Завершать текущий шаг (COMPLETE_STEP)
- Откатывать шаг (ROLLBACK_STEP)
- Создавать/редактировать/удалять: здания, блоки, этажи, подъезды, помещения, МОП

**Не может**:
- Редактировать в статусах: REVIEW, APPROVED, COMPLETED
- Выполнять Approve/Reject
- Изменять workflow-статусы напрямую

**Доступ к таблицам**:
- Чтение: Все таблицы
- Запись: projects, buildings, building_blocks, block_construction, block_engineering, basements, basement_parking_levels, floors, entrances, entrance_matrix, units, rooms, common_areas, block_floor_markers
- Нет доступа к записи: applications (только через workflow), application_history, application_steps

#### Controller (Контролер-бригадир)

**Может делать**:
- Просматривать все данные
- Выполнять Approve/Reject для этапов в статусе REVIEW
- Добавлять комментарии к решениям
- Просматривать историю изменений

**Не может**:
- Редактировать данные (проекты, здания, этажи, помещения)
- Завершать или откатывать шаги
- Изменять конфигурацию

**Доступ к таблицам**:
- Чтение: Все таблицы
- Запись: Только application_history (через Approve/Reject)

## 9.2 Шаг 0: `passport` — Паспорт жилого комплекса

### Кто заполняет

**Роль**: Technician или Admin

**Статус заявки**: NEW → DRAFT

### Когда создаются объекты

**При первом открытии проекта**:
1. Создается запись в `projects` (если новый проект)
2. Создается запись в `applications` (связанная с проектом)

**При заполнении формы**:
1. Обновляются поля в `projects`
2. Создаются записи в `project_participants` (при добавлении участников)
3. Создаются записи в `project_documents` (при добавлении документов)

### Таблицы и мутации данных

#### Таблица `projects`

| Поле БД | UI-поле | Русское название | Когда заполняется | Откуда берется |
|---------|---------|-----------------|------------------|----------------|
| `id` | - | ID проекта | При создании | Автоматически (UUID) |
| `scope_id` | - | Контур данных | При создании | Из авторизации |
| `uj_code` | - | Код проекта | При создании | Автогенерация `UJ000001` |
| `name` | `complexInfo.name` | Наименование ЖК | Ввод пользователя | Input field |
| `region` | `complexInfo.region` | Регион | Ввод пользователя | Input field |
| `district` | `complexInfo.district` | Район | Ввод пользователя | Input field |
| `address` | `complexInfo.street` | Адрес | Ввод пользователя | Input field |
| `landmark` | `complexInfo.landmark` | Ориентир | Ввод пользователя | Input field |
| `cadastre_number` | `cadastre.number` | Кадастровый номер | Ввод пользователя | Input field |
| `construction_status` | `complexInfo.status` | Статус строительства | Выбор пользователя | Справочник `dict_project_statuses` |
| `date_start_project` | `complexInfo.dateStartProject` | Плановая дата начала | Ввод пользователя | Date picker |
| `date_end_project` | `complexInfo.dateEndProject` | Плановая дата завершения | Ввод пользователя | Date picker |
| `date_start_fact` | `complexInfo.dateStartFact` | Фактическая дата начала | Ввод пользователя | Date picker |
| `date_end_fact` | `complexInfo.dateEndFact` | Фактическая дата завершения | Ввод пользователя | Date picker |
| `created_at` | - | Дата создания | При создании | Автоматически |
| `updated_at` | - | Дата обновления | При каждом UPDATE | Автоматически |

**SQL-операции**:
```sql
-- Создание проекта
INSERT INTO projects (scope_id, uj_code, name, ...)
VALUES (?, 'UJ000001', ?, ...);

-- Обновление при изменении
UPDATE projects SET 
  name = ?, region = ?, district = ?, ..., updated_at = now()
WHERE id = ?;
```

#### Таблица `project_participants`

| Поле БД | UI-поле | Русское название | Когда заполняется | Откуда берется |
|---------|---------|-----------------|------------------|----------------|
| `id` | - | ID участника | При добавлении | Автоматически (UUID) |
| `project_id` | - | ID проекта | При добавлении | ID текущего проекта |
| `role` | `participants[role]` | Роль участника | Выбор пользователя | Константы (developer/contractor/designer/customer) |
| `name` | `participants[role].name` | Наименование/ФИО | Ввод пользователя | Input field |
| `inn` | `participants[role].inn` | ИНН | Ввод пользователя | Input field |
| `created_at` | - | Дата создания | При добавлении | Автоматически |
| `updated_at` | - | Дата обновления | При обновлении | Автоматически |

**Уникальность**: Один участник на роль (`UNIQUE(project_id, role)`)

**SQL-операции**:
```sql
-- Создание/обновление участника
INSERT INTO project_participants (project_id, role, name, inn)
VALUES (?, 'developer', ?, ?)
ON CONFLICT (project_id, role) 
DO UPDATE SET name = EXCLUDED.name, inn = EXCLUDED.inn, updated_at = now();
```

#### Таблица `project_documents`

| Поле БД | UI-поле | Русское название | Когда заполняется | Откуда берется |
|---------|---------|-----------------|------------------|----------------|
| `id` | `documents[].id` | ID документа | При добавлении | Автоматически (UUID) |
| `project_id` | - | ID проекта | При добавлении | ID текущего проекта |
| `name` | `documents[].name` | Название документа | Ввод пользователя | Input field |
| `doc_type` | `documents[].type` | Тип документа | Ввод пользователя | Input field (свободный ввод) |
| `doc_number` | `documents[].number` | Номер документа | Ввод пользователя | Input field |
| `doc_date` | `documents[].date` | Дата документа | Ввод пользователя | Date picker |
| `file_url` | `documents[].url` | Ссылка на файл | После загрузки | File upload → storage URL |
| `created_at` | - | Дата создания | При добавлении | Автоматически |
| `updated_at` | - | Дата обновления | При обновлении | Автоматически |

**SQL-операции**:
```sql
-- Добавление документа
INSERT INTO project_documents (project_id, name, doc_type, doc_number, doc_date, file_url)
VALUES (?, ?, ?, ?, ?, ?);

-- Удаление документа
DELETE FROM project_documents WHERE id = ?;
```

### Логика работы

1. **При создании проекта**:
   - Генерируется `uj_code` через `generateNextProjectCode(scope)`
   - Запрос существующих кодов в scope
   - Инкремент максимального номера

2. **При добавлении участника**:
   - Проверка уникальности роли
   - Если роль уже существует → UPDATE
   - Если роль новая → INSERT

3. **При добавлении документа**:
   - Загрузка файла в storage (если есть)
   - Получение URL файла
   - Сохранение метаданных в БД

### Валидация

**Нет обязательных полей** на этом шаге, можно сохранить проект с минимумом данных и продолжить заполнение позже.

### Workflow

**При завершении шага**:
```javascript
applications.current_step: 0 → 1
applications.status: DRAFT (остается)
application_steps: INSERT (step_index=0, is_completed=true)
application_history: INSERT (action='COMPLETE_STEP')
```

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
