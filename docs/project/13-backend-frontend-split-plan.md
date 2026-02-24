# 13. План разделения проекта на Backend и Frontend

## 0) Контекст и цель

Текущий проект работает как frontend-first приложение с прямым доступом к Supabase из клиентского кода. Это ускоряет DEV, но создает ограничения:

- бизнес-логика и правила workflow частично «размазаны» по UI;
- сложнее централизованно контролировать права и аудит;
- интеграции и миграция на «чистый» PostgreSQL сложнее без сервисного слоя;
- высокий coupling между схемой БД и представлением.

**Цель**: эволюционно разделить систему на:

1. **Frontend (React/Vite)** — UI, UX, локальное состояние, формовые валидации.
2. **Backend API (BFF/Domain API)** — бизнес-операции, оркестрация workflow, транзакции, авторизация, аудит, интеграции.
3. **PostgreSQL** — хранилище и целостность данных, минимально необходимая серверная логика.

Приоритет — **безболезненный переход** без big-bang переписывания.

---

## 1) Целевая архитектура (предложение)

## 1.1 Компоненты

- **`apps/frontend`**: текущий React-проект (постепенно переносится).
- **`apps/backend`**: Node.js backend (рекомендуется Fastify/NestJS/Express + zod/openapi).
- **`db`**: SQL-миграции, сиды, роли БД, функции/триггеры.

## 1.2 Границы ответственности

### Frontend
- Отрисовка экранов, навигация, формы, optimistic UI.
- Локальные валидаторы удобства ввода.
- Вызов только HTTP API backend (без прямых write-операций в БД).

### Backend
- Единая точка входа для доменных сценариев:
  - управление проектом/заявкой;
  - workflow transitions;
  - операции реестров и матриц;
  - блокировки конкурентного редактирования;
  - versioning.
- Авторизация/аутентификация и серверный RBAC/ABAC.
- Транзакционность и аудит.
- Интеграции (УЗКАД и др.).

### Database
- FK/UNIQUE/CHECK, индексы, базовые функции, триггеры updated_at.
- Справочники и seed-процедуры.
- RLS (в зависимости от выбранной модели доступа).

## 1.3 Рекомендуемый стиль API

- REST + OpenAPI (быстрый старт и прозрачный контракт).
- Доменные endpoints вместо «табличных CRUD» там, где есть бизнес-операция:
  - `/applications/{id}/workflow/complete-step`
  - `/applications/{id}/workflow/review-approve`
  - `/applications/{id}/locks/acquire`
  - `/projects/{id}/buildings/...`

---

## 2) Варианты миграции (предложение)

## Вариант A (рекомендуемый): BFF над текущей БД

1. Сначала вводится backend как прокси-оркестратор поверх текущего Supabase/Postgres.
2. Frontend постепенно переключается с Supabase SDK на backend API.
3. После стабилизации — перенос на целевой Postgres-контур без изменения frontend-контрактов.

**Плюсы**: минимальный риск, поэтапный rollout, обратимая миграция.
**Минусы**: временно дублируется часть логики (frontend + backend).

## Вариант B: сразу полный backend + отключение direct DB из фронта

**Плюсы**: быстрее к «чистой» архитектуре.
**Минусы**: высокий риск регрессий и большая волна изменений.

---

## 3) План работ (детально по фазам)

## Фаза 1. Архитектурная стабилизация и инвентаризация (1–2 недели)

### Задачи
1. Каталогизировать все текущие точки доступа к данным из фронта:
   - чтение/запись, RPC, batch-операции, workflow actions.
2. Сформировать карту доменных сценариев:
   - Project lifecycle,
   - Application workflow,
   - Registry operations,
   - Locks,
   - Versioning.
3. Разделить операции по критичности:
   - P0 (workflow + locks + статусные переходы),
   - P1 (основные справочники/реестры),
   - P2 (второстепенные/аналитические).

### Результат
- ADR-документ(ы) с целевой схемой и контрактом API.
- Матрица «текущий вызов → будущий endpoint». 

## Фаза 2. Каркас backend и технические стандарты (1 неделя)

### Задачи
1. Поднять skeleton backend:
   - health/readiness,
   - structured logging,
   - error model,
   - config/env management.
2. Ввести единые middleware:
   - auth context,
   - request-id/correlation-id,
   - rate limit (минимальный).
3. Настроить OpenAPI-генерацию и клиентские типы.

