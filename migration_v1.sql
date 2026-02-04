-- 1. ОЧИСТКА (Удаляем старые таблицы, если есть, чтобы пересоздать структуру начисто)
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS units CASCADE;
DROP TABLE IF EXISTS common_areas CASCADE; -- Если была
DROP TABLE IF EXISTS entrances CASCADE;
DROP TABLE IF EXISTS floors CASCADE;
DROP TABLE IF EXISTS building_blocks CASCADE;
DROP TABLE IF EXISTS buildings CASCADE;
DROP TABLE IF EXISTS project_participants CASCADE;
DROP TABLE IF EXISTS project_documents CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

-- Включаем расширение для генерации UUID, если еще не включено
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. СОЗДАНИЕ ТАБЛИЦ

-- --- УРОВЕНЬ 1: ПРОЕКТ ---

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    status TEXT DEFAULT 'Проектный', -- Draft, Construction, Completed
    
    -- Адресные данные (ранее complexInfo)
    region TEXT,
    district TEXT,
    address TEXT,
    landmark TEXT,
    
    -- Кадастровые и временные данные
    cadastre_number TEXT,
    date_start_project DATE,
    date_end_project DATE,
    date_start_fact DATE,
    date_end_fact DATE,
    
    -- Метаданные системы
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE project_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- developer, designer, contractor
    name TEXT,
    inn TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE project_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT,
    doc_type TEXT, -- РНР, АПЗ и т.д.
    doc_number TEXT,
    doc_date DATE,
    file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- --- УРОВЕНЬ 2: СТРОЕНИЯ И БЛОКИ ---

CREATE TABLE buildings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Идентификация
    label TEXT NOT NULL, -- "Корпус 1"
    house_number TEXT,
    
    -- Типизация
    category TEXT NOT NULL, -- residential, parking_separate, infrastructure
    construction_type TEXT DEFAULT 'capital', -- capital, light, open
    parking_type TEXT, -- underground, ground (если это паркинг)
    infra_type TEXT, -- school, kindergarten (если это инфра)
    
    -- Конструктив (вынесено из JSON)
    foundation TEXT,
    walls TEXT,
    slabs TEXT,
    roof TEXT,
    seismicity INT,
    
    -- Инженерные системы (Флаги)
    has_electricity BOOLEAN DEFAULT FALSE,
    has_water BOOLEAN DEFAULT FALSE,
    has_sewerage BOOLEAN DEFAULT FALSE,
    has_gas BOOLEAN DEFAULT FALSE,
    has_heating BOOLEAN DEFAULT FALSE,
    has_ventilation BOOLEAN DEFAULT FALSE,
    has_firefighting BOOLEAN DEFAULT FALSE,
    has_lowcurrent BOOLEAN DEFAULT FALSE,
    
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE building_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
    
    label TEXT NOT NULL, -- "Секция А" или "Основной"
    type TEXT NOT NULL, -- 'Ж' (Residential), 'Н' (Non-res/Commercial), 'Parking'
    
    -- Геометрия
    floors_count INT DEFAULT 1,
    entrances_count INT DEFAULT 1,
    elevators_count INT DEFAULT 0,
    
    -- Флаги конфигурации
    has_basement BOOLEAN DEFAULT FALSE,
    has_attic BOOLEAN DEFAULT FALSE,
    has_loft BOOLEAN DEFAULT FALSE,
    has_roof_expl BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- --- УРОВЕНЬ 3: ВЕРТИКАЛЬ (Этажи и Подъезды) ---

CREATE TABLE floors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_id UUID REFERENCES building_blocks(id) ON DELETE CASCADE,
    
    index INT NOT NULL, -- Физический индекс для сортировки (-1, 0, 1, 2...)
    label TEXT NOT NULL, -- "1 этаж", "Подвал", "Технический"
    
    floor_type TEXT NOT NULL, -- residential, basement, attic, technical, roof, commercial
    
    height DECIMAL(5, 2), -- Высота потолка (м)
    area_proj DECIMAL(10, 2),
    area_fact DECIMAL(10, 2),
    
    is_duplex BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE entrances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_id UUID REFERENCES building_blocks(id) ON DELETE CASCADE,
    number INT NOT NULL, -- Номер подъезда (1, 2...)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- --- УРОВЕНЬ 4: ПОМЕЩЕНИЯ (Юниты) ---

CREATE TABLE units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    floor_id UUID REFERENCES floors(id) ON DELETE CASCADE,
    entrance_id UUID REFERENCES entrances(id) ON DELETE SET NULL, -- Nullable (для паркингов/офисов)
    
    number TEXT NOT NULL, -- "1", "1А", "102"
    type TEXT NOT NULL, -- flat, office, pantry, parking_place, duplex_up, duplex_down
    
    status TEXT DEFAULT 'free', -- free, sold, booked
    
    total_area DECIMAL(10, 2) DEFAULT 0,
    living_area DECIMAL(10, 2) DEFAULT 0,
    useful_area DECIMAL(10, 2) DEFAULT 0, -- (без балконов/лоджий)
    
    rooms_count INT DEFAULT 0,
    cadastre_number TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    
    name TEXT, -- Кухня, Гостиная
    room_type TEXT, -- kitchen, living, bathroom...
    area DECIMAL(10, 2),
    
    coefficient DECIMAL(3, 2) DEFAULT 1.0, -- 1.0, 0.5 (лоджия), 0.3 (балкон)
    level INT DEFAULT 1 -- 1 или 2 (для дуплексов)
);

-- Таблица для МОП (Места Общего Пользования)
CREATE TABLE common_areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    floor_id UUID REFERENCES floors(id) ON DELETE CASCADE,
    entrance_id UUID REFERENCES entrances(id) ON DELETE CASCADE,
    
    type TEXT, -- Лестница, Коридор
    area DECIMAL(10, 2)
);

-- 3. НАСТРОЙКА ПРАВ ДОСТУПА (RLS - Row Level Security)
-- Разрешаем анонимный доступ для разработки (как вы просили)

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE building_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE entrances ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE common_areas ENABLE ROW LEVEL SECURITY;

-- Создаем политики для публичного доступа (Anon & Authenticated)
CREATE POLICY "Public Access Projects" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Participants" ON project_participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Docs" ON project_documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Buildings" ON buildings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Blocks" ON building_blocks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Floors" ON floors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Entrances" ON entrances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Units" ON units FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Rooms" ON rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access CommonAreas" ON common_areas FOR ALL USING (true) WITH CHECK (true);

-- Выдаем права ролям
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Комментарий о завершении
COMMENT ON TABLE projects IS 'Реестр жилищных комплексов (Основная таблица)';
COMMENT ON TABLE buildings IS 'Физические здания внутри комплекса';
COMMENT ON TABLE building_blocks IS 'Секции здания (Жилые/Нежилые)';
COMMENT ON TABLE units IS 'Конечные объекты недвижимости (Квартиры, машиноместа)';