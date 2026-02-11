# 3. ER-связи и целостность данных

## 3.1 Полная схема связей

### Иерархия CORE (Проект и Заявка)

```
projects (1) ──┬── (1) applications
               │
               ├── (N) project_participants
               │
               ├── (N) project_documents
               │
               └── (N) buildings
```

**Описание связей**:
1. `projects.id` ← `applications.project_id` **(1:1, UNIQUE)**
   - Тип связи: Один-к-одному
   - FK: `applications.project_id` REFERENCES `projects(id)` ON DELETE CASCADE
   - Уникальность: `applications.project_id` UNIQUE
   - **Смысл**: Один проект имеет ровно одну активную заявку
   
2. `projects.id` ← `project_participants.project_id` **(1:N)**
   - Тип связи: Один-ко-многим
   - FK: `project_participants.project_id` REFERENCES `projects(id)` ON DELETE CASCADE
   - Уникальность: UNIQUE(`project_id`, `role`)
   - **Смысл**: У проекта может быть несколько участников, каждый с уникальной ролью
   
3. `projects.id` ← `project_documents.project_id` **(1:N)**
   - Тип связи: Один-ко-многим
   - FK: `project_documents.project_id` REFERENCES `projects(id)` ON DELETE CASCADE
   - **Смысл**: У проекта может быть множество документов
   
4. `projects.id` ← `buildings.project_id` **(1:N)**
   - Тип связи: Один-ко-многим
   - FK: `buildings.project_id` REFERENCES `projects(id)` ON DELETE CASCADE
   - **Смысл**: Проект включает одно или несколько зданий

### Иерархия WORKFLOW (История заявки)

```
applications (1) ──┬── (N) application_history
                   │
                   └── (N) application_steps
```

**Описание связей**:
1. `applications.id` ← `application_history.application_id` **(1:N)**
   - Тип связи: Один-ко-многим
   - FK: `application_history.application_id` REFERENCES `applications(id)` ON DELETE CASCADE
   - **Смысл**: Заявка имеет журнал всех действий и переходов
   
2. `applications.id` ← `application_steps.application_id` **(1:N)**
   - Тип связи: Один-ко-многим
   - FK: `application_steps.application_id` REFERENCES `applications(id)` ON DELETE CASCADE
   - Уникальность: UNIQUE(`application_id`, `step_index`)
   - **Смысл**: Заявка имеет набор шагов с флагами выполнения/проверки и шаговыми JSON-статусами заполнения блоков (`block_statuses`)

### Иерархия BUILDINGS (Здания и блоки)

```
buildings (1) ──┬── (N) building_blocks ──┬── (1) block_construction
                │                          │
                │                          ├── (1) block_engineering
                │                          │
                │                          ├── (N) floors
                │                          │
                │                          ├── (N) entrances
                │                          │
                │                          └── (N) block_floor_markers
                │
                └── (N) basements ──── (N) basement_parking_levels
```

**Описание связей**:
1. `buildings.id` ← `building_blocks.building_id` **(1:N)**
   - Тип связи: Один-ко-многим
   - FK: `building_blocks.building_id` REFERENCES `buildings(id)` ON DELETE CASCADE
   - **Смысл**: Здание состоит из одного или нескольких блоков
   
2. `building_blocks.id` ← `block_construction.block_id` **(1:1)**
   - Тип связи: Один-к-одному
   - FK: `block_construction.block_id` REFERENCES `building_blocks(id)` ON DELETE CASCADE
   - Уникальность: `block_construction.block_id` UNIQUE
   - **Смысл**: Каждый блок имеет один набор конструктивных характеристик
   
3. `building_blocks.id` ← `block_engineering.block_id` **(1:1)**
   - Тип связи: Один-к-одному
   - FK: `block_engineering.block_id` REFERENCES `building_blocks(id)` ON DELETE CASCADE
   - Уникальность: `block_engineering.block_id` UNIQUE
   - **Смысл**: Каждый блок имеет один набор инженерных систем
   
4. `building_blocks.id` ← `floors.block_id` **(1:N)**
   - Тип связи: Один-ко-многим
   - FK: `floors.block_id` REFERENCES `building_blocks(id)` ON DELETE CASCADE
   - **Смысл**: Блок содержит множество этажей
   
