# 25. План внедрения сущности пристроек блока (`block_extensions`)

## Цель

Ввести отдельную доменную сущность **пристроек блока** с полным жизненным циклом в проекте:
- хранение в БД как отдельной таблицы (`block_extensions`),
- редактирование в UI вместе с родительским блоком,
- участие в существующих шагах workflow через `extension_id` в `floors` и `units`,
- поддержка «смещенного старта» пристройки (не с 1 этажа, включая связь на уровне этажа или кровли).

## Подтвержденные бизнес-правила

1. У одного блока может быть несколько пристроек.
2. Пристройка относится к **конкретному** родительскому блоку (`parent_block_id`).
3. Пристройка не имеет блочных атрибутов типа:
   - подъезды,
   - лифты,
   - подвалы/уровни подземного паркинга.
4. Пристройка имеет:
   - этажность,
   - тип конструкции (`capital`/`light`),
   - конструктив,
   - инженерные коммуникации.
5. Пристройка участвует в:
   - внешней инвентаризации (`floors`),
   - внутренней инвентаризации (`units`/`rooms`).
6. Пристройка может начинаться не с 1 этажа (переход, вестибюль, надстройка на крыше).

## Доменная модель (утверждаемый контракт)

### 1) Новая таблица `block_extensions`

Рекомендуемый минимальный состав полей:

- `id UUID PK`
- `building_id UUID NOT NULL` -> `buildings(id)`
- `parent_block_id UUID NOT NULL` -> `building_blocks(id)`
- `label TEXT NOT NULL`
- `extension_type TEXT NOT NULL`
  - примерные коды: `CANOPY`, `TAMBUR`, `VESTIBULE`, `PASSAGE`, `UTILITY`, `OTHER`
- `construction_kind TEXT NOT NULL`
  - `capital` | `light`
- `floors_count INT NOT NULL DEFAULT 1`
- `start_floor_index INT NOT NULL DEFAULT 1`
- `vertical_anchor_type TEXT NOT NULL DEFAULT 'GROUND'`
  - `GROUND` | `BLOCK_FLOOR` | `ROOF`
- `anchor_floor_key TEXT NULL`
- `notes TEXT NULL`
- `created_at`, `updated_at`

Индексы:
- `idx_block_extensions_building (building_id)`
- `idx_block_extensions_parent (parent_block_id)`
- `idx_block_extensions_anchor (parent_block_id, start_floor_index)`

Ограничения:
- `floors_count >= 1`
- `vertical_anchor_type in ('GROUND','BLOCK_FLOOR','ROOF')`
- `(vertical_anchor_type = 'GROUND' and anchor_floor_key is null) or (vertical_anchor_type in ('BLOCK_FLOOR','ROOF'))`

> Примечание: Для `ROOF` разрешается `start_floor_index` как индекс опорного уровня родительского блока (определяется на backend при валидации).

### 2) Расширение `floors`

Добавить поле:
- `extension_id UUID NULL` -> `block_extensions(id)`

Добавить XOR-ограничение принадлежности записи этажа:
- запись этажа принадлежит **либо** `block_id`, **либо** `extension_id`.

Рекомендуемый CHECK:
- `(block_id is not null and extension_id is null) or (block_id is null and extension_id is not null)`

Индексы:
- `idx_floors_extension (extension_id, index)`

### 3) Расширение `units`

Добавить поле:
- `extension_id UUID NULL` -> `block_extensions(id)`

Добавить XOR-ограничение принадлежности помещения:
- помещение принадлежит этажу и дополнительно указывает источник: блок или пристройка.

Рекомендуемый CHECK:
- `(extension_id is null) or (extension_id is not null)` с серверной проверкой согласованности `units.extension_id == floors.extension_id`.

Индексы:
- `idx_units_extension (extension_id)`

### 4) Конструктив/инженерия пристроек

Вариант A (рекомендуется для чистоты):
- отдельные таблицы:
  - `extension_construction` (1:1 с `block_extensions`),
  - `extension_engineering` (1:1 с `block_extensions`).

