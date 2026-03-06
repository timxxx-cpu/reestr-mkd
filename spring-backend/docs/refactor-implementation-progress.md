# Поэтапная реализация рефакторинга backend

## Этап 1 — вынесение sync parking из RegistryController

Статус: ✅ Завершен

### Что сделано
1. Создан сервис `ParkingSyncService`, куда перенесена бизнес-логика синхронизации парковочных мест.
2. В `RegistryController` endpoint `/floors/{floorId}/parking-places/sync` переведен на делегирование в сервис.
3. Добавлен typed request DTO `SyncParkingPlacesRequestDto` вместо generic map-подхода для этого endpoint.
4. Добавлены unit-тесты `ParkingSyncServiceTests` на три базовых сценария:
   - без изменений,
   - добавление мест,
   - удаление мест.

### Результат этапа
- Контроллер стал тоньше для данного сценария.
- Бизнес-правило стало отдельно тестируемым.
- Начата поэтапная типизация API-контрактов без big-bang переписывания.


## Этап 2 — вынос query-логики чтения из RegistryController

Статус: ✅ Завершен

### Что сделано
1. Создан `RegistryQueryService` для read-операций реестра (`buildings summary`, `parking counts`).
2. `RegistryController` для двух GET endpoints теперь делегирует в сервис, не строит SQL напрямую.
3. Добавлены unit-тесты `RegistryQueryServiceTests` на фильтрацию и маппинг результата.

### Результат этапа
- Снижена нагрузка на контроллер и связность HTTP-слоя с SQL.
- Появилась переиспользуемая и тестируемая read-логика для следующих шагов декомпозиции.


## Этап 3 — вынос explication query/use-case из RegistryController

Статус: ✅ Завершен

### Что сделано
1. Создан `RegistryUnitQueryService` с методом `loadUnitExplication(UUID)` для выборки и сборки модели квартиры с помещениями.
2. Endpoint `GET /units/{unitId}/explication` в `RegistryController` переведен на делегирование в сервис.
3. Добавлены unit-тесты `RegistryUnitQueryServiceTests` на сценарии `not found` и корректный маппинг полей комнат.

### Результат этапа
- Контроллер дополнительно упрощен и не содержит SQL для explication-сценария.
- Сложная read-логика стала изолирована, переиспользуема и покрыта тестами.


## Этап 4 — вынос query-логики списка юнитов блока из RegistryController

Статус: ✅ Завершен

### Что сделано
1. Создан `RegistryBlockUnitsQueryService` с методом `loadUnits(...)` для получения списка юнитов блока и `entranceMap` с фильтрами/пагинацией.
2. Endpoint `GET /blocks/{blockId}/units` в `RegistryController` переведен на делегирование в сервис.
3. Добавлены unit-тесты `RegistryBlockUnitsQueryServiceTests` на базовый сценарий и сценарий с фильтрами.

### Результат этапа
- Из контроллера вынесен еще один объемный SQL/read-сценарий.
- Read-логика списка юнитов стала изолированной и тестируемой в сервисном слое.


## Этап 5 — вынос write/use-case reconcile entrances из RegistryController

Статус: ✅ Завершен

### Что сделано
1. Создан `EntranceReconcileService` с методом `reconcile(UUID blockId, int count)` для создания/удаления подъездов по целевому количеству.
2. Добавлен typed DTO `ReconcileEntrancesRequestDto` (`count >= 0`).
3. Endpoint `POST /blocks/{blockId}/entrances/reconcile` в `RegistryController` переведен на делегирование в сервис (контроллер оставляет policy-check + HTTP ответ).
4. Добавлены unit-тесты `EntranceReconcileServiceTests` на сценарии добавления и удаления подъездов.

### Результат этапа
- Из контроллера вынесен еще один write-сценарий с SQL и бизнес-правилом.
- Улучшена типизация контракта и тестируемость mutate-операции.

## Итог
- По текущему плану реализации выполнено **5/5 этапов (100%)**.


## Этап 6 — вынос write/use-case reconcile units из RegistryController

Статус: ✅ Завершен

### Что сделано
1. Создан `UnitsReconcileService` с методом `reconcile(UUID blockId)` для синхронизации квартир/коммерции на основании `entrance_matrix`.
2. Endpoint `POST /blocks/{blockId}/units/reconcile` в `RegistryController` переведен на делегирование в сервис.
3. Добавлены unit-тесты `UnitsReconcileServiceTests` на сценарии `no floors` и `add/delete by matrix`.

