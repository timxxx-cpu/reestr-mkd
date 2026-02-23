# 18. FE/BE migration gap inventory (что осталось перенести)

## Текущее покрытие BFF (оценка)

По состоянию текущей ветки критичные workflow и реестровые write-path уже заведены в BFF под feature-flag:

- workflow-мутации (`complete/rollback/review/request-decline/decline/return/restore/assign`),
- composition,
- floors/entrances,
- units/common areas,
- parking sync.

**Оценка прогресса миграции write-path:** ~88–92%.

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
