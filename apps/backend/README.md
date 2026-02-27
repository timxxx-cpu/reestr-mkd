# reestr-mkd BFF (Iteration 5)

Backend-for-Frontend для первой итерации миграции (Вариант A).

## Запуск

```bash
cd apps/backend
npm install
npm run dev
npm test
```

## Переменные окружения

Обязательные:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Опциональные:

- `PORT` (default: `8787`)
- `HOST` (default: `0.0.0.0`)
- `VERSIONING_ENABLED` (default: `false`)
- `PROJECT_INIT_RPC_ENABLED` (default: `false`)
- `AUTH_MODE` (`dev` | `jwt`, default: `dev`)
- `JWT_SECRET` (обязателен при `AUTH_MODE=jwt`)
- `RUNTIME_ENV` / `APP_ENV` / `NODE_ENV` (используется для запрета `AUTH_MODE=dev` в production-like окружениях)

## Структура route-модулей

### Route-файлы (регистрируют HTTP-маршруты)

- `src/server.js` — точка входа: инициализация Fastify, регистрация middleware и всех route-модулей; содержит dashboard-проекции (`/api/v1/projects`, `summary-counts`) и вспомогательные маршруты.
- `src/auth-routes.js` — аутентификация (`/api/v1/auth/login`).
- `src/catalog-routes.js` — CRUD справочников (`/api/v1/catalogs/*`).
- `src/locks-routes.js` — управление блокировками заявок (`/api/v1/applications/:id/locks/*`).
- `src/workflow-routes.js` — переходы состояний workflow (`/api/v1/applications/:id/workflow/*`).
- `src/composition-routes.js` — buildings/blocks (состав объектов).
- `src/registry-routes.js` — floors/entrances/units/common-areas + реестровые агрегаты.
- `src/integration-routes.js` — integration-status + cadastre-updates.
- `src/project-routes.js` — project-init-from-application.
- `src/project-extended-routes.js` — context/admin, passport, basements, versioning, full-registry.

### Утилиты и слои (не регистрируют маршруты)

- `src/idempotency-helpers.js` — `buildIdempotencyContext`, `tryServeIdempotentResponse`, `rememberIdempotentResponse` (общие для workflow, registry, project-routes).
- `src/workflow-transitions.js` — чистая бизнес-логика переходов состояний (`buildCompletionTransition`, `buildRollbackTransition`, `buildReviewTransition`, `getStageStepRange`). Не зависит от HTTP/Supabase.
- `src/application-repository.js` — DB-слой для `applications`, `application_history`, `application_steps`, `application_locks`.
- `src/format-utils.js` — `formatByGroups`, `formatComplexCadastre`, `formatBuildingCadastre`, `getNextSequenceNumber`.
- `src/validation.js` — `buildStepValidationResult` (валидация шагов workflow).
- `src/project-helpers.js` — `parseCsvParam`, `normalizeProjectStatusFromDb`, `buildProjectAvailableActions` (dashboard-проекции).
- `src/auth.js` — auth middleware (`AUTH_MODE=dev|jwt`) и actor-context.
- `src/policy.js` — единая RBAC policy matrix по доменам/действиям.
- `src/http-helpers.js` — `sendError`, `requirePolicyActor`.
- `src/idempotency-store.js` — in-memory кэш idempotency-ключей с TTL.
- `src/floor-generator.js` — генератор модели этажей (чистая функция).
- `src/versioning.js` — `createPendingVersionsForApplication`, `collectProjectVersionEntities`.
- `src/config.js` — валидация и нормализация переменных окружения.
- `src/supabase.js` — фабрика Supabase-клиента.

## API (актуальный route-map)

Ниже перечислены маршруты, объявленные в backend-коде (`apps/backend/src/*`).

### Health

- `GET /health`

### Auth

- `POST /api/v1/auth/login`

### Catalogs

- `GET /api/v1/catalogs/:table`
- `POST /api/v1/catalogs/:table/upsert`
- `PUT /api/v1/catalogs/:table/:id/active`

### Applications: locks

- `GET /api/v1/applications/:applicationId/locks`
- `POST /api/v1/applications/:applicationId/locks/acquire`
- `POST /api/v1/applications/:applicationId/locks/refresh`
- `POST /api/v1/applications/:applicationId/locks/release`

### Applications: workflow

- `POST /api/v1/applications/:applicationId/workflow/complete-step`
- `POST /api/v1/applications/:applicationId/workflow/review-approve`
- `POST /api/v1/applications/:applicationId/workflow/review-reject`
- `POST /api/v1/applications/:applicationId/workflow/rollback-step`
- `POST /api/v1/applications/:applicationId/workflow/assign-technician`
- `POST /api/v1/applications/:applicationId/workflow/request-decline`
- `POST /api/v1/applications/:applicationId/workflow/decline`
- `POST /api/v1/applications/:applicationId/workflow/return-from-decline`
- `POST /api/v1/applications/:applicationId/workflow/restore`

### Projects: dashboard/read-model

- `GET /api/v1/projects`
- `GET /api/v1/external-applications?scope=:scope`
- `GET /api/v1/projects/summary-counts`
- `GET /api/v1/projects/:projectId/application-id`
- `POST /api/v1/projects/:projectId/validation/step`

### Projects: init and composition

- `POST /api/v1/projects/from-application`
- `GET /api/v1/projects/:projectId/buildings`
- `POST /api/v1/projects/:projectId/buildings`
- `PUT /api/v1/buildings/:buildingId`
- `DELETE /api/v1/buildings/:buildingId`

### Projects: context/passport/admin

