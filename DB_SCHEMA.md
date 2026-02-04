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