Вариант B (ускоренный):
- хранить конструктив/инженерию пристройки в JSONB полях `block_extensions` с дальнейшей нормализацией.

**Рекомендуем к внедрению Вариант A** для сохранения существующего паттерна `block_construction` / `block_engineering`.

## Изменения в backend

## Этап 1. Контракт и migration-слой

1. Обновить `db/reset_schema.sql`:
   - создать таблицу `block_extensions`,
   - добавить `extension_id` в `floors`/`units`,
   - добавить индексы/ограничения.
2. Обновить документацию таблиц/ER/валидаций.
3. Добавить seed-справочник типов пристроек (если вводим `dict_extension_types`).

Критерии готовности:
- схема пересобирается с нуля без ошибок,
- FK/CHECK валидны,
- вставка/обновление неправильных связей блокируется на уровне БД.

## Этап 2. API/Repository слой

1. В backend (BFF + backend-java) добавить endpoint-ы:
   - `GET /api/v1/blocks/:blockId/extensions`
   - `POST /api/v1/blocks/:blockId/extensions`
   - `PUT /api/v1/extensions/:extensionId`
   - `DELETE /api/v1/extensions/:extensionId`
2. Обновить read-агрегаты проекта:
   - загрузка пристроек вместе со зданием/блоками,
   - загрузка этажей и помещений с `extension_id`.
3. Добавить серверную валидацию:
   - `parent_block_id` принадлежит указанному `building_id`,
   - `start_floor_index` допустим относительно конфигурации parent block,
   - `ROOF` допустим только если у parent block есть соответствующая кровельная отметка/уровень.

Критерии готовности:
- API возвращает пристройки в составе проектного агрегата,
- операции CRUD покрыты контрактными тестами.

## Этап 3. Workflow/locks/idempotency

1. Все mutating endpoint-ы пристроек должны поддерживать `x-idempotency-key`.
2. Редактирование пристроек проходит через те же lock-правила заявки (`application_locks`).
3. История изменений заявок (при workflow-действиях) сохраняет инварианты как для блоков.

Критерии готовности:
- повторные запросы безопасны,
- конкурентное редактирование контролируется lock-механикой.

## Изменения во frontend

## Этап 4. State/DTO/mappers

1. Расширить DTO и маппинг:
   - `composition[].blocks[].extensions[]`.
2. В `db-mappers` добавить сборку/обратный маппинг пристроек.
3. Обновить data-layer/sync-layer для поддержки upsert/delete пристроек.

Критерии готовности:
- пристройки загружаются/сохраняются без потери данных,
- данные пристроек не смешиваются с обычными блоками.

## Этап 5. UI шагов

1. `registry_res`/`registry_nonres`:
   - в редакторе блока добавить секцию «Пристройки» (список + CRUD),
   - поля вертикальной привязки (`start_floor_index`, `vertical_anchor_type`, `anchor_floor_key`).
2. `floors`:
   - в списке инвентаризируемых сущностей показывать пристройки как дочерние элементы блока,
   - генерация/редактирование этажей пристройки с учетом смещенного старта.
3. `apartments`:
   - помещения пристроек ведутся в общем реестре с явным признаком принадлежности пристройке.
4. `entrances`/`mop`:
   - пристройки не включаются в обязательные матрицы подъездов/МОП.

Критерии готовности:
- редактирование пристроек выполняется «вместе с блоком» в одном UX-контуре,
- сценарии «пристройка на уровне N» и «пристройка на крыше» доступны из UI.

## Валидации (обновление)

## Этап 6. Step validators

Добавить валидатор профиля пристроек:

- Обязательные:
  - `construction_kind`,
  - этажность (`floors_count`),
  - вертикальная привязка,
  - конструктив,
  - инженерия.

- Запрещенные/игнорируемые поля для пристроек:
  - `entrances_count`,
  - `elevators_count`,
  - basement-поля.

- Для `vertical_anchor_type`:
  - `GROUND`: старт с уровня по умолчанию,
  - `BLOCK_FLOOR`: `start_floor_index` должен существовать в parent block,
  - `ROOF`: должен существовать roof-маркер/флаг у parent block.