### Результат этапа
- Из контроллера вынесен один из самых больших mutate-сценариев.
- Сервис изолирует SQL/бизнес-правила и упрощает дальнейшую декомпозицию `RegistryController`.

## Обновленный итог
- Выполнено **6 этапов** по поэтапному выносу логики из `RegistryController`.


## Этап 7 — вынос write/use-case reconcile mops из RegistryController

Статус: ✅ Завершен

### Что сделано
1. Создан `MopsReconcileService` с методом `reconcile(UUID blockId)` для удаления лишних `common_areas` по целевым значениям `mop_count` из `entrance_matrix`.
2. Endpoint `POST /blocks/{blockId}/common-areas/reconcile` в `RegistryController` переведен на делегирование в сервис.
3. Добавлены unit-тесты `MopsReconcileServiceTests` на сценарии `no floors` и `delete above desired count`.

### Результат этапа
- Из контроллера вынесен еще один крупный mutate-сценарий.
- Логика reconcile MOP теперь изолирована и тестируема на уровне сервиса.

## Обновленный итог
- Выполнено **7 этапов** по поэтапному выносу логики из `RegistryController`.


## Этап 8 — вынос use-case reconcile preview из RegistryController

Статус: ✅ Завершен

### Что сделано
1. Создан `ReconcilePreviewService` с методом `preview(UUID blockId)` для расчёта `toRemove/checkedCells` по units/commonAreas.
2. Endpoint `POST /blocks/{blockId}/reconcile/preview` в `RegistryController` переведен на делегирование в сервис.
3. Добавлены unit-тесты `ReconcilePreviewServiceTests` на сценарии `no floors` и расчет удалений по матрице.

### Результат этапа
- Из контроллера вынесен еще один крупный read/use-case блок.
- Расчет превью reconcile теперь изолирован и покрыт тестами.

## Обновленный итог
- Выполнено **8 этапов** по поэтапному выносу логики из `RegistryController`.


## Этап 9 — вынос use-case entrance matrix (cell/batch) из RegistryController

Статус: ✅ Завершен

### Что сделано
1. Создан `EntranceMatrixService` с методами `upsertCell(...)` и `upsertBatch(...)` и валидацией matrix-значений.
2. Endpoints `PUT /blocks/{blockId}/entrance-matrix/cell` и `PUT /blocks/{blockId}/entrance-matrix/batch` в `RegistryController` переведены на делегирование в сервис.
3. Добавлены unit-тесты `EntranceMatrixServiceTests` на сценарии upsert cell, валидации required fields и batch c failed-элементами.

### Результат этапа
- Из контроллера вынесена ещё одна значимая mutate-логика с SQL и валидацией.
- Matrix-операции теперь изолированы и переиспользуемы в сервисном слое.

## Обновленный итог
- Выполнено **9 этапов** по поэтапному выносу логики из `RegistryController`.


## Этап 10 — вынос write/use-case floors reconcile из RegistryController

Статус: ✅ Завершен

### Что сделано
1. Создан `FloorsReconcileService` с методом `reconcile(UUID blockId)` для генерации/апсерта этажей и ремапа ссылок перед удалением.
2. Endpoint `POST /blocks/{blockId}/floors/reconcile` в `RegistryController` переведен на делегирование в сервис.
3. Добавлены unit-тесты `FloorsReconcileServiceTests` на сценарии `block not found` и базовый сценарий `delete + upsert`.

### Результат этапа
- Из контроллера вынесен один из самых сложных mutate-блоков с каскадной логикой.
- Логика reconcile этажей централизована и тестируема в сервисном слое.

## Обновленный итог
- Выполнено **10 этапов** по поэтапному выносу логики из `RegistryController`.


## Этап 11 — вынос CRUD/use-case common areas из RegistryController

Статус: ✅ Завершен

### Что сделано
1. Создан `CommonAreasService` с методами `upsert`, `batchUpsert`, `delete`, `clear`, `list`.
2. Endpoints `/common-areas/*` и `/blocks/{blockId}/common-areas` в `RegistryController` переведены на делегирование в сервис.
3. Удалены дублирующие helper-методы `saveMopRow/parsePersistedUuid/parseRequiredUuid/parseRequiredDecimal` из контроллера.
4. Добавлены unit-тесты `CommonAreasServiceTests` на upsert, валидацию type, batchUpsert и list.

