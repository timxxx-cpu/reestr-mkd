# Полная карта контрактов Frontend ↔ Backend (все варианты backend)

Дата: 2026-03-01 (актуализировано по исходникам `apps/backend/src/*`, `apps/backend-java/*`, `apps/backend-java-jpa/*`, `src/lib/bff-client.js`).

## 1) Варианты backend и общий контракт API

Во фронтенде используется единый HTTP-клиент `BffClient` и единый набор путей `/api/v1/*`.
В зависимости от развернутого backend этот контракт обслуживается одним из 3 вариантов:

1. `apps/backend` (Node.js Fastify + Supabase Admin).
2. `apps/backend-java` (Spring Boot 3, Java 21, direct PostgreSQL).
3. `apps/backend-java-jpa` (Spring Boot 3, Java 21, Hibernate JPA Repository).

Во всех вариантах поддерживается parity route-surface для прикладных `/api/v1/*`-маршрутов Node BFF. Дополнительно в Java/JPA есть служебный endpoint `GET /api/v1/ops/ping`, а в Node присутствует инфраструктурный `GET /health`.

---

## 2) Глобальный транспортный контракт (для всех endpoint-ов)

### 2.1 Base URL и включение BFF

- Base URL: `VITE_BFF_BASE_URL` (по умолчанию `http://localhost:8787`).
- Флаг включения: `VITE_BFF_ENABLED` (по умолчанию включено).
- Если BFF выключен, операции доменных API, помеченные как обязательные, выбрасывают ошибку `BFF backend is required for operation: ...`.

### 2.2 Обязательные/служебные заголовки

Фронтенд отправляет:

- `x-client-request-id: fe-...` — корреляция запроса.
- `x-operation-source: bff` — источник операции.
- `Authorization: Bearer <token>` — если токен есть в `AuthService`.
- `x-user-id` / `x-user-role` — actor-контекст для mutating операций.
- `x-idempotency-key` — для операций, где включена дедупликация.
- `content-type: application/json` — если есть body.

Backend возвращает трассировочные заголовки, включая `x-request-id`.

### 2.3 Error contract

При `!res.ok` фронтенд поднимает `BffError` со структурой:

- `message`
- `code`
- `details`
- `status`

То есть backend должен стабильно возвращать JSON-ошибку с полями `message/code/details`.

---

## 3) Карта API-контрактов: frontend-метод → HTTP endpoint → payload in/out

Ниже перечислены все контракты, объявленные во фронтенд-клиенте (`src/lib/bff-client.js`), и их фактическое покрытие в backend-вариантах.

## 3.1 Auth

### Login
- **Frontend**: прямой вызов endpoint-а (через auth flow).
- **HTTP**: `POST /api/v1/auth/login`
- **Request**: credentials (JSON).
- **Response**: auth payload (token + user context), который далее используется `AuthService`.

## 3.2 Dashboard / проекты / inbox

### Получение списка проектов
- **Frontend**: `ApiService.getProjectsPage(scope, options)` / `getProjectsList`.
- **HTTP**: `GET /api/v1/projects?scope&status&workflowSubstatus&assignee&search&page&limit`
- **Request params**:
  - `scope` — доменная область (обязателен для бизнес-выборки).
  - фильтры/пагинация.
- **Response** (2 поддерживаемых формата):
  1. Массив `Project[]` (legacy).
  2. Пагинированный объект `{ items, page, limit, total, totalPages }`.

### Общая карта всех ЖК (рабочий стол)
- **Frontend**: `ApiService.getProjectsMapOverview(scope)`.
- **HTTP**: `GET /api/v1/projects/map-overview?scope=...`
- **Response**: `{ items: [{ id, ujCode, name, address?, status?, totalBuildings?, buildingTypeStats?, landPlotGeometry, buildings: [{ id, label, buildingCode, category?, houseNumber?, house_number?, blocksCount?, floorsMax?, apartmentsCount?, address?, geometry, blocks?: [{ id, label?, floorsCount, geometry }] }] }] }`.
- **Назначение**: единая карта всех ЖК со списком слева (UJ-код + название), масштабированием к выбранному ЖК, отображением контуров/подписей и карточками деталей по клику на ЖК/здание (адрес, статус, типы, блоки, этажность, квартиры). Есть переключатель 2D/3D; в 3D отображается только выбранный на панели слева ЖК, а блоки рендерятся экструзией по формуле `floorsCount * 3м`.

