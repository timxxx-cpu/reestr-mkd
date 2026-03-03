# Глубокий code-level аудит паритета Node.js ↔ Java JPA

Дата: 2026-03-02.
Фокус: сравнение кода `apps/backend/src/*` и `apps/backend-java-jpa/src/main/java/*` (а не документации).

## Что проверено

1. **Route surface parity** через статический анализ маршрутов (`scripts/check-backend-jpa-parity.mjs`).
2. **Код middleware/безопасности** (auth, policy, контекст пользователя).
3. **Контракт ошибок** (форма тела, коды и маппинг причин).
4. **Workflow/locks/idempotency** (побочные эффекты и повторяемость мутаций).
5. **Проектные и реестровые endpoint-ы** (поддержка query/filter/pagination и payload-ограничений).

## Ключевой вывод

По **method+path** есть паритет (87 vs 87), но по функционалу 100% паритет **не достигнут**: в Java JPA остаются расхождения в безопасности, error-контрактах, идемпотентности и части бизнес-правил.

---

## Детальный план расхождений (gap plan)

## GAP-1. Аутентификация/авторизация неэквивалентна

**Факт по Node.js:**
- На `/api/v1/*` применяется auth middleware с JWT-валидацией и dev-fallback.
- При `authMode=jwt` запросы без валидного Bearer токена отклоняются `401`.
- Бизнес-роуты используют policy-проверки (`requirePolicyActor`) перед mutation.

**Факт по Java JPA:**
- В security chain стоит `anyRequest().permitAll()`.
- Нет фильтра/механизма, аналогичного Node middleware для обязательного auth context.
- В lock endpoints при пустых заголовках подставляется `system/unknown`, что в Node не является штатным security-эквивалентом.

**Риск:**
- Любой клиент может вызывать защищённые mutation-роуты без эквивалентной роли/токена.

**План устранения:**
1. Добавить в Java JPA фильтр аутентификации с логикой, эквивалентной `installAuthMiddleware`.
2. Ввести единый `AuthContext` и policy-check слой (модуль/action) перед сервисными mutation-операциями.
3. Удалить fallback `system/unknown` в lock контроллере; при отсутствии контекста возвращать `401`.
4. Прогнать негативные сценарии: missing bearer, invalid JWT, missing role, forbidden action.

## GAP-2. Контракт ошибок отличается от Node

**Факт по Node.js:**
- Ошибки отдаются централизованно через `sendError(reply, status, code, message, details)` с телом `code/message/details/requestId`.
- Для lock RPC причин (`LOCKED`, `ASSIGNEE_MISMATCH`, `NOT_FOUND`, `OWNER_MISMATCH`) есть явное преобразование в HTTP status.

**Факт по Java JPA:**
- Преобладает `ResponseStatusException` с текстовыми reason без стандартизованного JSON-контракта Node.
- В lock-сервисе не реализован полный reason→status mapping как в Node.

**Риск:**
- Frontend/интеграции, ожидающие `code` и стабильную структуру, получают несовместимые ответы.

**План устранения:**
1. Добавить `@RestControllerAdvice` с выдачей Node-совместимого error JSON.
2. Вынести error code catalog и использовать его во всех сервисах.
3. Для lock/validation/workflow внедрить точный status/code mapping из Node.
4. Закрыть parity-тестами: сравнение status + body на одинаковые негативные кейсы.

## GAP-3. Идемпотентность мутаций отсутствует/неэквивалентна

**Факт по Node.js:**
- Для критичных mutation-роутов используется `x-idempotency-key` + fingerprint тела + кэш результата.
- При конфликте fingerprint возвращается `409 IDEMPOTENCY_CONFLICT`.

**Факт по Java JPA:**
- Аналога `idempotency-helpers.js`/`idempotency-store.js` для mutation-роутов нет.

**Риск:**
- Повторные запросы могут выполнять операцию повторно, создавая расхождения по данным/истории.

