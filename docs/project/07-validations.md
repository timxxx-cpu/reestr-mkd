# 7. Валидации (с привязкой к полям БД/UI)

## Базовые правила

- `floors.height` (`floorData.height`) -> **Высота этажа в допустимом диапазоне**.
- `floors.area_proj` / `floors.area_fact` (`floorData.areaProj/areaFact`) -> **Контроль расхождения проект/факт**.
- `building_blocks.elevators_count` + этажность (`floors_to`/`floors_count`) -> **Проверка обязательности лифта**.
- `common_areas.type` + `common_areas.area` (`mopData`) -> **Полнота МОП**.
- `units.number` + `units.unit_type` (`flatMatrix`) -> **Нумерация и корректность типов помещений**.

## Шаговые проверки

- `composition` -> `buildings.category` -> **В проекте должен быть жилой объект**.
- `registry_*` -> `building_blocks`, `block_construction`, `block_engineering` -> **Полнота конфигурации блока**.
- `floors` -> `floors.*` -> **Полнота этажной инвентаризации**.
- `entrances` -> `entrances` + `entrance_matrix` -> **Заполненность матрицы подъездов**.
- `apartments` -> `units` + `rooms` -> **Корректность реестра помещений и экспликации**.
- `mop` -> `common_areas` + `entrance_matrix.mop_count` -> **Соответствие количества и состава МОП**.
- `parking_config` -> `basements/basement_parking_levels/units(unit_type=parking_place)` -> **Корректность паркинга**.

Если правило не выполнено, workflow не переводит `applications.current_step` на следующий шаг.