### Счетчики по вкладкам
- **Frontend**: `ApiService.getProjectsSummaryCounts({ scope, assignee })`.
- **HTTP**: `GET /api/v1/projects/summary-counts?scope&assignee`
- **Response**: `{ work, review, integration, pendingDecline, declined, registryApplications, registryComplexes }`.

### Внешние заявки
- **Frontend**: `ApiService.getExternalApplications(scope)`.
- **HTTP**: `GET /api/v1/external-applications?scope=...`
- **Response**: массив заявок внешних систем (используется для создания проекта из заявки).

### Создание проекта из внешней заявки
- **Frontend**: `ApiService.createProjectFromApplication(scope, appData, user)`.
- **HTTP**: `POST /api/v1/projects/from-application`
- **Request body**: `{ scope, appData }`.
- **Headers**: actor + `x-idempotency-key` (`project-init-from-application:*`).
- **Response**: объект с `projectId` (frontend использует `response.projectId`).

### Удаление проекта
- **Frontend**: `ApiService.deleteProject(scope, projectId)`.
- **HTTP**: `DELETE /api/v1/projects/:projectId?scope=...`
- **Response**: стандартный результат удаления.

## 3.3 Каталоги / админка

### Чтение активного справочника
- **Frontend**: `CatalogService.getCatalog(table)`.
- **HTTP**: `GET /api/v1/catalogs/:table?activeOnly=true`
- **Response**: массив строк справочника.

### Чтение полного справочника
- **Frontend**: `CatalogService.getCatalogAll(table)`.
- **HTTP**: `GET /api/v1/catalogs/:table`
- **Response**: массив строк справочника.

### Upsert элемента справочника
- **Frontend**: `CatalogService.upsertCatalogItem(table, item, actor)`.
- **HTTP**: `POST /api/v1/catalogs/:table/upsert`
- **Request body**: `{ item }`.
- **Response**: обновленный/созданный item.

### Активация/деактивация элемента
- **Frontend**: `CatalogService.setCatalogItemActive(table, id, isActive, actor)`.
- **HTTP**: `PUT /api/v1/catalogs/:table/:id/active`
- **Request body**: `{ isActive }`.
- **Response**: состояние после изменения.

### Пользователи системы
- **Frontend**: `ApiService.getSystemUsers()`.
- **HTTP**: `GET /api/v1/catalogs/dict_system_users?activeOnly=true`
- **Response**: массив пользователей; фронт нормализует в `{ id, code, name, role, group, sortOrder }`.

## 3.4 Контекст проекта / паспорт / геометрия

### Полная загрузка контекста проекта
- **Frontend**: `ApiService.getProjectFullData(scope, projectId)`.
- **HTTP**: `GET /api/v1/projects/:projectId/context?scope=...`
- **Response**: агрегат с секциями:
  - `application`, `project`, `participants`, `documents`,
  - `buildings` (с `building_blocks` и `block_extensions`),
  - `history`, `steps`, `block_floor_markers`.
- **Frontend mapping**:
  - Формирует `projectData`, `composition`, `buildingDetails`,
  - Нормализует basement-блоки (`is_basement_block`),
  - Склеивает расширения блоков из вложенного и плоского представления.

### Доп. реестровый контекст
- **Frontend**: `ApiService.getProjectContextRegistryDetails(projectId)`.
- **HTTP**: `GET /api/v1/projects/:projectId/context-registry-details`
- **Response**: детализированные части контекста для реестровых шагов.

### Валидация шага
- **Frontend**: `ApiService.validateStepCompletionViaBff({ scope, projectId, stepId })`.
- **HTTP**: `POST /api/v1/projects/:projectId/validation/step`
- **Request body**: `{ scope, stepId }`.
- **Response**: объект результата валидации (`ok`, ошибки/причины, детали по блокам).

### Сохранение meta-контекста
- **Frontend**: `ApiService.saveData(...complexInfo/applicationInfo...)`.
- **HTTP**: `POST /api/v1/projects/:projectId/context-meta/save`
- **Request body**: `{ scope, complexInfo, applicationInfo }`.

### Сохранение деталей зданий
- **Frontend**: `ApiService.saveData(...buildingDetails...)`.
- **HTTP**: `POST /api/v1/projects/:projectId/context-building-details/save`
- **Важно**: для каждого блока требуется `buildingDetails["<buildingId>_<blockId>"].blockGeometry` (Polygon/MultiPolygon), и backend проверяет вхождение полигона блока в геометрию здания.
- **Request body**: `{ buildingDetails }`.