### Результат
- Рабочий backend-шаблон, готовый к доменным модулям.

## Фаза 3. Auth, роли, доступы (1–2 недели)

### Задачи
1. Определить модель identity:
   - Supabase Auth passthrough или собственный JWT provider.
2. Перенести проверки ролей из frontend в backend policy layer.
3. Зафиксировать permission-matrix по операциям (admin/manager/technician/controller).
4. Согласовать RLS-стратегию:
   - оставить RLS как defense-in-depth,
   - либо управлять доступом только в backend (с service-role).

### Результат
- Серверный enforcement прав доступа на всех критичных endpoint.

## Фаза 4. Перенос workflow и lock-механики в backend (P0, 2–3 недели)

### Задачи
1. Реализовать backend endpoints для:
   - COMPLETE_STEP,
   - ROLLBACK_STEP,
   - REVIEW_APPROVE/REVIEW_REJECT,
   - assign/decline/restore.
2. Перенести acquire/refresh/release lock в backend use-cases.
3. Обернуть операции в транзакции + audit events.
4. Ввести idempotency для повторных запросов критичных операций.

### Результат
- Самая чувствительная бизнес-логика централизована на сервере.

## Фаза 5. Перенос реестровых операций (P1, 2–4 недели)

### Задачи
1. Для building/floor/entrance/unit/common_area создать domain services.
2. Вынести маппинг UI↔DB в backend DTO layer (frontend оставляет только ViewModel).
3. Реализовать batch-операции и reconciliation серверно.
4. Сохранить совместимость payload-форматов на переходный период.

### Результат
- Frontend перестает писать в БД напрямую.

## Фаза 6. Версионирование и интеграции (P1/P2, 1–2 недели)

### Задачи
1. Перенести object_versions операции полностью в backend.
2. Вынести интеграции (УЗКАД и др.) в integration adapters.
3. Добавить outbox/ретраи для внешних вызовов (по необходимости).

### Результат
- Консистентная серверная оркестрация версий и интеграций.

## Фаза 7. Отключение прямого Supabase-доступа с фронта (1 неделя)

### Задачи
1. Удалить/заморозить прямые write-path в frontend.
2. Оставить только backend API client.
3. Закрыть публичные каналы доступа к критичным таблицам.

### Результат
- Четкое разделение FE/BE на уровне runtime-доступов.

## Фаза 8. Пост-миграционная оптимизация (параллельно)

### Задачи
1. Производительность:
   - индексы,
   - slow query review,
   - pagination/streaming.
2. Надежность:
   - retry policies,
   - circuit breakers на внешних интеграциях.
3. Наблюдаемость:
   - metrics, traces, error budgets.

---

## 4) Предлагаемая структура backend-модулей

- `modules/projects`
- `modules/applications`
- `modules/workflow`
- `modules/registry`
- `modules/locks`
- `modules/versions`
- `modules/catalogs`
- `modules/integration`
- `modules/auth`
- `shared/db`, `shared/logger`, `shared/errors`, `shared/validation`

В каждом модуле:
- `controller` (HTTP),
- `service/use-case` (бизнес-правила),
- `repository` (SQL),
- `dto/schemas` (zod/openapi),
- `tests` (unit/integration).

---

## 5) Контрактный слой и совместимость

## 5.1 Контрактная дисциплина

- Все endpoints versioned (`/api/v1/...`).
- OpenAPI как source of truth.
- Backend возвращает нормализованную модель ошибок:
  - `code`, `message`, `details`, `requestId`.

## 5.2 Переходный адаптер

На фронте добавить тонкий data-access adapter:
- текущий supabase-путь (legacy),
- новый backend-путь,
- feature-flag для поэтапного переключения по модулям.

---

## 6) Тестовая стратегия и контроль качества

## 6.1 Backend
- Unit tests на use-cases.
- Integration tests с тестовой БД (docker postgres).
- Contract tests по OpenAPI.
- Workflow state-transition tests (критично).

## 6.2 Frontend
- Smoke/E2E на ключевые пользовательские сценарии.
- Snapshot/regression на critical views.

## 6.3 Migration safety checks
- Data parity checks до/после переключения endpoint.
- Shadow-mode для чтений (сравнение старого и нового ответа).

---

## 7) Безопасность и операционная модель

