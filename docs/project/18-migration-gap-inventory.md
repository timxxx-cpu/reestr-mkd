# 18. FE/BE migration gap inventory (что осталось перенести)

## Текущее покрытие BFF (оценка)

По состоянию текущей ветки критичные workflow и реестровые write-path уже заведены в BFF под feature-flag:

- workflow-мутации (`complete/rollback/review/request-decline/decline/return/restore/assign`),
- composition,
- floors/entrances,
- units/common areas,
- parking sync.

**Оценка прогресса миграции write-path:** ~70–75%.

> Это инженерная оценка по текущему `ApiService` и включенным BFF веткам, а не формальная метрика релизного KPI.

## Что еще осталось перенести на Backend (приоритетно)

### P1 — операции создания/инициализации проекта

1. `createProjectFromApplication` (основной сценарий старта жизненного цикла)
2. Сопутствующие проверки/сайд-эффекты при создании проекта и заявки

Почему важно:
- это входная точка всего процесса,
- сейчас там есть значимый direct-write контур.

### P1 — интеграционные статусные мутации

1. `updateIntegrationStatus`
2. Специализированные update-операции по интеграции, которые пока идут напрямую в Supabase.

Почему важно:
- интеграционные статусы должны быть под единым backend error/audit контрактом.

### P2 — кадастровые point-updates

1. `updateBuildingCadastre`
2. `updateUnitCadastre`

Почему важно:
- небольшие, но частые мутации, которые лучше унифицировать в BFF для трассируемости.

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
2. Перевести `updateIntegrationStatus` на BFF endpoint.
3. Добавить BFF endpoints для `updateBuildingCadastre` / `updateUnitCadastre`.
4. После стабилизации — закрыть fallback для этих операций feature-флагами.

Этот пакет обычно закрывает основной остаток до фазы «direct-write off by default».
