# 26. Геометрия ЖК и зданий (PostGIS + MapLibre) — план и реализация

## Цель

Добавить пространственный контур проекта:
- выбор земельного участка ЖК из SHP-кандидатов на шаге `passport`;
- обязательную привязку геометрии каждому зданию на шаге `composition`;
- хранение геометрий в PostGIS (SRID 3857, MultiPolygon);
- backend валидации топологии и площадей.

## Пофайловый план внедрения

### DDL / БД
- `db/reset_schema.sql`
  - подключение `postgis`;
  - поля в `projects`: `land_plot_geojson`, `land_plot_geom`, `land_plot_area_m2`;
  - поля в `buildings`: `footprint_geojson`, `building_footprint_geom`, `building_footprint_area_m2`, `geometry_candidate_id`;
  - новая таблица `project_geometry_candidates`;
  - GIST-индексы;
  - SQL functions:
    - `upsert_project_geometry_candidate`
    - `set_project_land_plot_from_candidate`
    - `assign_building_geometry_from_candidate`

### Backend API
- `apps/backend/src/project-extended-routes.js`
  - `GET /api/v1/projects/:projectId/geometry-candidates`
  - `POST /api/v1/projects/:projectId/geometry-candidates/import`
  - `POST /api/v1/projects/:projectId/land-plot/select`
  - расширение `GET/PUT /api/v1/projects/:projectId/passport` данными геометрии/площади.

- `apps/backend/src/composition-routes.js`
  - отдача геометрических полей здания;
  - обязательная проверка `geometryCandidateId` при создании;
  - назначение геометрии через RPC;
  - топологическая проверка в БД: `ST_CoveredBy` + запрет overlap (кроме `ST_Touches`).

### Frontend
- `src/features/steps/passport/PassportEditor.jsx`
  - импорт SHP ZIP (`shpjs`), отправка кандидатов в backend;
  - карта MapLibre и выбор одного полигона участка;
  - сохранение площади участка.

- `src/features/steps/composition/CompositionEditor.jsx`
  - карта кандидатов и обязательный выбор полигона для здания;
  - передача `geometryCandidateId` в create/update здания.

- Новые утилиты:
  - `src/components/maps/GeometryPickerMap.jsx`
  - `src/lib/geometry-utils.js`

- Клиент API:
  - `src/lib/bff-client.js`
  - `src/lib/api/project-domain.js`
  - `src/lib/db-mappers.js`

### Тесты
- backend route-тесты на:
  - импорт кандидатов,
  - выбор land plot,
  - запрет создания здания без geometry candidate,
  - топологические ошибки (outside/intersection).
- frontend smoke на наличие map flow в `passport`/`composition`.

## Порядок внедрения
1. DDL + функции PostGIS.
2. Backend endpoints и server-side валидации.
3. Frontend map flow и SHP import.
4. Интеграционные и smoke-тесты.
5. Документация и финальная синхронизация.

## Статус
- Реализация выполнена в рамках текущей итерации; требуется регрессионный прогон CI на полном контуре.