5. `building_blocks.id` ← `entrances.block_id` **(1:N)**
   - Тип связи: Один-ко-многим
   - FK: `entrances.block_id` REFERENCES `building_blocks(id)` ON DELETE CASCADE
   - Уникальность: UNIQUE(`block_id`, `number`)
   - **Смысл**: Блок имеет несколько подъездов с уникальными номерами
   
6. `building_blocks.id` ← `block_floor_markers.block_id` **(1:N)**
   - Тип связи: Один-ко-многим
   - FK: `block_floor_markers.block_id` REFERENCES `building_blocks(id)` ON DELETE CASCADE
   - Уникальность: UNIQUE(`block_id`, `marker_key`)
   - **Смысл**: Блок имеет маркеры для конфигурации этажей
   
7. `buildings.id` ← `basements.building_id` **(1:N)**
   - Тип связи: Один-ко-многим
   - FK: `basements.building_id` REFERENCES `buildings(id)` ON DELETE CASCADE
   - **Смысл**: Здание может иметь подвалы
   
8. `building_blocks.id` ← `basements.block_id` **(1:N)**
   - Тип связи: Один-ко-многим
   - FK: `basements.block_id` REFERENCES `building_blocks(id)` ON DELETE CASCADE
   - **Смысл**: Блок может иметь подвалы
   
9. `basements.id` ← `basement_parking_levels.basement_id` **(1:N)**
   - Тип связи: Один-ко-многим
   - FK: `basement_parking_levels.basement_id` REFERENCES `basements(id)` ON DELETE CASCADE
   - Уникальность: UNIQUE(`basement_id`, `depth_level`)
   - **Смысл**: Подвал имеет конфигурацию уровней для паркинга

### Иерархия FLOORS и UNITS (Этажи и помещения)

```
floors (1) ──┬── (N) units ──── (N) rooms
             │
             ├── (N) common_areas
             │
             └── (N) entrance_matrix

entrances (1) ──┬── (N) units (optional)
                │
                └── (N) common_areas (optional)

basements (1) ──── (N) floors (optional)
```

**Описание связей**:
1. `floors.id` ← `entrance_matrix.floor_id` **(1:N)**
   - Тип связи: Один-ко-многим
   - FK: `entrance_matrix.floor_id` REFERENCES `floors(id)` ON DELETE CASCADE
   - Уникальность: UNIQUE(`block_id`, `floor_id`, `entrance_number`)
   - **Смысл**: Этаж имеет матрицу планирования по подъездам
   
2. `floors.id` ← `units.floor_id` **(1:N)**
   - Тип связи: Один-ко-многим
   - FK: `units.floor_id` REFERENCES `floors(id)` ON DELETE CASCADE
   - **Смысл**: На этаже расположено множество помещений
   
3. `entrances.id` ← `units.entrance_id` **(1:N, OPTIONAL)**
   - Тип связи: Один-ко-многим (опциональная)
   - FK: `units.entrance_id` REFERENCES `entrances(id)` ON DELETE SET NULL
   - **Смысл**: Помещение может быть привязано к подъезду (NULL для общих помещений)
   
4. `units.id` ← `rooms.unit_id` **(1:N)**
   - Тип связи: Один-ко-многим
   - FK: `rooms.unit_id` REFERENCES `units(id)` ON DELETE CASCADE
   - **Смысл**: Помещение имеет экспликацию (разбивку на комнаты)
   
5. `floors.id` ← `common_areas.floor_id` **(1:N)**
   - Тип связи: Один-ко-многим
   - FK: `common_areas.floor_id` REFERENCES `floors(id)` ON DELETE CASCADE
   - **Смысл**: На этаже расположены МОП
   
6. `entrances.id` ← `common_areas.entrance_id` **(1:N, OPTIONAL)**
   - Тип связи: Один-ко-многим (опциональная)
   - FK: `common_areas.entrance_id` REFERENCES `entrances(id)` ON DELETE SET NULL
   - **Смысл**: МОП может быть привязан к подъезду (NULL для общих МОП)
   
7. `basements.id` ← `floors.basement_id` **(1:N, OPTIONAL)**
   - Тип связи: Один-ко-многим (опциональная)
   - FK: `floors.basement_id` REFERENCES `basements(id)` ON DELETE SET NULL
   - **Смысл**: Этаж может быть частью подвала

