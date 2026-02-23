# reestr-mkd BFF (Iteration 5)

Минимальный backend для первой итерации миграции (Вариант A):

- `locks/*`
- `workflow/complete-step`
- `workflow/review-approve`
- `workflow/review-reject`
- `workflow/rollback-step`
- `workflow/restore`
- `workflow/return-from-decline`
- `workflow/decline`
- `workflow/request-decline`
- `workflow/assign-technician`
- `composition` (buildings/blocks)
- `registry-floors`
- `registry-entrances`
- `integration-status`
- `cadastre-updates`
- `project-init-from-application`
- `project-passport`
- `basements`
- `object-versioning`
- `project-full-registry`

## Запуск

```bash
cd apps/backend
npm install
npm run dev
npm test
```

Требуемые переменные окружения:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PORT` (optional, default `8787`)
- `HOST` (optional, default `0.0.0.0`)
- `VERSIONING_ENABLED` (optional, default `false`)
- `PROJECT_INIT_RPC_ENABLED` (optional, default `false`)


## Структура route-модулей

- `src/project-routes.js` — project-init и orchestration инициализации проекта.
- `src/project-extended-routes.js` — project passport/admin, basements, versioning, full-registry read.

## API

- `GET /health`
- `GET /api/v1/applications/:applicationId/locks`
- `POST /api/v1/applications/:applicationId/locks/acquire`
- `POST /api/v1/applications/:applicationId/locks/refresh`
- `POST /api/v1/applications/:applicationId/locks/release`
- `POST /api/v1/applications/:applicationId/workflow/complete-step`
- `POST /api/v1/applications/:applicationId/workflow/review-approve`
- `POST /api/v1/applications/:applicationId/workflow/review-reject`
- `POST /api/v1/applications/:applicationId/workflow/rollback-step`
- `POST /api/v1/applications/:applicationId/workflow/restore`
- `POST /api/v1/applications/:applicationId/workflow/return-from-decline`
- `POST /api/v1/applications/:applicationId/workflow/decline`
- `POST /api/v1/applications/:applicationId/workflow/request-decline`
- `POST /api/v1/applications/:applicationId/workflow/assign-technician`
- `GET /api/v1/projects/:projectId/buildings`
- `GET /api/v1/projects/:projectId/parking-counts`
- `GET /api/v1/projects/:projectId/full-registry`
- `GET /api/v1/projects/:projectId/context?scope=:scope`
- `GET /api/v1/projects/:projectId/context-registry-details`
- `POST /api/v1/projects/:projectId/context-meta/save`
- `POST /api/v1/projects/:projectId/context-building-details/save`
- `POST /api/v1/projects/:projectId/buildings`
- `PUT /api/v1/buildings/:buildingId`
- `DELETE /api/v1/buildings/:buildingId`
- `GET /api/v1/blocks/:blockId/floors`
- `GET /api/v1/blocks/:blockId/entrances`
- `GET /api/v1/blocks/:blockId/entrance-matrix`
- `GET /api/v1/blocks/:blockId/units`
- `GET /api/v1/units/:unitId/explication`
- `GET /api/v1/blocks/:blockId/common-areas`
- `POST /api/v1/floors/:floorId/parking-places/sync`
- `POST /api/v1/units/upsert`
- `POST /api/v1/units/batch-upsert`
- `POST /api/v1/blocks/:blockId/units/reconcile`
- `POST /api/v1/blocks/:blockId/common-areas/reconcile`
- `POST /api/v1/common-areas/upsert`
- `DELETE /api/v1/common-areas/:id`
- `POST /api/v1/blocks/:blockId/common-areas/clear`
- `PUT /api/v1/floors/:floorId`
- `POST /api/v1/blocks/:blockId/floors/reconcile`
- `PUT /api/v1/blocks/:blockId/entrance-matrix/cell`
- `POST /api/v1/blocks/:blockId/entrances/reconcile`
- `GET /api/v1/projects/:projectId/integration-status`
- `PUT /api/v1/projects/:projectId/integration-status`
- `PUT /api/v1/buildings/:buildingId/cadastre`
- `PUT /api/v1/units/:unitId/cadastre`
- `POST /api/v1/projects/from-application`
- `GET /api/v1/projects/:projectId/passport`
- `PUT /api/v1/projects/:projectId/passport`
- `PUT /api/v1/projects/:projectId/participants/:role`
- `POST /api/v1/projects/:projectId/documents`
- `DELETE /api/v1/project-documents/:documentId`
- `DELETE /api/v1/projects/:projectId?scope=:scope`
- `GET /api/v1/projects/:projectId/basements`
- `PUT /api/v1/basements/:basementId/parking-levels/:level`
- `GET /api/v1/versions?entityType=:entityType&entityId=:entityId`
- `POST /api/v1/versions`
- `POST /api/v1/versions/:versionId/approve`
- `POST /api/v1/versions/:versionId/decline`
- `GET /api/v1/versions/:versionId/snapshot`
- `POST /api/v1/versions/:versionId/restore`

## Auth-context (DEV)

Для endpoint-ов мутации используются заголовки:

- `x-user-id`
- `x-user-role`

Дополнительно для batch/reconcile операций поддерживается:

- `x-idempotency-key` — ключ дедупликации повторных запросов в пределах TTL in-memory кэша BFF; поддерживается для registry batch/reconcile, ключевых workflow-мутаций (`complete-step`, `rollback-step`, `review-approve`, `review-reject`, `assign-technician`, `request-decline`, `decline`, `return-from-decline`, `restore`) и `POST /api/v1/projects/from-application`. При повторе с другим payload backend вернет `409 IDEMPOTENCY_CONFLICT`.

В продовом контуре это должно быть заменено на полноценный auth middleware (JWT/session).

- `POST /api/v1/projects/from-application` также запускает backend-side инициализацию pending versions при `VERSIONING_ENABLED=true` (в случае ошибки вернет `warning` в payload, но не откатывает уже созданные project/application).

- При `PROJECT_INIT_RPC_ENABLED=true` endpoint `POST /api/v1/projects/from-application` использует SQL function `init_project_from_application` (transactional boundary на стороне Postgres); при ошибке RPC автоматически переключается на direct BFF path (fallback).
