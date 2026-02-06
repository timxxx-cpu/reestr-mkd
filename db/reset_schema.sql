-- Full DEV reset schema for reestr-mkd (PostgreSQL/Supabase)
-- WARNING: destructive reset (drops current objects in public schema related to app)

begin;

create extension if not exists "pgcrypto";

-- -----------------------------
-- DROP (children first)
-- -----------------------------
drop table if exists application_steps cascade;
drop table if exists application_history cascade;
drop table if exists basement_parking_levels cascade;
drop table if exists common_areas cascade;
drop table if exists rooms cascade;
drop table if exists units cascade;
drop table if exists entrance_matrix cascade;
drop table if exists entrances cascade;
drop table if exists floors cascade;
drop table if exists basements cascade;
drop table if exists block_floor_markers cascade;
drop table if exists block_engineering cascade;
drop table if exists block_construction cascade;
drop table if exists building_blocks cascade;
drop table if exists buildings cascade;
drop table if exists project_documents cascade;
drop table if exists project_participants cascade;
drop table if exists applications cascade;
drop table if exists projects cascade;

-- catalogs
drop table if exists dict_unit_types cascade;
drop table if exists dict_room_types cascade;
drop table if exists dict_mop_types cascade;
drop table if exists dict_infra_types cascade;
drop table if exists dict_parking_construction_types cascade;
drop table if exists dict_parking_types cascade;
drop table if exists dict_light_structure_types cascade;
drop table if exists dict_roof_types cascade;
drop table if exists dict_slab_types cascade;
drop table if exists dict_wall_materials cascade;
drop table if exists dict_foundations cascade;
drop table if exists dict_external_systems cascade;
drop table if exists dict_application_statuses cascade;
drop table if exists dict_project_statuses cascade;

-- -----------------------------
-- CORE
-- -----------------------------
create table projects (
  id uuid primary key default gen_random_uuid(),
  scope_id text not null,
  name text not null,
  region text,
  district text,
  address text,
  landmark text,
  cadastre_number text,
  construction_status text,
  date_start_project date,
  date_end_project date,
  date_start_fact date,
  date_end_fact date,
  integration_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_projects_scope on projects(scope_id);
create index idx_projects_updated on projects(updated_at desc);

create table applications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references projects(id) on delete cascade,
  scope_id text not null,
  internal_number text,
  external_source text,
  external_id text,
  applicant text,
  submission_date timestamptz,
  assignee_name text,
  status text not null default 'DRAFT',
  current_step int not null default 0,
  current_stage int not null default 1,
  integration_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_applications_scope on applications(scope_id);
create index idx_applications_project_scope on applications(project_id, scope_id);

create table application_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  action text,
  prev_status text,
  next_status text,
  user_name text,
  comment text,
  created_at timestamptz not null default now()
);
create index idx_app_history_app_created on application_history(application_id, created_at desc);

create table application_steps (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  step_index int not null,
  is_completed boolean not null default false,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(application_id, step_index)
);

create table project_participants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  role text not null,
  name text,
  inn text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, role)
);

create table project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text,
  doc_type text,
  doc_date date,
  doc_number text,
  file_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_project_documents_project_date on project_documents(project_id, doc_date desc);

-- -----------------------------
-- BUILDINGS + BLOCKS
-- -----------------------------
create table buildings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  label text not null,
  house_number text,
  category text not null,
  stage text,
  date_start date,
  date_end date,
  construction_type text,
  parking_type text,
  infra_type text,
  has_non_res_part boolean not null default false,
  cadastre_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_buildings_project on buildings(project_id);

create table building_blocks (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id) on delete cascade,
  label text not null,
  type text not null,
  floors_count int default 0,
  floors_from int,
  floors_to int,
  entrances_count int default 0,
  elevators_count int default 0,
  vehicle_entries int default 0,
  levels_depth int default 0,
  light_structure_type text,
  has_basement boolean default false,
  has_attic boolean default false,
  has_loft boolean default false,
  has_roof_expl boolean default false,
  has_custom_address boolean default false,
  custom_house_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_blocks_building on building_blocks(building_id);