### Связи с родительскими блоками (стилобаты)

```
building_blocks (parent) ──── building_blocks.parent_blocks[] (child)
```

**Описание связи**:
- `building_blocks.parent_blocks` → массив UUID[] блоков-родителей
- **Смысл**: Нежилой блок (стилобат) может быть связан с одним или несколькими жилыми блоками
- Используется для логической связи, физического FK нет (массив UUID)

## 3.2 Логика удаления (Referential Integrity)

### ON DELETE CASCADE (Каскадное удаление)

**Принцип**: При удалении родительской записи автоматически удаляются все дочерние записи.

**Применяется в**:
1. `projects` → `applications`, `project_participants`, `project_documents`, `buildings`
   - **Эффект**: Удаление проекта удаляет заявку, участников, документы и все здания
   
2. `applications` → `application_history`, `application_steps`
   - **Эффект**: Удаление заявки удаляет всю историю и шаги
   
3. `buildings` → `building_blocks`, `basements`
   - **Эффект**: Удаление здания удаляет все блоки и подвалы
   
4. `building_blocks` → `block_construction`, `block_engineering`, `floors`, `entrances`, `block_floor_markers`, `basements`
   - **Эффект**: Удаление блока удаляет конструктив, инженерию, этажи, подъезды, маркеры
   
5. `floors` → `entrance_matrix`, `units`, `common_areas`
   - **Эффект**: Удаление этажа удаляет матрицу, помещения и МОП
   
6. `units` → `rooms`
   - **Эффект**: Удаление помещения удаляет экспликацию
   
7. `basements` → `basement_parking_levels`
   - **Эффект**: Удаление подвала удаляет конфигурацию уровней

**Полная цепочка каскадного удаления**:
```
projects
  └─► applications
       └─► application_history, application_steps
  └─► project_participants
  └─► project_documents
  └─► buildings
       └─► building_blocks
            └─► block_construction
            └─► block_engineering
            └─► floors
                 └─► entrance_matrix
                 └─► units
                      └─► rooms
                 └─► common_areas
            └─► entrances
            └─► block_floor_markers
            └─► basements
                 └─► basement_parking_levels
       └─► basements
            └─► basement_parking_levels
```

### ON DELETE SET NULL (Установка NULL)

**Принцип**: При удалении родительской записи в дочерней записи FK устанавливается в NULL (запись сохраняется).

**Применяется в**:
1. `entrances.id` ← `units.entrance_id`
   - **Эффект**: Удаление подъезда не удаляет помещения, только обнуляет привязку
   - **Смысл**: Помещение остается, но теряет привязку к подъезду
   
2. `entrances.id` ← `common_areas.entrance_id`
   - **Эффект**: Удаление подъезда не удаляет МОП, только обнуляет привязку
   - **Смысл**: МОП становится общим для этажа
   
3. `basements.id` ← `floors.basement_id`
   - **Эффект**: Удаление подвала не удаляет этажи, только обнуляет привязку
   - **Смысл**: Этаж сохраняется, но теряет связь с подвальным контуром

## 3.3 Уникальность и ограничения

### Уникальные индексы на один столбец

| Таблица | Поле | Условие | Назначение |
|---------|------|---------|-----------|
| `projects` | `uj_code` | NOT NULL | Уникальный код проекта формата UJ000000 |
| `buildings` | `building_code` | NOT NULL | Уникальный код здания формата ZD00 |
| `units` | `unit_code` | NOT NULL | Уникальный код помещения формата EL000 |
| `applications` | `project_id` | - | Одна заявка на проект |
| `block_construction` | `block_id` | - | Один набор конструктива на блок |
| `block_engineering` | `block_id` | - | Один набор инженерии на блок |
| `dict_system_users` | `code` | - | Уникальный код пользователя |

### Уникальные индексы на несколько столбцов

