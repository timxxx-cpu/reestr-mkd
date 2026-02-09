# 1. Обзор проекта и архитектура

## Назначение

Система ведет реестр МКД и процесс обработки заявок:
- паспорт объекта,
- состав зданий и блоков,
- инвентаризация этажей/подъездов/помещений/МОП,
- интеграционные кадастровые операции.

## Базовые сущности (БД -> UI -> русское значение)

- `projects` -> `complexInfo/cadastre` -> **Карточка проекта (ЖК)**.
- `applications` -> `applicationInfo` -> **Заявка и ее workflow-состояние**.
- `buildings` + `building_blocks` -> `composition` -> **Состав объектов и блоков**.
- `floors` -> `floorData` -> **Этажная структура и параметры этажей**.
- `entrances` + `entrance_matrix` -> `entrancesData` -> **Подъезды и плановые матрицы по этажам**.
- `units` + `rooms` -> `flatMatrix` -> **Реестр помещений и экспликация**.
- `common_areas` -> `mopData` -> **Места общего пользования**.

## Архитектурные слои

1. UI-слой (редакторы шагов).
2. Project Context:
   - data-layer (агрегация и read-only),
   - sync-layer (очередь сохранений),
   - workflow-layer (переходы статусов/шагов/этапов).
3. ApiService (чтение/запись PostgreSQL).
4. db-mappers (snake_case БД -> camelCase UI).
5. validators/state-machine (проверки и правила workflow).

## Загрузка и сохранение (обобщение)

- Загрузка проекта читает таблицы: `projects`, `applications`, `application_history`, `application_steps`, `project_participants`, `project_documents`, `buildings`, `building_blocks`, `block_construction`, `block_engineering`, `floors`, `entrances`, `entrance_matrix`, `units`, `rooms`, `common_areas`, `basements`, `basement_parking_levels`.
- Сохранение делает обратный маппинг UI -> БД по тем же сущностям.
