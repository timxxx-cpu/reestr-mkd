# 19. Backend transition execution plan (PostgreSQL-first, Supabase DEV)

## Цель документа

## 0) Статус исполнения (текущая ветка)

В рамках выполнения плана уже начат перенос оставшихся legacy-path:

- добавлены BFF feature-flags для `project passport`, `basements`, `versioning`;
- frontend `ApiService`/`BffClient` переключают эти модули на backend при включенных флагах;
- в backend добавлены endpoint-ы для passport/admin операций, basements и object versioning.
- добавлен backend read-path `project full registry` и флаг `VITE_BFF_FULL_REGISTRY_ENABLED` для перевода тяжелой сводной загрузки на BFF.
- добавлен backend read-path `project context` и флаг `VITE_BFF_PROJECT_CONTEXT_ENABLED` для переноса полной загрузки контекста проекта на BFF.
- добавлен backend read-path `project context registry details` и флаг `VITE_BFF_PROJECT_CONTEXT_DETAILS_ENABLED` для переноса детализированных read-запросов контекста на BFF.
- добавлен backend write-path `project context meta save` и флаг `VITE_BFF_SAVE_META_ENABLED` для переноса сохранения project/application meta в BFF-контур.
- добавлен backend write-path `project context building-details save` и флаг `VITE_BFF_SAVE_BUILDING_DETAILS_ENABLED` для переноса сохранения block-level конфигураций в BFF.
- backend маршруты разнесены по модульному слою (`project-init` отдельно от extended project routes), чтобы упростить дальнейший перенос в полноценные `modules/*` и сопровождение.

Это закрывает стартовую реализацию Iteration A/B/C и формирует основу для cutover smoke в backend-only режиме.

---


Этот документ фиксирует **практический план закрытия миграции на backend** в тестовом контуре, где:

- DEV по-прежнему работает через Supabase;
- схема данных восстанавливается из `db/reset_schema.sql`;
- целевая модель — frontend без direct-write и backend как единая точка бизнес-мутаций.

Документ дополняет разделы `16`, `17`, `18` и переводит их в формат исполнимого плана с критериями готовности.

---

## 1) Что уже закрыто

На стороне BFF уже есть покрытие для критичных сценариев:

- lock lifecycle;
- workflow-мутации;
- composition;
- floors/entrances;
- units/common areas;
- parking sync;
- integration status + cadastre updates;
- project init from application.

Это означает, что основной реестровый happy-path уже может работать через backend под feature-flags.

---

## 2) Что еще осталось довести для полного FE→BE перехода

Ниже — оставшиеся направления, которые еще создают зависимость от legacy Supabase write/read path.

## 2.1 Project passport / admin write-path (P1)

Остались прямые операции, которые логически должны быть backend use-case:

- обновление карточки проекта (`projects`);
- участники проекта (`project_participants`);
- документы проекта (`project_documents`);
- удаление проекта;
- тяжелая агрегированная загрузка контекста/реестра без BFF контрактов.

### Что сделать

1. Ввести backend endpoints для project passport и admin операций.
2. Зафиксировать DTO-контракты и унифицировать ошибки (`code/message/details/requestId`).
3. Переключить frontend на BFF path с модульным флагом `VITE_BFF_PROJECT_PASSPORT_ENABLED`.
4. После стабилизации — выключить legacy write для passport-модуля.

## 2.2 Basements / basement parking levels (P1)

Операции по подвальным уровням пока остаются direct-write.

### Что сделать

1. Добавить BFF endpoints:
   - `GET /projects/:id/basements`
   - `PUT /basements/:id/parking-levels/:level`
2. Добавить серверную валидацию диапазона уровней и аудит события.
3. Включить idempotency для batch-сценариев, если появятся массовые операции.

## 2.3 Object versioning API (P1/P2)

Версионирование пока реализовано через frontend→Supabase path (с feature-toggle `VERSIONING_ENABLED`), что мешает полной централизации прав и аудита.

### Что сделать

1. Перенести CRUD и state transitions по `object_versions` в backend модуль.
2. Свести approve/decline/restore в явные доменные endpoints.
3. Убрать из frontend прямую запись в `object_versions`.
4. Проверить связку с `POST /projects/from-application` и pending-version orchestration.

## 2.4 Auth/RBAC hardening (P1)

Текущий DEV-контекст использует `x-user-id/x-user-role`. Для устойчивого backend-only режима нужна более строгая auth-модель.

### Что сделать

1. Добавить auth middleware (JWT/session) как отдельный backend слой.
2. Перенести RBAC-правила из UI-ограничений в серверные policy checks.
3. Оставить DEV-режим заголовков только как explicit fallback profile.

## 2.5 Наблюдаемость и контроль cutover (P1)

Для безопасного отключения legacy-path нужны прозрачные метрики источника записи.

### Что сделать

1. Логировать во frontend и backend источник операции (`bff`/`legacy`) и requestId.
2. Добавить DEV smoke-checklist в CI/ручной прогон по ключевым сценариям.
3. Ввести «стоп-условия» релиза: если есть критичный сценарий только в legacy, direct-write не отключать.

---

## 3) Исполнимый roadmap (4 итерации)

## Iteration A — Project passport + admin API

**Scope:** project info, participants, documents, delete project, read aggregate (минимально необходимый).

**DoD:**

- все операции passport write идут через backend при активном флаге;
- единая ошибка backend-контракта;
- smoke «обновить паспорт + участника + документ» проходит без Supabase write.

## Iteration B — Basements + parking levels

**Scope:** чтение/редактирование basement-модели через backend.

**DoD:**

- `getBasements/toggleBasementLevel` не используют direct Supabase при активном флаге;
- есть серверная валидация и аудит.

## Iteration C — Versioning backend module

**Scope:** create/approve/decline/restore/get versions snapshot через backend.

**DoD:**

- frontend не вызывает прямые мутации `object_versions`;
- approve/decline/restore полностью под server-side RBAC;
- проходит regression по workflow + versioning.

## Iteration D — Cutover readiness и default backend mode

**Scope:** наблюдаемость, fallback-policy, отключение legacy write по умолчанию.

**DoD:**

- `VITE_BFF_ENABLED=true` + модульные флаги дают полный write-path coverage;
- legacy write выключен по умолчанию и включается только аварийно;
- есть финальный чеклист «direct-write off».

---

## 4) Критерии готовности к «direct-write OFF by default»

Переключение считается безопасным, если одновременно выполняются условия:

1. Для P1-модулей нет незакрытых direct-write путей.
2. У каждого оставшегося исключения есть owner, дедлайн и rollback-план.
3. Smoke по ключевому workflow проходит в режиме backend-only.
4. Для ошибок есть единый backend контракт + request tracing.
5. Документация (`13/16/18/19`) синхронизирована с фактическим кодом.

---

## 5) Практический рабочий режим команды до полного cutover

1. Новые мутации проектировать только как backend use-case.
2. Во frontend — адаптер + feature-flag, без новой direct Supabase записи.
3. Любую legacy ветку сопровождать задачей на удаление.
4. После каждой итерации обновлять gap inventory и критерии отключения fallback.

Такой режим позволяет сохранить скорость тестового DEV-контура, но не накапливать новый технический долг в legacy write-path.
