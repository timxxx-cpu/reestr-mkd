-- Full DEV reset schema for reestr-mkd (PostgreSQL/Supabase)
-- WARNING: destructive reset (drops current objects in public schema related to app)

begin;

-- Full cleanup to avoid leftover objects (tables/indexes/sequences/triggers/functions)
drop schema if exists public cascade;
create schema public;

create extension if not exists "pgcrypto";
create extension if not exists "postgis";

-- -----------------------------
-- DROP (kept for compatibility in partial/manual reruns)
-- -----------------------------
drop table if exists application_steps cascade;
drop table if exists application_history cascade;
drop table if exists application_lock_audit cascade;
drop table if exists application_locks cascade;
drop table if exists object_versions cascade;
drop table if exists dict_version_statuses cascade;
drop table if exists dict_workflow_substatuses;
drop table if exists common_areas cascade;
drop table if exists rooms cascade;
drop table if exists units cascade;
drop table if exists entrance_matrix cascade;
drop table if exists entrances cascade;
drop table if exists floors cascade;
drop table if exists block_extensions cascade;
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
drop table if exists dict_extension_types cascade;
drop table if exists dict_roof_types cascade;
drop table if exists dict_slab_types cascade;
drop table if exists dict_wall_materials cascade;
drop table if exists dict_foundations cascade;
drop table if exists dict_external_systems cascade;
drop table if exists dict_application_statuses cascade;
drop table if exists dict_project_statuses cascade;
drop table if exists dict_system_users cascade;
drop table if exists addresses cascade;
drop table if exists makhallas cascade;
drop table if exists streets cascade;
drop table if exists districts cascade;
drop table if exists regions cascade;

-- -----------------------------
-- ADDRESS REGISTRIES
-- -----------------------------
create table if not exists regions (
  id uuid primary key default gen_random_uuid(),
  name_uk text,
  name_uz text,
  name_en text,
  name_ru text,
  status integer default 1,
  soato text unique,
  cadastral_prefix text,
  ordering integer default 1,
  geom geometry(MultiPolygon, 3857)
);

create table if not exists districts (
  id uuid primary key default gen_random_uuid(),
  name_uz text,
  name_uk text,
  name_ru text,
  name_en text,
  ordering integer,
  status integer default 1,
  soato text unique,
  region_id uuid references regions(id) on delete set null,
  cadastral_prefix text,
  geom geometry(MultiPolygon, 3857)
);
create index idx_regions_geom on regions using gist(geom);

create index idx_districts_region on districts(region_id);
create index idx_districts_status on districts(status);
create index idx_districts_geom on districts using gist(geom);

create table if not exists streets (
  id uuid primary key default gen_random_uuid(),
  status integer default 1,
  name text,
  district_soato text,
  code text unique,
  region_soato text,
  street_type text,
  foreign key (region_soato) references regions(soato) on delete set null,
  foreign key (district_soato) references districts(soato) on delete set null
);
create index idx_streets_region_soato on streets(region_soato);
create index idx_streets_district_soato on streets(district_soato);

create table if not exists makhallas (
  id uuid primary key default gen_random_uuid(),
  name text,
  code text unique,
  region_soato text references regions(soato) on delete set null,
  status integer default 1,
  old_code text,
  district_soato text references districts(soato) on delete set null,
  geom geometry(MultiPolygon, 3857)
);
create index idx_makhallas_region_soato on makhallas(region_soato);
create index idx_makhallas_district_soato on makhallas(district_soato);
create index idx_makhallas_geom on makhallas using gist(geom);

create table if not exists addresses (
  dtype varchar(31) not null,
  id uuid primary key default gen_random_uuid(),
  versionrev integer not null,
  address_line1 text,
  address_line2 text,
  city text,
  description text,
  full_address text,
  po_box text,
  postal_code text,
  village text,
  apartment_no text,
  building_no text,
  floor_no text,
  cad_district text,
  country text,
  county text,
  district text references districts(soato) on delete set null,
  address_type text,
  mahalla uuid references makhallas(id) on delete set null,
  massive text,
  street uuid references streets(id) on delete set null,
  building_no_index varchar(20)
);
create index idx_addresses_postal_code on addresses(postal_code);
create index idx_addresses_mahalla on addresses(mahalla);
create index idx_addresses_street on addresses(street);

-- -----------------------------
-- DEFAULT ADDRESS REGISTRY DATA (TASHKENT)
-- -----------------------------
insert into regions (name_uk, name_uz, name_en, name_ru, status, soato, cadastral_prefix, ordering)
values ('Toshkent shahri', 'Toshkent shahri', 'Tashkent city', 'Город Ташкент', 1, '1726', '01', 1)
on conflict (soato) do update
set name_uk = excluded.name_uk,
    name_uz = excluded.name_uz,
    name_en = excluded.name_en,
    name_ru = excluded.name_ru,
    status = excluded.status,
    cadastral_prefix = excluded.cadastral_prefix,
    ordering = excluded.ordering;

insert into districts (name_uz, name_uk, name_ru, name_en, ordering, status, soato, region_id, cadastral_prefix)
select
  d.name_uz,
  d.name_uk,
  d.name_ru,
  d.name_en,
  d.ordering,
  1,
  d.soato,
  r.id,
  d.cadastral_prefix