Критерии готовности:
- ошибки валидации детализированы по пристройкам,
- нет ложных ошибок по правилам, относящимся только к блокам.

## Статусы заполнения и workflow-шаги

## Этап 7. `application_steps.block_statuses`

1. В блок-статусах шага добавить поддержку элементов типа `extension`.
2. Для шагов:
   - включить пристройки в `registry_res`, `registry_nonres`, `floors`, `apartments`;
   - исключить из `entrances`, `mop`, `parking_config`.
3. Обновить колонку «Статус заполнения» в селекторе зданий.

Критерии готовности:
- статус пристроек считается отдельно,
- общий статус здания корректно учитывает вклад блоков и пристроек.

## Документирование (обязательно)

## Этап 8. Док-пакет

Обновить разделы документации:

1. `docs/project/02-database-structure.md`
   - новые таблицы и поля,
   - UI ↔ DB маппинг по пристройкам.
2. `docs/project/03-er-and-integrity.md`
   - новые связи и правила удаления.
3. `docs/project/06-operational-flow.md`
   - где и как редактируются/инвентаризируются пристройки.
4. `docs/project/07-validations.md`
   - правила валидации пристроек.
5. `docs/project/08-integration-sync-and-migration.md`
   - синхронизация UI/DB по `extension_id`.
6. `docs/project/09-role-step-data-lifecycle.md`
   - мутации таблиц по шагам для пристроек.

Критерии готовности:
- документация синхронизирована с кодом и схемой,
- новый функционал полностью трассируется от UI до SQL.

## Тест-план внедрения

## Этап 9. Автотесты

1. DB smoke:
   - создание пристройки,
   - вставка floors/units для пристройки,
   - отказ при нарушении XOR/anchor-правил.
2. Backend tests:
   - CRUD пристроек,
   - валидация смещенного старта,
   - idempotency и lock-сценарии.
3. Frontend tests:
   - сохранение/перезагрузка пристроек в редакторе блока,
   - блок-статусы с пристройками,
   - шаговые smoke-тесты.

Критерии готовности:
- green на обязательных guardrails,
- прохождение новых сценариев пристроек.

## План релиза (безопасный)

## Этап 10. Feature-flag rollout

1. Ввести feature-flag `extensions_enabled`:
   - backend + frontend.
2. Сначала включить на DEV.
3. Проверить регрессию workflow и шаговых редакторов.
4. После стабилизации снять флаг и сделать функционал стандартным.

## Итоговые контрольные точки утверждения

1. **Утверждение DB-контракта** (`block_extensions`, `extension_id`, XOR, anchor-поля).
2. **Утверждение UX** редактирования пристроек внутри блока.
3. **Утверждение правил валидации** (что обязательно, что запрещено).
4. **Утверждение состава шагов**, где пристройки учитываются в статусе заполнения.
5. **Утверждение тест-пакета и порядка rollout**.

После утверждения этого плана следующая итерация — подготовка точных DDL-изменений и контрактов API (request/response) с привязкой к конкретным файлам реализации.

## Статус реализации (итерация 1)

### Что уже реализовано в кодовой базе

1. В `db/reset_schema.sql` добавлены:
   - таблица `block_extensions`,
   - поле `floors.extension_id` с XOR-ограничением принадлежности (`block_id` xor `extension_id`),
   - поле `units.extension_id` и триггер согласованности `units.extension_id` с `floors.extension_id`,
   - индексы по новым полям,
   - справочник `dict_extension_types` с seed-значениями.

2. Обновлены DTO/маппинг:
   - типы `DbFloorRow`, `UiFloor`, `DbUnitRow` расширены `extension_id/extensionId`,
   - мапперы `mapFloorFromDB` и `mapUnitFromDB` возвращают `extensionId`,
   - `mapBuildingFromDB` поддерживает `blocks[].extensions[]`.

3. Обновлен расчет `block_statuses`:
   - в шаговых статусах добавлена поддержка сущностей типа `extension` для шагов
     `registry_nonres`, `registry_res`, `floors`, `apartments`.

### Что следующим шагом

