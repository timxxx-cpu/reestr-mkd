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

## Запуск

```bash
cd apps/backend
npm install
npm run dev
```

Требуемые переменные окружения:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PORT` (optional, default `8787`)
- `HOST` (optional, default `0.0.0.0`)

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

## Auth-context (DEV)

Для endpoint-ов мутации используются заголовки:

- `x-user-id`
- `x-user-role`

Дополнительно для batch/reconcile операций поддерживается:

- `x-idempotency-key` — ключ дедупликации повторных запросов в пределах TTL in-memory кэша BFF; поддерживается для registry batch/reconcile и ключевых workflow-мутаций (`complete-step`, `rollback-step`, `review-approve`, `review-reject`, `assign-technician`, `request-decline`, `decline`, `return-from-decline`, `restore`). При повторе с другим payload backend вернет `409 IDEMPOTENCY_CONFLICT`.

В продовом контуре это должно быть заменено на полноценный auth middleware (JWT/session).