create table block_construction (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null unique references building_blocks(id) on delete cascade,
  foundation text,
  walls text,
  slabs text,
  roof text,
  seismicity int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table block_engineering (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null unique references building_blocks(id) on delete cascade,
  has_electricity boolean default false,
  has_water boolean default false,
  has_hot_water boolean default false,
  has_sewerage boolean default false,
  has_gas boolean default false,
  has_heating boolean default false,
  has_ventilation boolean default false,
  has_firefighting boolean default false,
  has_lowcurrent boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table basements (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id) on delete cascade,
  block_id uuid not null references building_blocks(id) on delete cascade,
  depth int not null,
  has_parking boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_basements_building on basements(building_id);
create index idx_basements_block on basements(block_id);

create table block_floor_markers (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references building_blocks(id) on delete cascade,
  marker_key text not null,
  marker_type text not null,
  floor_index int,
  parent_floor_index int,
  is_technical boolean not null default false,
  is_commercial boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(block_id, marker_key),
  check (marker_type in ('floor', 'technical', 'special', 'basement'))
);
create index idx_block_floor_markers_block on block_floor_markers(block_id);

create table basement_parking_levels (
  id uuid primary key default gen_random_uuid(),
  basement_id uuid not null references basements(id) on delete cascade,
  depth_level int not null,
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(basement_id, depth_level)
);

-- -----------------------------
-- FLOORS / ENTRANCES / UNITS / MOP
-- -----------------------------
create table floors (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references building_blocks(id) on delete cascade,
  index int not null,
  floor_key text,
  label text,
  floor_type text,
  height numeric(10,2),
  area_proj numeric(14,2),
  area_fact numeric(14,2),
  is_duplex boolean default false,
  parent_floor_index int,
  basement_id uuid references basements(id) on delete set null,
  is_technical boolean default false,
  is_commercial boolean default false,
  is_stylobate boolean default false,
  is_basement boolean default false,
  is_attic boolean default false,
  is_loft boolean default false,
  is_roof boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_floors_block on floors(block_id);
create unique index uq_floors_block_idx_parent_basement_expr
  on floors (
    block_id,
    index,
    coalesce(parent_floor_index, -99999),
    coalesce(basement_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create table entrances (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references building_blocks(id) on delete cascade,
  number int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(block_id, number)
);
create index idx_entrances_block on entrances(block_id);

create table entrance_matrix (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references building_blocks(id) on delete cascade,
  floor_id uuid not null references floors(id) on delete cascade,
  entrance_number int not null,
  flats_count int default 0,
  commercial_count int default 0,
  mop_count int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(block_id, floor_id, entrance_number)
);
create index idx_entrance_matrix_block_floor on entrance_matrix(block_id, floor_id);

create table units (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references floors(id) on delete cascade,
  entrance_id uuid references entrances(id) on delete set null,
  number text,
  unit_type text not null,
  total_area numeric(14,2) default 0,
  living_area numeric(14,2) default 0,
  useful_area numeric(14,2) default 0,
  rooms_count int default 0,
  status text default 'free',
  cadastre_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_units_floor on units(floor_id);
create index idx_units_entrance on units(entrance_id);
create index idx_units_type on units(unit_type);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  room_type text,
  name text,
  area numeric(14,2) default 0,
  level int default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_rooms_unit on rooms(unit_id);

create table common_areas (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references floors(id) on delete cascade,
  entrance_id uuid references entrances(id) on delete set null,
  type text,
  area numeric(14,2) default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_common_areas_floor on common_areas(floor_id);

-- -----------------------------
-- CATALOGS (dict_*)
-- -----------------------------
create table dict_project_statuses (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  label text not null,
  sort_order int not null default 100,
  is_active boolean not null default true
);

create table dict_application_statuses (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  label text not null,
  sort_order int not null default 100,
  is_active boolean not null default true
);

create table dict_external_systems (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  label text not null,
  sort_order int not null default 100,
  is_active boolean not null default true
);

create table dict_foundations (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  label text not null,
  sort_order int not null default 100,
  is_active boolean not null default true
);

create table dict_wall_materials (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  label text not null,
  sort_order int not null default 100,
  is_active boolean not null default true
);

create table dict_slab_types (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  label text not null,
  sort_order int not null default 100,
  is_active boolean not null default true
);

create table dict_roof_types (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  label text not null,
  sort_order int not null default 100,
  is_active boolean not null default true
);

create table dict_light_structure_types (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  label text not null,
  sort_order int not null default 100,
  is_active boolean not null default true
);

create table dict_parking_types (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  label text not null,
  sort_order int not null default 100,
  is_active boolean not null default true
);

create table dict_parking_construction_types (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  label text not null,
  sort_order int not null default 100,
  is_active boolean not null default true
);

create table dict_infra_types (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  label text not null,
  sort_order int not null default 100,
  is_active boolean not null default true
);

create table dict_mop_types (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  label text not null,
  sort_order int not null default 100,
  is_active boolean not null default true
);

create table dict_unit_types (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  label text not null,
  sort_order int not null default 100,
  is_active boolean not null default true
);

create table dict_room_types (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  label text not null,
  room_scope text not null default 'residential',
  area_bucket text not null default 'useful',
  coefficient numeric(6,3) not null default 1.0,
  sort_order int not null default 100,
  unique (code, room_scope),
  is_active boolean not null default true,
  check (room_scope in ('residential', 'commercial')),
  check (area_bucket in ('living', 'main', 'useful', 'aux', 'summer', 'other')),
  check (coefficient >= 0)
);

-- ---------------------------------------------------------
-- Ensure UNIQUE(code) for all dict_* tables except dict_room_types
-- (required for ON CONFLICT (code) ...; safe for re-runs)
-- ---------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select t.tablename
    from pg_tables t
    where t.schemaname = 'public'
      and t.tablename like 'dict\_%' escape '\'
      and t.tablename <> 'dict_room_types'
  loop
    -- add unique(code) only if it doesn't exist yet
    if not exists (
      select 1
      from pg_constraint c
      join pg_class rel on rel.oid = c.conrelid
      join pg_namespace n on n.oid = rel.relnamespace
      where n.nspname = 'public'
        and rel.relname = r.tablename
        and c.contype = 'u'
        and pg_get_constraintdef(c.oid) = 'UNIQUE (code)'
    ) then
      execute format(
        'alter table public.%I add constraint %I unique (code)',
        r.tablename,
        r.tablename || '_code_uniq'
      );
    end if;
  end loop;
end $$;

-- -----------------------------
-- MINIMUM SEED
-- -----------------------------
insert into dict_project_statuses(code, label, sort_order) values
('project', 'Проектный', 10),
('building', 'Строящийся', 20),
('ready', 'Готовый к вводу', 30),
('done', 'Введенный', 40)
on conflict (code) do nothing;

insert into dict_application_statuses(code, label, sort_order) values
('NEW', 'Новая', 10),
('DRAFT', 'В работе', 20),
('REVIEW', 'На проверке', 30),
('APPROVED', 'Принято', 40),
('REJECTED', 'Возврат', 50),
('INTEGRATION', 'Интеграция', 60),
('COMPLETED', 'Закрыта', 70)
on conflict (code) do nothing;

insert into dict_external_systems(code, label, sort_order) values
('DXM', 'ДХМ (Центры госуслуг)', 10),
('EPIGU', 'ЕПИГУ (my.gov.uz)', 20),
('ESCROW', 'ЭСКРОУ', 30),
('SHAFOF', 'Шаффоф Курилиш', 40)
on conflict (code) do nothing;

insert into dict_unit_types(code, label, sort_order) values
('flat', 'Квартира', 10),
('duplex_up', 'Дуплекс (В)', 20),
('duplex_down', 'Дуплекс (Н)', 30),
('office', 'Офис', 40),
('office_inventory', 'Нежилое (Инв.)', 50),
('non_res_block', 'Нежилой блок', 60),
('infrastructure', 'Инфраструктура', 70),
('parking_place', 'Машиноместо', 80)
on conflict (code) do nothing;

insert into dict_mop_types(code, label, sort_order) values
('STAIR', 'Лестничная клетка', 10),
('CORRIDOR', 'Межквартирный коридор', 20),
('ELEVATOR_HALL', 'Лифтовой холл', 30),
('TECH', 'Техническое помещение', 40),
('OTHER', 'Другое', 100)
on conflict (code) do nothing;

insert into dict_room_types(code, label, room_scope, area_bucket, coefficient, sort_order) values
('living', 'Жилая комната', 'residential', 'living', 1.0, 10),
('kitchen', 'Кухня', 'residential', 'useful', 1.0, 20),
('kitchen_living', 'Кухня-гостиная', 'residential', 'living', 1.0, 30),
('bathroom', 'Ванная / С/У', 'residential', 'useful', 1.0, 40),
('corridor', 'Коридор / Холл', 'residential', 'useful', 1.0, 50),
('pantry', 'Кладовая / Гардероб', 'residential', 'useful', 1.0, 60),
('staircase', 'Внутрикв. лестница', 'residential', 'useful', 1.0, 70),
('loggia', 'Лоджия', 'residential', 'summer', 0.5, 80),
('balcony', 'Балкон', 'residential', 'summer', 0.3, 90),
('other', 'Другое', 'residential', 'other', 1.0, 100),
('main_hall', 'Торговый зал / Опенспейс', 'commercial', 'main', 1.0, 210),
('cabinet', 'Кабинет', 'commercial', 'main', 1.0, 220),
('storage', 'Склад / Подсобное', 'commercial', 'aux', 1.0, 230),
('kitchen', 'Кухня (для персонала)', 'commercial', 'aux', 1.0, 240),
('bathroom', 'Санузел', 'commercial', 'aux', 1.0, 250),
('corridor', 'Коридор', 'commercial', 'aux', 1.0, 260),
('tambour', 'Тамбур / Входная группа', 'commercial', 'aux', 1.0, 270),
('tech', 'Тех. помещение', 'commercial', 'aux', 1.0, 280),
('terrace', 'Терраса', 'commercial', 'summer', 0.3, 290)
on conflict (code, room_scope) do nothing;

-- lightweight defaults for remaining dicts
insert into dict_foundations(code, label) values ('MONOLITH', 'Монолитный') on conflict (code) do nothing;
insert into dict_wall_materials(code, label) values ('BRICK', 'Кирпич') on conflict (code) do nothing;
insert into dict_slab_types(code, label) values ('RC', 'Ж/Б') on conflict (code) do nothing;
insert into dict_roof_types(code, label) values ('FLAT', 'Плоская') on conflict (code) do nothing;
insert into dict_light_structure_types(code, label) values ('STANDARD', 'Стандарт') on conflict (code) do nothing;
insert into dict_parking_types(code, label) values ('underground', 'Подземный'), ('aboveground', 'Наземный') on conflict (code) do nothing;
insert into dict_parking_construction_types(code, label) values ('capital', 'Капитальный'), ('light', 'Из легких конструкций'), ('open', 'Открытый') on conflict (code) do nothing;
insert into dict_infra_types(code, label) values ('school', 'Школа'), ('kindergarten', 'Детский сад'), ('other', 'Другое') on conflict (code) do nothing;


-- -----------------------------
-- DEV RLS: enable + full access for anon/authenticated
-- WARNING: only for test/dev environments
-- -----------------------------

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;

do $$
declare
  tbl record;
begin
  for tbl in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', tbl.tablename);

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = tbl.tablename
        and policyname = 'anon_full_access'
    ) then
      execute format(
        'create policy anon_full_access on public.%I for all to anon using (true) with check (true)',
        tbl.tablename
      );
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = tbl.tablename
        and policyname = 'authenticated_full_access'
    ) then
      execute format(
        'create policy authenticated_full_access on public.%I for all to authenticated using (true) with check (true)',
        tbl.tablename
      );
    end if;
  end loop;
end
$$;

commit;