1. Секреты только на backend (без экспозиции в клиент).
2. Server-side валидация всех write-запросов.
3. Обязательный audit trail для workflow-операций.
4. Защита от race conditions:
   - optimistic locking/version fields,
   - транзакции,
   - lock table + TTL.
5. Backup/restore и миграционные rollback scripts.

---

## 8) Основные риски и как снижать

1. **Риск регрессий workflow**
   - Смягчение: golden test-cases + state-machine tests.
2. **Риск рассинхронизации DTO/UI/DB**
   - Смягчение: единый schema registry + contract tests.
3. **Риск деградации производительности**
   - Смягчение: профилирование SQL и индексная программа.
4. **Риск сложного cutover**
   - Смягчение: feature flags + canary rollout.

---

## 9) Предложение по roadmap релизов

- **R1 (MVP backend)**: auth, workflow, locks, health, logging.
- **R2 (registry core)**: здания/блоки/этажи/помещения + batch.
- **R3 (versions + integrations)**: версионирование и внешние адаптеры.
- **R4 (deprecation legacy)**: отключение direct DB из frontend.

Каждый релиз завершается:
- регрессионным прогоном,
- проверкой инвариантов БД,
- обновлением документации API.

---

## 10) Что делать прямо сейчас (первый practical шаг)

1. Утвердить архитектурное решение: **Вариант A (поэтапный BFF)**.
2. Зафиксировать shortlist P0 endpoints (workflow + locks).
3. Создать backend-репозиторий/папку и базовый CI.
4. Ввести feature-flag в frontend data-access слой.
5. Запустить первую миграционную волну на одном вертикальном срезе:
   - `acquire/refresh/release lock` + `complete-step`.

Это даст быстрый практический эффект и минимизирует риск.

---

## 11) Зафиксированное решение и shortlist P0 endpoints (workflow + locks)

### 11.1 Принятое решение

Выбран **Вариант A: поэтапный BFF**.

Это означает:
- frontend переключается на backend API по модульным срезам;
- критичные операции workflow/locks переводятся первыми;
- direct write в Supabase из фронта планово выводится из эксплуатации.

### 11.2 Shortlist P0 endpoints (MVP)

Ниже минимальный набор endpoint-ов, который должен быть реализован в первой волне миграции.

#### A. Locks

1. `POST /api/v1/applications/{applicationId}/locks/acquire`
   - Назначение: взять заявку в работу (эксклюзивная блокировка).
   - Body:
     - `ttlSeconds?: number` (default 1200)
   - Response 200:
     - `ok`, `reason`, `message`, `expiresAt`
   - Ошибки:
     - `409 LOCKED`
     - `403 ASSIGNEE_MISMATCH`
     - `404 NOT_FOUND`

2. `POST /api/v1/applications/{applicationId}/locks/refresh`
   - Назначение: продлить lock текущего владельца.
   - Body:
     - `ttlSeconds?: number`
   - Response 200:
     - `ok`, `reason`, `message`, `expiresAt`
   - Ошибки:
     - `409 OWNER_MISMATCH`
     - `404 LOCK_NOT_FOUND`

3. `POST /api/v1/applications/{applicationId}/locks/release`
   - Назначение: освободить lock.
   - Body: пустой.
   - Response 200:
     - `ok`, `reason`, `message`
   - Ошибки:
     - `409 OWNER_MISMATCH`
     - `404 LOCK_NOT_FOUND`

4. `GET /api/v1/applications/{applicationId}/locks`
   - Назначение: получить текущий статус lock.
   - Response 200:
     - `locked: boolean`, `ownerUserId`, `ownerRole`, `expiresAt`

#### B. Workflow

5. `POST /api/v1/applications/{applicationId}/workflow/complete-step`
   - Назначение: завершить текущий шаг исполнителем.
   - Body:
     - `stepIndex: number`
     - `comment?: string`
     - `idempotencyKey?: string`
   - Response 200:
     - `applicationStatus`, `workflowSubstatus`, `currentStep`, `currentStage`
     - `historyEventId`
   - Ошибки:
     - `409 INVALID_STEP_STATE`
     - `423 LOCK_REQUIRED`
     - `403 FORBIDDEN`

6. `POST /api/v1/applications/{applicationId}/workflow/rollback-step`
   - Назначение: откат шага на доработку.
   - Body:
     - `targetStepIndex: number`
     - `reason: string`
     - `idempotencyKey?: string`
   - Response 200:
     - обновленное состояние заявки + `historyEventId`