from regions r
cross join (
  values
    ('Bektemir tumani', 'Bektemir tumani', 'Бектемирский район', 'Bektemir district', 1, '1726001', '0101'),
    ('Chilonzor tumani', 'Chilonzor tumani', 'Чиланзарский район', 'Chilanzar district', 2, '1726002', '0102'),
    ('Mirobod tumani', 'Mirobod tumani', 'Мирабадский район', 'Mirabad district', 3, '1726003', '0103'),
    ('Mirzo Ulugʻbek tumani', 'Mirzo Ulugʻbek tumani', 'Мирзо-Улугбекский район', 'Mirzo-Ulugbek district', 4, '1726004', '0104'),
    ('Olmazor tumani', 'Olmazor tumani', 'Алмазарский район', 'Almazar district', 5, '1726005', '0105'),
    ('Sergeli tumani', 'Sergeli tumani', 'Сергелийский район', 'Sergeli district', 6, '1726006', '0106'),
    ('Shayxontohur tumani', 'Shayxontohur tumani', 'Шайхантахурский район', 'Shaykhantakhur district', 7, '1726007', '0107'),
    ('Uchtepa tumani', 'Uchtepa tumani', 'Учтепинский район', 'Uchtepa district', 8, '1726008', '0108'),
    ('Yakkasaroy tumani', 'Yakkasaroy tumani', 'Яккасарайский район', 'Yakkasaray district', 9, '1726009', '0109'),
    ('Yashnobod tumani', 'Yashnobod tumani', 'Яшнабадский район', 'Yashnabad district', 10, '1726010', '0110'),
    ('Yunusobod tumani', 'Yunusobod tumani', 'Юнусабадский район', 'Yunusabad district', 11, '1726260', '0111'),
    ('Yangihayot tumani', 'Yangihayot tumani', 'Янгиҳаётский район', 'Yangihayot district', 12, '1726012', '0112')
) as d(name_uz, name_uk, name_ru, name_en, ordering, soato, cadastral_prefix)
where r.soato = '1726'
on conflict (soato) do update
set name_uz = excluded.name_uz,
    name_uk = excluded.name_uk,
    name_ru = excluded.name_ru,
    name_en = excluded.name_en,
    ordering = excluded.ordering,
    status = excluded.status,
    region_id = excluded.region_id,
    cadastral_prefix = excluded.cadastral_prefix;

insert into streets (status, name, district_soato, code, region_soato, street_type)
select
  1,
  format('Virtual Street %s', gs),
  '1726260',
  format('TSH-ST-%s', lpad(gs::text, 3, '0')),
  '1726',
  'street'
from generate_series(1, 40) gs
on conflict (code) do update
set status = excluded.status,
    name = excluded.name,
    district_soato = excluded.district_soato,
    region_soato = excluded.region_soato,
    street_type = excluded.street_type;

insert into makhallas (name, code, region_soato, status, old_code, district_soato)
select
  format('Virtual Makhalla %s', gs),
  format('TSH-MH-%s', lpad(gs::text, 3, '0')),
  '1726',
  1,
  null,
  '1726260'
from generate_series(1, 40) gs
on conflict (code) do update
set name = excluded.name,
    region_soato = excluded.region_soato,
    status = excluded.status,
    old_code = excluded.old_code,
    district_soato = excluded.district_soato;

