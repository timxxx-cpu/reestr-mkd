# 16. Backend migration — план следующего этапа

## Контекст

Текущий этап: Iteration 1-3 по P0 уже реализованы (locks + ключевые workflow endpoints), frontend частично работает через feature-flagged BFF-пути.

Цель следующего этапа: перевести критичные write-path реестровых данных на backend и сократить direct-write из frontend до минимума.

---

## 1) Приоритеты (в порядке выполнения)

1. **P1 Registry Core на backend**
   - здания/блоки,
   - этажи,
   - подъезды,
   - помещения/экспликация,
   - МОП.
2. **Унификация контрактов DTO**
   - стабилизация request/response схем,
   - выравнивание DB↔BFF↔UI маппинга.
3. **Снижение legacy direct-write в frontend**
   - флагами переключить сохранение модулей на BFF,
   - оставить временно только fallback-read where needed.
4. **Надежность и наблюдаемость**
   - idempotency на write-операциях,
   - аудит + request tracing + error contract.

---

## 2) Ближайшие 3 итерации

## Iteration 4 (1–2 недели): Registry foundation

### Backend
- Добавить endpoints `projects/:id/buildings` (create/update/delete).
- Добавить endpoints `buildings/:id/blocks` (upsert/batch-update).
- Вынести серверные zod-схемы для payload-валидации.
- Обернуть write-операции в транзакции.

### Frontend
- Добавить BFF-клиент для composition-сценариев.
- Включить feature-flag `FF_USE_BFF_COMPOSITION`.
- Сохранить fallback на legacy путь только для DEV rollback.

### Definition of Done
- 100% save-операций на шаге composition проходят через BFF при включенном флаге.
- Логи backend содержат `requestId`, `applicationId`, `userId`.

---

## Iteration 5 (1–2 недели): Floors + Entrances

### Backend
- Добавить endpoints для пакетной записи этажей и матрицы подъездов.
- Реализовать reconciliation-логику (insert/update/delete за один запрос).
- Добавить серверную валидацию инвариантов (дубли, диапазоны, обязательные поля).

### Frontend
- Вынести save floors/entrances в единый adapter слой.
- Включить feature-flags:
  - `FF_USE_BFF_FLOORS`
  - `FF_USE_BFF_ENTRANCES`

### Definition of Done
- Write-path по `floors` и `entrances` не использует direct Supabase при активных флагах.
- Smoke-сценарий «создать этажи → создать подъезды → сохранить» стабильно проходит.

---

## Iteration 6 (2 недели): Units + MOP + hardening

### Backend
- Добавить endpoints для units/rooms/common_areas.
- Поддержать batch upsert + soft-delete/physical-delete по согласованным правилам.
- Нормализовать модель ошибок: `code/message/details/requestId`.

### Frontend
- Переключить save-операции apartments + mop на BFF.
- Добавить централизованный обработчик backend-ошибок.
- Подготовить выключение legacy write-path (по модульным флагам).

### Definition of Done
- Критичные реестровые write-path полностью маршрутизируются через backend.
- Direct-write остается только как временный аварийный fallback (отключаемый конфигом).

---

## 3) Технический backlog (детализация)

## 3.1 Backend (обязательно)

- [ ] Ввести модульную структуру `modules/registry/*` с use-case слоями.
- [ ] Добавить интеграционные тесты на тестовом Postgres-контуре.
- [ ] Добавить idempotency-key для batch-мутаций.
- [ ] Ввести audit events для операций массового редактирования.
- [ ] Уточнить и зафиксировать RBAC-правила по endpoint-ам registry.

## 3.2 Frontend (обязательно)

- [ ] Консолидировать все write-вызовы в data-access adapter.
- [ ] Для каждого модуля добавить отдельный feature-flag.
- [ ] Добавить fallback-policy: когда допускается legacy путь, когда нет.
- [ ] Логировать источник сохранения (`bff` / `legacy`) для DEV-диагностики.

## 3.3 Data/DB

- [ ] Проверить индексы на таблицах реестра под batch write/read.
- [ ] Уточнить правила delete-каскадов для registry сущностей.
- [ ] Подготовить SQL-checklist для parity-проверок при переключении.

