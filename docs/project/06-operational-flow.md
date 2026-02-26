# 6. Пошаговый рабочий процесс

## 1) Вход

- Источник: `dict_system_users` (`name`, `role`, `group_name`) -> **Пользователь и роль в UI**.

## 2) Создание/загрузка проекта

- Создание: `projects` + `applications`.
- Загрузка: чтение полного агрегата из таблиц проекта/заявки/состава/реестров.

## 2.1) Навигация по экранам

- **Рабочий стол**: текущие заявления в обработке.
- **Реестр**: закрытые записи в двух режимах:
  - `Заявления` — статусы `COMPLETED` и `DECLINED`;
  - `Жилые комплексы` — только `COMPLETED`.
- **Администрирование**: редактирование справочников.

Дополнительно:
- Переключение между этими экранами выполняется через dropdown-переключатель в шапке.
- Фильтры (по исполнителю/статусам/типу реестра) и сервисные действия (эмуляция входящих) находятся в правой сворачиваемой панели.

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
- `building_blocks` (`is_basement_block`, `linked_block_ids`, `basement_depth`, `basement_parking_levels`, `basement_communications`) -> **Подвальные уровни, связи и паркинг**.
- `application_steps.block_statuses` -> **Статус заполнения блоков по шагу** (обновляется по кнопке «Сохранить» на уровне выбранного здания).

## 6) Инвентаризация подвалов (`basement_inventory`)

- `building_blocks` (`is_basement_block=true`) -> **Карточки подвалов**.
- `building_blocks.linked_block_ids` -> **Какие блоки обслуживает подвал**.
- `building_blocks.basement_depth` -> **Глубина подвала**.
- `building_blocks.basement_communications` -> **Инженерные коммуникации подвала**.
- `building_blocks.entrances_count` -> **Количество входов в подвал (1..10)**.

## 7) Этажи (`floors`)

- `floors.height/area_proj/area_fact/floor_type/...` -> **Инвентаризация этажей**.

## 8) Подъезды (`entrances`)

- `entrances.number` -> **Номера подъездов**.
- `entrance_matrix.flats_count/commercial_count/mop_count` -> **План по этажу и подъезду**.

## 9) Помещения (`apartments`)

- `units.number/unit_type/total_area/...` -> **Реестр помещений**.
- `rooms.room_type/name/area/level` -> **Экспликация помещения**.

## 10) МОП (`mop`)

- `common_areas.type/area` -> **Параметры мест общего пользования**.

## 11) Паркинг (`parking_config`)

- `building_blocks.basement_parking_levels` -> **Активность уровней паркинга по глубине**.
- `units.unit_type='parking_place'` -> **Машиноместа**.

## 12) Проверка контролером

- `applications.status/current_step/current_stage` -> **Смена состояния workflow**.
- `application_history.*` -> **Фиксация решения/комментария**.
- `application_steps.*` -> **Фиксация completed/verified**.

## 13) Локальное сохранение статусов заполнения блоков (новый подпроцесс)

Для шагов, где участвуют блоки (`registry_nonres`, `registry_res`, `floors`, `entrances`, `apartments`, `mop`):

1. Пользователь открывает редактор конкретного здания.
2. Нажимает кнопку **«Сохранить»** в шапке редактора.
3. Клиент запускает те же правила step-валидации, что и при `COMPLETE_STEP`, но только для блоков выбранного здания.
4. По результату формируются статусы блоков (`Заполнено` / `Не заполнено` / `Заполнено частично`).
5. Результат сохраняется в `application_steps.block_statuses` для текущего `step_index`.
6. В списке зданий на шаге отображается отдельная колонка **«Статус заполнения»**.