### Сохранение статусов блоков шага
- **Frontend**: `ApiService.saveStepBlockStatuses({ scope, projectId, stepIndex, statuses })`.
- **HTTP**: `POST /api/v1/projects/:projectId/step-block-statuses/save`
- **Request body**: `{ scope, stepIndex, statuses }`.

### Паспорт проекта
- **Frontend**:
  - `ApiService.getProjectPassport(projectId)`
  - `ApiService.updateProjectInfo(projectId, info, cadastreData)`
- **HTTP**:
  - `GET /api/v1/projects/:projectId/passport`
  - `PUT /api/v1/projects/:projectId/passport`
- **PUT body**: `{ info, cadastreData }`.
- **Response**: актуальный snapshot паспортных данных.

### Участники проекта
- **Frontend**: `ApiService.upsertParticipant(projectId, role, data)`.
- **HTTP**: `PUT /api/v1/projects/:projectId/participants/:role`
- **Request body**: `{ data }`.

### Документы проекта
- **Frontend**:
  - `ApiService.upsertDocument(projectId, doc)`
  - `ApiService.deleteDocument(documentId)`
- **HTTP**:
  - `POST /api/v1/projects/:projectId/documents` body `{ doc }`
  - `DELETE /api/v1/project-documents/:documentId`

### Геометрия/земельный участок
- **Frontend**:
  - `getProjectGeometryCandidates(projectId)`
  - `importProjectGeometryCandidates(projectId, candidates)`
  - `deleteProjectGeometryCandidate(projectId, candidateId)`
  - `selectBuildingGeometry(projectId, buildingId, candidateId)`
  - `selectProjectLandPlot(projectId, candidateId)`
  - `unselectProjectLandPlot(projectId)`
- **HTTP**:
  - `GET /api/v1/projects/:projectId/geometry-candidates`
  - `POST /api/v1/projects/:projectId/geometry-candidates/import` body `{ candidates }`
  - `DELETE /api/v1/projects/:projectId/geometry-candidates/:candidateId`
  - `POST /api/v1/projects/:projectId/buildings/:buildingId/geometry/select` body `{ candidateId }`
  - `POST /api/v1/projects/:projectId/land-plot/select` body `{ candidateId }`
  - `POST /api/v1/projects/:projectId/land-plot/unselect` body `{}`/пустое тело

## 3.5 Состав комплекса (buildings/blocks)

### Здания
- **Frontend**:
  - `getBuildings(projectId)`
  - `createBuilding(projectId, buildingData, blocksData)`
  - `updateBuilding(buildingId, buildingData, blocksData?)`
  - `deleteBuilding(buildingId)`
- **HTTP**:
  - `GET /api/v1/projects/:projectId/buildings`
  - `POST /api/v1/projects/:projectId/buildings` body `{ buildingData, blocksData }`
  - `PUT /api/v1/buildings/:buildingId` body `{ buildingData, blocksData }`
  - `DELETE /api/v1/buildings/:buildingId`

### Расширения блоков
- **Frontend**:
  - `getBlockExtensions(blockId)`
  - `createBlockExtension(blockId, extensionData)`
  - `updateBlockExtension(extensionId, extensionData)`
  - `deleteBlockExtension(extensionId)`
- **HTTP**:
  - `GET /api/v1/blocks/:blockId/extensions`
  - `POST /api/v1/blocks/:blockId/extensions` body `{ extensionData }`
  - `PUT /api/v1/extensions/:extensionId` body `{ extensionData }`
  - `DELETE /api/v1/extensions/:extensionId`
- **Idempotency**: create/update/delete идут с `x-idempotency-key`.

## 3.6 Реестровые операции (floors/entrances/units/common areas)

### Этажи
- **Frontend**:
  - `getFloors(blockId)`
  - `updateFloor(floorId, updates)`
  - `updateFloorsBatch(items)`
  - `generateFloors(blockId, floorsFrom, floorsTo, defaultType)`
- **HTTP**:
  - `GET /api/v1/blocks/:blockId/floors`
  - `PUT /api/v1/floors/:floorId` body `{ updates }`
  - `PUT /api/v1/floors/batch` body `{ items }`
  - `POST /api/v1/blocks/:blockId/floors/reconcile` body `{ floorsFrom, floorsTo, defaultType }`