-- -----------------------------
-- CORE
-- -----------------------------
create table projects (
  id uuid primary key default gen_random_uuid(),
  scope_id text not null,
  uj_code text,
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
  address_id uuid references addresses(id) on delete set null,
  land_plot_geojson jsonb,
  land_plot_geom geometry(MultiPolygon, 3857),
  land_plot_area_m2 numeric(14,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_projects_scope on projects(scope_id);
create index idx_projects_updated on projects(updated_at desc);
create unique index idx_projects_uj_code on projects(uj_code) where uj_code is not null;
create index idx_projects_land_plot_geom on projects using gist(land_plot_geom);
create index idx_projects_address_id on projects(address_id);

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
  status text not null default 'IN_PROGRESS',
  workflow_substatus text not null default 'DRAFT',
  current_step int not null default 0,
  current_stage int not null default 1,
  integration_data jsonb default '{}'::jsonb,
  requested_decline_reason text,
  requested_decline_step int,
  requested_decline_by text,
  requested_decline_at timestamptz,
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



-- -----------------------------
-- APPLICATION LOCKS
-- -----------------------------
create table application_locks (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references applications(id) on delete cascade,
  owner_user_id text not null,
  owner_role text,
  acquired_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_application_locks_expires on application_locks(expires_at);

create table application_lock_audit (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  action text not null, -- ACQUIRE | REFRESH | RELEASE | DENY
  actor_user_id text,
  actor_role text,
  prev_owner_user_id text,
  next_owner_user_id text,
  comment text,
  created_at timestamptz not null default now()
);
create index idx_lock_audit_app_created on application_lock_audit(application_id, created_at desc);

create or replace function acquire_application_lock(
  p_application_id uuid,
  p_owner_user_id text,
  p_owner_role text,
  p_ttl_seconds int default 1200
)
returns table(ok boolean, reason text, message text, expires_at timestamptz)
language plpgsql
as $$
declare
  v_app applications%rowtype;
  v_lock application_locks%rowtype;
  v_expires_at timestamptz;
begin
  select * into v_app from applications where id = p_application_id;
  if not found then
    return query select false, 'NOT_FOUND'::text, 'Заявка не найдена'::text, null::timestamptz;
    return;
  end if;

  if p_owner_role = 'technician' and v_app.assignee_name is not null and v_app.assignee_name <> p_owner_user_id then
    insert into application_lock_audit(application_id, action, actor_user_id, actor_role, comment)
    values (p_application_id, 'DENY', p_owner_user_id, p_owner_role, 'ASSIGNEE_MISMATCH');

    return query select false, 'ASSIGNEE_MISMATCH'::text,
      format('Заявка назначена на %s. Взять в работу нельзя.', v_app.assignee_name), null::timestamptz;
    return;
  end if;

  v_expires_at := now() + make_interval(secs => greatest(60, p_ttl_seconds));

  insert into application_locks(application_id, owner_user_id, owner_role, acquired_at, expires_at, updated_at)
  values (p_application_id, p_owner_user_id, p_owner_role, now(), v_expires_at, now())
  on conflict (application_id) do update
    set owner_user_id = excluded.owner_user_id,
        owner_role = excluded.owner_role,
        acquired_at = now(),
        expires_at = excluded.expires_at,
        updated_at = now()
    where application_locks.owner_user_id = p_owner_user_id
       or application_locks.expires_at <= now();

  select * into v_lock from application_locks where application_id = p_application_id;

  if v_lock.owner_user_id = p_owner_user_id then
    insert into application_lock_audit(application_id, action, actor_user_id, actor_role, next_owner_user_id)
    values (p_application_id, 'ACQUIRE', p_owner_user_id, p_owner_role, p_owner_user_id);

    return query select true, 'OK'::text, 'LOCK_ACQUIRED'::text, v_lock.expires_at;
    return;
  end if;

  insert into application_lock_audit(application_id, action, actor_user_id, actor_role, prev_owner_user_id, comment)
  values (p_application_id, 'DENY', p_owner_user_id, p_owner_role, v_lock.owner_user_id, 'LOCKED');

  return query select false, 'LOCKED'::text,
    format('Заявка уже открыта пользователем %s. Попробуйте позже.', v_lock.owner_user_id),
    v_lock.expires_at;
end;
$$;

create or replace function refresh_application_lock(
  p_application_id uuid,
  p_owner_user_id text,
  p_ttl_seconds int default 1200
)
returns table(ok boolean, reason text, message text, expires_at timestamptz)
language plpgsql
as $$
declare
  v_lock application_locks%rowtype;
  v_expires_at timestamptz;
begin
  select * into v_lock from application_locks where application_id = p_application_id;
  if not found then
    return query select false, 'NOT_FOUND'::text, 'LOCK_NOT_FOUND'::text, null::timestamptz;
    return;
  end if;

  if v_lock.owner_user_id <> p_owner_user_id then
    return query select false, 'OWNER_MISMATCH'::text, 'LOCK_OWNER_MISMATCH'::text, v_lock.expires_at;
    return;
  end if;

  v_expires_at := now() + make_interval(secs => greatest(60, p_ttl_seconds));

  update application_locks
    set expires_at = v_expires_at,
        updated_at = now()
    where application_id = p_application_id
      and owner_user_id = p_owner_user_id;

  insert into application_lock_audit(application_id, action, actor_user_id, actor_role, prev_owner_user_id, next_owner_user_id)
  values (p_application_id, 'REFRESH', p_owner_user_id, v_lock.owner_role, p_owner_user_id, p_owner_user_id);

  return query select true, 'OK'::text, 'LOCK_REFRESHED'::text, v_expires_at;
end;
$$;

create or replace function release_application_lock(
  p_application_id uuid,
  p_owner_user_id text
)
returns table(ok boolean, reason text, message text)
language plpgsql
as $$
declare
  v_lock application_locks%rowtype;
begin
  select * into v_lock from application_locks where application_id = p_application_id;
  if not found then
    return query select false, 'NOT_FOUND'::text, 'LOCK_NOT_FOUND'::text;
    return;
  end if;

  if v_lock.owner_user_id <> p_owner_user_id then
    return query select false, 'OWNER_MISMATCH'::text, 'LOCK_OWNER_MISMATCH'::text;
    return;
  end if;

  delete from application_locks where application_id = p_application_id and owner_user_id = p_owner_user_id;

  insert into application_lock_audit(application_id, action, actor_user_id, actor_role, prev_owner_user_id)
  values (p_application_id, 'RELEASE', p_owner_user_id, v_lock.owner_role, p_owner_user_id);

  return query select true, 'OK'::text, 'LOCK_RELEASED'::text;
end;
$$;

create table application_steps (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  step_index int not null,
  is_completed boolean not null default false,
  is_verified boolean not null default false,
  block_statuses jsonb not null default '{}'::jsonb,
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
  building_code text,
  label text not null,
  house_number text,
  address_id uuid references addresses(id) on delete set null,
  category text not null,
  stage text,
  date_start date,
  date_end date,
  construction_type text,
  parking_type text,
  infra_type text,
  has_non_res_part boolean not null default false,
  cadastre_number text,
  footprint_geojson jsonb,
  building_footprint_geom geometry(MultiPolygon, 3857),
  building_footprint_area_m2 numeric(14,2),
  geometry_candidate_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_buildings_project on buildings(project_id);
create unique index idx_buildings_code on buildings(building_code) where building_code is not null;
create index idx_buildings_footprint_geom on buildings using gist(building_footprint_geom);
create index idx_buildings_address_id on buildings(address_id);

create table project_geometry_candidates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  source_index int not null,
  label text,
  properties jsonb not null default '{}'::jsonb,
  geom_geojson jsonb not null,
  geom geometry(MultiPolygon, 3857),
  area_m2 numeric(14,2),
  is_selected_land_plot boolean not null default false,
  assigned_building_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_proj_geom_candidates unique(project_id, source_index)
);
create index idx_proj_geom_candidates_project on project_geometry_candidates(project_id);
create index idx_proj_geom_candidates_geom on project_geometry_candidates using gist(geom);
create unique index idx_proj_geom_candidates_land_plot_once
  on project_geometry_candidates(project_id)
  where is_selected_land_plot = true;
create unique index idx_proj_geom_candidates_building_once
  on project_geometry_candidates(project_id, assigned_building_id)
  where assigned_building_id is not null;

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
  parent_blocks uuid[],
  is_basement_block boolean not null default false,
  linked_block_ids uuid[] not null default '{}',
  basement_depth int,
  basement_has_parking boolean not null default false,
  basement_parking_levels jsonb not null default '{}'::jsonb,
  basement_communications jsonb not null default '{}'::jsonb,
  has_basement boolean default false,
  has_attic boolean default false,
  has_loft boolean default false,
  has_roof_expl boolean default false,
  has_custom_address boolean default false,
  custom_house_number text,
  address_id uuid references addresses(id) on delete set null,
  footprint_geojson jsonb,
  block_footprint_geom geometry(MultiPolygon, 3857),
  block_footprint_area_m2 numeric(14,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_blocks_building on building_blocks(building_id);
create index idx_blocks_is_basement on building_blocks(is_basement_block);
create index idx_blocks_linked_basement_targets on building_blocks using gin(linked_block_ids);
create index idx_blocks_address_id on building_blocks(address_id);
create index idx_blocks_footprint_geom on building_blocks using gist(block_footprint_geom);
alter table building_blocks add constraint chk_basement_depth_range
  check (not is_basement_block or (basement_depth is not null and basement_depth between 1 and 10));


create or replace function validate_basement_block_rules()
returns trigger
language plpgsql
as $$
declare
  b_category text;
  b_parking_type text;
  b_construction_type text;
  basement_count int;
  regular_blocks_count int;
  lvl record;
  depth_limit int;
  comm_key text;
begin
  if not new.is_basement_block then
    return new;
  end if;

  select category, parking_type, construction_type
    into b_category, b_parking_type, b_construction_type
  from buildings
  where id = new.building_id;


  depth_limit := coalesce(new.basement_depth, 1);

  if new.basement_parking_levels is null or jsonb_typeof(new.basement_parking_levels) <> 'object' then
    raise exception 'basement_parking_levels must be a JSON object';
  end if;

  for lvl in select key, value from jsonb_each(new.basement_parking_levels)
  loop
    if lvl.key !~ '^[0-9]+$' then
      raise exception 'basement_parking_levels keys must be positive integer strings';
    end if;
    if (lvl.key)::int < 1 or (lvl.key)::int > depth_limit then
      raise exception 'basement parking level % is out of basement depth bounds', lvl.key;
    end if;
    if jsonb_typeof(lvl.value) <> 'boolean' then
      raise exception 'basement_parking_levels values must be boolean';
    end if;
  end loop;

  if new.basement_communications is null or jsonb_typeof(new.basement_communications) <> 'object' then
    raise exception 'basement_communications must be a JSON object';
  end if;

  for comm_key in select unnest(array['electricity','water','sewerage','heating','ventilation','gas','firefighting'])
  loop
    if not (new.basement_communications ? comm_key) then
      raise exception 'basement_communications must contain key %', comm_key;
    end if;
    if jsonb_typeof(new.basement_communications -> comm_key) <> 'boolean' then
      raise exception 'basement_communications.% must be boolean', comm_key;
    end if;
  end loop;

  if array_length(new.linked_block_ids, 1) is not null then
    select count(*) into regular_blocks_count
    from building_blocks bb
    where bb.building_id = new.building_id
      and bb.is_basement_block = false
      and bb.id = any(new.linked_block_ids);

    if regular_blocks_count <> array_length(new.linked_block_ids, 1) then
      raise exception 'linked_block_ids must reference regular blocks of same building';
    end if;
  end if;

  if b_category = 'infrastructure' then
    select count(*) into basement_count
    from building_blocks bb
    where bb.building_id = new.building_id
      and bb.is_basement_block = true
      and bb.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
    if basement_count >= 1 then
      raise exception 'Infrastructure building can have only one basement block';
    end if;
  end if;

  if b_category = 'parking_separate' and b_parking_type = 'aboveground' and b_construction_type in ('light', 'open') then
    raise exception 'Aboveground light/open parking cannot have basement blocks';
  end if;

  return new;
end;
$$;

create trigger trg_validate_basement_block_rules
  before insert or update on building_blocks
  for each row
  execute function validate_basement_block_rules();

create table block_extensions (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id) on delete cascade,
  parent_block_id uuid not null references building_blocks(id) on delete cascade,
  label text not null,
  extension_type text not null default 'OTHER',
  construction_kind text not null default 'capital',
  floors_count int not null default 1,
  start_floor_index int not null default 1,
  vertical_anchor_type text not null default 'GROUND',
  anchor_floor_key text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (floors_count >= 1),
  check (start_floor_index >= 1),
  check (construction_kind in ('capital', 'light')),
  check (vertical_anchor_type in ('GROUND', 'BLOCK_FLOOR', 'ROOF')),
  check (
    (vertical_anchor_type = 'GROUND' and anchor_floor_key is null)
    or (vertical_anchor_type in ('BLOCK_FLOOR', 'ROOF'))
  )
);
create index idx_block_extensions_building on block_extensions(building_id);
create index idx_block_extensions_parent on block_extensions(parent_block_id);
create index idx_block_extensions_anchor on block_extensions(parent_block_id, start_floor_index);

create or replace function validate_block_extension_rules()
returns trigger
language plpgsql
as $$
declare
  v_parent building_blocks%rowtype;
  v_has_anchor boolean;
begin
  select * into v_parent from building_blocks where id = new.parent_block_id;

  if not found then
    raise exception 'parent block % not found for extension', new.parent_block_id;
  end if;

  if v_parent.building_id <> new.building_id then
    raise exception 'extension building_id must match parent block building_id';
  end if;

  if v_parent.is_basement_block then
    raise exception 'basement block cannot be parent for block extension';
  end if;

  if new.vertical_anchor_type = 'BLOCK_FLOOR' then
    select exists(
      select 1
      from block_floor_markers m
      where m.block_id = new.parent_block_id
        and m.floor_index = new.start_floor_index
    ) into v_has_anchor;

    if not v_has_anchor then
      raise exception 'start_floor_index % not found in parent block floor markers', new.start_floor_index;
    end if;
  end if;

  if new.vertical_anchor_type = 'ROOF' and coalesce(v_parent.has_roof_expl, false) = false then
    raise exception 'ROOF extension requires parent block with exploitable roof';
  end if;

  return new;
end;
$$;

create trigger trg_validate_block_extension_rules
  before insert or update on block_extensions
  for each row execute function validate_block_extension_rules();

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
  has_heating_local boolean default false,
  has_heating_central boolean default false,
  has_ventilation boolean default false,
  has_firefighting boolean default false,
  has_lowcurrent boolean default false,
  has_internet boolean default false,
  has_solar_panels boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table block_floor_markers (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references building_blocks(id) on delete cascade,
  marker_key text not null,
  marker_type text not null check (marker_type in ('floor', 'technical', 'special', 'basement')),
  floor_index int,
  parent_floor_index int,
  is_technical boolean not null default false,
  is_commercial boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(block_id, marker_key)
);
create index idx_block_floor_markers_block on block_floor_markers(block_id);
-- -----------------------------
-- FLOORS / ENTRANCES / UNITS / MOP
-- -----------------------------
create table floors (
  id uuid primary key default gen_random_uuid(),
  block_id uuid references building_blocks(id) on delete cascade,
  extension_id uuid references block_extensions(id) on delete cascade,
  index int not null,
  floor_key text,
  label text,
  floor_type text,
  height numeric(10,2),
  area_proj numeric(14,2),
  area_fact numeric(14,2),
  is_duplex boolean default false,
  parent_floor_index int,
  basement_id uuid references building_blocks(id) on delete set null,
  is_technical boolean default false,
  is_commercial boolean default false,
  is_stylobate boolean default false,
  is_basement boolean default false,
  is_attic boolean default false,
  is_loft boolean default false,
  is_roof boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (((block_id is not null)::int + (extension_id is not null)::int) = 1)
);
create index idx_floors_block on floors(block_id);
create index idx_floors_extension on floors(extension_id);
create unique index uq_floors_block_idx_parent_basement_expr
  on floors (
    block_id,
    index,
    coalesce(parent_floor_index, -99999),
    coalesce(basement_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(extension_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
-- Performance: composite index for sorted floor queries
create index idx_floors_block_index on floors(coalesce(block_id, '00000000-0000-0000-0000-000000000000'::uuid), index);

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
  extension_id uuid references block_extensions(id) on delete cascade,
  entrance_id uuid references entrances(id) on delete set null,
  unit_code text,
  number text,
  unit_type text not null,
  has_mezzanine boolean not null default false,
  mezzanine_type text,
  total_area numeric(14,2) default 0,
  living_area numeric(14,2) default 0,
  useful_area numeric(14,2) default 0,
  rooms_count int default 0,
  status text default 'free',
  cadastre_number text,
  address_id uuid references addresses(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (mezzanine_type in ('internal', 'external') or mezzanine_type is null),
  check ((has_mezzanine = false and mezzanine_type is null) or has_mezzanine = true)
);
create index idx_units_floor on units(floor_id);
create index idx_units_extension on units(extension_id);
create index idx_units_entrance on units(entrance_id);
create index idx_units_type on units(unit_type);
-- Performance: composite index for units by floor and entrance queries
create index idx_units_floor_entrance on units(floor_id, entrance_id);
create unique index idx_units_code on units(unit_code) where unit_code is not null;
create index idx_units_address_id on units(address_id);

create or replace function validate_unit_extension_consistency()
returns trigger
language plpgsql
as $$
declare
  v_floor_extension_id uuid;
begin
  select extension_id into v_floor_extension_id from floors where id = new.floor_id;

  if not found then
    raise exception 'Floor % not found for unit', new.floor_id;
  end if;

  if (new.extension_id is null and v_floor_extension_id is not null)
     or (new.extension_id is not null and v_floor_extension_id is null)
     or (new.extension_id is not null and v_floor_extension_id is not null and new.extension_id <> v_floor_extension_id) then
    raise exception 'units.extension_id must match floors.extension_id for floor %', new.floor_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_units_extension_consistency on units;
create trigger trg_units_extension_consistency
before insert or update on units
for each row execute function validate_unit_extension_consistency();

create table rooms (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  room_type text,
  name text,
  area numeric(14,2) default 0,
  room_height numeric(8,2),
  level int default 1,
  is_mezzanine boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_rooms_unit on rooms(unit_id);
-- Performance: composite index for room queries with type filtering
create index idx_rooms_unit_type on rooms(unit_id, room_type);

create table common_areas (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references floors(id) on delete cascade,
  entrance_id uuid references entrances(id) on delete set null,
  type text,
  area numeric(14,2) default 0,
  height numeric(8,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_common_areas_floor on common_areas(floor_id);
-- Performance: composite index for common areas by floor and entrance queries
create index idx_common_areas_floor_entrance on common_areas(floor_id, entrance_id);

-- -----------------------------
-- CATALOGS (dict_*)
-- -----------------------------

create table object_versions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  version_number int not null default 1,
  version_status text not null default 'PENDING',
  snapshot_data jsonb not null default '{}'::jsonb,
  created_by text,
  approved_by text,
  declined_by text,
  decline_reason text,
  application_id uuid references applications(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_entity_version unique (entity_type, entity_id, version_number),
  constraint chk_obj_version_status check (version_status in ('CURRENT', 'PENDING', 'REJECTED', 'PREVIOUS'))
);
create index idx_obj_versions_entity on object_versions(entity_type, entity_id);
create index idx_obj_versions_status on object_versions(version_status);
create index idx_obj_versions_app on object_versions(application_id);
create unique index uq_entity_actual on object_versions(entity_type, entity_id)
  where version_status = 'CURRENT';
create unique index uq_entity_in_work on object_versions(entity_type, entity_id)
  where version_status = 'PENDING';

create table dict_version_statuses (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  label text not null,
  color text,
  sort_order int not null default 100,
  is_active boolean not null default true
);

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

create table dict_extension_types (
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

create table dict_system_users (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  role text not null,
  group_name text,
  sort_order int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (role in ('admin', 'branch_manager', 'controller', 'technician'))
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

-- Внешние статусы заявлений (3 вида)
insert into dict_application_statuses(code, label, sort_order) values
('IN_PROGRESS', 'В работе', 10),
('COMPLETED', 'Завершено', 20),
('DECLINED', 'Отказано', 30)
on conflict (code) do nothing;

-- Подстатусы workflow (внутренние)
create table if not exists dict_workflow_substatuses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  parent_status text not null,
  label text not null,
  sort_order int not null default 100,
  is_active boolean not null default true
);

insert into dict_workflow_substatuses(code, parent_status, label, sort_order) values
('DRAFT',                  'IN_PROGRESS', 'Ввод данных',             10),
('REVIEW',                 'IN_PROGRESS', 'На проверке',             20),
('REVISION',               'IN_PROGRESS', 'На доработке',            30),
('PENDING_DECLINE',        'IN_PROGRESS', 'Запрос на отказ',         35),
('RETURNED_BY_MANAGER',    'IN_PROGRESS', 'Возвращено начальником',  37),
('INTEGRATION',            'IN_PROGRESS', 'Интеграция',              40),
('DONE',                   'COMPLETED',   'Завершено',               50),
('DECLINED_BY_ADMIN',      'DECLINED',    'Отказано (админ)',         60),
('DECLINED_BY_CONTROLLER', 'DECLINED',    'Отказано (контролер)',     70),
('DECLINED_BY_MANAGER',    'DECLINED',    'Отказано (нач. филиала)',  75)
on conflict (code) do nothing;


insert into dict_version_statuses(code, label, color, sort_order) values
('CURRENT', 'Текущая', 'bg-emerald-100 text-emerald-700 border-emerald-200', 10),
('PENDING', 'В ожидании', 'bg-blue-100 text-blue-700 border-blue-200', 20),
('REJECTED', 'Отклонена', 'bg-red-100 text-red-700 border-red-200', 30),
('PREVIOUS', 'Предыдущая', 'bg-slate-100 text-slate-500 border-slate-200', 40)
on conflict (code) do nothing;

insert into dict_external_systems(code, label, sort_order) values
('DXM', 'ДХМ (Центры госуслуг)', 10),
('EPIGU', 'ЕПИГУ (my.gov.uz)', 20),
('ESCROW', 'ЭСКРОУ', 30),
('SHAFOF', 'Шаффоф Курилиш', 40)
on conflict (code) do nothing;

insert into dict_system_users(code, name, role, group_name, sort_order) values
('timur_admin', 'Тимур', 'admin', 'Тимур', 10),
('timur_manager', 'Тимур', 'branch_manager', 'Тимур', 15),
('timur_contr', 'Тимур', 'controller', 'Тимур', 20),
('timur_tech', 'Тимур', 'technician', 'Тимур', 30),
('abdu_admin', 'Абдурашид', 'admin', 'Абдурашид', 40),
('abdu_manager', 'Абдурашид', 'branch_manager', 'Абдурашид', 45),
('abdu_contr', 'Абдурашид', 'controller', 'Абдурашид', 50),
('abdu_tech', 'Абдурашид', 'technician', 'Абдурашид', 60),
('vakhit_admin', 'Вахит', 'admin', 'Вахит', 70),
('vakhit_manager', 'Вахит', 'branch_manager', 'Вахит', 75),
('vakhit_contr', 'Вахит', 'controller', 'Вахит', 80),
('vakhit_tech', 'Вахит', 'technician', 'Вахит', 90),
('abbos_admin', 'Аббос', 'admin', 'Аббос', 100),
('abbos_manager', 'Аббос', 'branch_manager', 'Аббос', 105),
('abbos_contr', 'Аббос', 'controller', 'Аббос', 110),
('abbos_tech', 'Аббос', 'technician', 'Аббос', 120),
('islom_admin', 'Ислом', 'admin', 'Ислом', 130),
('islom_manager', 'Ислом', 'branch_manager', 'Ислом', 135),
('islom_contr', 'Ислом', 'controller', 'Ислом', 140),
('islom_tech', 'Ислом', 'technician', 'Ислом', 145),
('akhad_admin', 'Ахад', 'admin', 'Ахад', 150),
('akhad_manager', 'Ахад', 'branch_manager', 'Ахад', 155),
('akhad_contr', 'Ахад', 'controller', 'Ахад', 160),
('akhad_tech', 'Ахад', 'technician', 'Ахад', 165)
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
insert into dict_extension_types(code, label) values
('CANOPY', 'Навес'),
('TAMBUR', 'Тамбур'),
('VESTIBULE', 'Вестибюль'),
('PASSAGE', 'Переход'),
('UTILITY', 'Подсобка'),
('OTHER', 'Прочее') on conflict (code) do nothing;
insert into dict_light_structure_types(code, label) values ('STANDARD', 'Стандарт') on conflict (code) do nothing;
insert into dict_parking_types(code, label) values ('underground', 'Подземный'), ('aboveground', 'Наземный') on conflict (code) do nothing;
insert into dict_parking_construction_types(code, label) values ('capital', 'Капитальный'), ('light', 'Из легких конструкций'), ('open', 'Открытый') on conflict (code) do nothing;
insert into dict_infra_types(code, label) values ('school', 'Школа'), ('kindergarten', 'Детский сад'), ('other', 'Другое') on conflict (code) do nothing;


-- -----------------------------
-- DEV RLS: enable + full access for anon/authenticated
-- WARNING: only for test/dev environments
-- -----------------------------

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

do $$
declare
  tbl record;
begin
  for tbl in
    select tablename
    from pg_tables
    where schemaname = 'public'
    and tablename != 'spatial_ref_sys'
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

-- -----------------------------
-- PROJECT INIT (RPC, TRANSACTIONAL)
-- -----------------------------
create or replace function init_project_from_application(
  p_scope_id text,
  p_applicant text default null,
  p_address text default null,
  p_cadastre_number text default null,
  p_external_source text default null,
  p_external_id text default null,
  p_submission_date timestamptz default null,
  p_assignee_name text default null
)
returns table(
  ok boolean,
  reason text,
  message text,
  project_id uuid,
  application_id uuid,
  uj_code text
)
language plpgsql
as $$
declare
  v_existing projects%rowtype;
  v_project projects%rowtype;
  v_application applications%rowtype;
  v_max_num int;
  v_uj_code text;
  v_cadastre text;
begin
  if p_scope_id is null or btrim(p_scope_id) = '' then
    return query select false, 'VALIDATION_ERROR'::text, 'scope_id is required'::text, null::uuid, null::uuid, null::text;
    return;
  end if;

  v_cadastre := nullif(btrim(coalesce(p_cadastre_number, '')), '');

  if v_cadastre is not null then
    select p.* into v_existing
    from projects p
    join applications a on a.project_id = p.id
    where p.scope_id = p_scope_id
      and p.cadastre_number = v_cadastre
      and a.status = 'IN_PROGRESS'
    limit 1;

    if found then
      return query select false, 'REAPPLICATION_BLOCKED'::text,
        format('Отказ в принятии: по %s уже есть активное заявление в работе. Повторная подача отклонена.', coalesce(v_existing.name, 'ЖК'))::text,
        null::uuid, null::uuid, null::text;
      return;
    end if;
  end if;

  select max(nullif(regexp_replace(uj_code, '^UJ', ''), '')::int)
  into v_max_num
  from projects
  where scope_id = p_scope_id
    and uj_code ~ '^UJ[0-9]{6}$';

  v_uj_code := format('UJ%06s', coalesce(v_max_num, 0) + 1);

  insert into projects (
    scope_id, uj_code, name, address, cadastre_number, construction_status
  ) values (
    p_scope_id,
    v_uj_code,
    case when p_applicant is not null and btrim(p_applicant) <> '' then format('ЖК от %s', p_applicant) else 'Новый проект' end,
    p_address,
    v_cadastre,
    'Проектный'
  )
  returning * into v_project;

  insert into applications (
    project_id, scope_id, internal_number, external_source, external_id,
    applicant, submission_date, assignee_name,
    status, workflow_substatus, current_step, current_stage
  ) values (
    v_project.id,
    p_scope_id,
    format('INT-%s', right((extract(epoch from now())::bigint)::text, 6)),
    p_external_source,
    p_external_id,
    p_applicant,
    coalesce(p_submission_date, now()),
    p_assignee_name,
    'IN_PROGRESS',
    'DRAFT',
    0,
    1
  )
  returning * into v_application;

  return query select true, 'OK'::text, 'Project created'::text, v_project.id, v_application.id, v_project.uj_code;
exception
  when unique_violation then
    return query select false, 'UNIQUE_VIOLATION'::text, sqlerrm::text, null::uuid, null::uuid, null::text;
  when others then
    return query select false, 'DB_ERROR'::text, sqlerrm::text, null::uuid, null::uuid, null::text;
end;
$$;

create or replace function upsert_project_geometry_candidate(
  p_project_id uuid,
  p_source_index int,
  p_label text,
  p_properties jsonb,
  p_geom_geojson jsonb
)
returns table(id uuid, source_index int, label text, properties jsonb, geom_geojson jsonb, area_m2 numeric)
language plpgsql
as $$
declare
  v_geom geometry;
  v_multi geometry;
  v_row project_geometry_candidates%rowtype;
begin
  if p_project_id is null then
    raise exception 'project_id is required';
  end if;

  v_geom := st_setsrid(st_geomfromgeojson(p_geom_geojson::text), 3857);
  if geometrytype(v_geom) not in ('POLYGON', 'MULTIPOLYGON') then
    raise exception 'Only Polygon/MultiPolygon supported';
  end if;
  v_multi := st_multi(v_geom);

  insert into project_geometry_candidates(project_id, source_index, label, properties, geom_geojson, geom, area_m2, updated_at)
      values (
        p_project_id,
        p_source_index,
        p_label,
        coalesce(p_properties, '{}'::jsonb),
        p_geom_geojson,
        v_multi,
        round(st_area(v_multi)::numeric, 2),
        now()
      )
      on conflict on constraint uq_proj_geom_candidates do update
        set label = excluded.label,
        properties = excluded.properties,
        geom_geojson = excluded.geom_geojson,
        geom = excluded.geom,
        area_m2 = excluded.area_m2,
        updated_at = now()
  returning * into v_row;

  return query
  select v_row.id, v_row.source_index, v_row.label, v_row.properties, v_row.geom_geojson, v_row.area_m2;
end;
$$;

create or replace function set_project_land_plot_from_candidate(
  p_project_id uuid,
  p_candidate_id uuid
)
returns table(out_project_id uuid, land_plot_area_m2 numeric)
language plpgsql
as $$
declare
  v_candidate project_geometry_candidates%rowtype;
begin
  select t.* into v_candidate
  from project_geometry_candidates t
  where t.id = p_candidate_id
    and t.project_id = p_project_id;

  if not found then
    raise exception 'Candidate not found';
  end if;

  update project_geometry_candidates
    set is_selected_land_plot = false,
        updated_at = now()
  where project_id = p_project_id;

  update project_geometry_candidates
    set is_selected_land_plot = true,
        updated_at = now()
  where id = p_candidate_id;

  update projects
    set land_plot_geojson = v_candidate.geom_geojson,
        land_plot_geom = v_candidate.geom,
        land_plot_area_m2 = v_candidate.area_m2,
        updated_at = now()
  where id = p_project_id;

  return query
  select p_project_id, v_candidate.area_m2;
end;
$$;

create or replace function assign_building_geometry_from_candidate(
  p_project_id uuid,
  p_building_id uuid,
  p_candidate_id uuid
)
returns table(out_building_id uuid, building_footprint_area_m2 numeric)
language plpgsql
as $$
declare
  v_candidate project_geometry_candidates%rowtype;
  v_land geometry;
  v_conflict uuid;
begin
  select land_plot_geom into v_land
  from projects
  where id = p_project_id;

  if v_land is null then
    raise exception 'Land plot is not selected';
  end if;

  select t.* into v_candidate
  from project_geometry_candidates t
  where t.id = p_candidate_id
    and t.project_id = p_project_id;

  if not found then
    raise exception 'Candidate not found';
  end if;

  if not st_coveredby(v_candidate.geom, v_land) then
    raise exception 'Building geometry must be within land plot';
  end if;

  select b.id into v_conflict
  from buildings b
  where b.project_id = p_project_id
    and b.id <> p_building_id
    and b.building_footprint_geom is not null
    and st_intersects(v_candidate.geom, b.building_footprint_geom)
    and not st_touches(v_candidate.geom, b.building_footprint_geom)
  limit 1;

  if v_conflict is not null then
    raise exception 'Building geometry intersects another building';
  end if;

  update buildings
  set footprint_geojson = v_candidate.geom_geojson,
      building_footprint_geom = v_candidate.geom,
      building_footprint_area_m2 = v_candidate.area_m2,
      geometry_candidate_id = v_candidate.id,
      updated_at = now()
  where id = p_building_id
    and project_id = p_project_id;

  if not found then
    raise exception 'Building not found';
  end if;

  update project_geometry_candidates
  set assigned_building_id = null,
      updated_at = now()
  where project_id = p_project_id
    and assigned_building_id = p_building_id
    and id <> p_candidate_id;

  update project_geometry_candidates
  set assigned_building_id = p_building_id,
      updated_at = now()
  where id = p_candidate_id;

  return query select p_building_id, v_candidate.area_m2;
end;
$$;