- `GET /api/v1/projects/:projectId/context?scope=:scope`
- `POST /api/v1/projects/:projectId/context-building-details/save`
- `POST /api/v1/projects/:projectId/context-meta/save`
- `POST /api/v1/projects/:projectId/step-block-statuses/save`
- `GET /api/v1/projects/:projectId/context-registry-details`
- `GET /api/v1/projects/:projectId/geometry-candidates`
- `POST /api/v1/projects/:projectId/geometry-candidates/import`
- `POST /api/v1/projects/:projectId/land-plot/select`
- `GET /api/v1/projects/:projectId/passport`
- `PUT /api/v1/projects/:projectId/passport`
- `PUT /api/v1/projects/:projectId/participants/:role`
- `POST /api/v1/projects/:projectId/documents`
- `DELETE /api/v1/project-documents/:documentId`
- `DELETE /api/v1/projects/:projectId?scope=:scope`

### Projects: integration + analytics

- `GET /api/v1/projects/:projectId/integration-status`
- `PUT /api/v1/projects/:projectId/integration-status`
- `PUT /api/v1/buildings/:buildingId/cadastre`
- `PUT /api/v1/units/:unitId/cadastre`
- `GET /api/v1/projects/:projectId/parking-counts`
- `GET /api/v1/registry/buildings-summary`

### Registry: floors / entrances / units / common-areas

- `GET /api/v1/blocks/:blockId/floors`
- `PUT /api/v1/floors/:floorId`
- `POST /api/v1/blocks/:blockId/floors/reconcile`
- `GET /api/v1/blocks/:blockId/entrances`
- `GET /api/v1/blocks/:blockId/extensions`
- `POST /api/v1/blocks/:blockId/extensions`
- `PUT /api/v1/extensions/:extensionId`
- `DELETE /api/v1/extensions/:extensionId`
- `POST /api/v1/blocks/:blockId/entrances/reconcile`
- `GET /api/v1/blocks/:blockId/entrance-matrix`
- `PUT /api/v1/blocks/:blockId/entrance-matrix/cell`
- `GET /api/v1/blocks/:blockId/units`
- `POST /api/v1/units/upsert`
- `POST /api/v1/units/batch-upsert`
- `POST /api/v1/blocks/:blockId/units/reconcile`
- `GET /api/v1/units/:unitId/explication`
- `POST /api/v1/floors/:floorId/parking-places/sync`
- `GET /api/v1/blocks/:blockId/common-areas`
- `POST /api/v1/common-areas/upsert`
- `DELETE /api/v1/common-areas/:id`
- `POST /api/v1/blocks/:blockId/common-areas/reconcile`
- `POST /api/v1/blocks/:blockId/common-areas/clear`

### Basements

- `GET /api/v1/projects/:projectId/basements`
- `PUT /api/v1/basements/:basementId/parking-levels/:level`

### Project full-registry

- `GET /api/v1/projects/:projectId/full-registry`
- `GET /api/v1/projects/:projectId/tep-summary`

### Object versioning

- `GET /api/v1/versions?entityType=:entityType&entityId=:entityId`
- `POST /api/v1/versions`
- `POST /api/v1/versions/:versionId/approve`
- `POST /api/v1/versions/:versionId/decline`
- `GET /api/v1/versions/:versionId/snapshot`
- `POST /api/v1/versions/:versionId/restore`

## Контроль документационного дрейфа API

Добавлен route-manifest и проверка синхронизации:

- `apps/backend/route-manifest.json` — автогенерируемый снимок всех backend routes.
- `npm run docs:routes:sync` — пересобирает manifest из `src/*.js` и сразу проверяет sync c `README.md`.
- `npm run docs:routes:check` — проверяет, что `README.md` и `route-manifest.json` соответствуют текущему route-map.

Рекомендуемый порядок при изменении API:

1. Изменить/добавить route в коде.
2. Обновить API-раздел в `README.md`.
3. Запустить `npm run docs:routes:sync`.
4. Закоммитить изменения в `README.md` и `route-manifest.json`.

## Auth-context (DEV)

Для mutating endpoint-ов используются заголовки:

- `x-user-id`
- `x-user-role`

Дополнительно для batch/reconcile и ключевых workflow/project-init операций:

- `x-idempotency-key` — дедупликация повторных запросов в пределах TTL in-memory кэша BFF.

Если ключ повторно использован с другим payload, backend вернет `409 IDEMPOTENCY_CONFLICT`.

В production-контуре DEV-заголовки должны быть заменены на полноценный auth middleware (JWT/session).

## Cutover-трассировка

Поддерживаются заголовки:

- `x-operation-source` — источник вызова (`bff`, `legacy`, и т.д.)
- `x-client-request-id` — клиентский correlation-id

В ответе возвращается `x-request-id` для связки frontend/backend логов.

## Feature-flags и поведение

- `POST /api/v1/projects/from-application` при `VERSIONING_ENABLED=true` запускает backend-side init pending versions;
  при ошибке вернет `warning` в payload (без отката уже созданных `project/application`).
- При `PROJECT_INIT_RPC_ENABLED=true` тот же endpoint использует SQL function `init_project_from_application`;
  при ошибке RPC выполняется fallback на direct BFF path.

## Auth/Policy layer

- `src/auth.js` — auth middleware (`AUTH_MODE=dev|jwt`) и actor-context.
- `src/policy.js` — единая RBAC policy matrix по доменам/действиям.
- Route-модули используют `requireActor` + `allowByPolicy` / `requirePolicyActor` без локальных дублей role-check helper.
