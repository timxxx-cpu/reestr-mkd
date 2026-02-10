# 4. Справочники, seed и DEV-RLS

## Справочники: `code` -> целевое поле БД -> русское значение

- `dict_project_statuses.code` -> `projects.construction_status` -> **Статус проекта**.
- `dict_application_statuses.code` -> `applications.status` -> **Внешний статус заявки (IN_PROGRESS/COMPLETED/DECLINED)**.
- `dict_workflow_substatuses.code` -> `applications.workflow_substatus` -> **Подстатус workflow**.
- `dict_external_systems.code` -> `applications.external_source` -> **Внешний источник заявления**.
- `dict_foundations.code` -> `block_construction.foundation` -> **Тип фундамента**.
- `dict_wall_materials.code` -> `block_construction.walls` -> **Материал стен**.
- `dict_slab_types.code` -> `block_construction.slabs` -> **Тип перекрытий**.
- `dict_roof_types.code` -> `block_construction.roof` -> **Тип кровли**.
- `dict_light_structure_types.code` -> `building_blocks.light_structure_type` -> **Тип легкой конструкции**.
- `dict_parking_types.code` -> `buildings.parking_type` -> **Тип паркинга**.
- `dict_parking_construction_types.code` -> `buildings.construction_type` -> **Конструктив паркинга**.
- `dict_infra_types.code` -> `buildings.infra_type` -> **Тип инфраструктуры**.
- `dict_mop_types.code` -> `common_areas.type` -> **Тип МОП**.
- `dict_unit_types.code` -> `units.unit_type` -> **Тип помещения**.
- `dict_room_types.code` -> `rooms.room_type` -> **Тип комнаты/зоны**.

Общие поля для dict-таблиц:
- `id` -> **Идентификатор записи справочника**.
- `code` -> **Код значения (хранится в бизнес-таблицах)**.
- `label` -> **Русское отображаемое название в UI**.
- `sort_order` -> **Порядок показа в UI**.
- `is_active` -> **Доступность для выбора в UI**.

## Seed

`db/reset_schema.sql` заполняет базовые записи справочников, чтобы UI мог сразу подставлять доступные значения и не работать с пустыми select-полями.

## DEV-RLS

- RLS включен для всех таблиц.
- В DEV используются permissive policy (`anon/authenticated` full access).
- Для production эти политики должны быть заменены на ограничительные.