### Результат этапа
- Из контроллера вынесен блок CRUD-логики common areas и сопутствующая валидация.
- API слой стал тоньше, сервисный слой получил переиспользуемые операции.

## Обновленный итог
- Выполнено **11 этапов** по поэтапному выносу логики из `RegistryController`.


## Этап 12 — вынос use-case update floor(s) из RegistryController

Статус: ✅ Завершен

### Что сделано
1. Создан `FloorsUpdateService` с методами `updateFloor(...)` и `updateFloorsBatch(...)`.
2. Endpoints `PUT /floors/{floorId}` и `PUT /floors/batch` в `RegistryController` переведены на делегирование в сервис.
3. Удалены дублирующие helper-методы маппинга/парсинга для floor-update из контроллера.
4. Добавлены unit-тесты `FloorsUpdateServiceTests` на single update, validation и batch partial-fail сценарий.

### Результат этапа
- Из контроллера вынесен еще один mutate-блок обновления этажей.
- Логика single/batch update этажей теперь централизована и покрыта тестами.

## Обновленный итог
- Выполнено **12 этапов** по поэтапному выносу логики из `RegistryController`.


## Этап 13 — вынос read/use-case entrance matrix list из RegistryController

Статус: ✅ Завершен

### Что сделано
1. Создан `EntranceMatrixQueryService` с методом `listByBlock(UUID blockId)`.
2. Endpoint `GET /blocks/{blockId}/entrance-matrix` в `RegistryController` переведен на делегирование в query-service.
3. Добавлен unit-тест `EntranceMatrixQueryServiceTests` на выборку строк матрицы по блоку.

### Результат этапа
- Из контроллера вынесена read-логика матрицы подъездов.
- Query-операции matrix унифицированы по текущему сервисному подходу.

## Обновленный итог
- Выполнено **13 этапов** по поэтапному выносу логики из `RegistryController`.


## Этап 14 — вынос ensure entrance matrix из RegistryController

Статус: ✅ Завершен

### Что сделано
1. Создан `EntranceMatrixEnsureService` с методом `ensureForBlock(UUID blockId)`.
2. Endpoints reconcile floors/entrances в `RegistryController` переведены на делегирование в `EntranceMatrixEnsureService`.
3. Удалены устаревшие приватные helper-методы `ensureEntranceMatrixForBlock`, `loadEntranceMap`, `parseUuid`, `toNullableInt` из контроллера.
4. Добавлены unit-тесты `EntranceMatrixEnsureServiceTests` на сценарии очистки и синхронизации matrix.

### Результат этапа
- SQL-синхронизация `entrance_matrix` после reconcile вынесена из API слоя в отдельный use-case сервис.
- `RegistryController` дополнительно упрощен и содержит меньше инфраструктурной/SQL логики.

## Обновленный итог
- Выполнено **14 этапов** по поэтапному выносу логики из `RegistryController`.

## Этап 15 — вынос read/use-case block floors/entrances list из RegistryController

Статус: ✅ Завершен

### Что сделано
1. Создан `BlockStructureQueryService` с методами `listFloors(UUID)` и `listEntrances(UUID)`.
2. Endpoints `GET /blocks/{blockId}/floors` и `GET /blocks/{blockId}/entrances` переведены на делегирование в query-service.
3. Добавлены unit-тесты `BlockStructureQueryServiceTests`.

### Результат этапа
- Read SQL по структуре блока (этажи/подъезды) вынесен из контроллера.

## Обновленный итог
- Выполнено **15 этапов** по поэтапному выносу логики из `RegistryController`.

## Этап 16 — вынос use-case block extension CRUD из RegistryController

Статус: ✅ Завершен

### Что сделано
1. Создан `BlockExtensionService` для операций list/create/update/delete пристроек.
2. Endpoints `/blocks/{blockId}/extensions` и `/extensions/{extensionId}` переведены на делегирование в сервис.
3. Удалены in-controller операции создания/обновления `BlockExtensionEntity`.
4. Добавлены unit-тесты `BlockExtensionServiceTests`.