**План устранения:**
1. Ввести server-side idempotency store (БД-таблица или Redis) с fingerprint-проверкой.
2. Подключить к workflow/registry/project mutation endpoint-ам в том же объёме, что в Node.
3. Возвращать сохранённый ответ при безопасном ретрае и `409` при конфликте fingerprint.
4. Добавить интеграционные тесты «same key same body» и «same key different body».

## GAP-4. Поведение lock acquire частично расходится

**Факт по Node.js:**
- Перед `acquire_application_lock` нет предварительного удаления lock-записи.
- Результат RPC интерпретируется с детализацией причин и разными HTTP кодами.

**Факт по Java JPA:**
- Перед RPC выполняется `delete from application_locks ...`, что меняет семантику конкурентного захвата.
- При `ok=false` в основном возвращается общий `409` без полной дифференциации причин.

**Риск:**
- Искажение lock-конкуренции и отличия от Node в гонках/конфликтах.

**План устранения:**
1. Убрать pre-delete перед `acquire_application_lock`.
2. Повторить Node-логику reason/status mapping полностью.
3. Добавить сценарии гонок на acquire/refresh/release и сравнить с Node black-box тестом.

## GAP-5. `/api/v1/projects` по query-возможностям неравнозначен

**Факт по Node.js:**
- Поддерживает query-параметры: `status`, `workflowSubstatus`, `assignee`, `search`, `page`, `limit`.
- Формирует пагинационный ответ (`items`, `page`, `limit`, `total`, `totalPages`) и доступные действия.

**Факт по Java JPA:**
- `projects.list(scope)` возвращает только `items` и `total`, без эквивалентной фильтрации/пагинации/поиска.

**Риск:**
- Разный UX списка проектов, разные объёмы данных и несовместимость фронтовых фильтров.

**План устранения:**
1. Расширить JPA endpoint query-параметрами Node-формата.
2. Воссоздать фильтрацию/поиск/assignee-режимы и pagination semantics.
3. Выровнять shape ответа и поля DTO (включая `availableActions`, `applicationInfo`).
4. Добавить контрактный snapshot-тест на список проектов.

## GAP-6. Неполный функциональный parity coverage в автоматических сценариях

**Факт:**
- Текущий сценарный набор функционального parity покрывает базовые error/payload/workflow кейсы, но не закрывает весь объём mutation/read контуров.

**Риск:**
- Регрессии в непокрытых endpoint-ах остаются незамеченными.

**План устранения:**
1. Расширить `tests/parity/backend-functional-parity.scenarios.json` доменными пакетами:
   - `project-list-filters`,
   - `locks-race-cases`,
   - `registry-upsert-idempotency`,
   - `auth-policy-negative`.
2. Включить эти сценарии в CI как mandatory gate.

---

## Рекомендуемый порядок внедрения

1. **Security + Error Contract (GAP-1, GAP-2)** — сначала, чтобы все последующие тесты имели корректную базу.
2. **Idempotency + Locks (GAP-3, GAP-4)** — затем защита от дублей и корректная конкуренция.
3. **Project query parity (GAP-5)** — выравнивание наиболее заметного API для UI.
4. **Тестовое покрытие (GAP-6)** — закрепление результата в CI.

## Статус реализации (итеративно)