1. Реализовать полные шаговые валидаторы для пристроек (не только наличие данных).
2. Добавить CRUD операций пристроек в API-домены и BFF-контракты.
3. Подключить UI-редактирование пристроек в `registry_res/registry_nonres` и отображение в `floors/apartments`.


## Статус реализации (итерация 2)

### Что сделано

1. Добавлены BFF-контракты для CRUD пристроек:
   - `GET /api/v1/blocks/:blockId/extensions`
   - `POST /api/v1/blocks/:blockId/extensions`
   - `PUT /api/v1/extensions/:extensionId`
   - `DELETE /api/v1/extensions/:extensionId`

2. В `registry-domain` добавлены обертки API:
   - `getBlockExtensions`,
   - `createBlockExtension`,
   - `updateBlockExtension`,
   - `deleteBlockExtension`.

3. Усилен step-status для пристроек:
   - добавлен базовый валидатор `validateExtensionByStep` для `registry_res/registry_nonres`,
   - статус пристройки на шаге теперь учитывает как наличие данных, так и ошибки обязательных полей.

### Что дальше

1. Подключить новые extension-методы в UI (`registry_res`/`registry_nonres`) с формами редактирования.
2. Добавить полноценные unit/integration тесты extension-flow в smoke-пакет.
3. Доработать backend endpoint-реализацию (если маршрут в конкретном runtime еще не реализован).


## Статус реализации (итерация 3)

### Что сделано

1. Усилена БД-валидация пристроек:
   - добавлен триггер `trg_validate_block_extension_rules`,
   - проверка соответствия `building_id` родительскому блоку,
   - запрет привязки пристройки к подвальному блоку,
   - проверка `start_floor_index` по `block_floor_markers` для `BLOCK_FLOOR`,
   - проверка наличия `has_roof_expl` у parent block для `ROOF`.

2. Улучшена агрегация проекта:
   - при объединении extension-данных из разных payload-источников добавлена дедупликация по `extension.id`.

3. Для расчета step-status улучшен `blockHasStepData`:
   - для extension на шагах `registry_res/registry_nonres` учитываются данные из `composition.blocks[].extensions[]`,
   - это предотвращает ложный `EMPTY` при отсутствии `buildingDetails`-ключа для пристройки.

### Что дальше

1. Реализовать UI-формы CRUD пристроек в редакторах `registry_res/registry_nonres`.
2. Подключить extension-aware генерацию/редактирование этажей и помещений в `floors/apartments`.
3. Добавить отдельные smoke/contract тесты extension-flow на уровне backend + frontend.


## Статус реализации (итерация 4)

### Что сделано

1. Реализован UI-компонент `ExtensionsCard`:
   - просмотр списка пристроек текущего блока,
   - создание/редактирование/удаление пристройки,
   - редактирование ключевых полей (`extensionType`, `constructionKind`, `floorsCount`, `startFloorIndex`, `verticalAnchorType`, `anchorFloorKey`).

2. Подключение в редактор блока (`StandardView`):
   - карточка встроена в шаги конфигурации `registry_res/registry_nonres` для block-scoped редактирования,
   - операции выполняются через `ApiService` (`create/update/deleteBlockExtension`),
   - локальная `composition` синхронизируется после успешных API-операций.

3. Добавлен визуальный smoke-артефакт с UI после подключения карточки пристроек.

### Что дальше

1. Расширить UI-поддержку пристроек для `InfrastructureView`/`ParkingView` (если подтверждено бизнесом).
2. Подключить extension-aware UX в шагах `floors/apartments` (навигация и фильтры по extension).
3. Добавить e2e/contract тесты на CRUD пристроек и step-status обновления в UI.


## Статус реализации (итерация 5)

### Что сделано

1. Расширена UI-поддержка `ExtensionsCard`:
   - карточка подключена не только в `StandardView`, но и в `InfrastructureView` и `ParkingView`.

2. CRUD-поток в этих представлениях использует общий API-контур:
   - `ApiService.createBlockExtension`,
   - `ApiService.updateBlockExtension`,
   - `ApiService.deleteBlockExtension`,
   - синхронизация локальной `composition` после успешных операций.

