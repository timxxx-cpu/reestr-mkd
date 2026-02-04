-- 1. ОЧИСТКА
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS units CASCADE;
DROP TABLE IF EXISTS common_areas CASCADE;
DROP TABLE IF EXISTS entrances CASCADE;
DROP TABLE IF EXISTS floors CASCADE;
DROP TABLE IF EXISTS building_blocks CASCADE;
DROP TABLE IF EXISTS buildings CASCADE;
DROP TABLE IF EXISTS project_participants CASCADE;
DROP TABLE IF EXISTS project_documents CASCADE;
DROP TABLE IF EXISTS application_steps CASCADE;
DROP TABLE IF EXISTS application_history CASCADE;
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ПРОЕКТ (Физический объект)
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    -- Статус физического объекта (не заявки!)
    construction_status TEXT DEFAULT 'Проектный', 
    
    region TEXT,
    district TEXT,
    address TEXT,
    landmark TEXT,
    
    cadastre_number TEXT,
    
    date_start_project DATE,
    date_end_project DATE,
    date_start_fact DATE,
    date_end_fact DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ЗАЯВКА (Процесс)
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    internal_number TEXT,
    external_source TEXT,
    external_id TEXT,
    applicant TEXT,
    submission_date TIMESTAMP WITH TIME ZONE,
    
    status TEXT DEFAULT 'NEW', -- DRAFT, REVIEW, APPROVED...
    assignee_name TEXT,
    
    current_step INT DEFAULT 0,
    current_stage INT DEFAULT 1,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. ИСТОРИЯ ЗАЯВКИ
CREATE TABLE application_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    
    action TEXT, -- 'Создание', 'Перевод статуса'
    prev_status TEXT,
    next_status TEXT,
    user_name TEXT,
    comment TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. ШАГИ ЗАЯВКИ (Progress)
CREATE TABLE application_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    step_index INT NOT NULL,
    
    is_completed BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    
    UNIQUE(application_id, step_index)
);

-- 6. УЧАСТНИКИ И ДОКУМЕНТЫ (Привязаны к Проекту)
CREATE TABLE project_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    name TEXT,
    inn TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- 7. СТРУКТУРА ЗДАНИЙ (Buildings -> Blocks -> Floors -> Units)
CREATE TABLE buildings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    house_number TEXT,
    category TEXT NOT NULL,
    construction_type TEXT DEFAULT 'capital',
    parking_type TEXT,
    infra_type TEXT,
    
    -- Конструктив
    foundation TEXT, walls TEXT, slabs TEXT, roof TEXT, seismicity INT,
    
    -- Инженерия
    has_electricity BOOLEAN DEFAULT FALSE,
    has_water BOOLEAN DEFAULT FALSE,
    has_sewerage BOOLEAN DEFAULT FALSE,
    has_gas BOOLEAN DEFAULT FALSE,
    has_heating BOOLEAN DEFAULT FALSE,
    has_ventilation BOOLEAN DEFAULT FALSE,
    has_firefighting BOOLEAN DEFAULT FALSE,
    has_lowcurrent BOOLEAN DEFAULT FALSE,
    
    photo_url TEXT
);

CREATE TABLE building_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    type TEXT NOT NULL, -- Ж, Н, Parking
    floors_count INT DEFAULT 1,
    entrances_count INT DEFAULT 1,
    elevators_count INT DEFAULT 0,
    has_basement BOOLEAN DEFAULT FALSE,
    has_attic BOOLEAN DEFAULT FALSE,
    has_loft BOOLEAN DEFAULT FALSE,
    has_roof_expl BOOLEAN DEFAULT FALSE
);

CREATE TABLE floors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_id UUID REFERENCES building_blocks(id) ON DELETE CASCADE,
    index INT NOT NULL,
    label TEXT NOT NULL,
    floor_type TEXT NOT NULL,
    height DECIMAL(5, 2),
    area_proj DECIMAL(10, 2),
    area_fact DECIMAL(10, 2),
    is_duplex BOOLEAN DEFAULT FALSE
);

CREATE TABLE entrances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_id UUID REFERENCES building_blocks(id) ON DELETE CASCADE,
    number INT NOT NULL
);

CREATE TABLE units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    floor_id UUID REFERENCES floors(id) ON DELETE CASCADE,
    entrance_id UUID REFERENCES entrances(id) ON DELETE SET NULL,
    number TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'free',
    total_area DECIMAL(10, 2) DEFAULT 0,
    living_area DECIMAL(10, 2) DEFAULT 0,
    useful_area DECIMAL(10, 2) DEFAULT 0,
    rooms_count INT DEFAULT 0,
    cadastre_number TEXT
);

CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    name TEXT,
    room_type TEXT,
    area DECIMAL(10, 2),
    coefficient DECIMAL(3, 2) DEFAULT 1.0,
    level INT DEFAULT 1
);

CREATE TABLE common_areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    floor_id UUID REFERENCES floors(id) ON DELETE CASCADE,
    entrance_id UUID REFERENCES entrances(id) ON DELETE CASCADE,
    type TEXT,
    area DECIMAL(10, 2)
);

-- 8. ПОЛИТИКИ (RLS)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE building_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE entrances ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE common_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Access" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Apps" ON applications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Hist" ON application_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Steps" ON application_steps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Parts" ON project_participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Docs" ON project_documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Blds" ON buildings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Blks" ON building_blocks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Flrs" ON floors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Entr" ON entrances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Units" ON units FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Rooms" ON rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Mop" ON common_areas FOR ALL USING (true) WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;