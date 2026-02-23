# 18. FE/BE migration gap inventory (что осталось перенести)

## Текущее покрытие BFF (оценка)

По состоянию текущей ветки критичные workflow и реестровые write-path уже заведены в BFF под feature-flag:

- workflow-мутации (`complete/rollback/review/request-decline/decline/return/restore/assign`),
- composition,
- floors/entrances,
- units/common areas,
- parking sync.

**Оценка прогресса миграции write-path:** ~92–95% (после переноса passport/basements/versioning/context save-path).

> Это инженерная оценка по текущему `ApiService` и включенным BFF веткам, а не формальная метрика релизного KPI.

## Что еще осталось перенести на Backend (приоритетно)

### P1 — операции создания/инициализации проекта (частично закрыто)

Уже перенесено в BFF под флаг:
1. `createProjectFromApplication` → `POST /projects/from-application`

Что осталось:
- объединить `project/application` и pending-version orchestration в единую transaction boundary (часть project/application уже может идти через RPC, pending versions пока за границей этой транзакции).

### P1/P2 — интеграционные и кадастровые мутации (закрыто в текущем пакете)

Уже перенесено в BFF под модульные флаги:

1. `getIntegrationStatus` / `updateIntegrationStatus`
2. `updateBuildingCadastre`
3. `updateUnitCadastre`

Используемые флаги:
- `VITE_BFF_INTEGRATION_ENABLED`
- `VITE_BFF_CADASTRE_ENABLED`

### P2/P3 — оставшиеся служебные и административные write-path

- точечные операции, которые остались в legacy-ветках и не блокируют основной workflow,
- операции вне критичного пользовательского happy-path.

## Что уже можно считать «почти готово к отключению direct-write»

Перед выключением direct-write в frontend должны одновременно выполниться условия:

1. Все P1-сценарии выше переведены на BFF.
2. Для оставшихся P2/P3 есть явный список исключений и owner по каждому пункту.
3. Smoke-прогон по ключевым сценариям проходит только через BFF ветку (без fallback).
4. Включен контроль источника записи (`bff`/`legacy`) в runtime-логах DEV.

## Рекомендуемый следующий пакет работ (за один спринт)

1. Вынести `createProjectFromApplication` в backend endpoint + фронтовый adapter.
2. Добавить полноценную транзакционную границу для связки `project/application/pending versions` (SQL function или explicit transactional boundary).
3. Перевести оставшиеся точечные legacy write-path на BFF и зафиксировать список исключений.
4. После стабилизации — закрыть fallback для модулей `project-init/integration/cadastre` и включить «BFF only» smoke.

Этот пакет доводит migration до near-complete состояния и готовит режим «direct-write off by default».

## Сводка следующего фокуса

Детальный исполнимый план закрытия оставшихся пунктов вынесен в [раздел 19](./19-backend-transition-execution-plan.md):

- project passport/admin write-path,
- basements + basement parking levels,
- backend-модуль versioning,
- cutover readiness и direct-write OFF by default.

## Выполнено в текущем пакете (по плану раздела 19)

- Добавлены backend endpoint-ы и frontend переключение под флаги для `project passport/admin write-path`.
- Добавлены backend endpoint-ы и frontend переключение для `basements` (`getBasements/toggleBasementLevel`).
- Добавлены backend endpoint-ы и frontend переключение для `object versioning` (`get/create/approve/decline/restore/snapshot`).
- В `.env.example` добавлены флаги:
  - `VITE_BFF_PROJECT_PASSPORT_ENABLED`
  - `VITE_BFF_BASEMENTS_ENABLED`
  - `VITE_BFF_VERSIONING_ENABLED`
- Добавлен backend read-endpoint `GET /projects/:id/full-registry` и frontend-switch под флаг `VITE_BFF_FULL_REGISTRY_ENABLED` для сводного реестрового чтения без direct Supabase path.
- Добавлен backend read-endpoint `GET /projects/:id/context?scope=:scope` и frontend-switch под флаг `VITE_BFF_PROJECT_CONTEXT_ENABLED` для загрузки полного контекста проекта через BFF без прямого фронтового fan-out к таблицам.
- Добавлен backend read-endpoint `GET /projects/:id/context-registry-details` и frontend-switch под флаг `VITE_BFF_PROJECT_CONTEXT_DETAILS_ENABLED` для переноса детальных реестровых read (markers/floors/matrix/units/mop) из frontend fan-out в BFF.
- Добавлен backend write-endpoint `POST /projects/:id/context-meta/save` и frontend-switch под флаг `VITE_BFF_SAVE_META_ENABLED` для переноса meta-save (`complexInfo/applicationInfo`) с frontend direct-write на BFF.
- Добавлен backend write-endpoint `POST /projects/:id/context-building-details/save` и frontend-switch под флаг `VITE_BFF_SAVE_BUILDING_DETAILS_ENABLED` для переноса сохранения `buildingDetails` (blocks/markers/basements/construction/engineering) на BFF.


## Update: observability и cutover tracing (новый приоритет P1)

Для безопасного отключения legacy write/read добавлен отдельный технический фокус:

1. Проставлять источник операции в запросах (`x-operation-source`: `bff` / `legacy`).
2. Прокидывать сквозной клиентский идентификатор запроса (`x-client-request-id`).
3. Возвращать из backend `x-request-id` и использовать его для корреляции логов frontend/backend.

### Уже сделано в текущем пакете

- `BffClient` отправляет `x-operation-source=bff` и `x-client-request-id`;
- в DEV frontend пишет корреляционный лог (`clientRequestId` + backend `requestId`);
- backend принимает заголовки, возвращает `x-request-id` и логирует источник операции;
- в `ApiService` добавлен DEV-tracking legacy fallback-веток для критичных операций (workflow lock/mutations, project-init fallback, cadastre fallback, versioning fallback, full-registry fallback) через `trackOperationSource`.
- добавлен DEV helper API для среза долей `bff/legacy`: `window.__reestrOperationSource.getSummary()` / `getStats()` / `reset()`.

### Что еще осталось по observability

- завершить маркировку оставшихся точечных legacy-path в некритичных/редких сценариях;
- собрать сводную метрику «доля BFF vs legacy» для release-gate на direct-write OFF;
- включить обязательную проверку трассировки в cutover smoke-checklist.


## Update: hard-switch policy

- frontend работает в **backend-first default**;
- аварийный откат в legacy доступен только через `VITE_LEGACY_ROLLBACK_ENABLED=true`;
- фактическое состояние фиксируется в `20-cutover-fact-sheet.md`.
