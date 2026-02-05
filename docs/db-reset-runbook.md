# DB reset runbook (DEV / Supabase)

Этот файл описывает безопасный перезапуск схемы для тестового стенда.

## Что делает reset

- Полностью пересоздает таблицы ядра проекта, workflow и инвентаризации.
- Пересоздает связи и уникальные ограничения, которые ожидает UI/ApiService.
- Заполняет минимальные `dict_*` справочники.

SQL: `db/reset_schema.sql`.

## Порядок запуска

1. Открыть Supabase SQL Editor на DEV-проекте.
2. Выполнить содержимое `db/reset_schema.sql` целиком одним скриптом.
3. Перезапустить фронт (`npm run dev`) и пройти smoke-check по шагам:
   - Step 1: Паспорт — создание/обновление полей
   - Step 2: Состав комплекса — создание здания/блоков
   - Step 5-9: этажи/подъезды/квартиры/МОП/паркинг
   - Step 10-14: реестры и интеграция

## Критичные гарантии схемы

- `applications` связана с `projects` (`project_id` unique) и хранит:
  - `status`, `current_step`, `current_stage`, `integration_data`
- `application_steps` хранит прогресс задач:
  - уникальность `(application_id, step_index)`
- `application_history` хранит историю действий по заявке.
- `entrance_matrix` имеет уникальность `(block_id, floor_id, entrance_number)`.
- `basement_parking_levels` имеет уникальность `(basement_id, depth_level)`.

## Важно

- Скрипт рассчитан на DEV и **удаляет все данные**.
- Для PROD/Stage требуется отдельная миграционная стратегия без drop.
