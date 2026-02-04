/*
  MIGRATION V2 - NORMALIZED SCHEMA
  Описание проекта: Реестр многоквартирных домов (МКД).
  Архитектура: Клиент-серверная (PostgreSQL + Supabase).
  
  Основные изменения v2:
  1. Декомпозиция building_blocks на компоненты (Constructive, Engineering).
  2. Унификация всех помещений (квартиры, офисы, паркинг) в таблицу units.
  3. Strict Foreign Keys с каскадным удалением.
*/

-- 1. СБРОС (Удаление старых таблиц в правильном порядке)
DROP TABLE IF EXISTS application_history CASCADE;
DROP TABLE IF EXISTS application_steps CASCADE;
DROP TABLE IF EXISTS common_areas CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS units CASCADE;
DROP TABLE IF EXISTS entrances CASCADE;
DROP TABLE IF EXISTS floors CASCADE;
DROP TABLE IF EXISTS block_engineering CASCADE;
DROP TABLE IF EXISTS block_construction CASCADE;
DROP TABLE IF EXISTS building_blocks CASCADE;
DROP TABLE IF EXISTS basement_parking_levels CASCADE;
DROP TABLE IF EXISTS basements CASCADE;
DROP TABLE IF EXISTS buildings CASCADE;
DROP TABLE IF EXISTS project_documents CASCADE;
DROP TABLE IF EXISTS project_participants CASCADE;
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

-- Включаем расширение для генерации UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 2. СУЩНОСТИ ПРОЕКТА И ЗАЯВКИ
-- ==========================================

-- Таблица: projects
-- Описание: Физический объект строительства (ЖК). Корневая сущность.
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope_id TEXT NOT NULL,                     -- Идентификатор владельца/тенанта
    name TEXT NOT NULL,                         -- Название ЖК
    construction_status TEXT DEFAULT 'Проектный', -- Статус стройки
    
    region TEXT,                                -- Область/Город
    district TEXT,                              -- Район
    address TEXT,                               -- Улица/Дом
    landmark TEXT,                              -- Ориентир
    cadastre_number TEXT,                       -- Кадастр участка
    
    date_start_project DATE,                    -- Плановое начало
    date_end_project DATE,                      -- Плановый ввод
    date_start_fact DATE,                       -- Фактическое начало
    date_end_fact DATE,                         -- Фактический ввод
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: applications
-- Описание: Процесс/Транзакция работы над проектом. Хранит состояние визарда.
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    scope_id TEXT NOT NULL,                     -- Идентификатор владельца/тенанта
    
    internal_number TEXT,                       -- Внутренний номер дела
    external_source TEXT,                       -- Источник (ЕПИГУ, ДХМ)
    external_id TEXT,                           -- Номер внешней заявки
    applicant TEXT,                             -- Заявитель
    submission_date TIMESTAMP WITH TIME ZONE,
    
    status TEXT DEFAULT 'NEW',                  -- Статус: NEW, DRAFT, REVIEW, APPROVED...
    assignee_name TEXT,                         -- Имя исполнителя (техника)
    
    current_step INT DEFAULT 0,                 -- Индекс текущего шага UI
    current_stage INT DEFAULT 1,                -- Номер текущего этапа бизнес-логики
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX projects_scope_id_idx ON projects(scope_id);
CREATE INDEX applications_scope_id_idx ON applications(scope_id);

-- Таблица: application_history
-- Описание: Лог действий (смена статусов, комментарии).
CREATE TABLE application_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    action TEXT,                                -- Действие (напр. "Вернуть на доработку")
    prev_status TEXT,
    next_status TEXT,
    user_name TEXT,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: application_steps
-- Описание: Статус выполнения конкретных шагов визарда.
CREATE TABLE application_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    step_index INT NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    UNIQUE(application_id, step_index)
);

-- Таблица: project_participants
-- Описание: Участники строительства (Застройщик, Проектировщик, Генподрядчик).
CREATE TABLE project_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    role TEXT NOT NULL,                         -- developer, designer, contractor
    name TEXT,
    inn TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: project_documents
-- Описание: Ссылки на документы (Разрешения, АПЗ и т.д.).
CREATE TABLE project_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT,
    doc_type TEXT,
    doc_number TEXT,
    doc_date DATE,
    file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 3. СТРУКТУРА ЗДАНИЙ И БЛОКОВ
-- ==========================================