7. `POST /api/v1/applications/{applicationId}/workflow/review-approve`
   - Назначение: контрольное подтверждение шага/этапа.
   - Body:
     - `stepIndex: number`
     - `comment?: string`
     - `idempotencyKey?: string`
   - Response 200:
     - обновленное состояние заявки + `historyEventId`

8. `POST /api/v1/applications/{applicationId}/workflow/review-reject`
   - Назначение: контрольный возврат/отклонение.
   - Body:
     - `stepIndex: number`
     - `reason: string`
     - `idempotencyKey?: string`
   - Response 200:
     - обновленное состояние заявки + `historyEventId`

9. `POST /api/v1/applications/{applicationId}/workflow/assign-technician`
   - Назначение: передача заявки между техниками.
   - Body:
     - `assigneeUserId: string`
     - `reason?: string`
   - Response 200:
     - `assigneeUserId`, `workflowSubstatus`, `historyEventId`

10. `POST /api/v1/applications/{applicationId}/workflow/request-decline`
    - Назначение: запрос отказа от исполнителя/ответственного.
    - Body:
      - `reason: string`
      - `stepIndex?: number`
    - Response 200:
      - `workflowSubstatus`, `requestedDeclineAt`

11. `POST /api/v1/applications/{applicationId}/workflow/decline`
    - Назначение: финальное отклонение заявки.
    - Body:
      - `reason: string`
      - `idempotencyKey?: string`
    - Response 200:
      - `applicationStatus='DECLINED'`, `workflowSubstatus`, `historyEventId`

12. `POST /api/v1/applications/{applicationId}/workflow/restore`
    - Назначение: восстановить заявку в работу после отклонения.
    - Body:
      - `comment?: string`
    - Response 200:
      - `applicationStatus='IN_PROGRESS'`, `workflowSubstatus`, `currentStep`, `historyEventId`

### 11.3 Общие P0 требования к endpoint-ам

1. **Транзакционность**: каждый workflow endpoint выполняется в одной транзакции.
2. **Аудит**: обязательная запись в `application_history` и/или event log.
3. **Idempotency**: для мутаций статуса поддержка `idempotencyKey`.
4. **Lock-aware**: write-операции исполнителя требуют действующий lock.
5. **RBAC**: серверная проверка роли и допустимости перехода.
6. **Единый error contract**:
   - `code`, `message`, `details`, `requestId`.
7. **Observability**:
   - метрики латентности/ошибок,
   - структурные логи с `applicationId` и `requestId`.

### 11.4 Порядок внедрения P0 (итерации)

- **Итерация 1**: `locks/*` + `workflow/complete-step`.
- **Итерация 2**: `review-approve`, `review-reject`, `rollback-step`.
- **Итерация 3**: `assign-technician`, `request-decline`, `decline`, `restore`.

Такой порядок даёт раннюю ценность и минимальный риск регрессии.


### 11.5 Статус выполнения

- Iteration 1, Iteration 2 и Iteration 3 запущены: реализованы backend endpoints для `locks/*`, `workflow/complete-step`, `workflow/rollback-step`, `workflow/review-approve`, `workflow/review-reject`, `workflow/assign-technician`, `workflow/request-decline`, `workflow/decline`, `workflow/return-from-decline`, `workflow/restore`; добавлен feature-flag rollout во frontend.
- Подробности реализации и ограничения зафиксированы в `14-iteration1-implementation.md`.


## 12) Сверка плана с фактической реализацией (обновлено)

Ниже — контрольная сверка «план vs код» по текущему состоянию ветки.

### 12.1 Что соответствует плану

1. **P0 workflow + locks** реализованы в backend и подключены во frontend через feature-flags.
2. **P1 registry write-path** в значительной части уже идет через BFF (composition, floors/entrances, units/common-areas, parking).
3. **Project passport/admin, basements, versioning** переведены на backend endpoints и доступны через модульные BFF-флаги.
4. **Технический каркас backend** (health, error contract, idempotency для критичных мутаций) реализован.
5. **Переходный адаптер frontend** реализован в виде `BffClient` + модульные флаги.

### 12.2 Что частично реализовано (есть gap)

1. **Auth/RBAC hardening** — в runtime остается DEV-профиль `x-user-id/x-user-role`; полноценный JWT-профиль не завершен.
2. **Полная транзакционная orchestration** — часть use-case выполняется последовательными запросами к БД, без централизованной SQL boundary для всех сложных операций.
3. **Observability уровня cutover** — базовое логирование есть, но требуется доведение до целевой policy (метрики покрытия legacy/bff и релизные стоп-условия).