### Результат этапа
- CRUD бизнес-логика пристроек централизована в сервисе, контроллер дополнительно упрощен.

## Обновленный итог
- Выполнено **16 этапов** по поэтапному выносу логики из `RegistryController`.

## Этап 17 — вынос unit/common-areas mutate orchestration из RegistryController

Статус: ✅ Завершен

### Что сделано
1. Создан `RegistryMutationsService` как фасад для `UnitService`, `UnitsReconcileService`, `MopsReconcileService`.
2. Endpoints `POST /units/upsert`, `POST /units/batch-upsert`, `POST /blocks/{blockId}/units/reconcile`, `POST /blocks/{blockId}/common-areas/reconcile` переведены на делегирование в фасад.
3. Добавлены unit-тесты `RegistryMutationsServiceTests`.

### Результат этапа
- Контроллер дополнительно упрощен: mutate orchestration по units/common areas централизована в сервисе.

## Обновленный итог
- Выполнено **17 этапов** по поэтапному выносу логики из `RegistryController`.

## Этап 18 — вынос orchestration reconcile floors/entrances + ensure matrix

Статус: ✅ Завершен

### Что сделано
1. Создан `RegistryReconcileService` для сценариев reconcile floors/entrances с пост-обновлением `entrance_matrix`.
2. Endpoints `/blocks/{blockId}/floors/reconcile` и `/blocks/{blockId}/entrances/reconcile` в `RegistryController` переведены на делегирование в новый сервис.
3. Добавлены unit-тесты `RegistryReconcileServiceTests` с проверкой порядка вызовов reconcile -> ensure.

### Результат этапа
- Сложный orchestration path вынесен из API слоя в отдельный сервис use-case уровня.

## Обновленный итог
- Выполнено **18 этапов** по поэтапному выносу логики из `RegistryController`.

## Этап 19 — вынос common areas orchestration из RegistryController

Статус: ✅ Завершен

### Что сделано
1. Создан `RegistryCommonAreasService` как фасад над `CommonAreasService`.
2. Endpoints common areas (`upsert`, `batch-upsert`, `delete`, `clear`, `list`) в `RegistryController` переведены на делегирование в фасад.
3. Добавлены unit-тесты `RegistryCommonAreasServiceTests`.

### Результат этапа
- Контроллер упрощен: orchestration по common areas вынесена в отдельный сервис.

## Обновленный итог
- Выполнено **19 этапов** по поэтапному выносу логики из `RegistryController`.

## Этап 20 — вынос entrance matrix orchestration из RegistryController

Статус: ✅ Завершен

### Что сделано
1. Создан `RegistryEntranceMatrixService`, объединяющий query + mutate операции matrix.
2. Endpoints matrix list/cell/batch в `RegistryController` переведены на делегирование в единый сервис.
3. Добавлены unit-тесты `RegistryEntranceMatrixServiceTests`.
4. Удалены неиспользуемые зависимости/поля контроллера (старые repo/jdbc/floor-generator references).

### Результат этапа
- API слой получил более компактный dependency graph и единый сервисный вход для matrix операций.

## Обновленный итог
- Выполнено **20 этапов** по поэтапному выносу логики из `RegistryController`.

## Этап 21 — перевод batch/update endpoints на typed request DTO

Статус: ✅ Завершен

### Что сделано
1. Добавлены DTO: `BatchUpsertUnitsRequestDto`, `BatchUpsertCommonAreasRequestDto`, `UpdateFloorRequestDto`, `UpdateFloorsBatchRequestDto`.
2. Endpoints `units/common-areas batch-upsert` и `floors update/batch` в `RegistryController` переведены с `MapPayloadDto` на typed DTO.
3. Удалены ставшие неиспользуемыми helper-методы `asMap` и `toBool` из контроллера (`asList` сохранен для matrix batch endpoint).

### Результат этапа
- Контракты batch/update операций стали явнее и менее зависимыми от динамических map-структур.

## Обновленный итог
- Выполнено **21 этап** по поэтапному выносу логики из `RegistryController`.

## Этап 22 — unit-тесты для request DTO преобразований

Статус: ✅ Завершен

### Что сделано
1. Добавлены тесты `RegistryRequestDtosTests` на fallback/priority поведение DTO.
2. Проверены safe-default сценарии для floor update DTO.