| Таблица | Поля | Назначение |
|---------|------|-----------|
| `application_steps` | (`application_id`, `step_index`) | Одна запись шага на заявку |
| `project_participants` | (`project_id`, `role`) | Один участник на роль |
| `entrances` | (`block_id`, `number`) | Уникальный номер подъезда в блоке |
| `entrance_matrix` | (`block_id`, `floor_id`, `entrance_number`) | Одна ячейка матрицы |
| `block_floor_markers` | (`block_id`, `marker_key`) | Уникальный маркер в блоке |
| `basement_parking_levels` | (`basement_id`, `depth_level`) | Один уровень в подвале |
| `dict_room_types` | (`code`, `room_scope`) | Уникальный код в области применения |

### Составной уникальный индекс с функциями

**Таблица `floors`**:
```sql
UNIQUE INDEX uq_floors_block_idx_parent_basement_expr ON (
  block_id,
  index,
  coalesce(parent_floor_index, -99999),
  coalesce(basement_id, '00000000-0000-0000-0000-000000000000'::uuid)
)
```

**Назначение**: Обеспечивает уникальность этажа с учетом:
- Блока
- Индекса этажа
- Родительского этажа (для технических)
- Подвала (для подвальных этажей)

**Смысл**: В блоке может быть несколько этажей с одинаковым индексом, если они относятся к разным родителям или подвалам.

## 3.4 CHECK-ограничения

| Таблица | Поле | Ограничение | Назначение |
|---------|------|-------------|-----------|
| `block_floor_markers` | `marker_type` | IN ('floor', 'technical', 'special', 'basement') | Допустимые типы маркеров |
| `dict_room_types` | `room_scope` | IN ('residential', 'commercial') | Область применения типа комнаты |
| `dict_room_types` | `area_bucket` | IN ('living', 'main', 'useful', 'aux', 'summer', 'other') | Категория площади |
| `dict_room_types` | `coefficient` | >= 0 | Коэффициент не может быть отрицательным |
| `dict_system_users` | `role` | IN ('admin', 'controller', 'technician') | Допустимые роли пользователей |

## 3.5 Индексы для производительности

### Простые индексы

| Таблица | Поле | Назначение |
|---------|------|-----------|
| `projects` | `scope_id` | Фильтрация проектов по контуру |
| `projects` | `updated_at DESC` | Сортировка по дате обновления |
| `applications` | `scope_id` | Фильтрация заявок по контуру |
| `buildings` | `project_id` | Выборка зданий проекта |
| `building_blocks` | `building_id` | Выборка блоков здания |
| `floors` | `block_id` | Выборка этажей блока |
| `entrances` | `block_id` | Выборка подъездов блока |
| `units` | `floor_id` | Выборка помещений этажа |
| `units` | `entrance_id` | Выборка помещений подъезда |
| `units` | `unit_type` | Фильтрация по типу помещения |
| `rooms` | `unit_id` | Выборка экспликации помещения |
| `common_areas` | `floor_id` | Выборка МОП этажа |
| `basements` | `building_id` | Выборка подвалов здания |
| `basements` | `block_id` | Выборка подвалов блока |
| `block_floor_markers` | `block_id` | Выборка маркеров блока |

### Составные индексы

| Таблица | Поля | Назначение |
|---------|------|-----------|
| `applications` | (`project_id`, `scope_id`) | Быстрый поиск заявки проекта в контуре |
| `application_history` | (`application_id`, `created_at DESC`) | История заявки по дате |
| `project_documents` | (`project_id`, `doc_date DESC`) | Документы проекта по дате |
| `floors` | (`block_id`, `index`) | Сортированная выборка этажей |
| `entrance_matrix` | (`block_id`, `floor_id`) | Выборка матрицы по блоку и этажу |
| `units` | (`floor_id`, `entrance_id`) | Выборка помещений по этажу и подъезду |
| `rooms` | (`unit_id`, `room_type`) | Фильтрация комнат по типу |
| `common_areas` | (`floor_id`, `entrance_id`) | Выборка МОП по этажу и подъезду |
### JSONB-поля workflow-контура

| Таблица | Поле | Назначение |
|---------|------|-----------|
| `applications` | `integration_data` | Служебные статусы интеграции с внешними системами |
| `application_steps` | `block_statuses` | Статусы заполнения блоков в рамках конкретного шага (`step_index`) |

`application_steps.block_statuses` обновляется отдельным действием «Сохранить» на шагах с блоками и не нарушает уникальность `(application_id, step_index)` — запись шага обновляется через upsert.