-- Таблица: buildings
-- Описание: Здание как физический объект (Корпус, Паркинг). Состоит из Блоков.
CREATE TABLE buildings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    label TEXT NOT NULL,                        -- Название (напр. "Корпус 1")
    house_number TEXT,                          -- Присвоенный номер дома
    category TEXT NOT NULL,                     -- residential, parking_separate, infrastructure
    
    -- Общие классификаторы
    construction_type TEXT,                     -- capital, light, open (для паркингов)
    parking_type TEXT,                          -- underground, ground (для паркингов)
    infra_type TEXT,                            -- Школа, Сад, Котельная (для инфраструктуры)
    has_non_res_part BOOLEAN DEFAULT FALSE,     -- Признак встроенной коммерции
    
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Таблица: building_blocks
-- Описание: Секция здания. Основная единица конфигурации этажности.
CREATE TABLE building_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
    
    label TEXT NOT NULL,                        -- Название секции (напр. "Секция А")
    type TEXT NOT NULL,                         -- Ж (Жилой), Н (Нежилой), Parking, Infra
    
    -- Геометрия
    floors_count INT DEFAULT 1,
    floors_from INT DEFAULT 1,
    floors_to INT DEFAULT 1,
    entrances_count INT DEFAULT 1,
    elevators_count INT DEFAULT 0,
    
    -- Специфика паркинга
    vehicle_entries INT DEFAULT 0,
    levels_depth INT DEFAULT 0,
    light_structure_type TEXT,                  -- canopy, box (для легких паркингов)
    
    -- Флаги этажности (влияют на генерацию матрицы этажей)
    has_basement BOOLEAN DEFAULT FALSE,
    has_attic BOOLEAN DEFAULT FALSE,
    has_loft BOOLEAN DEFAULT FALSE,
    has_roof_expl BOOLEAN DEFAULT FALSE,

    -- Настройки адресации
    has_custom_address BOOLEAN DEFAULT FALSE,
    custom_house_number TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Таблица: basements
-- Описание: Подвальные помещения, привязанные к блоку здания.
CREATE TABLE basements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
    block_id UUID REFERENCES building_blocks(id) ON DELETE CASCADE,
    depth INT NOT NULL DEFAULT 1,
    has_parking BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: basement_parking_levels
-- Описание: Уровни парковки внутри подвала.
CREATE TABLE basement_parking_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    basement_id UUID REFERENCES basements(id) ON DELETE CASCADE,
    depth_level INT NOT NULL,
    is_enabled BOOLEAN DEFAULT FALSE,
    UNIQUE(basement_id, depth_level)
);

CREATE INDEX basements_building_id_idx ON basements(building_id);
CREATE INDEX basements_block_id_idx ON basements(block_id);


-- Таблица: block_construction
-- Описание: Конструктивные характеристики блока (1:1 к building_blocks).
CREATE TABLE block_construction (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_id UUID REFERENCES building_blocks(id) ON DELETE CASCADE UNIQUE,
    
    foundation TEXT,
    walls TEXT,
    slabs TEXT,
    roof TEXT,
    seismicity INT
);

-- Таблица: block_engineering
-- Описание: Инженерные системы блока (1:1 к building_blocks).
CREATE TABLE block_engineering (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_id UUID REFERENCES building_blocks(id) ON DELETE CASCADE UNIQUE,
    
    has_electricity BOOLEAN DEFAULT FALSE,
    has_water BOOLEAN DEFAULT FALSE,        -- ХВС
    has_hot_water BOOLEAN DEFAULT FALSE,    -- ГВС (если нужно разделять, иначе water=ХВС)
    has_sewerage BOOLEAN DEFAULT FALSE,
    has_gas BOOLEAN DEFAULT FALSE,
    has_heating BOOLEAN DEFAULT FALSE,
    has_ventilation BOOLEAN DEFAULT FALSE,
    has_firefighting BOOLEAN DEFAULT FALSE,
    has_lowcurrent BOOLEAN DEFAULT FALSE    -- Слаботочка
);

-- ==========================================
-- 4. МАТРИЦЫ (ЭТАЖИ, ПОДЪЕЗДЫ)
-- ==========================================

