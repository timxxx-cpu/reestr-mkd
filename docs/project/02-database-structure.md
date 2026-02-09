# 2. Полная структура БД + соответствие UI + русские наименования

Источник схемы: `db/reset_schema.sql`.

Формат в документе:
- `поле_бд` -> `UI-поле` -> **русское название/разъяснение**.
- Дополнительно указаны: тип данных, ограничения, индексы, значения по умолчанию.

## 2.1 CORE — Основные таблицы проекта и заявки

### Таблица `projects` — Проект (Жилой комплекс)

**Назначение**: Основная таблица, содержащая информацию о жилом комплексе (проекте).

**Первичный ключ**: `id` (UUID)

**Уникальные ключи**: `uj_code` (только для не-NULL значений)

**Индексы**:
- `idx_projects_scope` на `scope_id` — быстрый поиск проектов в контуре
- `idx_projects_updated` на `updated_at DESC` — сортировка по дате обновления
- `idx_projects_uj_code` на `uj_code` (unique, partial) — уникальность УЖ-кода

**Поля**:

| Поле БД | Тип данных | Ограничения | UI-поле | Русское название | Когда заполняется | Откуда берется значение |
|---------|-----------|-------------|---------|-----------------|------------------|------------------------|
| `id` | UUID | PRIMARY KEY, NOT NULL, DEFAULT gen_random_uuid() | `projectId` | **Идентификатор проекта** | При создании проекта | Генерируется БД автоматически |
| `scope_id` | TEXT | NOT NULL, INDEX | `dbScope` | **Контур/область данных (tenant)** | При создании проекта | Из контекста авторизации пользователя |
| `uj_code` | TEXT | UNIQUE (partial), INDEX | `complexInfo.ujCode` | **Внутренний код проекта формата UJ000000** | При создании проекта | Автогенерация через `generateProjectCode()` |
| `name` | TEXT | NOT NULL | `complexInfo.name` | **Наименование жилого комплекса** | Шаг `passport` | Ввод пользователя |
| `region` | TEXT | NULL | `complexInfo.region` | **Регион расположения объекта** | Шаг `passport` | Ввод пользователя |
| `district` | TEXT | NULL | `complexInfo.district` | **Район расположения объекта** | Шаг `passport` | Ввод пользователя |
| `address` | TEXT | NULL | `complexInfo.street` | **Адрес (улица/описание)** | Шаг `passport` | Ввод пользователя |
| `landmark` | TEXT | NULL | `complexInfo.landmark` | **Ориентир** | Шаг `passport` | Ввод пользователя |
| `cadastre_number` | TEXT | NULL | `cadastre.number` | **Кадастровый номер комплекса** | Шаг `passport` или интеграция | Ввод пользователя или из системы УЗКАД |
| `construction_status` | TEXT | NULL | `complexInfo.status` | **Статус строительства** | Шаг `passport` | Справочник `dict_project_statuses` |
| `date_start_project` | DATE | NULL | `complexInfo.dateStartProject` | **Плановая дата начала строительства** | Шаг `passport` | Ввод пользователя |
| `date_end_project` | DATE | NULL | `complexInfo.dateEndProject` | **Плановая дата завершения строительства** | Шаг `passport` | Ввод пользователя |
| `date_start_fact` | DATE | NULL | `complexInfo.dateStartFact` | **Фактическая дата начала** | Шаг `passport` | Ввод пользователя |
| `date_end_fact` | DATE | NULL | `complexInfo.dateEndFact` | **Фактическая дата завершения** | Шаг `passport` | Ввод пользователя |
| `integration_data` | JSONB | NULL, DEFAULT '{}'::jsonb | (служебно) | **JSON-данные интеграционных статусов** | Шаги интеграции | Автоматически при обмене с УЗКАД |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата создания записи** | При создании | Автоматически БД |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата последнего обновления** | При любом изменении | Автоматически при UPDATE |

**Связи**:
- Один-к-одному с `applications` через `applications.project_id`
- Один-ко-многим с `project_participants` через `project_participants.project_id`
- Один-ко-многим с `project_documents` через `project_documents.project_id`
- Один-ко-многим с `buildings` через `buildings.project_id`

**Правила удаления**: При удалении проекта CASCADE удаляются все связанные записи.

### Таблица `applications` — Заявка (Workflow-контур проекта)

**Назначение**: Управление жизненным циклом заявки на обработку проекта. Хранит текущее состояние workflow: статус, шаг, этап.

**Первичный ключ**: `id` (UUID)

**Уникальные ключи**: `project_id` — одна заявка на проект

**Индексы**:
- `idx_applications_scope` на `scope_id`
- `idx_applications_project_scope` на `(project_id, scope_id)`

**Поля**:

| Поле БД | Тип данных | Ограничения | UI-поле | Русское название | Когда заполняется | Откуда берется значение |
|---------|-----------|-------------|---------|-----------------|------------------|------------------------|
| `id` | UUID | PRIMARY KEY, NOT NULL, DEFAULT gen_random_uuid() | `applicationInfo.id` | **Идентификатор заявки** | При создании заявки | Автоматически БД |
| `project_id` | UUID | NOT NULL, UNIQUE, FK -> projects(id) ON DELETE CASCADE | (связь) | **Проект заявки** | При создании заявки | Связь с созданным проектом |
| `scope_id` | TEXT | NOT NULL, INDEX | (служебно) | **Контур данных заявки** | При создании | Из контекста авторизации |
| `internal_number` | TEXT | NULL | `applicationInfo.internalNumber` | **Внутренний номер заявления** | При создании | Ввод пользователя |
| `external_source` | TEXT | NULL | `applicationInfo.externalSource` | **Источник внешнего заявления** | При создании из внешней системы | Справочник `dict_external_systems` |
| `external_id` | TEXT | NULL | `applicationInfo.externalId` | **Номер заявления из внешней системы** | При создании из внешней системы | Передается из внешней системы |
| `applicant` | TEXT | NULL | `applicationInfo.applicant` | **Заявитель (ФИО/организация)** | При создании | Ввод пользователя или из внешней системы |
| `submission_date` | TIMESTAMPTZ | NULL | `applicationInfo.submissionDate` | **Дата подачи заявления** | При создании | Ввод пользователя или текущая дата |
| `assignee_name` | TEXT | NULL | `applicationInfo.assigneeName` | **Назначенный исполнитель** | При назначении | Выбор из `dict_system_users` |
| `status` | TEXT | NOT NULL, DEFAULT 'DRAFT' | `applicationInfo.status` | **Текущий статус заявки** | Автоматически при переходах | Машина состояний workflow, значения из `dict_application_statuses` |
| `current_step` | INT | NOT NULL, DEFAULT 0 | `applicationInfo.currentStepIndex` | **Текущий шаг процесса (индекс)** | Автоматически при переходах | Изменяется при COMPLETE_STEP / ROLLBACK_STEP |
| `current_stage` | INT | NOT NULL, DEFAULT 1 | `applicationInfo.currentStage` | **Текущий этап процесса (1-4)** | Автоматически при переходах | Определяется по WORKFLOW_STAGES |
| `integration_data` | JSONB | NULL, DEFAULT '{}'::jsonb | (служебно) | **Статусы интеграции с УЗКАД** | Шаги интеграции | Автоматически при обмене |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата создания** | При создании | Автоматически БД |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата последнего изменения** | При любом изменении | Автоматически при UPDATE |

**Возможные значения `status`** (из `dict_application_statuses`):
- `NEW` — Новая заявка
- `DRAFT` — В работе у техника
- `REVIEW` — На проверке у контролера
- `APPROVED` — Принята контролером
- `REJECTED` — Возвращена на доработку
- `INTEGRATION` — Готова к передаче в УЗКАД
- `COMPLETED` — Полностью закрыта

**Связи**:
- Один-к-одному с `projects` через `project_id`
- Один-ко-многим с `application_history` через `application_history.application_id`
- Один-ко-многим с `application_steps` через `application_steps.application_id`

**Правила удаления**: При удалении заявки CASCADE удаляются история и шаги.

### Таблица `application_history` — История действий по заявке

**Назначение**: Журнал всех действий (переходов workflow, проверок, возвратов) по заявке. Обеспечивает полную трассируемость.

**Первичный ключ**: `id` (UUID)

**Индексы**:
- `idx_app_history_app_created` на `(application_id, created_at DESC)` — быстрая выборка истории по заявке

**Поля**:

| Поле БД | Тип данных | Ограничения | UI-поле | Русское название | Когда создается | Откуда берется значение |
|---------|-----------|-------------|---------|-----------------|----------------|------------------------|
| `id` | UUID | PRIMARY KEY, NOT NULL, DEFAULT gen_random_uuid() | (служебно) | **ID записи истории** | При любом действии | Автоматически БД |
| `application_id` | UUID | NOT NULL, FK -> applications(id) ON DELETE CASCADE | (связь) | **Заявка события** | При любом действии | ID текущей заявки |
| `action` | TEXT | NULL | `applicationInfo.history[].action` | **Тип действия** | При действии | Одно из: `COMPLETE_STEP`, `ROLLBACK_STEP`, `REVIEW_APPROVE`, `REVIEW_REJECT` |
| `prev_status` | TEXT | NULL | `applicationInfo.history[].prevStatus` | **Предыдущий статус** | При действии | Статус до перехода |
| `next_status` | TEXT | NULL | `applicationInfo.history[].nextStatus` | **Новый статус** | При действии | Статус после перехода |
| `user_name` | TEXT | NULL | `applicationInfo.history[].user` | **Пользователь** | При действии | Имя текущего пользователя из `dict_system_users` |
| `comment` | TEXT | NULL | `applicationInfo.history[].comment` | **Комментарий/причина возврата** | При действии | Ввод пользователя (обязательно при REJECT) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | `applicationInfo.history[].date` | **Дата и время события** | При действии | Автоматически БД |

**Примеры действий**:
1. Техник завершает шаг → action=`COMPLETE_STEP`, prev_status=`DRAFT`, next_status=`REVIEW`
2. Контролер принимает → action=`REVIEW_APPROVE`, prev_status=`REVIEW`, next_status=`DRAFT`
3. Контролер возвращает → action=`REVIEW_REJECT`, prev_status=`REVIEW`, next_status=`REJECTED`, comment="Неверные площади"

**Связи**:
- Многие-к-одному с `applications` через `application_id`

### Таблица `application_steps` — Флаги шагов заявки

**Назначение**: Хранит состояние каждого шага workflow (выполнен/проверен). Используется для визуализации прогресса и контроля завершенности.

**Первичный ключ**: `id` (UUID)

**Уникальные ключи**: `(application_id, step_index)` — одна запись на шаг

**Поля**:

| Поле БД | Тип данных | Ограничения | UI-поле | Русское название | Когда создается | Откуда берется значение |
|---------|-----------|-------------|---------|-----------------|----------------|------------------------|
| `id` | UUID | PRIMARY KEY, NOT NULL, DEFAULT gen_random_uuid() | (служебно) | **ID записи шага** | При первом обращении к шагу | Автоматически БД |
| `application_id` | UUID | NOT NULL, FK -> applications(id) ON DELETE CASCADE, UNIQUE(application_id, step_index) | (связь) | **Заявка** | При создании | ID текущей заявки |
| `step_index` | INT | NOT NULL, UNIQUE(application_id, step_index) | (индекс) | **Номер шага (0-16)** | При создании | Индекс шага из STEPS_CONFIG |
| `is_completed` | BOOLEAN | NOT NULL, DEFAULT false | `applicationInfo.completedSteps` | **Шаг выполнен** | При COMPLETE_STEP | true при завершении шага техником |
| `is_verified` | BOOLEAN | NOT NULL, DEFAULT false | `applicationInfo.verifiedSteps` | **Шаг проверен** | При REVIEW_APPROVE | true при принятии контролером |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата создания** | При создании | Автоматически БД |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата обновления** | При изменении флагов | Автоматически при UPDATE |

**Логика работы**:
1. При переходе на следующий шаг → `is_completed` для предыдущего шага устанавливается в `true`
2. При принятии этапа контролером → `is_verified` для всех шагов этапа устанавливается в `true`
3. При откате шага → `is_completed` и `is_verified` сбрасываются в `false`

**Связи**:
- Многие-к-одному с `applications` через `application_id`

### Таблица `project_participants` — Участники проекта

**Назначение**: Хранит информацию об участниках строительства (застройщик, подрядчик, проектировщик, заказчик).

**Первичный ключ**: `id` (UUID)

**Уникальные ключи**: `(project_id, role)` — один участник на роль

**Поля**:

| Поле БД | Тип данных | Ограничения | UI-поле | Русское название | Когда заполняется | Откуда берется значение |
|---------|-----------|-------------|---------|-----------------|------------------|------------------------|
| `id` | UUID | PRIMARY KEY, NOT NULL, DEFAULT gen_random_uuid() | `participants[role].id` | **ID участника** | Шаг `passport` | Автоматически БД |
| `project_id` | UUID | NOT NULL, FK -> projects(id) ON DELETE CASCADE, UNIQUE(project_id, role) | (связь) | **Проект** | Шаг `passport` | ID текущего проекта |
| `role` | TEXT | NOT NULL, UNIQUE(project_id, role) | `participants[role]` | **Роль участника** | Шаг `passport` | Ввод пользователя (застройщик/подрядчик/проектировщик/заказчик) |
| `name` | TEXT | NULL | `participants[role].name` | **Наименование/ФИО** | Шаг `passport` | Ввод пользователя |
| `inn` | TEXT | NULL | `participants[role].inn` | **ИНН участника** | Шаг `passport` | Ввод пользователя |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата добавления** | При создании | Автоматически БД |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата изменения** | При изменении | Автоматически при UPDATE |

**Типичные роли участников**:
- `developer` — Застройщик
- `contractor` — Подрядчик
- `designer` — Проектировщик
- `customer` — Заказчик

**Связи**:
- Многие-к-одному с `projects` через `project_id`

### Таблица `project_documents` — Документы проекта

**Назначение**: Хранит информацию о документах проекта (проектная документация, разрешения, договоры).

**Первичный ключ**: `id` (UUID)

**Индексы**:
- `idx_project_documents_project_date` на `(project_id, doc_date DESC)` — быстрая выборка документов проекта по дате

**Поля**:

| Поле БД | Тип данных | Ограничения | UI-поле | Русское название | Когда заполняется | Откуда берется значение |
|---------|-----------|-------------|---------|-----------------|------------------|------------------------|
| `id` | UUID | PRIMARY KEY, NOT NULL, DEFAULT gen_random_uuid() | `documents[].id` | **ID документа** | Шаг `passport` | Автоматически БД |
| `project_id` | UUID | NOT NULL, FK -> projects(id) ON DELETE CASCADE, INDEX | (связь) | **Проект** | Шаг `passport` | ID текущего проекта |
| `name` | TEXT | NULL | `documents[].name` | **Наименование документа** | Шаг `passport` | Ввод пользователя |
| `doc_type` | TEXT | NULL | `documents[].type` | **Тип документа** | Шаг `passport` | Ввод пользователя (Разрешение/Договор/ПД и т.д.) |
| `doc_date` | DATE | NULL, INDEX | `documents[].date` | **Дата документа** | Шаг `passport` | Ввод пользователя |
| `doc_number` | TEXT | NULL | `documents[].number` | **Номер документа** | Шаг `passport` | Ввод пользователя |
| `file_url` | TEXT | NULL | `documents[].url` | **Ссылка на файл** | Шаг `passport` | URL файла после загрузки |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата добавления** | При создании | Автоматически БД |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата изменения** | При изменении | Автоматически при UPDATE |

**Типичные типы документов**:
- `permission` — Разрешение на строительство
- `contract` — Договор
- `project_docs` — Проектная документация
- `expertise` — Заключение экспертизы

**Связи**:
- Многие-к-одному с `projects` через `project_id`

## 2.2 BUILDINGS + BLOCKS — Здания, блоки и их характеристики

### Таблица `buildings` — Здания и сооружения

**Назначение**: Основная таблица зданий и сооружений в составе проекта (жилые дома, паркинги, инфраструктура).

**Первичный ключ**: `id` (UUID)

**Уникальные ключи**: `building_code` (только для не-NULL значений)

**Индексы**:
- `idx_buildings_project` на `project_id` — быстрый поиск зданий проекта
- `idx_buildings_code` на `building_code` (unique, partial) — уникальность кода здания

**Поля**:

| Поле БД | Тип данных | Ограничения | UI-поле | Русское название | Когда заполняется | Откуда берется значение |
|---------|-----------|-------------|---------|-----------------|------------------|------------------------|
| `id` | UUID | PRIMARY KEY, NOT NULL, DEFAULT gen_random_uuid() | `composition[].id` | **ID здания** | Шаг `composition` | Автоматически БД |
| `project_id` | UUID | NOT NULL, FK -> projects(id) ON DELETE CASCADE, INDEX | (связь) | **Проект** | Шаг `composition` | ID текущего проекта |
| `building_code` | TEXT | NULL, UNIQUE (partial), INDEX | `composition[].buildingCode` | **Код здания (ZR00/ZM00/ZP00/ZI00)** | Шаг `composition` | Автогенерация через `generateBuildingCode()` |
| `label` | TEXT | NOT NULL | `composition[].label` | **Наименование здания** | Шаг `composition` | Ввод пользователя (Корпус 1, Паркинг А) |
| `house_number` | TEXT | NULL | `composition[].houseNumber` | **Номер дома/корпуса** | Шаг `composition` | Ввод пользователя |
| `category` | TEXT | NOT NULL | `composition[].category` | **Категория объекта** | Шаг `composition` | Выбор: `residential`, `residential_multiblock`, `parking_separate`, `infrastructure` |
| `stage` | TEXT | NULL | `composition[].stage` | **Стадия объекта** | Шаг `composition` | Ввод пользователя (Проектный/Строящийся) |
| `date_start` | DATE | NULL | `composition[].dateStart` | **Дата начала строительства** | Шаг `composition` | Ввод пользователя |
| `date_end` | DATE | NULL | `composition[].dateEnd` | **Дата завершения строительства** | Шаг `composition` | Ввод пользователя |
| `construction_type` | TEXT | NULL | `composition[].constructionType` | **Тип конструкции паркинга** | Шаг `composition` (для паркинга) | Справочник `dict_parking_construction_types` (capital/light/open) |
| `parking_type` | TEXT | NULL | `composition[].parkingType` | **Тип паркинга** | Шаг `composition` (для паркинга) | Справочник `dict_parking_types` (underground/aboveground) |
| `infra_type` | TEXT | NULL | `composition[].infraType` | **Тип инфраструктуры** | Шаг `composition` (для инфры) | Справочник `dict_infra_types` (school/kindergarten/other) |
| `has_non_res_part` | BOOLEAN | NOT NULL, DEFAULT false | `composition[].hasNonResPart` | **Есть нежилая часть** | Шаг `composition` (для жилого) | Ввод пользователя (checkbox) |
| `cadastre_number` | TEXT | NULL | (интеграция) | **Кадастровый номер здания** | Шаг `integration_buildings` | Получается из системы УЗКАД |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата создания** | При создании | Автоматически БД |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата изменения** | При изменении | Автоматически при UPDATE |

**Значения `category`**:
- `residential` — Жилой дом (одноблочный)
- `residential_multiblock` — Многоблочный жилой комплекс
- `parking_separate` — Отдельно стоящий паркинг
- `infrastructure` — Инфраструктурный объект (школа, сад)

**Связи**:
- Многие-к-одному с `projects` через `project_id`
- Один-ко-многим с `building_blocks` через `building_blocks.building_id`
- Один-ко-многим с `basements` через `basements.building_id`

**Правила удаления**: При удалении здания CASCADE удаляются все блоки, подвалы и связанные данные.

### Таблица `building_blocks` — Блоки здания

**Назначение**: Представляет структурные блоки внутри здания. Жилой многоблочный дом может иметь несколько блоков (жилые, нежилые, стилобаты). Для одноблочных зданий создается один блок.

**Первичный ключ**: `id` (UUID)

**Индексы**:
- `idx_blocks_building` на `building_id` — быстрый поиск блоков здания

**Поля**:

| Поле БД | Тип данных | Ограничения | UI-поле | Русское название | Когда заполняется | Откуда берется значение |
|---------|-----------|-------------|---------|-----------------|------------------|------------------------|
| `id` | UUID | PRIMARY KEY, NOT NULL, DEFAULT gen_random_uuid() | `composition[].blocks[].id` | **ID блока** | Шаг `composition` | Автоматически БД |
| `building_id` | UUID | NOT NULL, FK -> buildings(id) ON DELETE CASCADE, INDEX | (связь) | **Здание блока** | Шаг `composition` | ID родительского здания |
| `label` | TEXT | NOT NULL | `block.label/tabLabel` | **Название блока** | Шаг `composition` | Ввод пользователя (Секция А, Блок 1) |
| `type` | TEXT | NOT NULL | `block.type` | **Тип блока** | Шаг `composition` | Выбор: `Ж` (жилой), `Н` (нежилой), `Parking`, `Infra` |
| `floors_count` | INT | NULL, DEFAULT 0 | `buildingDetails[*].floorsCount` | **Количество этажей (для паркинга/инфры)** | Шаг `registry_res`/`registry_nonres` | Ввод пользователя (для фиксированной этажности) |
| `floors_from` | INT | NULL | `buildingDetails[*].floorsFrom` | **Этажность от** | Шаг `registry_res` (для жилых) | Ввод пользователя (нижняя граница переменной этажности) |
| `floors_to` | INT | NULL | `buildingDetails[*].floorsTo` | **Этажность до** | Шаг `registry_res` (для жилых) | Ввод пользователя (верхняя граница переменной этажности) |
| `entrances_count` | INT | NULL, DEFAULT 0 | `buildingDetails[*].entrances` | **Количество подъездов/входов** | Шаг `registry_res`/`registry_nonres` | Ввод пользователя |
| `elevators_count` | INT | NULL, DEFAULT 0 | `buildingDetails[*].elevators` | **Количество лифтов** | Шаг `registry_res`/`registry_nonres` | Ввод пользователя |
| `vehicle_entries` | INT | NULL, DEFAULT 0 | `buildingDetails[*].vehicleEntries` | **Въезды транспорта** | Шаг `registry_nonres` (для паркинга) | Ввод пользователя |
| `levels_depth` | INT | NULL, DEFAULT 0 | `buildingDetails[*].levelsDepth` | **Глубина подземных уровней** | Шаг `registry_nonres` (для подземного паркинга) | Ввод пользователя (количество уровней -1, -2, -3...) |
| `light_structure_type` | TEXT | NULL | `buildingDetails[*].lightStructureType` | **Тип легкой конструкции** | Шаг `registry_nonres` (для легкого паркинга) | Справочник `dict_light_structure_types` |
| `parent_blocks` | UUID[] | NULL | `buildingDetails[*].parentBlocks` | **Родительские блоки** | Шаг `registry_nonres` (для стилобатов) | Выбор из списка блоков здания (для связи стилобата с жилым блоком) |
| `has_basement` | BOOLEAN | NULL, DEFAULT false | `buildingDetails[*].hasBasementFloor` | **Есть подвал** | Шаг `registry_res` | Ввод пользователя (checkbox) |
| `has_attic` | BOOLEAN | NULL, DEFAULT false | `buildingDetails[*].hasAttic` | **Есть чердак** | Шаг `registry_res` | Ввод пользователя (checkbox) |
| `has_loft` | BOOLEAN | NULL, DEFAULT false | `buildingDetails[*].hasLoft` | **Есть мансарда** | Шаг `registry_res` | Ввод пользователя (checkbox) |
| `has_roof_expl` | BOOLEAN | NULL, DEFAULT false | `buildingDetails[*].hasExploitableRoof` | **Эксплуатируемая кровля** | Шаг `registry_res` | Ввод пользователя (checkbox) |
| `has_custom_address` | BOOLEAN | NULL, DEFAULT false | `buildingDetails[*].hasCustomAddress` | **Свой номер корпуса** | Шаг `registry_res`/`registry_nonres` | Ввод пользователя (checkbox) |
| `custom_house_number` | TEXT | NULL | `buildingDetails[*].customHouseNumber` | **Номер корпуса блока** | Шаг `registry_res`/`registry_nonres` | Ввод пользователя (если has_custom_address=true) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата создания** | При создании | Автоматически БД |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата изменения** | При изменении | Автоматически при UPDATE |

**Примечания**:
- Для жилых блоков используются `floors_from`/`floors_to` (переменная этажность)
- Для паркингов и инфры используется `floors_count` (фиксированная этажность)
- Массив `parent_blocks` используется для стилобатов и нежилых блоков, связанных с жилыми

**Связи**:
- Многие-к-одному с `buildings` через `building_id`
- Один-к-одному с `block_construction` через `block_construction.block_id`
- Один-к-одному с `block_engineering` через `block_engineering.block_id`
- Один-ко-многим с `floors` через `floors.block_id`
- Один-ко-многим с `entrances` через `entrances.block_id`
- Один-ко-многим с `block_floor_markers` через `block_floor_markers.block_id`