### Подъезды и матрица
- **Frontend**:
  - `getEntrances(blockId)`
  - `getMatrix(blockId)`
  - `upsertMatrixCell(blockId, floorId, entranceNumber, values)`
  - `batchUpsertMatrixCells(blockId, cells)`
  - `syncEntrances(blockId, count)`
- **HTTP**:
  - `GET /api/v1/blocks/:blockId/entrances`
  - `GET /api/v1/blocks/:blockId/entrance-matrix`
  - `PUT /api/v1/blocks/:blockId/entrance-matrix/cell` body `{ floorId, entranceNumber, values }`
  - `PUT /api/v1/blocks/:blockId/entrance-matrix/batch` body `{ cells }`
  - `POST /api/v1/blocks/:blockId/entrances/reconcile` body `{ count }`

### Помещения (units)
- **Frontend**:
  - `getUnits(blockId, { floorIds? })`
  - `getUnitExplicationById(unitId)`
  - `upsertUnit(unitData)`
  - `batchUpsertUnits(unitsList)`
  - `reconcileUnitsForBlock(blockId)`
  - `previewReconcileByBlock(blockId)`
- **HTTP**:
  - `GET /api/v1/blocks/:blockId/units[?floorIds=csv]`
  - `GET /api/v1/units/:unitId/explication`
  - `POST /api/v1/units/upsert` body `<unitData>`
  - `POST /api/v1/units/batch-upsert` body `{ unitsList }`
  - `POST /api/v1/blocks/:blockId/units/reconcile` body `{}`
  - `POST /api/v1/blocks/:blockId/reconcile/preview` body `{}`
- **Frontend normalization**:
  - Гарантируется двунаправленная совместимость `number`/`num`.
  - В `getUnits` ожидается payload `{ units, entranceMap }`.

### МОП / common areas
- **Frontend**:
  - `getCommonAreas(blockId, { floorIds? })`
  - `upsertCommonArea(data)`
  - `deleteCommonArea(id)`
  - `clearCommonAreas(blockId, { floorIds? })`
  - `reconcileCommonAreasForBlock(blockId)`
- **HTTP**:
  - `GET /api/v1/blocks/:blockId/common-areas[?floorIds=csv]`
  - `POST /api/v1/common-areas/upsert` body `<data>`
  - `DELETE /api/v1/common-areas/:id`
  - `POST /api/v1/blocks/:blockId/common-areas/clear` body `{ floorIds: 'csv' }`
  - `POST /api/v1/blocks/:blockId/common-areas/reconcile` body `{}`

## 3.7 Подвалы / паркинг

- **Frontend**:
  - `getBasements(projectId)`
  - `toggleBasementLevel(basementId, level, isEnabled)`
  - `getParkingCounts(projectId)`
  - `syncParkingPlaces(floorId, targetCount)`
- **HTTP**:
  - `GET /api/v1/projects/:projectId/basements`
  - `PUT /api/v1/basements/:basementId/parking-levels/:level` body `{ isEnabled }`
  - `GET /api/v1/projects/:projectId/parking-counts`
  - `POST /api/v1/floors/:floorId/parking-places/sync` body `{ targetCount }`

## 3.8 Реестровая аналитика

- **Frontend**:
  - `getBuildingsRegistrySummary()`
  - `getProjectFullRegistry(projectId)`
  - `getProjectTepSummary(projectId)`
- **HTTP**:
  - `GET /api/v1/registry/buildings-summary`
  - `GET /api/v1/projects/:projectId/full-registry`
  - `GET /api/v1/projects/:projectId/tep-summary`

## 3.9 Workflow и lock-менеджмент

### Разрешение applicationId
- **Frontend**: `resolveApplicationId(projectId, scope)`.
- **HTTP**: `GET /api/v1/projects/:projectId/application-id?scope=...`
- **Response**: `{ applicationId }`.

### Locks
- **Frontend**:
  - `acquireApplicationLock(applicationId, ttlMinutes)`
  - `refreshApplicationLock(applicationId, ttlMinutes)`
  - `releaseApplicationLock(applicationId)`
  - `getApplicationLock(applicationId)`
