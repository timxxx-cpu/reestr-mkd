# 14. Iteration 1 — внедрение BFF (locks + complete-step)

## 1) Цель итерации

Перенести в backend первый критичный срез без ломки текущего runtime:

- lock-механики;
- workflow-операцию `complete-step`.

## 2) Что реализовано

## 2.1 Backend (новый модуль `apps/backend`)

Добавлен минимальный BFF-сервис:

- стек: Node.js + Fastify + Supabase JS (service role);
- endpoint-ы:
  - `GET /health`
  - `GET /api/v1/applications/{applicationId}/locks`
  - `POST /api/v1/applications/{applicationId}/locks/acquire`
  - `POST /api/v1/applications/{applicationId}/locks/refresh`
  - `POST /api/v1/applications/{applicationId}/locks/release`
  - `POST /api/v1/applications/{applicationId}/workflow/complete-step`

Особенности:

- lock endpoint-ы используют существующие RPC (`acquire_application_lock`, `refresh_application_lock`, `release_application_lock`);
- `complete-step` проверяет валидность шага, наличие активного lock и обновляет статус заявки + историю;
- единый error-contract ответа (`code`, `message`, `details`, `requestId`).

## 2.2 Frontend integration (безопасный режим)

Добавлен BFF-клиент `src/lib/bff-client.js` и feature-flag переключения:

- `VITE_BFF_ENABLED=false` по умолчанию;
- при `true` lock-операции и `complete-step` идут через BFF;
- при `false` сохраняется текущий путь через Supabase SDK (legacy), поведение не меняется.

## 2.3 Runtime safety

Чтобы не нарушить работоспособность текущего проекта:

1. Legacy-путь полностью сохранен.
2. Новый путь активируется только флагом.
3. Изменения итерации ограничены P0-срезом (`locks + complete-step`).

## 3) Конфигурация

## Frontend `.env`

- `VITE_BFF_ENABLED`
- `VITE_BFF_BASE_URL`

## Backend `.env`

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PORT`
- `HOST`

## 4) Ограничения текущей итерации

1. Auth реализован DEV-способом через заголовки `x-user-id`/`x-user-role`.
2. Транзакционность `complete-step` пока на уровне последовательных операций, без server-side SQL function orchestration.
3. Idempotency key для `complete-step` принят в контракте, но отдельное хранилище идемпотентности пока не добавлено.

## 5) Рекомендации на Iteration 2

1. Перевести `review-approve`, `review-reject`, `rollback-step` в backend.
2. Добавить auth middleware (JWT) вместо DEV-header контекста.
3. Вынести `complete-step` в SQL/RPC или explicit transaction boundary в backend.
4. Добавить интеграционные тесты BFF endpoint-ов (happy path + race conditions).


## 6) Progress update: Iteration 2

Расширение BFF выполнено для следующих workflow-операций:

- `POST /api/v1/applications/{applicationId}/workflow/rollback-step`
- `POST /api/v1/applications/{applicationId}/workflow/review-approve`
- `POST /api/v1/applications/{applicationId}/workflow/review-reject`

Frontend теперь также переключает эти операции на BFF при `VITE_BFF_ENABLED=true` с fallback на legacy путь при `false`.


## 7) Progress update: Iteration 3

Расширение BFF выполнено для workflow-операций Iteration 3:

- `POST /api/v1/applications/{applicationId}/workflow/assign-technician`
- `POST /api/v1/applications/{applicationId}/workflow/request-decline`
- `POST /api/v1/applications/{applicationId}/workflow/decline`
- `POST /api/v1/applications/{applicationId}/workflow/return-from-decline`
- `POST /api/v1/applications/{applicationId}/workflow/restore`

Frontend переключает эти операции на BFF при `VITE_BFF_ENABLED=true` с fallback на legacy путь при `false`.