### Таблица `block_construction` — Конструктивные характеристики блока

**Назначение**: Хранит конструктивные параметры блока (связь 1:1 с `building_blocks`).

**Первичный ключ**: `id` (UUID)

**Уникальные ключи**: `block_id` (one-to-one)

**Поля**:

| Поле БД | Тип данных | Ограничения | UI-поле | Русское название | Когда заполняется | Откуда берется значение |
|---------|-----------|-------------|---------|-----------------|------------------|------------------------|
| `id` | UUID | PRIMARY KEY, NOT NULL, DEFAULT gen_random_uuid() | (служебно) | **ID записи** | При создании конфигурации | Автоматически БД |
| `block_id` | UUID | NOT NULL, UNIQUE, FK -> building_blocks(id) ON DELETE CASCADE | (связь 1:1) | **Блок** | При создании конфигурации | ID блока |
| `foundation` | TEXT | NULL | `buildingDetails[*].foundation` | **Тип фундамента** | Шаг `registry_res`/`registry_nonres` | Справочник `dict_foundations` (MONOLITH, PILE, и т.д.) |
| `walls` | TEXT | NULL | `buildingDetails[*].walls` | **Материал стен** | Шаг `registry_res`/`registry_nonres` | Справочник `dict_wall_materials` (BRICK, CONCRETE, и т.д.) |
| `slabs` | TEXT | NULL | `buildingDetails[*].slabs` | **Тип перекрытий** | Шаг `registry_res`/`registry_nonres` | Справочник `dict_slab_types` (RC, MONOLITH, и т.д.) |
| `roof` | TEXT | NULL | `buildingDetails[*].roof` | **Тип кровли** | Шаг `registry_res`/`registry_nonres` | Справочник `dict_roof_types` (FLAT, PITCHED, и т.д.) |
| `seismicity` | INT | NULL | `buildingDetails[*].seismicity` | **Сейсмичность (баллы)** | Шаг `registry_res`/`registry_nonres` | Ввод пользователя (0-9 баллов) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата создания** | При создании | Автоматически БД |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата изменения** | При изменении | Автоматически при UPDATE |

**Примечания**:
- Обязательно для жилых блоков и капитальных паркингов
- Для легких конструкций заполняется частично
- Валидация требует заполнения всех полей для жилых блоков

**Связи**:
- Один-к-одному с `building_blocks` через `block_id`

### Таблица `block_engineering` — Инженерное оснащение блока

**Назначение**: Хранит информацию о наличии инженерных систем в блоке (связь 1:1 с `building_blocks`).

**Первичный ключ**: `id` (UUID)

**Уникальные ключи**: `block_id` (one-to-one)

**Поля**:

| Поле БД | Тип данных | Ограничения | UI-поле | Русское название | Когда заполняется | Откуда берется значение |
|---------|-----------|-------------|---------|-----------------|------------------|------------------------|
| `id` | UUID | PRIMARY KEY, NOT NULL, DEFAULT gen_random_uuid() | (служебно) | **ID записи** | При создании конфигурации | Автоматически БД |
| `block_id` | UUID | NOT NULL, UNIQUE, FK -> building_blocks(id) ON DELETE CASCADE | (связь 1:1) | **Блок** | При создании конфигурации | ID блока |
| `has_electricity` | BOOLEAN | NULL, DEFAULT false | `engineering.electricity` | **Электроснабжение** | Шаг `registry_res`/`registry_nonres` | Ввод пользователя (checkbox) |
| `has_water` | BOOLEAN | NULL, DEFAULT false | `engineering.hvs` | **Холодное водоснабжение (ХВС)** | Шаг `registry_res`/`registry_nonres` | Ввод пользователя (checkbox) |
| `has_hot_water` | BOOLEAN | NULL, DEFAULT false | `engineering.gvs` | **Горячее водоснабжение (ГВС)** | Шаг `registry_res`/`registry_nonres` | Ввод пользователя (checkbox) |
| `has_sewerage` | BOOLEAN | NULL, DEFAULT false | `engineering.sewerage` | **Канализация** | Шаг `registry_res`/`registry_nonres` | Ввод пользователя (checkbox) |
| `has_gas` | BOOLEAN | NULL, DEFAULT false | `engineering.gas` | **Газоснабжение** | Шаг `registry_res`/`registry_nonres` | Ввод пользователя (checkbox) |
| `has_heating` | BOOLEAN | NULL, DEFAULT false | `engineering.heating` | **Отопление** | Шаг `registry_res`/`registry_nonres` | Ввод пользователя (checkbox) |
| `has_ventilation` | BOOLEAN | NULL, DEFAULT false | `engineering.ventilation` | **Вентиляция** | Шаг `registry_res`/`registry_nonres` | Ввод пользователя (checkbox) |
| `has_firefighting` | BOOLEAN | NULL, DEFAULT false | `engineering.firefighting` | **Противопожарная система** | Шаг `registry_res`/`registry_nonres` | Ввод пользователя (checkbox) |
| `has_lowcurrent` | BOOLEAN | NULL, DEFAULT false | `engineering.lowcurrent` | **Слаботочные системы** | Шаг `registry_res`/`registry_nonres` | Ввод пользователя (checkbox) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата создания** | При создании | Автоматически БД |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата изменения** | При изменении | Автоматически при UPDATE |

**Примечания**:
- Все поля boolean, по умолчанию false
- Для жилых зданий обычно все системы присутствуют
- Для инфраструктуры набор может быть ограничен

**Связи**:
- Один-к-одному с `building_blocks` через `block_id`

### Таблица `basements` — Подвалы

**Назначение**: Хранит информацию о подвальных уровнях жилых зданий. Подвалы могут использоваться для паркинга или технических помещений.

**Первичный ключ**: `id` (UUID)

**Индексы**:
- `idx_basements_building` на `building_id`
- `idx_basements_block` на `block_id`

**Поля**:

| Поле БД | Тип данных | Ограничения | UI-поле | Русское название | Когда заполняется | Откуда берется значение |
|---------|-----------|-------------|---------|-----------------|------------------|------------------------|
| `id` | UUID | PRIMARY KEY, NOT NULL, DEFAULT gen_random_uuid() | `basements[].id` | **ID подвала** | Шаг `registry_res` | Автоматически БД |
| `building_id` | UUID | NOT NULL, FK -> buildings(id) ON DELETE CASCADE, INDEX | (связь) | **Здание** | Шаг `registry_res` | ID здания |
| `block_id` | UUID | NOT NULL, FK -> building_blocks(id) ON DELETE CASCADE, INDEX | (связь) | **Блок** | Шаг `registry_res` | ID блока (блоки могут иметь свои подвалы) |
| `depth` | INT | NOT NULL | `basements[].depth` | **Глубина (количество уровней)** | Шаг `registry_res` | Ввод пользователя (1, 2, 3... уровня) |
| `has_parking` | BOOLEAN | NOT NULL, DEFAULT false | `basements[].hasParking` | **Есть паркинг в подвале** | Шаг `registry_res` или `parking_config` | Ввод пользователя (checkbox) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата создания** | При создании | Автоматически БД |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата изменения** | При изменении | Автоматически при UPDATE |

**Примечания**:
- Создается для жилых блоков, где установлен флаг `has_basement=true`
- Каждый уровень подвала (depth) может иметь разную конфигурацию паркинга

**Связи**:
- Многие-к-одному с `buildings` через `building_id`
- Многие-к-одному с `building_blocks` через `block_id`
- Один-ко-многим с `basement_parking_levels` через `basement_parking_levels.basement_id`
- Один-ко-многим с `floors` через `floors.basement_id` (SET NULL при удалении)

### Таблица `basement_parking_levels` — Уровни подземного паркинга

**Назначение**: Конфигурация паркинга на каждом уровне подвала (какие уровни активны для паркинга).

**Первичный ключ**: `id` (UUID)

**Уникальные ключи**: `(basement_id, depth_level)` — один уровень на подвал

**Поля**:

| Поле БД | Тип данных | Ограничения | UI-поле | Русское название | Когда заполняется | Откуда берется значение |
|---------|-----------|-------------|---------|-----------------|------------------|------------------------|
| `id` | UUID | PRIMARY KEY, NOT NULL, DEFAULT gen_random_uuid() | (служебно) | **ID записи** | Шаг `parking_config` | Автоматически БД |
| `basement_id` | UUID | NOT NULL, FK -> basements(id) ON DELETE CASCADE, UNIQUE(basement_id, depth_level) | (связь) | **Подвал** | Шаг `parking_config` | ID подвала |
| `depth_level` | INT | NOT NULL, UNIQUE(basement_id, depth_level) | `parkingLevels[level]` | **Номер уровня (-1, -2, -3...)** | Шаг `parking_config` | Номер подземного уровня |
| `is_enabled` | BOOLEAN | NOT NULL, DEFAULT false | `parkingLevels[level]` | **Уровень активен для паркинга** | Шаг `parking_config` | Ввод пользователя (checkbox) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата создания** | При создании | Автоматически БД |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата изменения** | При изменении | Автоматически при UPDATE |

**Примечания**:
- Позволяет гибко управлять тем, на каких уровнях размещается паркинг
- Например: подвал глубиной 3 уровня, но паркинг только на -1 и -2

**Связи**:
- Многие-к-одному с `basements` через `basement_id`

### Таблица `block_floor_markers` — Маркеры этажей блока

**Назначение**: Вспомогательная таблица для хранения специальных маркеров этажей (технические, коммерческие). Используется для конфигурации блока до создания полноценных этажей.

**Первичный ключ**: `id` (UUID)

**Уникальные ключи**: `(block_id, marker_key)` — уникальный маркер в блоке

**Индексы**:
- `idx_block_floor_markers_block` на `block_id`

**Поля**:

| Поле БД | Тип данных | Ограничения | UI-поле | Русское название | Когда заполняется | Откуда берется значение |
|---------|-----------|-------------|---------|-----------------|------------------|------------------------|
| `id` | UUID | PRIMARY KEY, NOT NULL, DEFAULT gen_random_uuid() | (служебно) | **ID маркера** | Шаг `registry_res` | Автоматически БД |
| `block_id` | UUID | NOT NULL, FK -> building_blocks(id) ON DELETE CASCADE, UNIQUE(block_id, marker_key), INDEX | (связь) | **Блок** | Шаг `registry_res` | ID блока |
| `marker_key` | TEXT | NOT NULL, UNIQUE(block_id, marker_key) | (служебно) | **Ключ маркера** | Шаг `registry_res` | Генерируется автоматически (floor_3, floor_5_tech) |
| `marker_type` | TEXT | NOT NULL, CHECK (marker_type IN ('floor', 'technical', 'special', 'basement')) | (служебно) | **Тип маркера** | Шаг `registry_res` | Определяется логикой (floor/technical/special/basement) |
| `floor_index` | INT | NULL | (UI логика) | **Номер этажа** | Шаг `registry_res` | Номер этажа для обычных маркеров |
| `parent_floor_index` | INT | NULL | (UI логика) | **Родительский этаж** | Шаг `registry_res` | Номер основного этажа для технических уровней |
| `is_technical` | BOOLEAN | NOT NULL, DEFAULT false | `technicalFloors` | **Технический этаж** | Шаг `registry_res` | Ввод пользователя (checkbox) |
| `is_commercial` | BOOLEAN | NOT NULL, DEFAULT false | `commercialFloors` | **Коммерческий этаж** | Шаг `registry_res` | Ввод пользователя (checkbox) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата создания** | При создании | Автоматически БД |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата изменения** | При изменении | Автоматически при UPDATE |

**Примечания**:
- Используется на этапе конфигурации блока
- При переходе на шаг `floors` эти маркеры используются для создания реальных записей в таблице `floors`
- Позволяет отметить, какие этажи будут коммерческими или техническими

**Связи**:
- Многие-к-одному с `building_blocks` через `block_id`

## 2.3 FLOORS / ENTRANCES / UNITS / MOP — Инвентаризация этажей, подъездов, помещений и МОП

### Таблица `floors` — Этажи

**Назначение**: Полная инвентаризация этажей блока. Каждая запись представляет один этаж (жилой, технический, подвал, цоколь, чердак, мансарду, кровлю).

**Первичный ключ**: `id` (UUID)

**Индексы**:
- `idx_floors_block` на `block_id` — быстрый поиск этажей блока
- `idx_floors_block_index` на `(block_id, index)` — сортированная выборка этажей
- `uq_floors_block_idx_parent_basement_expr` уникальный составной индекс на `(block_id, index, coalesce(parent_floor_index, -99999), coalesce(basement_id, '00000000-0000-0000-0000-000000000000'))`

**Поля**:

| Поле БД | Тип данных | Ограничения | UI-поле | Русское название | Когда заполняется | Откуда берется значение |
|---------|-----------|-------------|---------|-----------------|------------------|------------------------|
| `id` | UUID | PRIMARY KEY, NOT NULL, DEFAULT gen_random_uuid() | `floorData[*].id` | **ID этажа** | Шаг `floors` | Автоматически БД |
| `block_id` | UUID | NOT NULL, FK -> building_blocks(id) ON DELETE CASCADE, INDEX, UNIQUE(...) | `floorData[*].blockId` | **Блок** | Шаг `floors` | ID блока |
| `index` | INT | NOT NULL, UNIQUE(...) | `floorData[*].index` | **Номер этажа** | Шаг `floors` | Порядковый номер (1, 2, 3...) |
| `floor_key` | TEXT | NULL | `floorData[*].floorKey` | **Системный ключ этажа** | Шаг `floors` | Генерируется (floor_1, floor_2_tech, basement_1, tsokol, attic, loft, roof) |
| `label` | TEXT | NULL | `floorData[*].label` | **Название этажа в UI** | Шаг `floors` | Генерируется ("1 этаж", "Подвал -1", "Тех. этаж 5") |
| `floor_type` | TEXT | NULL | `floorData[*].type` | **Тип этажа** | Шаг `floors` | Определяется: residential/mixed/technical/parking_floor/office/basement/tsokol/attic/loft/roof/stylobate |
| `height` | NUMERIC(10,2) | NULL | `floorData[*].height` | **Высота этажа (м)** | Шаг `floors` | Ввод пользователя (валидация 2.0-6.0 м) |
| `area_proj` | NUMERIC(14,2) | NULL | `floorData[*].areaProj` | **Проектная площадь (м²)** | Шаг `floors` | Ввод пользователя |
| `area_fact` | NUMERIC(14,2) | NULL | `floorData[*].areaFact` | **Фактическая площадь (м²)** | Шаг `floors` | Ввод пользователя (валидация расхождения max 15%) |
| `is_duplex` | BOOLEAN | NULL, DEFAULT false | `floorData[*].isDuplex` | **Дуплексный этаж** | Шаг `floors` | Ввод пользователя (checkbox) |
| `parent_floor_index` | INT | NULL, UNIQUE(...) | `floorData[*].parentFloorIndex` | **Родительский этаж** | Шаг `floors` | Для технических этажей - номер основного этажа |
| `basement_id` | UUID | NULL, FK -> basements(id) ON DELETE SET NULL, UNIQUE(...) | `floorData[*].basementId` | **Подвал** | Шаг `floors` | ID подвала для подвальных этажей |
| `is_technical` | BOOLEAN | NULL, DEFAULT false | `flags.isTechnical` | **Технический этаж** | Шаг `floors` | Флаг (из маркеров или ввод пользователя) |
| `is_commercial` | BOOLEAN | NULL, DEFAULT false | `flags.isCommercial` | **Коммерческий этаж** | Шаг `floors` | Флаг (из маркеров или ввод пользователя) |
| `is_stylobate` | BOOLEAN | NULL, DEFAULT false | `flags.isStylobate` | **Стилобат** | Шаг `floors` | Флаг для стилобатных этажей нежилых блоков |
| `is_basement` | BOOLEAN | NULL, DEFAULT false | `flags.isBasement` | **Подвал** | Шаг `floors` | Флаг для подвальных этажей |
| `is_attic` | BOOLEAN | NULL, DEFAULT false | `flags.isAttic` | **Чердак** | Шаг `floors` | Флаг для чердачных этажей |
| `is_loft` | BOOLEAN | NULL, DEFAULT false | `flags.isLoft` | **Мансарда** | Шаг `floors` | Флаг для мансардных этажей |
| `is_roof` | BOOLEAN | NULL, DEFAULT false | `flags.isRoof` | **Кровля** | Шаг `floors` | Флаг для эксплуатируемой кровли |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата создания** | При создании | Автоматически БД |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата изменения** | При изменении | Автоматически при UPDATE |