### Результат этапа
- Поведение DTO нормализации payload формализовано тестами.

## Обновленный итог
- Выполнено **22 этапа** по поэтапному выносу логики из `RegistryController`.

## Этап 23 — типизация оставшихся common/matrix mutate payloads

Статус: ✅ Завершен

### Что сделано
1. Добавлены DTO: `UpsertCommonAreaRequestDto`, `ClearCommonAreasRequestDto`, `UpsertEntranceMatrixCellRequestDto`, `UpsertEntranceMatrixBatchRequestDto`.
2. Endpoints `common-areas upsert/clear` и `entrance-matrix cell/batch` переведены с `MapPayloadDto` на typed request DTO.
3. Удален helper `asList` из контроллера после перехода matrix batch на typed DTO.

### Результат этапа
- Доля dynamic-map payload в контроллере дополнительно снижена.

## Обновленный итог
- Выполнено **23 этапа** по поэтапному выносу логики из `RegistryController`.

## Этап 24 — cleanup сигнатур и DTO тесты

Статус: ✅ Завершен

### Что сделано
1. Убран неиспользуемый `@RequestBody` параметр из endpoint `floors/reconcile`.
2. Расширены тесты `RegistryRequestDtosTests` на новые common/matrix DTO safe-default сценарии.

### Результат этапа
- Контроллерные сигнатуры стали чище, а DTO контракты покрыты дополнительными тестами.

## Обновленный итог
- Выполнено **24 этапа** по поэтапному выносу логики из `RegistryController`.

## Этап 25 — типизация extension create/update payloads

Статус: ✅ Завершен

### Что сделано
1. Добавлены `CreateExtensionRequestDto` и `UpdateExtensionRequestDto`.
2. Endpoints extension create/update переведены на typed request DTO.
3. Конвертация DTO -> map централизована в самих DTO (`toMap()`).

### Результат этапа
- Контракты extension mutate операций стали явнее и менее зависимыми от dynamic-map payload.

## Обновленный итог
- Выполнено **25 этапов** по поэтапному выносу логики из `RegistryController`.

## Этап 26 — типизация units/upsert payload + DTO tests

Статус: ✅ Завершен

### Что сделано
1. Добавлен `UpsertUnitRequestDto` с `safeData()`.
2. Endpoint `POST /units/upsert` переведен с `MapPayloadDto` на typed request DTO.
3. Расширены `RegistryRequestDtosTests` на extension DTO mapping и upsert unit safe-default сценарий.

### Результат этапа
- Снижен объем dynamic-map payload в контроллере для mutate endpoint'ов.

## Обновленный итог
- Выполнено **26 этапов** по поэтапному выносу логики из `RegistryController`.

## Этап 27 — поддержка pagination в buildings summary query

Статус: ✅ Завершен

### Что сделано
1. `RegistryQueryService.loadBuildingsSummary(...)` расширен параметрами `page` и `limit`.
2. Добавлены safe-default/safe-range правила для pagination (`page>=1`, `limit<=200`, default `50`).
3. В SQL добавлены `limit/offset`.

### Результат этапа
- Endpoint summary больше не игнорирует pagination-параметры и выдает предсказуемо ограниченные выборки.

## Обновленный итог
- Выполнено **27 этапов** по поэтапному выносу логики из `RegistryController`.

## Этап 28 — cleanup contracts для buildings summary + тесты query service

Статус: ✅ Завершен

### Что сделано
1. Удалены неиспользуемые query-параметры `building` и `floor` из сигнатуры endpoint `GET /registry/buildings-summary`.
2. Контроллер переведен на делегирование `search/page/limit` в `RegistryQueryService`.
3. Расширены unit-тесты `RegistryQueryServiceTests` на pagination и safe-default сценарии.

### Результат этапа
- Контракт endpoint синхронизирован с фактической реализацией query-service и покрыт тестами.

## Обновленный итог
- Выполнено **28 этапов** по поэтапному выносу логики из `RegistryController`.

## Этап 29 — усиление Bean Validation для extension DTO

Статус: ✅ Завершен

### Что сделано
1. В `CreateExtensionRequestDto` добавлены ограничения: `@NotBlank buildingId`, `@Size` для label, `@Min(1)` для `floorsCount/startFloorIndex`.
2. В `UpdateExtensionRequestDto` добавлены ограничения: `@Size` для label и `@Min(1)` для числовых полей.
3. Для typed `@RequestBody` в `RegistryController` включен `@Valid`.