3. Сохранен единый UX: редактирование пристроек остается частью block-scoped редактора в шагах конфигурации.

### Что дальше

1. Добавить extension-aware отображение/фильтрацию в шагах `floors` и `apartments`.
2. Добавить smoke/e2e сценарии для CRUD пристроек в `StandardView`/`InfrastructureView`/`ParkingView`.
3. Подключить backend-реализацию новых extension endpoint-ов во всех runtime-вариантах.


## Статус реализации (итерация 6)

### Что сделано

1. Закрыт документальный хвост по extension-сущности:
   - обновлены `03-er-and-integrity`, `06-operational-flow`, `07-validations`, `09-role-step-data-lifecycle` с явным описанием `block_extensions`, `extension_id`, step-status и fallback-поведения.

2. Расширено регрессионное покрытие merge-логики в `project-domain`:
   - проверяется дедупликация nested/top-level payload,
   - проверяется игнорирование orphan extension (`parent_block_id` без блока),
   - зафиксирован приоритет nested payload при дублирующемся `extension.id`,
   - зафиксировано корректное распределение top-level extension по `parent_block_id` между несколькими блоками.

3. Расширено контрактное покрытие доменных API:
   - `registry-domain` tests проверяют BFF-gate, actor propagation и idempotency-key для extension CRUD.

### Что осталось до полного закрытия задачи

1. Реализовать extension-aware UX в шагах `floors` и `apartments` (навигация/фильтрация/редактирование в разрезе extension).
2. Добавить e2e/smoke сценарии UI для extension CRUD и обновления step-status в рантайме браузера.
3. Завершить backend runtime-реализацию extension endpoint в текущем тестовом контуре и снять локальный fallback как основной режим.
4. Пройти rollout через feature-flag (`extensions_enabled`) в текущем едином тестовом контуре с проверочным деплоем.


## Статус реализации (итерация 7)

### Что сделано

1. Реализован extension-aware UX в шагах `floors` и `apartments`:
   - в `FloorMatrixEditor` добавлены вкладки пристроек и фильтрация этажей по `extensionId`;
   - в `ApartmentsRegistry` добавлены вкладки пристроек для текущего блока и фильтрация матрицы/списка по `extensionId`.

2. Введен feature-flag контур для extensions:
   - `VITE_EXTENSIONS_ENABLED` — глобальное включение/отключение UI-операций с пристройками;
   - `VITE_EXTENSIONS_LOCAL_FALLBACK_ENABLED` — управление локальным fallback-режимом при недоступном backend endpoint.

3. Обновлен UX карточки `ExtensionsCard`:
   - поддержан `disabled`-режим с явным информированием пользователя, когда feature выключен.

### Что осталось до полного закрытия задачи

1. Добавить стабильный browser e2e smoke сценарий extension-flow (create/update/delete + статус шага) в CI-пакет.
2. Завершить backend runtime rollout endpoint-ов пристроек в текущем тестовом контуре и перевести UI на API-only режим после проверки readiness.
3. Завершить rollout через feature-flag в текущем едином тестовом контуре и зафиксировать итоговую конфигурацию без fallback.


## Статус реализации (итерация 8)

### Что сделано

1. Добавлен browser/runtime smoke-контур на уровне автопроверок контракта UI:
   - `tests/extensions-ui-rollout-contract.test.mjs` проверяет наличие extension-aware логики во `FloorMatrixEditor` и `ApartmentsRegistry`;
   - проверяется подключение feature-flag управления и `disabled`-режима `ExtensionsCard` во всех конфигурационных view.

2. Для rollout-конфигурации обновлен `.env.example`:
   - добавлены `VITE_EXTENSIONS_ENABLED` и `VITE_EXTENSIONS_LOCAL_FALLBACK_ENABLED`.

### Что осталось до полного закрытия задачи

1. Добавить стабильный browser e2e smoke extension-flow (create/update/delete + влияние на step-status) в CI-пакет.
2. Зафиксировать финальный runtime smoke в тестовом контуре с `VITE_EXTENSIONS_LOCAL_FALLBACK_ENABLED=false` и приложить артефакты прогона.
