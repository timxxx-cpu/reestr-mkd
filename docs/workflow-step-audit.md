# Workflow audit (шаги 1–17)

Аудит сделан по связке `App.jsx -> компонент шага -> hooks/api -> ApiService -> Supabase`.

| # | Step ID | UI/Компонент | Чтение из БД | Запись в БД | Статус | Комментарий |
|---|---|---|---|---|---|---|
| 1 | `passport` | `PassportEditor` | `projects`, `project_participants`, `project_documents` через `getProjectDetails` | `projects` через `updateProjectInfo` | ✅ OK | Добавлены недостающие методы `ApiService`, иначе шаг 1 ломался при вызове `updateProjectInfo`. |
| 2 | `composition` | `CompositionEditor` | `buildings`, `building_blocks` через `getBuildings` | `buildings`, `building_blocks` через `createBuilding/updateBuilding/deleteBuilding` | ✅ OK | CRUD работает через `useDirectBuildings`. |
| 3 | `registry_nonres` | `BuildingSelector` → `BuildingConfigurator(mode=nonres)` | Контекст проекта (`getProjectFullData`), в т.ч. `buildings`, `building_blocks`, `block_*`, `floors`, `basements` | `building_blocks`, `block_construction`, `block_engineering`, `basements`, `basement_parking_levels` через `saveData` | ✅ OK | Сохраняется при `saveProjectImmediate`/завершении шага. |
| 4 | `registry_res` | `BuildingSelector` → `BuildingConfigurator(mode=res)` | То же, что шаг 3 | То же, что шаг 3 | ✅ OK | Логика аналогична нежилому конфигу. |
| 5 | `floors` | `FloorMatrixEditor` | `floors` через `getFloors` | `floors` через `updateFloor/generateFloors` | ✅ OK | Прямые методы API (без legacy-буфера). |
| 6 | `entrances` | `EntranceMatrixEditor` | `entrances`, `entrance_matrix`, `floors` | `entrance_matrix` (`upsertMatrixCell`), `entrances` (`syncEntrances`) | ✅ OK | Матрица и подъезды синхронизируются напрямую. |
| 7 | `apartments` | `FlatMatrixEditor` | `floors`, `entrances`, `entrance_matrix`, `units`, `rooms` | `units`, `rooms` (`upsertUnit`, `batchUpsertUnits`) | ✅ OK | Нумерация/типизация квартир сохраняется напрямую. |
| 8 | `mop` | `MopEditor` | `floors`, `entrances`, `entrance_matrix`, `common_areas` | `common_areas` (`upsert/delete/clear`) | ✅ OK | МОП привязаны к floor/entrance. |
| 9 | `parking_config` | `ParkingConfigurator` | `basements`, `basement_parking_levels`, `floors`, `units` (подсчет парковок) | `basement_parking_levels`, `units` (синхронизация машиномест) | ✅ OK | Генерация/удаление машиномест через `syncParkingPlaces`. |
| 10 | `registry_apartments` | `UnitRegistry(mode=apartments)` | `getProjectFullRegistry` (агрегат проекта) | `upsertUnit` для инвентаризации | ✅ OK | Реестр строится из общего регистра. |
| 11 | `registry_commercial` | `UnitRegistry(mode=commercial)` | `getProjectFullRegistry` | `upsertUnit` | ✅ OK | Нежилые юниты/инвентаризация. |
| 12 | `registry_parking` | `UnitRegistry(mode=parking)` | `getProjectFullRegistry` | `upsertUnit` | ✅ OK | Реестр машиномест. |
| 13 | `integration_buildings` | `IntegrationBuildings` | `getIntegrationStatus`, `getBuildings`/registry | `updateIntegrationStatus`, `updateBuildingCadastre` | ✅ OK | Кадастровые номера зданий пишутся в `buildings`. |
| 14 | `integration_units` | `IntegrationUnits` | `getIntegrationStatus`, `getProjectFullRegistry` | `updateIntegrationStatus`, `updateUnitCadastre` | ✅ OK | Кадастровые номера помещений пишутся в `units`. |
| 15 | `registry_nonres_view` | `RegistryView(mode=nonres)` | Агрегаты из контекста/реестра (`getProjectFullRegistry`) | Нет | ✅ OK | Просмотровый шаг (сводная). |
| 16 | `registry_res_view` | `RegistryView(mode=res)` | Агрегаты из контекста/реестра (`getProjectFullRegistry`) | Нет | ✅ OK | Просмотровый шаг (сводная). |
| 17 | `summary` | `SummaryDashboard` | `getProjectFullRegistry` + `complexInfo` | Нет | ✅ OK | Аналитический слой, без записи в БД. |

## Критичные исправления в рамках этого прохода

1. Добавлены отсутствующие методы `ApiService`, используемые шагом 1 (`passport`):
   - `getProjectDetails`
   - `updateProjectInfo`
   - `upsertParticipant`
   - `upsertDocument`
   - `deleteDocument`
   - `createProject` (совместимость для старых экранов)

2. Подтверждено, что Workflow-статус/шаг/этап сохраняются даже при отсутствии строки `applications` (предыдущее исправление), поэтому переходы между шагами не теряют состояние.
