/*
  MIGRATION V3 - REFERENCE DICTIONARIES
  Цель: вынести статические справочники из фронтенда в PostgreSQL.
*/

-- Базовый хелпер столбцов (повторяем вручную, без JSONB)

CREATE TABLE IF NOT EXISTS dict_project_statuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    sort_order INT DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dict_application_statuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    sort_order INT DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dict_external_systems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    sort_order INT DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dict_foundations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    sort_order INT DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dict_wall_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    sort_order INT DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dict_slab_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    sort_order INT DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dict_roof_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    sort_order INT DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dict_light_structure_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    sort_order INT DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dict_parking_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    sort_order INT DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS dict_parking_construction_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    sort_order INT DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dict_infra_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    sort_order INT DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dict_mop_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    sort_order INT DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dict_unit_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    sort_order INT DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed: idempotent
INSERT INTO dict_project_statuses(code, label, sort_order) VALUES
('project', 'Проектный', 10),
('building', 'Строящийся', 20),
('ready', 'Готовый к вводу', 30),
('commissioned', 'Введенный', 40),
('archive', 'Архив', 50)
ON CONFLICT (code) DO NOTHING;

INSERT INTO dict_application_statuses(code, label, sort_order) VALUES
('NEW', 'Новая', 10),
('DRAFT', 'В работе', 20),
('REVIEW', 'На проверке', 30),
('APPROVED', 'Принято', 40),
('REJECTED', 'Возврат', 50),
('INTEGRATION', 'Интеграция', 60),
('COMPLETED', 'Закрыта', 70)
ON CONFLICT (code) DO NOTHING;

INSERT INTO dict_external_systems(code, label, sort_order) VALUES
('DXM', 'ДХМ (Центры госуслуг)', 10),
('EPIGU', 'ЕПИГУ (my.gov.uz)', 20),
('ESCROW', 'ЭСКРОУ', 30),
('SHAFOF', 'Шаффоф Курилиш', 40)
ON CONFLICT (code) DO NOTHING;

INSERT INTO dict_foundations(code, label, sort_order) VALUES
('monolith_plate', 'Монолитная плита', 10),
('pile', 'Свайный', 20),
('strip', 'Ленточный', 30)
ON CONFLICT (code) DO NOTHING;

INSERT INTO dict_wall_materials(code, label, sort_order) VALUES
('monolith_rc', 'Монолитный ж/б', 10),
('brick', 'Кирпич', 20),
('aerated_block', 'Газоблок', 30),
('panel', 'Панель', 40)
ON CONFLICT (code) DO NOTHING;

INSERT INTO dict_slab_types(code, label, sort_order) VALUES
('monolith_rc', 'Монолитные ж/б', 10),
('prefab', 'Сборные плиты', 20),
('wood', 'Деревянные', 30)
ON CONFLICT (code) DO NOTHING;

INSERT INTO dict_roof_types(code, label, sort_order) VALUES
('flat_roll', 'Плоская рулонная', 10),
('pitched', 'Скатная', 20),
('exploited', 'Эксплуатируемая', 30)
ON CONFLICT (code) DO NOTHING;

INSERT INTO dict_light_structure_types(code, label, sort_order) VALUES
('canopy', 'Навес', 10),
('box', 'Бокс', 20)
ON CONFLICT (code) DO NOTHING;

INSERT INTO dict_parking_types(code, label, sort_order) VALUES
('underground', 'Подземный', 10),
('ground', 'Наземный', 20)
ON CONFLICT (code) DO NOTHING;


INSERT INTO dict_parking_construction_types(code, label, sort_order) VALUES
('capital', 'Капитальный', 10),
('light', 'Из легких конструкций', 20),
('open', 'Открытый', 30)
ON CONFLICT (code) DO NOTHING;

INSERT INTO dict_infra_types(code, label, sort_order) VALUES
('school', 'Школа', 10),
('kindergarten', 'Детский сад', 20),
('boiler', 'Котельная', 30),
('checkpoint', 'КПП', 40),
('other', 'Другое', 100)
ON CONFLICT (code) DO NOTHING;

INSERT INTO dict_mop_types(code, label, sort_order) VALUES
('stairs', 'Лестничная клетка', 10),
('corridor', 'Межквартирный коридор', 20),
('elevator_hall', 'Лифтовой холл', 30),
('tambour', 'Тамбур', 40),
('lobby', 'Вестибюль', 50),
('security', 'Комната охраны', 60),
('wc', 'Санузел', 70),
('electric', 'Электрощитовая', 80),
('technical', 'Техническое помещение', 90),
('other', 'Другое', 999)
ON CONFLICT (code) DO NOTHING;

INSERT INTO dict_unit_types(code, label, sort_order) VALUES
('flat', 'Квартира', 10),
('office', 'Офис/коммерция', 20),
('pantry', 'Кладовая', 30),
('parking_place', 'Машиноместо', 40),
('duplex_up', 'Двухуровневая (верх)', 50),
('duplex_down', 'Двухуровневая (низ)', 60)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE dict_project_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE dict_application_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE dict_external_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE dict_foundations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dict_wall_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE dict_slab_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE dict_roof_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE dict_light_structure_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE dict_parking_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE dict_parking_construction_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE dict_infra_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE dict_mop_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE dict_unit_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public All" ON dict_project_statuses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All" ON dict_application_statuses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All" ON dict_external_systems FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All" ON dict_foundations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All" ON dict_wall_materials FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All" ON dict_slab_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All" ON dict_roof_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All" ON dict_light_structure_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All" ON dict_parking_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All" ON dict_parking_construction_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All" ON dict_infra_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All" ON dict_mop_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All" ON dict_unit_types FOR ALL USING (true) WITH CHECK (true);