- ✅ Добавлены базовые JPA-связи для цепочки `Project -> Building -> Block -> Floor -> Unit`.
- ✅ Расширены связи для workflow-контекста: `Project -> Application`, `Application -> steps/history/lock`.
- ✅ Расширены связи для проектных артефактов: `Project -> participants/documents/geometryCandidates`.
- ✅ Добавлены связи `Unit -> rooms`, `Floor -> commonAreas`, `Block -> entrances/extensions`.
- ✅ Добавлены связи для инженерного и матричного контуров блока: `Block -> construction/engineering/floorMarkers/entranceMatrix`.
- ✅ Добавлены связи extension/entrance-контура: `Extension <-> floors/units`, `Entrance <-> units/commonAreas`, `GeometryCandidate -> assignedBuilding`.
- ✅ Добавлены unit-тесты на `JpaFacadeService#setProjectIntegration` (инициализация/merge `integrationData.status`).
- ✅ Добавлены рефлективные unit-тесты на наличие и корректный `mappedBy` у ключевых JPA-связей domain-модели.
- ✅ Добавлены проверки `@JoinColumn(insertable=false, updatable=false)` для совместимого read-only режима связей.
- ✅ Добавлены unit-тесты `ProjectJpaService` для базовых контрактов (`list`, `appId`, валидация scope и 404-кейсы).
- ✅ `mapOverview` переведен с native SQL на repository-граф (projects/applications/buildings/blocks/floors/units) + добавлен unit-тест happy-path.
- ✅ `summary` переведен с native SQL на repository-данные (`applications.findByScopeId`) + добавлены unit-тесты на валидацию и счетчики.
- ✅ Расширены unit-тесты `mapOverview`: добавлены негативный кейс `scope` и проверка исключения basement-блоков из агрегированных метрик.
- ✅ Дополнены unit-тесты `mapOverview/summary`: пустой scope-data, fallback `status` от `project.constructionStatus`, отдельный `pendingDecline` сценарий.
- ✅ Добавлены unit-тесты `fromApplication/integrationStatus`: валидация `scope`, успешное создание project+application, merge `integrationData.lastUpdate`.
- ✅ Начат перенос `context`: чтение `application_steps` и `application_history` переведено с `jdbc.queryForList` на JPA-репозитории (`ApplicationStepRepository`, `ApplicationHistoryRepository`).
- ✅ Продолжен перенос `context`: building/block детали, basement features, конструктив, инженерка и floor markers переведены на repository-агрегацию вместо `jdbc.queryForList`.
- ✅ `contextBuildingSave`: проверка project-owned building/block id и удаление отсутствующих basement-блоков переведены с SQL-выборок на repository-данные.
- ✅ `participants/documents/deleteDoc`: CRUD-операции переведены с SQL upsert/select/delete на `ProjectParticipantRepository` и `ProjectDocumentRepository`.
- ✅ `contextRegistryDetails`: чтение marker/floor/entrance/matrix/unit/mop данных переведено с SQL queryList на repository-агрегацию.
- ✅ `passport`: загрузка `participants/documents` переведена с SQL queryList на `ProjectParticipantRepository`/`ProjectDocumentRepository`.
- ✅ `buildingsSummary/basements`: чтение сводки зданий и basement-блоков переведено с SQL queryList на `BuildingRepository`/`BuildingBlockRepository`.
- ✅ `parkingCounts/fullRegistry(основной read-graph)`: цепочки buildings->blocks->extensions->floors->entrances->units->rooms переведены на repository-данные; SQL join для parking count удален.
- ✅ `tepSummary`: расчеты площадей/категорий/прогресса и cadastre-ready переведены с SQL queryList на repository-цепочку.
- ✅ `updateBasementLevel`: чтение/обновление basement parking levels переведено с SQL select/update на `BuildingBlockRepository` (`findById` + `save`).
- ✅ `passport(project)`: базовые project-поля переведены с SQL join на `ProjectRepository.findById`; адресные reference-поля остаются через точечный SQL lookup по `address_id`.
- ✅ `updatePassport`: обновление и возврат project-данных переведены с SQL update/select на `ProjectRepository.findById/save` + entity->map маппинг.
- ✅ Добавлены обязательные parity-сценарии (`project-list-filters`, `locks-race-cases`, `registry-upsert-idempotency`, `auth-policy-negative`) и тест-валидатор покрытия сценариев.
- ✅ Добавлен CI workflow `backend-jpa-e2e-parity` (schedule + workflow_dispatch) с mandatory secret-check и запуском end-to-end parity gate.
- ✅ Добавлен агрегатор mismatch-отчета (`scripts/summarize-backend-jpa-parity-report.mjs`) и выгрузка parity-артефакта в CI для операционного разбора первых расхождений.

## Критерий «абсолютный паритет достигнут»

- Route parity: без missing/extra маршрутов.
- Functional parity: ноль расхождений по status/body на расширенном сценарном наборе.
- Security parity: негативные auth/policy сценарии дают те же ответы, что и Node.
- Idempotency parity: повторные mutation запросы ведут себя идентично Node.
