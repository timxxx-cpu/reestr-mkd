# Upsert idempotency map (`onConflict`)

Для стабильных повторных сохранений в `ApiService` введен единый словарь `UPSERT_ON_CONFLICT`.

| Таблица | onConflict |
|---|---|
| `projects` | `id` |
| `project_participants` | `id` |
| `project_documents` | `id` |
| `floors` | `id` |
| `entrance_matrix` | `block_id,floor_id,entrance_number` |
| `units` | `id` |
| `common_areas` | `id` |
| `basements` | `id` |
| `basement_parking_levels` | `basement_id,depth_level` |
| `application_steps` | `application_id,step_index` |
| `block_floor_markers` | `block_id,marker_key` |
| `block_construction` | `block_id` |
| `block_engineering` | `block_id` |

## Правило

- Любой новый `upsert` в `ApiService` должен ссылаться на ключ из `UPSERT_ON_CONFLICT`.
- Если для таблицы нет записи в словаре, сначала добавить и согласовать ключ конфликтов.
