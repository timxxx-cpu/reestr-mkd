# Полное описание структуры БД (DEV / Supabase / PostgreSQL)

Источник истины для схемы: `db/reset_schema.sql`.

## 1. Общие принципы

- Схема пересоздается destructive-скриптом (`drop ... cascade` + `create table ...`).
- Почти все PK — `uuid` с `gen_random_uuid()`.
- Таймстемпы: `created_at`, `updated_at` присутствуют в большинстве бизнес-таблиц.
- Для идемпотентных сохранений добавлены уникальности под upsert.
- В конце скрипта включается RLS и создаются DEV-policy с full access.

---

## 2. Доменные контуры

БД разбивается на 4 контура:

1. **Project/Application workflow**
2. **Buildings/Blocks/Tech characteristics**
3. **Floor inventory + units + common areas + parking levels**
4. **Catalogs (`dict_*`)**

---

## 3. CORE: проект и заявка

## 3.1 `projects`

Хранит «паспорт» проекта/ЖК.

Ключевые поля:

- `scope_id` — логическое разделение данных (в DEV используется общий scope).
- `name`, `region`, `district`, `address`, `landmark`.
- `cadastre_number`.
- `construction_status` (код статуса проекта).
- даты план/факт.
- `integration_data` JSONB — служебный контейнер интеграционных/доп. данных.

Индексы:

- `idx_projects_scope`
- `idx_projects_updated`

## 3.2 `applications`

Одна заявка на проект (`project_id unique`).

Поля процесса:

- `status` (`NEW`, `DRAFT`, `REVIEW`, ...)
- `current_step` (индекс шага)
- `current_stage` (этап workflow)
- `integration_data` (JSONB: в т.ч. причины возврата и пр.)

Служебные поля:

- `internal_number`, `external_source`, `external_id`, `applicant`, `assignee_name`.

Индексы:

- `idx_applications_scope`
- `idx_applications_project_scope`

## 3.3 `application_steps`

Фиксирует прогресс по шагам.

- `application_id`
- `step_index`
- `is_completed`
- `is_verified`

Ключевой инвариант:

- `unique(application_id, step_index)` — критично для upsert.

## 3.4 `application_history`

Журнал событий/переходов:

- `action`
- `prev_status` / `next_status`
- `user_name`
- `comment`
- `created_at`

Индекс: `idx_app_history_app_created`.

## 3.5 Вспомогательные проектные таблицы

### `project_participants`

Участники проекта (роль, имя, ИНН), `unique(project_id, role)`.

### `project_documents`

Документы проекта (тип, номер, дата, ссылка на файл).

---

## 4. Состав комплекса: здания и блоки

## 4.1 `buildings`

Объекты уровня «корпус/паркинг/инфраструктура».

Поля:

- `project_id`
- `label`, `house_number`, `category`
- `stage`
- `construction_type`, `parking_type`, `infra_type`
- `has_non_res_part`
- `cadastre_number`

## 4.2 `building_blocks`

Детализация здания на блоки.

Поля геометрии/конфигурации:

- `type` (Ж/Н/Parking/Infra)
- `floors_count`, `floors_from`, `floors_to`
- `entrances_count`, `elevators_count`
- `vehicle_entries`, `levels_depth`
- флаги `has_basement/attic/loft/roof_expl`
- `parent_blocks` (uuid[])

## 4.3 `block_construction` (1:1 с блоком)

- `foundation`, `walls`, `slabs`, `roof`, `seismicity`

## 4.4 `block_engineering` (1:1 с блоком)

Набор булевых флагов инженерных систем:

- electricity, water, hot water, sewerage, gas, heating, ventilation, firefighting, lowcurrent.

## 4.5 `basements`

Подвальные уровни, связь с `building_id` и `block_id`.

## 4.6 `basement_parking_levels`

Конфиг парковки по глубине подземных уровней.

Ключевой инвариант:

- `unique(basement_id, depth_level)`.

## 4.7 `block_floor_markers`