### Результат этапа
- Ошибки некорректных payload для extension DTO валидируются на уровне API-контракта до попадания в service слой.

## Обновленный итог
- Выполнено **29 этапов** по поэтапному выносу логики из `RegistryController`.

## Этап 30 — тесты валидации request DTO

Статус: ✅ Завершен

### Что сделано
1. Добавлен `RegistryRequestValidationTests` с проверками ограничений для `CreateExtensionRequestDto` и `UpdateExtensionRequestDto`.
2. Добавлен regression-check для существующей валидации `SyncParkingPlacesRequestDto`.

### Результат этапа
- Правила Bean Validation для ключевых typed request DTO зафиксированы автоматическими тестами.

## Обновленный итог
- Выполнено **30 этапов** по поэтапному выносу логики из `RegistryController`.

## Этап 31 — гибридный data-access: JPA для простых read, SQL для сложных

Статус: ✅ Завершен

### Что сделано
1. `BlockStructureQueryService.listFloors(...)` переведен на JPA (`FloorJpaRepository.findByBlockIdOrderByIndexAsc`).
2. Для `listEntrances(...)` сохранен SQL-подход, т.к. текущая `EntranceEntity` не покрывает полный набор полей (например, `number`).
3. Добавлен метод `findByBlockIdOrderByIndexAsc(UUID)` в `FloorJpaRepository`.
4. Обновлены unit-тесты `BlockStructureQueryServiceTests` на гибридную стратегию (JPA + SQL).

### Результат этапа
- Применен практичный гибридный подход: простые кейсы переведены на JPA, сложные/неполностью покрытые моделью — оставлены на SQL.

## Обновленный итог
- Выполнен **31 этап** по поэтапному выносу логики из `RegistryController`.

## Этап 32 — гибридный подход для unit explication query

Статус: ✅ Завершен

### Что сделано
1. `RegistryUnitQueryService` переведен с `JdbcTemplate` на JPA-репозитории `UnitJpaRepository` и `RoomJpaRepository`.
2. Для unit explication реализован entity->map маппинг с сохранением текущего API-формата (`type`, `label`, `isMezzanine` и пр.).
3. Обновлены unit-тесты `RegistryUnitQueryServiceTests` под JPA-подход.

### Результат этапа
- Еще один простой read/use-case переведен на JPA, сохранив совместимость ответа и гибридную архитектурную стратегию.

## Обновленный итог
- Выполнено **32 этапа** по поэтапному выносу логики из `RegistryController`.

## Этап 33 — расширение JPA-модели entrances и перевод block structure query на JPA

Статус: ✅ Завершен

### Что сделано
1. В `EntranceEntity` добавлено поле `number` (mapping к колонке `number`).
2. В `EntranceJpaRepository` добавлен метод `findByBlockIdOrderByNumberAsc(UUID blockId)`.
3. `BlockStructureQueryService.listEntrances(...)` переведен с SQL на JPA.
4. Обновлены unit-тесты `BlockStructureQueryServiceTests` (оба сценария теперь через JPA repositories).

### Результат этапа
- Для block-structure read use-case реализован полностью JPA-подход без потери сортировки/контракта.
- Гибридная стратегия сохранена в проекте в целом: сложные динамические/агрегатные запросы остаются на SQL.

## Обновленный итог
- Выполнено **33 этапа** по поэтапному выносу логики из `RegistryController`.

## Этап 34 — typed service boundary для extension use-case

Статус: ✅ Завершен

### Что сделано
1. Добавлены typed команды сервисного слоя: `CreateExtensionCommand`, `UpdateExtensionCommand`.
2. `BlockExtensionService` переведен с `Map<String,Object>` на typed command-API.
3. `RegistryController` обновлен на передачу `payload.toCommand()` в `BlockExtensionService`.
4. Обновлены unit-тесты `BlockExtensionServiceTests` и DTO-тесты `RegistryRequestDtosTests`.

### Результат этапа
- Граница API->service для extension use-case стала строго типизированной без dynamic map в сервисе.

## Обновленный итог
- Выполнено **34 этапа** по поэтапному выносу логики из `RegistryController`.