**Примечания**:
- Генерируется автоматически на шаге `floors` на основе конфигурации блока
- Дополнительные этажи (подвал, цоколь, чердак, мансарда, кровля) создаются при наличии соответствующих флагов в `building_blocks`
- Технические этажи имеют привязку к родительскому этажу через `parent_floor_index`
- Уникальность обеспечивается составным индексом

**Связи**:
- Многие-к-одному с `building_blocks` через `block_id`
- Многие-к-одному с `basements` через `basement_id` (SET NULL при удалении)
- Один-ко-многим с `entrance_matrix` через `entrance_matrix.floor_id`
- Один-ко-многим с `units` через `units.floor_id`
- Один-ко-многим с `common_areas` через `common_areas.floor_id`

### Таблица `entrances` — Подъезды и входы

**Назначение**: Справочник подъездов/входов блока. Создается на основе количества подъездов из конфигурации блока.

**Первичный ключ**: `id` (UUID)

**Уникальные ключи**: `(block_id, number)` — уникальный номер подъезда в блоке

**Индексы**:
- `idx_entrances_block` на `block_id`

**Поля**:

| Поле БД | Тип данных | Ограничения | UI-поле | Русское название | Когда заполняется | Откуда берется значение |
|---------|-----------|-------------|---------|-----------------|------------------|------------------------|
| `id` | UUID | PRIMARY KEY, NOT NULL, DEFAULT gen_random_uuid() | `entranceId` | **ID подъезда** | Шаг `entrances` | Автоматически БД |
| `block_id` | UUID | NOT NULL, FK -> building_blocks(id) ON DELETE CASCADE, UNIQUE(block_id, number), INDEX | (связь) | **Блок** | Шаг `entrances` | ID блока |
| `number` | INT | NOT NULL, UNIQUE(block_id, number) | `entranceIndex` | **Номер подъезда/входа** | Шаг `entrances` | Порядковый номер (1, 2, 3...) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата создания** | При создании | Автоматически БД |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата изменения** | При изменении | Автоматически при UPDATE |

**Примечания**:
- Создается автоматически на основе `building_blocks.entrances_count`
- Количество подъездов синхронизируется при изменении конфигурации блока
- Для паркингов и инфраструктуры используется термин "входы" вместо "подъезды"

**Связи**:
- Многие-к-одному с `building_blocks` через `block_id`
- Один-ко-многим с `units` через `units.entrance_id` (SET NULL при удалении)
- Один-ко-многим с `common_areas` через `common_areas.entrance_id` (SET NULL при удалении)

### Таблица `entrance_matrix` — Матрица подъезд × этаж

**Назначение**: Планирование количества квартир, нежилых помещений и МОП на каждой ячейке "этаж × подъезд".

**Первичный ключ**: `id` (UUID)

**Уникальные ключи**: `(block_id, floor_id, entrance_number)` — одна ячейка матрицы

**Индексы**:
- `idx_entrance_matrix_block_floor` на `(block_id, floor_id)` — быстрая выборка матрицы

**Поля**:

| Поле БД | Тип данных | Ограничения | UI-поле | Русское название | Когда заполняется | Откуда берется значение |
|---------|-----------|-------------|---------|-----------------|------------------|------------------------|
| `id` | UUID | PRIMARY KEY, NOT NULL, DEFAULT gen_random_uuid() | (служебно) | **ID ячейки** | Шаг `entrances` | Автоматически БД |
| `block_id` | UUID | NOT NULL, FK -> building_blocks(id) ON DELETE CASCADE, UNIQUE(...), INDEX | (связь) | **Блок** | Шаг `entrances` | ID блока |
| `floor_id` | UUID | NOT NULL, FK -> floors(id) ON DELETE CASCADE, UNIQUE(...), INDEX | (связь) | **Этаж** | Шаг `entrances` | ID этажа |
| `entrance_number` | INT | NOT NULL, UNIQUE(block_id, floor_id, entrance_number) | `entrancesData[*]` | **Номер подъезда** | Шаг `entrances` | Номер подъезда (1, 2, 3...) |
| `flats_count` | INT | NULL, DEFAULT 0 | `entrancesData[*].apts` | **Количество квартир** | Шаг `entrances` | Ввод пользователя (плановое количество квартир) |
| `commercial_count` | INT | NULL, DEFAULT 0 | `entrancesData[*].units` | **Количество нежилых помещений** | Шаг `entrances` | Ввод пользователя (для коммерческих этажей) |
| `mop_count` | INT | NULL, DEFAULT 0 | `entrancesData[*].mopQty` | **Количество МОП** | Шаг `entrances` | Ввод пользователя (места общего пользования) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата создания** | При создании | Автоматически БД |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата изменения** | При изменении | Автоматически при UPDATE |

**Примечания**:
- Ключ в UI формируется как `${buildingId}_${blockId}_ent${entrance_number}_${virtualFloorId}`
- Используется для планирования и валидации количества помещений
- На шаге `apartments` проверяется соответствие фактически созданных помещений с плановыми значениями

**Связи**:
- Многие-к-одному с `building_blocks` через `block_id`
- Многие-к-одному с `floors` через `floor_id`

### Таблица `units` — Помещения (квартиры, офисы, машиноместа)

**Назначение**: Реестр всех помещений: квартиры, дуплексы, офисы, нежилые помещения, машиноместа.

**Первичный ключ**: `id` (UUID)

**Уникальные ключи**: `unit_code` (только для не-NULL значений)

**Индексы**:
- `idx_units_floor` на `floor_id` — выборка помещений этажа
- `idx_units_entrance` на `entrance_id` — выборка помещений подъезда
- `idx_units_type` на `unit_type` — фильтрация по типу
- `idx_units_floor_entrance` на `(floor_id, entrance_id)` — составной индекс для быстрой выборки
- `idx_units_code` на `unit_code` (unique, partial) — уникальность кода помещения

**Поля**:

| Поле БД | Тип данных | Ограничения | UI-поле | Русское название | Когда заполняется | Откуда берется значение |
|---------|-----------|-------------|---------|-----------------|------------------|------------------------|
| `id` | UUID | PRIMARY KEY, NOT NULL, DEFAULT gen_random_uuid() | `flatMatrix[*].id` | **ID помещения** | Шаг `apartments` | Автоматически БД |
| `floor_id` | UUID | NOT NULL, FK -> floors(id) ON DELETE CASCADE, INDEX | `flatMatrix[*].floorId` | **Этаж** | Шаг `apartments` | ID этажа |
| `entrance_id` | UUID | NULL, FK -> entrances(id) ON DELETE SET NULL, INDEX | `flatMatrix[*].entranceId` | **Подъезд** | Шаг `apartments` | ID подъезда |
| `unit_code` | TEXT | NULL, UNIQUE (partial), INDEX | `flatMatrix[*].unitCode` | **Код помещения (EF000/EO000/EP000)** | Шаг `apartments` | Автогенерация через `generateUnitCode()` |
| `number` | TEXT | NULL | `flatMatrix[*].num/number` | **Номер помещения** | Шаг `apartments` | Ввод пользователя (номер квартиры/офиса/места) |
| `unit_type` | TEXT | NOT NULL, INDEX | `flatMatrix[*].type` | **Тип помещения** | Шаг `apartments` | Справочник `dict_unit_types` |
| `total_area` | NUMERIC(14,2) | NULL, DEFAULT 0 | `flatMatrix[*].area` | **Общая площадь (м²)** | Шаг `apartments` | Рассчитывается из экспликации или ввод пользователя |
| `living_area` | NUMERIC(14,2) | NULL, DEFAULT 0 | `flatMatrix[*].livingArea` | **Жилая площадь (м²)** | Шаг `apartments` | Рассчитывается из экспликации (для квартир) |
| `useful_area` | NUMERIC(14,2) | NULL, DEFAULT 0 | `flatMatrix[*].usefulArea` | **Полезная площадь (м²)** | Шаг `apartments` | Рассчитывается из экспликации |
| `rooms_count` | INT | NULL, DEFAULT 0 | `flatMatrix[*].rooms` | **Количество комнат** | Шаг `apartments` | Рассчитывается из экспликации или ввод пользователя |
| `status` | TEXT | NULL, DEFAULT 'free' | `flatMatrix[*].isSold` | **Статус** | Шаг `apartments` или реестры | Значения: `free` (свободно), `sold` (продано) |
| `cadastre_number` | TEXT | NULL | `flatMatrix[*].cadastreNumber` | **Кадастровый номер** | Шаг `integration_units` | Получается из системы УЗКАД |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата создания** | При создании | Автоматически БД |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата изменения** | При изменении | Автоматически при UPDATE |

