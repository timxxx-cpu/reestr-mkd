# reestr-mkd BFF (Iteration 1)

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

## Auth-context (DEV)

Для endpoint-ов мутации используются заголовки:

- `x-user-id`
- `x-user-role`

В продовом контуре это должно быть заменено на полноценный auth middleware (JWT/session).