- **HTTP**:
  - `GET /api/v1/applications/:applicationId/locks`
  - `POST /api/v1/applications/:applicationId/locks/acquire` body `{ ttlSeconds }`
  - `POST /api/v1/applications/:applicationId/locks/refresh` body `{ ttlSeconds }`
  - `POST /api/v1/applications/:applicationId/locks/release` body `{}`

### Workflow transitions
- **Frontend**:
  - `completeStep({ applicationId, stepIndex, comment })`
  - `rollbackStep({ applicationId, reason })`
  - `reviewApprove({ applicationId, comment })`
  - `reviewReject({ applicationId, reason })`
  - `assignTechnician({ applicationId, assigneeUserId, reason })`
  - `requestDecline({ applicationId, reason, stepIndex })`
  - `declineApplication({ applicationId, reason })`
  - `returnFromDecline({ applicationId, comment })`
  - `restoreApplication({ applicationId, comment })`
- **HTTP**:
  - `POST /api/v1/applications/:applicationId/workflow/complete-step`
  - `POST /api/v1/applications/:applicationId/workflow/rollback-step`
  - `POST /api/v1/applications/:applicationId/workflow/review-approve`
  - `POST /api/v1/applications/:applicationId/workflow/review-reject`
  - `POST /api/v1/applications/:applicationId/workflow/assign-technician`
  - `POST /api/v1/applications/:applicationId/workflow/request-decline`
  - `POST /api/v1/applications/:applicationId/workflow/decline`
  - `POST /api/v1/applications/:applicationId/workflow/return-from-decline`
  - `POST /api/v1/applications/:applicationId/workflow/restore`
- **Idempotency**: все ключевые mutating workflow-вызовы отправляются с `x-idempotency-key`.

## 3.10 Интеграционный этап

- **Frontend**:
  - `getIntegrationStatus(projectId)`
  - `updateIntegrationStatus(projectId, field, status)`
  - `updateBuildingCadastre(buildingId, cadastre)`
  - `updateUnitCadastre(unitId, cadastre)`
- **HTTP**:
  - `GET /api/v1/projects/:projectId/integration-status`
  - `PUT /api/v1/projects/:projectId/integration-status` body `{ field, status }`
  - `PUT /api/v1/buildings/:buildingId/cadastre` body `{ cadastre }`
  - `PUT /api/v1/units/:unitId/cadastre` body `{ cadastre }`

## 3.11 Versioning

- **Frontend**:
  - `getVersions(entityType, entityId)`
  - `createVersion({ entityType, entityId, snapshotData, createdBy, applicationId })`
  - `approveVersion({ versionId, approvedBy })`
  - `declineVersion({ versionId, reason, declinedBy })`
  - `getVersionSnapshot(versionId)`
  - `restoreVersion({ versionId })`
- **HTTP**:
  - `GET /api/v1/versions?entityType&entityId`
  - `POST /api/v1/versions` body `{ entityType, entityId, snapshotData, createdBy, applicationId }`
  - `POST /api/v1/versions/:versionId/approve` body `{ approvedBy }`
  - `POST /api/v1/versions/:versionId/decline` body `{ reason, declinedBy }`
  - `GET /api/v1/versions/:versionId/snapshot`
  - `POST /api/v1/versions/:versionId/restore` body `{}`

---

## 4) Привязка API к этапам workflow во фронтенде

Ниже — практическая карта «этап UI → какие контракты дергаются».

## 4.1 Этап 1: Инвентаризация (passport/composition/registry_nonres/basement_inventory/registry_res/floors/entrances)

Основные вызовы:
- Контекст/паспорт: `/projects/:id/context`, `/passport`, `/participants`, `/documents`.
- Геометрия: `/geometry-candidates/*`, `/land-plot/*`.
- Состав: `/projects/:id/buildings`, `/buildings/:id`, `/blocks/:id/extensions`.
- Этажи/подъезды: `/blocks/:id/floors`, `/floors/:id`, `/entrances`, `/entrance-matrix*`.
- Подвалы: `/projects/:id/basements`, `/basements/:id/parking-levels/:level`.

## 4.2 Этап 2: Конфигурация (apartments/mop/parking_config)

Основные вызовы:
- Units: `/blocks/:id/units`, `/units/upsert`, `/units/batch-upsert`, `/units/reconcile`, `/reconcile/preview`.
- Explication: `/units/:unitId/explication`.
- Common areas: `/common-areas/*`, `/common-areas/reconcile`, `/common-areas/clear`.
- Parking sync: `/floors/:floorId/parking-places/sync`, `/projects/:id/parking-counts`.

