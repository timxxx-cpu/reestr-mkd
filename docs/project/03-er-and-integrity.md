# 3. ER-связи и целостность данных

## Основные связи

- `projects.id` -> `applications.project_id` (1:1) -> **Один проект = одна активная заявка**.
- `projects.id` -> `project_participants.project_id` (1:N) -> **Участники проекта**.
- `projects.id` -> `project_documents.project_id` (1:N) -> **Документы проекта**.
- `projects.id` -> `buildings.project_id` (1:N) -> **Здания в проекте**.
- `buildings.id` -> `building_blocks.building_id` (1:N) -> **Блоки здания**.
- `building_blocks.id` -> `floors.block_id` (1:N) -> **Этажи блока**.
- `building_blocks.id` -> `entrances.block_id` (1:N) -> **Подъезды блока**.
- `floors.id` -> `units.floor_id` (1:N) -> **Помещения на этаже**.
- `units.id` -> `rooms.unit_id` (1:N) -> **Экспликация помещения**.
- `floors.id` -> `common_areas.floor_id` (1:N) -> **МОП на этаже**.

## Логика удаления

- `on delete cascade`: дочерние записи удаляются при удалении родителя (например, проект -> здания -> блоки -> этажи -> помещения).
- `on delete set null`:
  - `units.entrance_id` -> **сохраняем помещение, даже если удален подъезд**,
  - `common_areas.entrance_id` -> **сохраняем МОП без привязки к подъезду**,
  - `floors.basement_id` -> **сохраняем этаж при удалении подвального контура**.

## Уникальность

- `application_steps (application_id, step_index)` -> **у шага заявки одна запись**.
- `project_participants (project_id, role)` -> **одна запись участника на роль**.
- `entrances (block_id, number)` -> **нет дубля номера подъезда в блоке**.
- `entrance_matrix (block_id, floor_id, entrance_number)` -> **одна ячейка матрицы на комбинацию**.
- `projects.uj_code`, `buildings.building_code`, `units.unit_code` -> **уникальные идентификаторы сущностей**.