Маркерная модель виртуальных/особых этажей.

Поля:

- `marker_key`, `marker_type`, `floor_index`, `parent_floor_index`
- флаги technical/commercial

Инварианты:

- `unique(block_id, marker_key)`
- `check(marker_type in ('floor','technical','special','basement'))`

---

## 5. Инвентаризация этажей/помещений

## 5.1 `floors`

Этажи блока с расширенными флагами типа:

- `index`, `floor_key`, `label`, `floor_type`
- `height`, `area_proj`, `area_fact`
- `is_duplex`, `parent_floor_index`, `basement_id`
- флаги: technical/commercial/stylobate/basement/attic/loft/roof

Ключевой уникальный индекс:

- `uq_floors_block_idx_parent_basement_expr` по выражению:  
  `(block_id, index, coalesce(parent_floor_index,...), coalesce(basement_id,...))`

Это стабилизирует модель при null-значениях и защищает от дублей этажей.

## 5.2 `entrances`

Подъезды блока:

- `unique(block_id, number)`.

## 5.3 `entrance_matrix`

Матрица по этажу/подъезду:

- `block_id`, `floor_id`, `entrance_number`
- `flats_count`, `commercial_count`, `mop_count`

Ключевой инвариант:

- `unique(block_id, floor_id, entrance_number)`.

## 5.4 `units`

Помещения/юниты (квартиры, офисы, машиноместа и пр.):

- `floor_id`, `entrance_id`
- `number`, `unit_type`
- `total_area`, `living_area`, `useful_area`
- `rooms_count`, `status`, `cadastre_number`

Индексы:

- по `floor_id`, `entrance_id`, `unit_type`.

## 5.5 `rooms`

Экспликация/состав помещений внутри `unit`:

- `room_type`, `name`, `area`, `level`.

## 5.6 `common_areas`

МОП:

- `floor_id`, `entrance_id`, `type`, `area`.

---

## 6. Справочники `dict_*`

Таблицы-каталоги:

- `dict_project_statuses`
- `dict_application_statuses`
- `dict_external_systems`
- `dict_foundations`
- `dict_wall_materials`
- `dict_slab_types`
- `dict_roof_types`
- `dict_light_structure_types`
- `dict_parking_types`
- `dict_parking_construction_types`
- `dict_infra_types`
- `dict_mop_types`
- `dict_unit_types`
- `dict_room_types`
- `dict_system_users`

Общий паттерн: `code`, `label`, `sort_order`, `is_active`.

Особенности:

- для всех dict (кроме `dict_room_types`) через DO-блок добавляется `UNIQUE(code)`;
- `dict_room_types` имеет `unique(code, room_scope)` + checks на `room_scope`, `area_bucket`, `coefficient`;
- `dict_system_users` содержит check по ролям (`admin/controller/technician`).

---

## 7. Seed-данные

`reset_schema.sql` сразу заполняет минимальные справочники:

- статусы проекта и заявок;
- внешние системы;
- набор DEV-пользователей по ролям;
- типы юнитов/МОП/комнат;
- базовые конструктивные и инфраструктурные значения.

Все вставки идут с `ON CONFLICT DO NOTHING`, поэтому повторный запуск безопасен.

---

## 8. RLS в DEV

В конце скрипта:

- `grant usage on schema public to anon, authenticated`;
- `grant all on all tables/sequences ...`;
- включение RLS на всех таблицах;
- создание policy `anon_full_access` и `authenticated_full_access`.

Важно: это допустимо только в DEV-тесте. Для stage/prod нужны ограничительные политики.

---

## 9. Что критично для миграции на «чистый PostgreSQL»

1. Сохранить все уникальности, на которые завязан фронтовый upsert.
2. Сохранить структуру `integration_data` JSONB (или дать маппинг).
3. Не менять коды статусов без обновления мапперов UI↔DB.
4. Повторить/адаптировать RLS и grants под целевую безопасность окружения.
5. Прогнать smoke-тесты workflow после каждого изменения схемы.
