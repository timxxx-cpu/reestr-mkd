# 19. Единый план миграции на BFF (backend-first)

## Цель

Этот документ — **единый источник правды** по миграции FE→BFF:

- текущее состояние миграции;
- what-is-done vs what-is-left;
- технические и процессные риски;
- пошаговый план закрытия задач до полного cutover.

> Все прежние отдельные документы по BFF-миграции, статусам и roadmap объединены в этот файл.

---

## 1) Текущее состояние (сверено с кодом)

По `src/lib/bff-client.js`, `src/lib/api-service.js`, `apps/backend/src/*`:

### 1.1 Базовый режим cutover

- frontend работает в **backend-first** логике;
- BFF считается включенным по default;
- возврат на legacy-path возможен только через аварийный `VITE_LEGACY_ROLLBACK_ENABLED=true`.

### 1.2 Что уже переведено на BFF

- locks lifecycle;
- workflow-операции;
- composition/floors/entrances/units/common areas/parking;
- integration status + cadastre updates;
- project init from application;
- project passport/admin (project info, participants, documents, delete);
- basements (read + toggle parking levels);
- versioning (create/approve/decline/restore/snapshot/list);
- project full registry/context/context-registry-details;
- meta/building-details/step-block-statuses save-path;
- buildings summary read-path.

### 1.3 Observability / auth

- frontend отправляет `x-operation-source` и `x-client-request-id`;
- backend возвращает `x-request-id` и пишет source-aware логи;
- в DEV есть runtime summary источников операций;
- поддерживаются `AUTH_MODE=dev` и `AUTH_MODE=jwt`.

### 1.4 Что еще частично флагировано

Остались read-path, включаемые отдельными флагами staged rollout:

- `VITE_BFF_APPLICATIONS_READ_ENABLED`;
- `VITE_BFF_CATALOGS_ENABLED`.

---

## 2) Оставшиеся задачи (backlog)

## 2.1 Auth/RBAC hardening (приоритет P1)

1. Довести policy matrix до единого server-side покрытия на всех write endpoint-ах.
2. Зафиксировать и проверить единый формат forbidden/error ответа.
3. Зафиксировать профиль окружений, где `AUTH_MODE=dev` запрещен.

## 2.2 Финализация read-cutover (приоритет P1)

1. Включить и стабилизировать BFF read-path для applications/dashboard.
2. Включить и стабилизировать BFF read-path для catalogs/system users.
3. После стабилизации — убрать legacy fallback по этим read-модулям.

## 2.3 Release gate и эксплуатационная готовность (приоритет P1)

1. Утвердить финальный smoke-чеклист backend-only режима.
2. Зафиксировать stop-conditions (когда откат обязателен).
3. Закрепить rollback-процедуру (кто, когда, как включает emergency-флаги).

## 2.4 Cleanup legacy (приоритет P2)

1. Удалить неиспользуемые direct Supabase ветки во frontend data-layer.
2. Сократить число feature-флагов до минимального аварийного набора.

---

## 3) Единый roadmap

## Phase A — Hardening

**Scope:** RBAC/auth/error-contract.

**DoD:**

- write endpoints покрыты единым server-side policy-слоем;
- зафиксирован единый формат ошибок;
- согласованы runtime-профили auth для DEV/pre-prod/prod.

## Phase B — Read cutover completion

**Scope:** applications read + catalogs read.

**DoD:**

- staged read-флаги работают стабильно в backend-only профиле;
- read-операции в штатном режиме идут через BFF;
- подтверждена отсутствие критичных regressions.

## Phase C — Cutover gate

**Scope:** эксплуатационная приемка.

**DoD:**

- smoke backend-only режима проходит;
- подтверждено отсутствие критичных legacy-path;
- утвержден rollback runbook.

## Phase D — Legacy retirement

**Scope:** удаление legacy-кода.

**DoD:**

- удалены dead legacy ветки;
- документация соответствует фактическому финальному коду.

---

## 4) Критерии готовности к `direct-write/read OFF by default`

Переключение считается безопасным, если одновременно выполнено:

1. Нет незакрытых P1 direct-write путей.
2. Dashboard/catalog read-path работают через BFF в штатном профиле.
3. Smoke backend-only проходит по ключевым пользовательским сценариям.
4. Наблюдаемость показывает отсутствие критичных legacy операций.
5. Error-contract и request tracing единообразны.

---

## 5) Рабочие правила команды до завершения миграции

1. Любая новая мутация проектируется как backend use-case.
2. Во frontend новые direct Supabase write/read ветки не добавляются.
3. Любая временная legacy-ветка должна иметь задачу на удаление.
4. После каждого релизного шага обновляется **этот документ** (а не отдельные status-файлы).