-- Таблица: floors
-- Описание: Этажи блока.
CREATE TABLE floors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_id UUID REFERENCES building_blocks(id) ON DELETE CASCADE,
    floor_key TEXT NOT NULL,                    -- Уникальный ключ этажа внутри блока
    basement_id UUID REFERENCES basements(id) ON DELETE SET NULL,
    
    index INT NOT NULL,                         -- Логический номер для сортировки (-1, 0, 1...)
    label TEXT NOT NULL,                        -- Отображаемое название ("1 этаж", "Подвал")
    floor_type TEXT NOT NULL,                   -- residential, basement, technical, attic...
    parent_floor_index INT,                     -- Базовый этаж для тех. этажа (если есть)
    
    -- Признаки этажей
    is_technical BOOLEAN DEFAULT FALSE,
    is_commercial BOOLEAN DEFAULT FALSE,
    is_stylobate BOOLEAN DEFAULT FALSE,
    is_basement BOOLEAN DEFAULT FALSE,
    is_attic BOOLEAN DEFAULT FALSE,
    is_loft BOOLEAN DEFAULT FALSE,
    is_roof BOOLEAN DEFAULT FALSE,
    
    height DECIMAL(5, 2),                       -- Высота потолка
    area_proj DECIMAL(10, 2),                   -- Площадь проектная
    area_fact DECIMAL(10, 2),                   -- Площадь фактическая
    
    is_duplex BOOLEAN DEFAULT FALSE,            -- Флаг двухуровневого этажа
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX floors_block_key_idx ON floors(block_id, floor_key);

-- Таблица: entrances
-- Описание: Подъезды (вертикали).
CREATE TABLE entrances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_id UUID REFERENCES building_blocks(id) ON DELETE CASCADE,
    number INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 5. РЕЕСТР ПОМЕЩЕНИЙ (UNITS)
-- ==========================================

-- Таблица: units
-- Описание: Единая таблица для Квартир, Офисов, Кладовых и Машиномест.
CREATE TABLE units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    floor_id UUID REFERENCES floors(id) ON DELETE CASCADE,
    entrance_id UUID REFERENCES entrances(id) ON DELETE SET NULL, -- Nullable для паркингов/инфры
    
    -- Идентификация
    unit_type TEXT NOT NULL,                    -- flat, office, pantry, parking_place, duplex_up, duplex_down
    number TEXT NOT NULL,                       -- Номер помещения ("10", "1А", "P-12")
    status TEXT DEFAULT 'free',                 -- free, sold, booked
    
    -- Площади
    total_area DECIMAL(10, 2) DEFAULT 0,
    living_area DECIMAL(10, 2) DEFAULT 0,
    useful_area DECIMAL(10, 2) DEFAULT 0,       -- Для балконов/лоджий
    
    rooms_count INT DEFAULT 0,
    cadastre_number TEXT,                       -- Присвоенный кадастровый номер
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица: rooms
-- Описание: Экспликация (комнаты внутри юнита).
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    name TEXT,                                  -- Кухня, Спальня
    room_type TEXT,                             -- living, auxiliary, summer
    area DECIMAL(10, 2),
    level INT DEFAULT 1                         -- Уровень (для двухуровневых квартир)
);

-- Таблица: common_areas
-- Описание: Места общего пользования (МОП).
CREATE TABLE common_areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    floor_id UUID REFERENCES floors(id) ON DELETE CASCADE,
    entrance_id UUID REFERENCES entrances(id) ON DELETE CASCADE,
    type TEXT,                                  -- Коридор, Лестница, Лифт
    area DECIMAL(10, 2)
);

-- ==========================================
-- 6. БЕЗОПАСНОСТЬ (RLS)
-- ==========================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE basements ENABLE ROW LEVEL SECURITY;
ALTER TABLE basement_parking_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE building_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE block_construction ENABLE ROW LEVEL SECURITY;
ALTER TABLE block_engineering ENABLE ROW LEVEL SECURITY;
ALTER TABLE floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE entrances ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE common_areas ENABLE ROW LEVEL SECURITY;

-- Политики для анонимного доступа (тестовый режим)
CREATE POLICY "Public All" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All" ON applications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All" ON application_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All" ON application_steps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All" ON project_participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All" ON project_documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All" ON buildings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All" ON basements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All" ON basement_parking_levels FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All" ON building_blocks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All" ON block_construction FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All" ON block_engineering FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All" ON floors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All" ON entrances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All" ON units FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All" ON rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All" ON common_areas FOR ALL USING (true) WITH CHECK (true);

-- Гранты
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
