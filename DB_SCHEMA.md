# Структура базы данных (PostgreSQL)

Проект переведен с JSONB-хранилища на реляционную модель.
Все таблицы используют `UUID` в качестве первичных ключей.

## ER-Диаграмма (Логическая)
Project (1) -> (*) ProjectParticipants
Project (1) -> (*) Buildings
Buildings (1) -> (*) BuildingBlocks (Секции)
BuildingBlocks (1) -> (*) Floors (Этажи)
BuildingBlocks (1) -> (*) Entrances (Подъезды)
Floors (1) -> (*) Units (Помещения: Квартиры, Офисы, Паркинг)
Units (1) -> (*) Rooms (Экспликация)

---

## Описание таблиц

### 1. `projects` (Проекты ЖК)
Корневая сущность. Содержит паспортные данные.
- `id`: UUID (PK)
- `name`: Название ЖК
- `status`: Статус (Проектный, Строящийся...)
- `region`, `district`, `address`: Адресные данные
- `cadastre_number`: Кадастровый номер земельного участка
- `date_start`, `date_end`: Плановые сроки
- `created_at`, `updated_at`: Временные метки

### 2. `project_participants` (Участники)
Связанные организации (Застройщик, Проектировщик и т.д.).
- `id`: UUID (PK)
- `project_id`: FK -> projects
- `role`: Роль (developer, designer, contractor)
- `name`: Наименование организации
- `inn`: ИНН

### 3. `buildings` (Здания / Сооружения)
Физические объекты строительства.
- `id`: UUID (PK)
- `project_id`: FK -> projects
- `label`: Название (напр. "Корпус 1")
- `house_number`: Номер дома
- `category`: Категория (residential, parking_separate, infrastructure)
- `construction_type`: Тип конструкции (capital, light...)
- **Конструктив**: `foundation`, `walls`, `roof`, `slabs` (материалы)
- **Инженерия**: `has_electricity`, `has_water`, `has_gas`, `has_sewerage`, `has_heating`

### 4. `building_blocks` (Блоки / Секции)
Логические части здания. Даже если здание односекционное, оно должно иметь 1 запись здесь.
- `id`: UUID (PK)
- `building_id`: FK -> buildings
- `label`: Название секции (напр. "Секция А")
- `type`: Тип блока (Ж - жилой, Н - нежилой, Паркинг)
- `floors_count`: Этажность блока
- `entrances_count`: Количество подъездов

### 5. `floors` (Этажи)
Матрица этажей. Привязана к блоку.
- `id`: UUID (PK)
- `block_id`: FK -> building_blocks
- `index`: Физический номер (для сортировки: -1, 0, 1...)
- `label`: Отображаемое название ("1 этаж", "Подвал")
- `type`: Тип (residential, basement, attic, technical...)
- `height`: Высота потолка
- `area_proj`: Проектная площадь этажа
- `area_fact`: Фактическая площадь
- `is_duplex`: Флаг двухуровневого этажа

### 6. `entrances` (Подъезды)
Вертикали для привязки квартир.
- `id`: UUID (PK)
- `block_id`: FK -> building_blocks
- `number`: Номер подъезда (1, 2, 3...)

### 7. `units` (Помещения)
Квартиры, Офисы, Машиноместа, Кладовые.
- `id`: UUID (PK)
- `floor_id`: FK -> floors
- `entrance_id`: FK -> entrances (Nullable, т.к. у паркинга может не быть подъезда)
- `number`: Номер помещения (строка, т.к. бывает "1А")
- `type`: Тип (flat, office, pantry, parking_place)
- `status`: Статус (free, sold, booked)
- `total_area`: Общая площадь
- `living_area`: Жилая площадь
- `rooms_count`: Количество комнат
- `cadastre_number`: Присвоенный кадастр

### 8. `rooms` (Экспликация)
Детализация помещений внутри Unit.
- `id`: UUID (PK)
- `unit_id`: FK -> units
- `name`: Название (Кухня, Спальня)
- `area`: Площадь
- `coefficient`: Коэффициент (1.0, 0.5 для балконов)

# Структура базы данных (v2 - Разделение Проекта и Заявки)

## Основные сущности

### 1. `projects` (Физический объект)
Описывает Жилой Комплекс как объект недвижимости.
- `id`: UUID (PK)
- `name`: Название ЖК
- `region`, `district`, `address`, `landmark`: География
- `cadastre_number`: Кадастр земельного участка
- `construction_status`: Статус стройки (Проект, Стройка, Сдан)
- `date_start`, `date_end`: Сроки

### 2. `applications` (Заявка / Транзакция)
Описывает процесс работы над объектом в системе.
- `id`: UUID (PK)
- `project_id`: FK -> projects (1:1 или N:1)
- `internal_number`: Внутренний номер дела
- `external_source`: Источник (ЕПИГУ, ДХМ)
- `external_id`: Номер внешней заявки
- `applicant`: Заявитель
- `submission_date`: Дата подачи
- `status`: Статус процесса (DRAFT, REVIEW, INTEGRATION...)
- `assignee_name`: Исполнитель
- `current_step`: Индекс текущего шага
- `current_stage`: Номер текущего этапа

### 3. `application_history` (История)
Лог действий по заявке.
- `id`: UUID
- `application_id`: FK -> applications
- `action`: Действие (Смена статуса, Комментарий)
- `user_name`: Кто сделал
- `comment`: Комментарий
- `created_at`: Время

### 4. `application_steps` (Прогресс)
Статус выполнения конкретных шагов визарда.
- `application_id`: FK -> applications
- `step_index`: Номер шага
- `is_completed`: Завершен техником
- `is_verified`: Проверен бригадиром

---
## Дочерние сущности Проекта (без изменений)
`buildings`, `building_blocks`, `floors`, `entrances`, `units`, `rooms`, `common_areas` ссылаются на `project_id` (через цепочку).