**Значения `unit_type`** (из `dict_unit_types`):
- `flat` — Квартира
- `duplex_up` — Дуплекс (верхний уровень)
- `duplex_down` — Дуплекс (нижний уровень)
- `office` — Офис
- `office_inventory` — Нежилое помещение (инвентаризационное)
- `non_res_block` — Нежилой блок
- `infrastructure` — Инфраструктурное помещение
- `parking_place` — Машиноместо

**Примечания**:
- Полный идентификатор помещения формируется как `UJ000000-ZD00-EL000`
- Площади автоматически рассчитываются на основе экспликации (таблица `rooms`)
- Для дуплексов создается 2 записи (duplex_up и duplex_down) на разных этажах

**Связи**:
- Многие-к-одному с `floors` через `floor_id`
- Многие-к-одному с `entrances` через `entrance_id` (SET NULL при удалении)
- Один-ко-многим с `rooms` через `rooms.unit_id`

### Таблица `rooms` — Экспликация помещения

**Назначение**: Детальная экспликация помещения - разбивка на комнаты и функциональные зоны с указанием площадей.

**Первичный ключ**: `id` (UUID)

**Индексы**:
- `idx_rooms_unit` на `unit_id` — выборка экспликации помещения
- `idx_rooms_unit_type` на `(unit_id, room_type)` — фильтрация по типу комнаты

**Поля**:

| Поле БД | Тип данных | Ограничения | UI-поле | Русское название | Когда заполняется | Откуда берется значение |
|---------|-----------|-------------|---------|-----------------|------------------|------------------------|
| `id` | UUID | PRIMARY KEY, NOT NULL, DEFAULT gen_random_uuid() | `explication[].id` | **ID строки экспликации** | Шаг `apartments` | Автоматически БД |
| `unit_id` | UUID | NOT NULL, FK -> units(id) ON DELETE CASCADE, INDEX | (связь) | **Помещение** | Шаг `apartments` | ID помещения |
| `room_type` | TEXT | NULL, INDEX | `explication[].type` | **Тип комнаты/зоны** | Шаг `apartments` | Справочник `dict_room_types` |
| `name` | TEXT | NULL | `explication[].label` | **Название комнаты** | Шаг `apartments` | Автоматически из справочника или ввод пользователя |
| `area` | NUMERIC(14,2) | NULL, DEFAULT 0 | `explication[].area` | **Площадь комнаты (м²)** | Шаг `apartments` | Ввод пользователя |
| `level` | INT | NULL, DEFAULT 1 | `explication[].level` | **Уровень** | Шаг `apartments` | Для дуплексов: 1 (нижний), 2 (верхний) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата создания** | При создании | Автоматически БД |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата изменения** | При изменении | Автоматически при UPDATE |

**Примечания**:
- Для квартир используется `room_scope='residential'` из справочника `dict_room_types`
- Для офисов/коммерции используется `room_scope='commercial'`
- Площади комнат суммируются с учетом коэффициентов из справочника (например, балкон × 0.3)
- Жилая площадь = сумма комнат с `area_bucket='living'`
- Общая площадь = сумма всех комнат с учетом коэффициентов

**Связи**:
- Многие-к-одному с `units` через `unit_id`

### Таблица `common_areas` — МОП (места общего пользования)

**Назначение**: Реестр мест общего пользования (лестничные клетки, коридоры, лифтовые холлы, технические помещения).

**Первичный ключ**: `id` (UUID)

**Индексы**:
- `idx_common_areas_floor` на `floor_id` — выборка МОП этажа
- `idx_common_areas_floor_entrance` на `(floor_id, entrance_id)` — составной индекс

**Поля**:

| Поле БД | Тип данных | Ограничения | UI-поле | Русское название | Когда заполняется | Откуда берется значение |
|---------|-----------|-------------|---------|-----------------|------------------|------------------------|
| `id` | UUID | PRIMARY KEY, NOT NULL, DEFAULT gen_random_uuid() | `mopData[*].id` | **ID МОП** | Шаг `mop` | Автоматически БД |
| `floor_id` | UUID | NOT NULL, FK -> floors(id) ON DELETE CASCADE, INDEX | `mopData[*].floorId` | **Этаж** | Шаг `mop` | ID этажа |
| `entrance_id` | UUID | NULL, FK -> entrances(id) ON DELETE SET NULL, INDEX | `mopData[*].entranceId` | **Подъезд** | Шаг `mop` | ID подъезда (NULL для общих МОП) |
| `type` | TEXT | NULL | `mopData[*].type` | **Тип МОП** | Шаг `mop` | Справочник `dict_mop_types` |
| `area` | NUMERIC(14,2) | NULL, DEFAULT 0 | `mopData[*].area` | **Площадь (м²)** | Шаг `mop` | Ввод пользователя |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата создания** | При создании | Автоматически БД |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | (служебно) | **Дата изменения** | При изменении | Автоматически при UPDATE |

**Значения `type`** (из `dict_mop_types`):
- `STAIR` — Лестничная клетка
- `CORRIDOR` — Межквартирный коридор
- `ELEVATOR_HALL` — Лифтовой холл
- `TECH` — Техническое помещение
- `OTHER` — Другое

**Примечания**:
- Количество МОП должно соответствовать плановому значению из `entrance_matrix.mop_count`
- МОП могут быть привязаны к конкретному подъезду или быть общими для этажа (entrance_id = NULL)
- В UI ключ формируется как `${buildingId}_${blockId}_e${entrance}_f${virtualFloorId}_mops`

**Связи**:
- Многие-к-одному с `floors` через `floor_id`
- Многие-к-одному с `entrances` через `entrance_id` (SET NULL при удалении)

## 2.4 Справочники `dict_*` — Справочные таблицы

### Общая структура справочников

Большинство справочников имеют единую структуру полей:

| Поле | Тип данных | Ограничения | Назначение |
|------|-----------|-------------|-----------|
| `id` | UUID | PRIMARY KEY, NOT NULL, DEFAULT gen_random_uuid() | **Идентификатор записи** |
| `code` | TEXT | NOT NULL, UNIQUE | **Машинный код** (используется в БД) |
| `label` | TEXT | NOT NULL | **Отображаемое название** (используется в UI) |
| `sort_order` | INT | NOT NULL, DEFAULT 100 | **Порядок сортировки** в списках UI |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT true | **Доступность для выбора** |

### Таблица `dict_project_statuses` — Статусы строительства проекта

**Назначение**: Статусы строительства жилого комплекса.

**Используется в**: `projects.construction_status`

**Стандартные значения**:
| code | label | sort_order |
|------|-------|-----------|
| `project` | Проектный | 10 |
| `building` | Строящийся | 20 |
| `ready` | Готовый к вводу | 30 |
| `done` | Введенный | 40 |

### Таблица `dict_application_statuses` — Статусы workflow заявки

**Назначение**: Статусы жизненного цикла заявки в системе workflow.

**Используется в**: `applications.status`

**Стандартные значения**:
| code | label | sort_order | Описание |
|------|-------|-----------|----------|
| `NEW` | Новая | 10 | Заявка создана, еще не взята в работу |
| `DRAFT` | В работе | 20 | Заявка в работе у техника |
| `REVIEW` | На проверке | 30 | Заявка отправлена контролеру |
| `APPROVED` | Принято | 40 | Контролер принял этап |
| `REJECTED` | Возврат | 50 | Контролер вернул на доработку |
| `INTEGRATION` | Интеграция | 60 | Готова к передаче в УЗКАД |
| `COMPLETED` | Закрыта | 70 | Финальный статус |

### Таблица `dict_external_systems` — Внешние системы-источники

**Назначение**: Внешние системы, из которых могут поступать заявки.

**Используется в**: `applications.external_source`

**Стандартные значения**:
| code | label | sort_order |
|------|-------|-----------|
| `DXM` | ДХМ (Центры госуслуг) | 10 |
| `EPIGU` | ЕПИГУ (my.gov.uz) | 20 |
| `ESCROW` | ЭСКРОУ | 30 |
| `SHAFOF` | Шаффоф Курилиш | 40 |

### Таблица `dict_foundations` — Типы фундаментов

**Назначение**: Типы фундаментов зданий.