## 4.3 Этап 3: Реестры (registry_apartments/registry_commercial/registry_parking)

Основные вызовы:
- Реестровые чтения: `/projects/:id/full-registry`, `/projects/:id/context-registry-details`.
- Точечные правки юнитов: `/units/upsert`, `/units/:id/explication`.
- Сводка по зданиям: `/registry/buildings-summary`.

## 4.4 Этап 4: Интеграция (integration_buildings/integration_units)

Основные вызовы:
- `/projects/:id/integration-status` (GET/PUT).
- `/buildings/:id/cadastre`.
- `/units/:id/cadastre`.

## 4.5 Сквозные этапы управления жизненным циклом заявки

Вызываются на протяжении всего workflow:
- Locking: `/application-id`, `/locks/acquire|refresh|release`.
- Переходы: `/workflow/*`.
- Валидация: `/projects/:id/validation/step`.
- Сохранение статусов блоков: `/step-block-statuses/save`.

---

## 5) Совместимость контрактов между backend-вариантами

## 5.1 Node BFF (эталон контракта)

`apps/backend` — референс route-map и фактическая боевая интеграция фронта. По коду маршрутов в `apps/backend/src/*` доступно **85 endpoint-ов `/api/v1/*`**.

## 5.2 Java transfer

`apps/backend-java` повторяет endpoint-map `/api/v1/*` Node BFF и содержит дополнительный service endpoint `GET /api/v1/ops/ping`.

## 5.3 Java JPA variant

`apps/backend-java-jpa` также покрывает endpoint-map `/api/v1/*` Node BFF, добавляет `GET /api/v1/ops/ping` и использует JPA-репозитории как слой data access.

Вывод: фронтенд может работать с любым из 3 backend-вариантов без изменения URL/методов/headers, если соблюден единый JSON-контракт request/response и error-contract.

### 5.4 Важные уточнения по route-coverage

1. Route-manifest `apps/backend/route-manifest.json` содержит 80 маршрутов и может отставать от исходников; источником истины считаются route-объявления в `apps/backend/src/*`.
2. В `src/lib/bff-client.js` присутствует legacy-метод `getBasementsByBuildingIds` (`GET /api/v1/basements?buildingIds=...`), но этот endpoint отсутствует в Node/Java/Java-JPA; для текущего потока используется `GET /api/v1/projects/:projectId/basements`.
3. Критичные route-и, которые должны быть отражены в полной контрактной документации: `PUT /api/v1/floors/batch`, `PUT /api/v1/blocks/:blockId/entrance-matrix/batch`, `POST /api/v1/blocks/:blockId/reconcile/preview`, `POST /api/v1/projects/:projectId/land-plot/unselect`, `GET /api/v1/applications/:applicationId/locks`.

---

## 6) Что backend обязан вернуть, чтобы фронт работал корректно

Критические формы payload (на которые фронтенд завязан явно):

1. `GET /api/v1/projects` — либо массив, либо `{ items, page, limit, total, totalPages }`.
2. `GET /api/v1/projects/:id/context` — секции `application/project/participants/documents/buildings/history/steps`.
3. `GET /api/v1/blocks/:id/units` — объект `{ units, entranceMap }`.
4. `GET /api/v1/blocks/:id/entrance-matrix` — массив строк с `floor_id`, `entrance_number`, `flats_count`, `commercial_count`, `mop_count`.
5. `GET /api/v1/units/:id/explication` — объект unit + `rooms[]`.
6. Все mutating endpoint-ы — корректный JSON ответ и единый JSON error-contract при ошибках.
7. `GET /api/v1/projects/map-overview` — `{ items[] }` с геометрией границ ЖК (`landPlotGeometry`), деталями ЖК (`address`, `status`, `totalBuildings`, `buildingTypeStats[]`) и деталями зданий (`buildings[].geometry`, `buildings[].houseNumber|house_number`, `category`, `blocksCount`, `floorsMax`, `apartmentsCount`, `address`, `blocks[]`), где `blocks[].geometry` и `blocks[].floorsCount` используются для 3D-экструзии.
8. `POST /api/v1/projects/:projectId/context-building-details/save` — обязательна геометрия блока (`blockGeometry`) и правило валидации «блок внутри здания».