---

## 4) Риски и контрольные меры

1. **Риск несовместимости payload-форматов**
   - Мера: контрактные тесты + версионирование DTO.
2. **Риск race-condition при параллельном редактировании**
   - Мера: lock-aware write, транзакции, проверка owner lock.
3. **Риск «тихих» расхождений legacy vs BFF**
   - Мера: shadow-check для read (сравнение старого/нового ответа в DEV).
4. **Риск замедления UI из-за backend hops**
   - Мера: batch endpoints, pagination, профилирование медленных запросов.

---

## 5) Критерии готовности к этапу «отключаем direct write»

Переход к отключению direct write из frontend выполняется, если одновременно выполнены условия:

1. Для `composition/floors/entrances/apartments/mop` write-path идет через BFF.
2. Ошибки backend нормализованы и корректно отображаются в UI.
3. Интеграционные тесты backend + smoke frontend стабильны минимум 1 релизный цикл.
4. Есть rollback-план (флаговый откат) и parity-check отчеты.

---

## 6) Что делаем прямо сейчас (next actions)

1. Зафиксировать API-контракты Iteration 4 для `buildings/blocks`.
2. Реализовать в backend первые registry endpoints + транзакции.
3. Подключить frontend adapter для composition под feature-flag.
4. Прогнать smoke по сценарию редактирования состава объекта.
5. Обновить документацию (`08`, `13`, `14`, текущий раздел `16`) по факту внедрения.

Это даст следующий ощутимый шаг миграции: перенос первого крупного P1-вертикального среза (composition) на backend без остановки разработки.


---

## 7) Статус выполнения (текущий прогресс)