**Используется в**: `block_construction.foundation`

**Примеры значений**:
| code | label |
|------|-------|
| `MONOLITH` | Монолитный |
| `PILE` | Свайный |
| `STRIP` | Ленточный |
| `SLAB` | Плитный |

### Таблица `dict_wall_materials` — Материалы стен

**Назначение**: Материалы несущих стен.

**Используется в**: `block_construction.walls`

**Примеры значений**:
| code | label |
|------|-------|
| `BRICK` | Кирпич |
| `CONCRETE` | Бетон |
| `PANEL` | Панель |
| `MONOLITH` | Монолит |

### Таблица `dict_slab_types` — Типы перекрытий

**Назначение**: Типы межэтажных перекрытий.

**Используется в**: `block_construction.slabs`

**Примеры значений**:
| code | label |
|------|-------|
| `RC` | Ж/Б |
| `MONOLITH` | Монолитные |
| `PRECAST` | Сборные |

### Таблица `dict_roof_types` — Типы кровли

**Назначение**: Типы кровли зданий.

**Используется в**: `block_construction.roof`

**Примеры значений**:
| code | label |
|------|-------|
| `FLAT` | Плоская |
| `PITCHED` | Скатная |
| `EXPLOITABLE` | Эксплуатируемая |

### Таблица `dict_light_structure_types` — Типы легких конструкций

**Назначение**: Типы легких конструкций для паркингов.

**Используется в**: `building_blocks.light_structure_type`

**Примеры значений**:
| code | label |
|------|-------|
| `STANDARD` | Стандарт |
| `METAL_FRAME` | Металлокаркас |
| `TENSILE` | Тентовая |

### Таблица `dict_parking_types` — Типы паркинга

**Назначение**: Типы размещения паркинга.

**Используется в**: `buildings.parking_type`

**Стандартные значения**:
| code | label | sort_order |
|------|-------|-----------|
| `underground` | Подземный | 10 |
| `aboveground` | Наземный | 20 |

### Таблица `dict_parking_construction_types` — Типы конструкций паркинга

**Назначение**: Типы конструкций паркинга.

**Используется в**: `buildings.construction_type`

**Стандартные значения**:
| code | label | sort_order |
|------|-------|-----------|
| `capital` | Капитальный | 10 |
| `light` | Из легких конструкций | 20 |
| `open` | Открытый | 30 |

### Таблица `dict_infra_types` — Типы инфраструктуры

**Назначение**: Типы инфраструктурных объектов.

**Используется в**: `buildings.infra_type`

**Стандартные значения**:
| code | label | sort_order |
|------|-------|-----------|
| `school` | Школа | 10 |
| `kindergarten` | Детский сад | 20 |
| `other` | Другое | 100 |

### Таблица `dict_mop_types` — Типы МОП

**Назначение**: Типы мест общего пользования.

**Используется в**: `common_areas.type`

**Стандартные значения**:
| code | label | sort_order |
|------|-------|-----------|
| `STAIR` | Лестничная клетка | 10 |
| `CORRIDOR` | Межквартирный коридор | 20 |
| `ELEVATOR_HALL` | Лифтовой холл | 30 |
| `TECH` | Техническое помещение | 40 |
| `OTHER` | Другое | 100 |

### Таблица `dict_unit_types` — Типы помещений

**Назначение**: Типы помещений в реестре.

**Используется в**: `units.unit_type`

**Стандартные значения**:
| code | label | sort_order |
|------|-------|-----------|
| `flat` | Квартира | 10 |
| `duplex_up` | Дуплекс (В) | 20 |
| `duplex_down` | Дуплекс (Н) | 30 |
| `office` | Офис | 40 |
| `office_inventory` | Нежилое (Инв.) | 50 |
| `non_res_block` | Нежилой блок | 60 |
| `infrastructure` | Инфраструктура | 70 |
| `parking_place` | Машиноместо | 80 |

### Таблица `dict_room_types` — Типы комнат/зон экспликации

**Назначение**: Типы комнат и функциональных зон для экспликации помещений.

**Используется в**: `rooms.room_type`

**Особенности структуры**:
| Поле | Тип данных | Ограничения | Назначение |
|------|-----------|-------------|-----------|
| `id` | UUID | PRIMARY KEY | Идентификатор |
| `code` | TEXT | NOT NULL, UNIQUE(code, room_scope) | Код типа комнаты |
| `label` | TEXT | NOT NULL | Название комнаты |
| `room_scope` | TEXT | NOT NULL, CHECK IN ('residential', 'commercial') | Область применения |
| `area_bucket` | TEXT | NOT NULL, CHECK IN ('living', 'main', 'useful', 'aux', 'summer', 'other') | Категория площади |
| `coefficient` | NUMERIC(6,3) | NOT NULL, DEFAULT 1.0, CHECK >= 0 | Коэффициент учета площади |
| `sort_order` | INT | NOT NULL, DEFAULT 100 | Порядок сортировки |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT true | Доступность |

**Стандартные значения для `room_scope='residential'` (жилые помещения)**:
| code | label | area_bucket | coefficient | sort_order |
|------|-------|-------------|-------------|-----------|
| `living` | Жилая комната | living | 1.0 | 10 |
| `kitchen` | Кухня | useful | 1.0 | 20 |
| `kitchen_living` | Кухня-гостиная | living | 1.0 | 30 |
| `bathroom` | Ванная / С/У | useful | 1.0 | 40 |
| `corridor` | Коридор / Холл | useful | 1.0 | 50 |
| `pantry` | Кладовая / Гардероб | useful | 1.0 | 60 |
| `staircase` | Внутрикв. лестница | useful | 1.0 | 70 |
| `loggia` | Лоджия | summer | 0.5 | 80 |
| `balcony` | Балкон | summer | 0.3 | 90 |
| `other` | Другое | other | 1.0 | 100 |

**Стандартные значения для `room_scope='commercial'` (нежилые помещения)**:
| code | label | area_bucket | coefficient | sort_order |
|------|-------|-------------|-------------|-----------|
| `main_hall` | Торговый зал / Опенспейс | main | 1.0 | 210 |
| `cabinet` | Кабинет | main | 1.0 | 220 |
| `storage` | Склад / Подсобное | aux | 1.0 | 230 |
| `kitchen` | Кухня (для персонала) | aux | 1.0 | 240 |
| `bathroom` | Санузел | aux | 1.0 | 250 |
| `corridor` | Коридор | aux | 1.0 | 260 |
| `tambour` | Тамбур / Входная группа | aux | 1.0 | 270 |
| `tech` | Тех. помещение | aux | 1.0 | 280 |
| `terrace` | Терраса | summer | 0.3 | 290 |

**Примечания**:
- `area_bucket` определяет категорию для расчета площадей
- `coefficient` учитывается при подсчете общей площади (балкон × 0.3, лоджия × 0.5)
- Жилая площадь = сумма комнат с `area_bucket='living'`
- Полезная площадь = сумма комнат с `area_bucket IN ('living', 'main', 'useful')`

### Таблица `dict_system_users` — Системные пользователи (DEV)

**Назначение**: Справочник пользователей для DEV-контура.

**Используется в**: UI для авторизации, выбора исполнителя, истории действий.

**Особенности структуры**:
| Поле | Тип данных | Ограничения | Назначение |
|------|-----------|-------------|-----------|
| `id` | UUID | PRIMARY KEY | Идентификатор |
| `code` | TEXT | NOT NULL, UNIQUE | Уникальный код пользователя |
| `name` | TEXT | NOT NULL | Имя пользователя |
| `role` | TEXT | NOT NULL, CHECK IN ('admin', 'controller', 'technician') | Роль пользователя |
| `group_name` | TEXT | NULL | Группа/отдел пользователя |
| `sort_order` | INT | NOT NULL, DEFAULT 100 | Порядок сортировки |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT true | Активность учетной записи |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Дата создания |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Дата изменения |

**Примеры значений**:
| code | name | role | group_name | sort_order |
|------|------|------|-----------|-----------|
| `timur_admin` | Тимур | admin | Тимур | 10 |
| `timur_contr` | Тимур | controller | Тимур | 20 |
| `timur_tech` | Тимур | technician | Тимур | 30 |
| `abdu_admin` | Абдурашид | admin | Абдурашид | 40 |

**Роли пользователей**:
- `admin` — Полный доступ к данным и workflow
- `controller` — Проверка этапов, approve/reject
- `technician` — Ввод и редактирование данных
