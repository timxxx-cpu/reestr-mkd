# 8. Маппинг UI ↔ DB, синхронизация и миграция

## UI -> DB (ключевые соответствия)

- `complexInfo` -> `projects` -> **Паспорт проекта**.
- `applicationInfo` -> `applications` -> **Статусы/шаги/этапы заявки**.
- `participants` -> `project_participants` -> **Участники проекта**.
- `documents` -> `project_documents` -> **Документы проекта**.
- `composition` -> `buildings` + `building_blocks` -> **Состав объектов**.
- `buildingDetails` -> `building_blocks` + `block_construction` + `block_engineering` + `basements` + `basement_parking_levels` + `block_floor_markers` -> **Параметры блоков**.
- `floorData` -> `floors` -> **Параметры этажей**.
- `entrancesData` -> `entrance_matrix` -> **Матрица подъезд/этаж**.
- `flatMatrix` -> `units` + `rooms` -> **Реестр помещений/экспликация**.
- `mopData` -> `common_areas` -> **МОП**.

## Синхронизация записей

- `saveData` пишет пакетами в бизнес-таблицы.
- `saveProjectImmediate` сериализует очередь сохранений.
- Post-sync:
  - `syncEntrances` обновляет `entrances` и чистит хвост в `entrance_matrix`;
  - sync floors from details пересобирает `floors` по конфигурации блока.

## Интеграция

- `applications.integration_data` -> **Служебные статусы интеграционных операций**.
- `buildings.cadastre_number` -> **Кадастровый номер здания**.
- `units.cadastre_number` -> **Кадастровый номер помещения**.

## Миграционные акценты

- `db/reset_schema.sql` = baseline схемы.
- Сохранить контракты имен полей БД/UI.
- DEV RLS-политики заменить на production-ограничения.
- Сохранить правила генерации уникальных кодов (`projects.uj_code`, `buildings.building_code`, `units.unit_code`).
