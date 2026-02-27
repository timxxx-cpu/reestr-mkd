# Backend study (apps/backend)

Дата: 2026-02-27.

## 1) Технологический стек и точка входа

- Backend реализован как BFF на **Fastify** (`type: module`) и работает через **Supabase Admin client**.
- Точка входа — `apps/backend/src/server.js`: здесь поднимается сервер, CORS, auth middleware, логирование request metadata, а также регистрируются route-модули.
- Конфигурация читается в `getConfig()` из `apps/backend/src/config.js`:
  - обязательны `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`;
  - поддерживаются `AUTH_MODE=dev|jwt`, `JWT_SECRET`, `PORT`, `HOST`, `CORS_ORIGIN`;
  - `AUTH_MODE=dev` запрещён в production-like окружениях (`production`, `prod`, `preprod`, `staging`).

## 2) Слои и модули

### 2.1 HTTP/маршруты

Ключевые route-модули в `apps/backend/src/*-routes.js`:

- `auth-routes.js` — login.
- `workflow-routes.js` — операции workflow (complete/review/rollback/decline/restore).
- `locks-routes.js` — lock acquire/refresh/release.
- `catalog-routes.js` — справочники.
- `composition-routes.js` — buildings/blocks.
- `registry-routes.js` — floors/entrances/units/common-areas, reconcile и агрегаты.
- `integration-routes.js` — cadastre/integration status.
- `project-routes.js` + `project-extended-routes.js` — инициализация проекта, контекст, паспорт, basements, full-registry, versioning и admin-операции.

### 2.2 Сервисные/доменные модули

- `application-repository.js` — доступ к таблицам `applications`, `application_history`, `application_steps`, `application_locks`.
- `workflow-transitions.js` — чистая логика переходов состояния workflow.
- `idempotency-store.js` + `idempotency-helpers.js` — in-memory idempotency (TTL + fingerprint payload).
- `policy.js` — RBAC matrix по доменам и действиям.
- `auth.js` — auth-context из JWT (HS256) или DEV-заголовков.
- `http-helpers.js` — стандартизированный error-contract и policy-aware доступ.
- `validation.js`, `versioning.js`, `project-helpers.js`, `format-utils.js` — прикладные части под конкретные use-case.

## 3) Безопасность и контроль доступа

- Доступ строится на `req.authContext`, который формируется централизованным middleware (`installAuthMiddleware`).
- Для `AUTH_MODE=jwt` backend требует Bearer-token и валидирует подпись/срок действия HS256.
- Для `AUTH_MODE=dev` доступен fallback по заголовкам `x-user-id`, `x-user-role`.
- Проверка ролей выполняется через policy matrix (`allowByPolicy`) и helper `requirePolicyActor` в маршрутах.

## 4) Управление конкурентностью и повторными запросами

- В workflow и части mutating route-ов используется **двойной контроль**:
  1. **Lock ownership** в БД (`application_locks`) через `ensureActorLock`.
  2. **Idempotency key** (`x-idempotency-key`) через in-memory store с fingerprint тела запроса.
- Повтор с тем же ключом и иным payload возвращает `409 IDEMPOTENCY_CONFLICT`.

## 5) Наблюдаемость и operational практики

- Сервер пишет `operationSource`, `clientRequestId`, `requestId`, `method`, `url` в лог на каждом запросе.
- В ответ прокидываются `x-request-id`, `x-operation-source` для трассировки FE↔BFF.
- Документационный drift API контролируется через `route-manifest.json` и script `docs:routes:check|sync`.

## 6) Текущая архитектурная оценка

Сильные стороны:

- Хорошо разделены HTTP-слой, доменная логика переходов и DB-репозиторий.
- Есть явный RBAC, idempotency, lock-механизм и единый error-contract.
- Присутствует route-manifest check для синхронизации README и реального API.

Риски/ограничения:

- Idempotency store in-memory: не shared между инстансами (горизонтальное масштабирование потребует Redis/DB-backed store).
- В `AUTH_MODE=dev` безопасность зависит от корректной конфигурации окружения.
- Часть read-model эндпойнтов агрегирует данные в приложении; при росте объёмов возможна потребность в SQL-view/RPC оптимизации.

## 7) Практический вывод

Backend уже соответствует роли BFF для транзакционных сценариев (workflow, locking, registry-mutations) и имеет базовые механизмы production-гигиены (policy, auth, observability, anti-duplication).

Следующий логичный шаг для enterprise-нагрузки — вынести idempotency/lock координацию в shared-storage и продолжить сужение «толстых» read-model запросов через SQL-слой (views/RPC).