### 12.3 Что еще не завершено

1. Отключение direct-write из frontend **по умолчанию** (пока fallback сохранен).
2. Формализация release-gate для режима `backend-only` (чек-лист + обязательный smoke-пакет).
3. Декомпозиция backend в полноценные `modules/*` с единообразными policy/repository слоями по всем доменам.

### 12.4 Обновленный ближайший фокус внедрения

1. **Наблюдаемость cutover (выполняется):**
   - маркировать источник операции (`bff/legacy`) и прокидывать `requestId` end-to-end;
   - логировать клиентский `clientRequestId` во frontend и backend.
2. **Auth/RBAC hardening:** ввести production-profile middleware для JWT и серверный policy-layer без доверия UI.
3. **Cutover rehearsal:** прогнать smoke в режиме `VITE_BFF_ENABLED=true` + все модульные флаги, зафиксировать оставшиеся legacy-зависимости.

### 12.5 Что уже начато в текущем пакете изменений

Сделан первый шаг по п.12.4(1):

- frontend BFF-клиент теперь отправляет `x-operation-source=bff` и `x-client-request-id`, а также логирует связку `clientRequestId/requestId` в DEV;
- backend принимает эти заголовки, возвращает `x-request-id` и пишет в structured log источник операции;
- legacy fallback-ветки в `ApiService` для критичных сценариев теперь тоже маркируются в DEV-трекере источника (`legacy`), что позволяет оценивать долю `bff/legacy` во время cutover rehearsal.

- frontend переведен в backend-first режим по умолчанию; legacy включается только через аварийный флаг `VITE_LEGACY_ROLLBACK_ENABLED=true`;
- в backend добавлен auth profile `AUTH_MODE=jwt` (Bearer JWT HS256 + `JWT_SECRET`) с DEV fallback `AUTH_MODE=dev`.

Это закрывает базовый фундамент для трассировки FE→BE запросов в период отключения legacy-path.


Сводная фактология текущего cutover-состояния вынесена в `20-cutover-fact-sheet.md`.

---

## 13) Актуальный статус по фазам и план закрытия

Ниже — пересборка фаз из раздела 3 с учетом фактического состояния (раздел 12 и `20-cutover-fact-sheet.md`).

### 13.1 Статус фаз

1. **Фаза 1 (архитектура и инвентаризация)** — **выполнена**.
   - Карта сценариев и миграционный backlog сформированы в документах `13/18/19`.

2. **Фаза 2 (каркас backend)** — **выполнена**.
   - BFF поднят, есть health/error contract/idempotency, модульные роуты и базовая трассировка.

3. **Фаза 3 (auth/roles/access)** — **частично**.
   - `AUTH_MODE=jwt` уже есть, но полный server-side policy matrix и унификация guard-слоя на всех workflow endpoint еще не завершены.

4. **Фаза 4 (workflow + locks, P0)** — **закрыта**.
   - P0 endpoint-ы реализованы и переведены на единый guard/helper слой (`requirePolicyActor` + `sendError`) в backend workflow route-ах.

5. **Фаза 5 (registry operations, P1)** — **закрыта (operational done)**.
   - Registry read/write-path переведен в BFF-only режим; legacy fallback для реестровых операций отключен.

6. **Фаза 6 (versions + integrations, P1/P2)** — **в основном выполнена (hardening продолжается)**.
   - Основные endpoint-ы и интеграционные контуры есть; начата детализация server-side RBAC для versioning actions (`create/approve/decline/restore`) и требуется формализация релизных gate.

7. **Фаза 7 (отключение direct Supabase из frontend)** — **в процессе**.
   - Backend-first включен по умолчанию, но legacy rollback-путь еще сохранен как аварийный.

8. **Фаза 8 (пост-миграционная оптимизация)** — **в процессе**.
   - Базовая observability есть; не закрыты финальные SLO/SLI и формальные stop-conditions cutover.

### 13.2 Что еще не сделано (критичный остаток)

1. **Формализовать release-gate backend-only режима**:
   - обязательный smoke-пакет;
   - критерии блокировки релиза при наличии legacy-only сценариев.