- ✅ Старт Iteration 4: реализованы BFF endpoints для composition (`GET/POST /projects/:id/buildings`, `PUT/DELETE /buildings/:id`).
- ✅ Frontend `ApiService` переключает операции `getBuildings/createBuilding/updateBuilding/deleteBuilding` на BFF при `VITE_BFF_ENABLED=true` и `VITE_BFF_COMPOSITION_ENABLED=true`.
- ✅ Сохранен безопасный fallback на legacy Supabase-путь при выключенном feature-flag.
- ✅ Синхронизировано поведение create-building в BFF с legacy: добавлена генерация `building_code` по UJ-схеме проекта.
- ✅ В composition UI прокинут реальный `actor` (`userName/userRole`) в create/update/delete мутации для корректного RBAC и аудита на backend.
- ✅ Для `PUT /api/v1/buildings/:buildingId` добавлен reconciliation блоков (`insert/update/delete`) через `blocksData`, чтобы обновление состава блоков шло через BFF.
- ✅ Iteration 5 (частично): добавлены BFF endpoints для floors/entrances (`PUT /floors/:id`, `POST /blocks/:id/floors/reconcile`, `PUT /blocks/:id/entrance-matrix/cell`, `POST /blocks/:id/entrances/reconcile`).
- ✅ Frontend `ApiService` переключает write-path для `updateFloor/generateFloors/upsertMatrixCell/syncEntrances` на BFF при флагах `VITE_BFF_FLOORS_ENABLED=true` и `VITE_BFF_ENTRANCES_ENABLED=true`.
- ✅ Для floors/entrances сохранен fallback на legacy Supabase путь при выключенных модульных флагах.
- ✅ В `ApiService` для floors/entrances при BFF-пути добавлена подстановка `actor` из контекста/`AuthService` (для корректного RBAC и аудита без ручной прокладки в каждый вызов).
- ✅ Для floors/entrances read-path (`getFloors/getEntrances/getMatrix`) также переключен на BFF при активных флагах с сохранением legacy fallback.
- ✅ Добавлены BFF read-endpoints для `units` и `common_areas` и включено флаговое чтение в frontend (`VITE_BFF_UNITS_ENABLED`, `VITE_BFF_MOP_ENABLED`) с legacy fallback.
- ✅ MOP write-path (`upsertCommonArea/deleteCommonArea/clearCommonAreas`) переведен на BFF при `VITE_BFF_MOP_ENABLED=true` с legacy fallback.
- ✅ Units write-path (`upsertUnit/batchUpsertUnits`) переключен на BFF при `VITE_BFF_UNITS_ENABLED=true` с legacy fallback.
- ✅ Reconcile операции `reconcileUnitsForBlock/reconcileCommonAreasForBlock` переведены на BFF (флаги `VITE_BFF_UNITS_ENABLED` / `VITE_BFF_MOP_ENABLED`) с legacy fallback.
- ✅ Деталка экспликации `getUnitExplicationById` переключена на BFF при `VITE_BFF_UNITS_ENABLED=true` с legacy fallback.
- ✅ В `useDirect*` hooks добавлена явная передача `actor` в registry-мутации, чтобы BFF вызовы не опирались только на fallback и стабильно сохраняли корректный RBAC/audit контекст.
- ✅ Дополнительно в редакторах/контексте (вне `useDirect*`) прокинут явный `actor` в массовые reconcile/batch мутации (`FlatMatrix`, `EntranceMatrix`, `MopEditor`, `ParkingRegistry`, `ProjectContext`).
- ✅ В `registry/views/*` и `UnitRegistry` добавлена явная передача `actor` в `upsertUnit`/fallback upsert-вызовы для полного покрытия units-мутаций на UI-слое.
- ✅ Parking sync/read (`getParkingCounts/syncParkingPlaces`) переключены на BFF при `VITE_BFF_PARKING_ENABLED=true` с legacy fallback.
- ✅ Для registry batch/reconcile write-path добавлен idempotency слой в BFF (через `x-idempotency-key`, in-memory TTL cache) для защиты от дублей; reuse ключа с другим payload теперь возвращает `409 IDEMPOTENCY_CONFLICT`.
- ✅ Idempotency расширен на ключевые workflow endpoint-ы BFF (`complete-step`, `rollback-step`, `review-approve`, `review-reject`, `assign-technician`, `request-decline`, `decline`, `return-from-decline`, `restore`) с тем же контрактом `x-idempotency-key` + `409 IDEMPOTENCY_CONFLICT` при payload mismatch.
- ✅ Frontend `BffClient` расширен: `idempotencyKey` теперь прокидывается в `requestDecline/returnFromDecline/restoreApplication`, чтобы все покрытые workflow-мутации могли стабильно использовать header-контракт `x-idempotency-key`.


- ✅ В `ApiService` добавлена автогенерация idempotency-key для workflow BFF-мутаций (и прокидка в `assignTechnician`), чтобы UI не зависел от ручной передачи ключа в каждом вызове.
- ✅ Добавлены backend endpoint-ы для integration/cadastre операций: `GET/PUT /projects/:id/integration-status`, `PUT /buildings/:id/cadastre`, `PUT /units/:id/cadastre`.
- ✅ `ApiService` переключает `getIntegrationStatus/updateIntegrationStatus` на BFF при `VITE_BFF_INTEGRATION_ENABLED=true` (с legacy fallback).
- ✅ `ApiService` переключает `updateBuildingCadastre/updateUnitCadastre` на BFF при `VITE_BFF_CADASTRE_ENABLED=true` (с legacy fallback).
- ✅ Добавлен backend endpoint `POST /projects/from-application` и frontend-switch в `ApiService.createProjectFromApplication` при `VITE_BFF_PROJECT_INIT_ENABLED=true` (с сохранением legacy fallback).
- ✅ Для `POST /projects/from-application` добавлена idempotency-защита (`x-idempotency-key`) от дублей создания проекта при ретраях/повторных кликах.
- ✅ Для `POST /projects/from-application` добавлен backend-side вызов инициализации pending versions (guarded через `VERSIONING_ENABLED`), чтобы закрыть остаток версиирования в backend-контуре.
- ✅ Для project-init добавлен optional RPC-режим (`PROJECT_INIT_RPC_ENABLED`) через SQL function `init_project_from_application`, что дает transaction boundary на уровне Postgres с fallback на текущий direct path.
