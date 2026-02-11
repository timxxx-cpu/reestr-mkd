# 6. Пошаговый рабочий процесс

## 1) Вход

- Источник: `dict_system_users` (`name`, `role`, `group_name`) -> **Пользователь и роль в UI**.

## 2) Создание/загрузка проекта

- Создание: `projects` + `applications`.
- Загрузка: чтение полного агрегата из таблиц проекта/заявки/состава/реестров.

## 3) Паспорт (`passport`)

- `projects.name` -> **Наименование ЖК**.
- `projects.construction_status` -> **Статус проекта**.
- `projects.address` -> **Адрес проекта**.
- `projects.cadastre_number` -> **Кадастровый номер ЖК**.
- `project_participants.role/name/inn` -> **Участники и реквизиты**.
- `project_documents.name/doc_type/doc_number/doc_date/file_url` -> **Документы проекта**.

## 4) Состав (`composition`)

- `buildings.label/category/house_number/...` -> **Здание в составе проекта**.
- `building_blocks.label/type` -> **Блок внутри здания**.

## 5) Конфигурации (`registry_res`, `registry_nonres`)

- `building_blocks` (этажность, подъезды, признаки) -> **Параметры блока**.
- `block_construction.*` -> **Конструктив блока**.
- `block_engineering.*` -> **Инженерное оснащение блока**.
- `basements` + `basement_parking_levels` -> **Подвальные уровни и паркинг**.
- `application_steps.block_statuses` -> **Статус заполнения блоков по шагу** (обновляется по кнопке «Сохранить» на уровне выбранного здания).

## 6) Этажи (`floors`)

- `floors.height/area_proj/area_fact/floor_type/...` -> **Инвентаризация этажей**.

## 7) Подъезды (`entrances`)

- `entrances.number` -> **Номера подъездов**.
- `entrance_matrix.flats_count/commercial_count/mop_count` -> **План по этажу и подъезду**.

## 8) Помещения (`apartments`)

- `units.number/unit_type/total_area/...` -> **Реестр помещений**.
- `rooms.room_type/name/area/level` -> **Экспликация помещения**.

## 9) МОП (`mop`)

- `common_areas.type/area` -> **Параметры мест общего пользования**.

## 10) Паркинг (`parking_config`)

- `basement_parking_levels.is_enabled` -> **Активность уровня паркинга**.
- `units.unit_type='parking_place'` -> **Машиноместа**.

## 11) Проверка контролером

- `applications.status/current_step/current_stage` -> **Смена состояния workflow**.
- `application_history.*` -> **Фиксация решения/комментария**.
- `application_steps.*` -> **Фиксация completed/verified**.

## 12) Локальное сохранение статусов заполнения блоков (новый подпроцесс)

Для шагов, где участвуют блоки (`registry_nonres`, `registry_res`, `floors`, `entrances`, `apartments`, `mop`):

1. Пользователь открывает редактор конкретного здания.
2. Нажимает кнопку **«Сохранить»** в шапке редактора.
3. Клиент запускает те же правила step-валидации, что и при `COMPLETE_STEP`, но только для блоков выбранного здания.
4. По результату формируются статусы блоков (`Заполнено` / `Не заполнено` / `Заполнено частично`).
5. Результат сохраняется в `application_steps.block_statuses` для текущего `step_index`.
6. В списке зданий на шаге отображается отдельная колонка **«Статус заполнения»**.