2. **Подтвердить в живом rehearsal отсутствие критичных legacy-path** и зафиксировать это в артефактах cutover.
3. **Довести модульную декомпозицию backend (`modules/*`)** до единообразной структуры по workflow/registry/versioning/integration.

### 13.3 План закрытия (3 ближайшие фазы, 2–4 недели)

#### Фаза A (Неделя 1): Auth/RBAC hardening + workflow guard unification

**Цель:** закрыть незавершенную часть Фазы 3.

**Задачи:**
- Перевести оставшиеся workflow endpoint-ы на общий `requirePolicyActor`/`sendError` helper.
- Зафиксировать server-side policy matrix по ролям и переходам статусов.
- Включить обязательный JWT-профиль для rehearsal окружения (DEV fallback только как explicit override).

**DoD:**
- Нет endpoint-ов workflow с ручными/дублирующими auth-проверками.
- Все критичные переходы покрыты policy-тестами.

#### Фаза B (Неделя 2): Cutover rehearsal и release-gate

**Цель:** закрыть незавершенную часть Фазы 7.

**Задачи:**
- Прогнать `cutover:smoke`, backend tests и frontend build в backend-first режиме.
- Выполнить живой user-smoke по `live-business-smoke-checklist.md`.
- Зафиксировать release-gate документом: что блокирует отключение аварийного legacy rollback.

**DoD:**
- В smoke/report нет критичных операций, которые работают только через legacy.
- Есть согласованный чек-лист допуска к hard-switch.

#### Фаза C (Недели 3–4): Hard-switch cleanup + post-migration baseline

**Цель:** завершить Фазы 7 и 8.

**Задачи:**
- Удалить/заморозить legacy write-path для критичных модулей после прохождения gate.
- Доделать модульную декомпозицию backend и owner-ответственность по доменам.
- Зафиксировать базовые SLI/SLO на latency/error-rate для workflow/registry операций.

**DoD:**
- Direct-write из frontend отключен (кроме явно задокументированных исключений с дедлайном удаления).
- Обновлены fact-sheet и migration docs с финальным статусом cutover.


### 13.4 Фаза 5 закрыта: что именно зафиксировано

**Статус:** Фаза 5 переведена в *operational done*. Для registry-модуля включен BFF-only path, а legacy rollback больше не применяется к registry операциям.

#### Что уже дает готовность к закрытию Фазы 5

- Реестровые модульные BFF-флаги уже включены в backend-first логике (`composition/floors/entrances/units/mop/parking`).
- Для ключевых registry-path есть BFF endpoint-ы и клиентские вызовы через `BffClient` при активных флагах.
- В документированной фактологии cutover уже зафиксирован перевод registry core в BFF path.

#### Что нужно добить, чтобы честно поставить DONE

1. **Проверка полного coverage реестровых write-path**
   - пройти чек-лист: create/update/delete building, reconcile floors, matrix sync, units/mop batch, parking sync;
   - убедиться, что в DEV summary нет критичных legacy fallback для этих операций.
2. **Формальный gate по Фазе 5**
   - отдельный короткий checklist-артефакт «Phase-5 gate»;
   - в gate включить критерий: при `VITE_BFF_ENABLED=true` и профильных `VITE_BFF_*` флагах все P1 registry write операции идут через BFF.
3. **Зафиксировать исключения (если останутся)**
   - только read-only/не критичные кейсы;
   - для каждого: owner + дедлайн + rollback-план.

#### Предлагаемый микроплан (5 рабочих дней)

- **Day 1:** обновить и согласовать Phase-5 checklist (операции + expected source=bff).
- **Day 2:** прогнать `cutover:smoke` + targeted registry smoke; собрать отчет по источникам `bff/legacy`.
- **Day 3:** закрыть найденные legacy-holes в реестровых write-path.
- **Day 4:** повторный smoke и freeze списка исключений (если есть).
- **Day 5:** подписать Phase-5 gate и обновить статус в `13/20` как «Фаза 5 — done (operational)».

#### Критерий завершения Фазы 5 (предложение)

Фаза 5 считается закрытой, если одновременно выполнено:

1. Реестровые write-операции P1 выполняются через BFF в backend-first режиме.
2. Нет блокирующих legacy-only сценариев в smoke-отчете по реестрам.
3. Исключения задокументированы и не относятся к критичным write-path.
4. Статус синхронизирован в `13-backend-frontend-split-plan.md` и `20-cutover-fact-sheet.md`.
