# Project discovery notes (architecture, schema, workflow)

## 1) Текущий стек и контекст

- Frontend: React + Vite.
- Data layer: Supabase (`@supabase/supabase-js`) как DEV-источник данных.
- Валидация: `zod`.
- Текущее состояние: проект в фазе перехода схемы на PostgreSQL; для DEV используется Supabase.

## 2) Высокоуровневая схема домена

Система разделена на 4 логических области:

1. **Проект и заявка (workflow-shell)**
   - `projects` — метаданные ЖК/проекта.
   - `applications` — процессная сущность со статусом, текущим шагом и этапом.
   - `application_steps` — отметки прохождения шагов.
   - `application_history` — аудит действий/переходов.

2. **Состав комплекса (buildings/blocks)**
   - `buildings` → `building_blocks`.
   - Детализация по конструктиву и инженерке: `block_construction`, `block_engineering`.
   - Подземные сущности: `basements`, `basement_parking_levels`.

3. **Инвентаризация по этажам/помещениям**
   - `floors`, `entrances`, `entrance_matrix`.
   - `units`, `rooms`, `common_areas`.

4. **Справочники (`dict_*`)**
   - Статусы, типы, внешние системы, пользователи и т.д.

## 3) База данных и инварианты

`db/reset_schema.sql` — полный DEV reset со следующими свойствами:

- Полностью пересоздает таблицы и минимальные seed-данные.
- Включает уникальности для идемпотентного upsert:
  - `application_steps (application_id, step_index)`
  - `entrance_matrix (block_id, floor_id, entrance_number)`
  - `basement_parking_levels (basement_id, depth_level)`
  - `block_floor_markers (block_id, marker_key)`
- Создает RLS policy с full-access для `anon/authenticated` (только DEV).

Важно: данные в DEV считаются одноразовыми — схему можно регулярно пересобирать с нуля.

## 4) Workflow (бизнес-логика)

### Статусы

Используются статусы заявки:

- `NEW`, `DRAFT`, `REVIEW`, `APPROVED`, `REJECTED`, `INTEGRATION`, `COMPLETED`.

### Шаги (17 штук, индексы 0..16)

Основная последовательность:

1. Паспорт/состав
2. Нежилой и жилой реестр-конфиг
3. Этажи/подъезды/нумерация/МОП/паркинг
4. Реестры квартир/коммерции/паркинга
5. Интеграция зданий/помещений
6. Финальные сводные

### Границы этапов

`WORKFLOW_STAGES`:

- Этап 1 заканчивается на шаге `5`
- Этап 2 — на `8`
- Этап 3 — на `11`
- Этап 4 — на `16`

На границе этапа при `complete` статус переходит в `REVIEW`.

Отдельно: старт интеграции начинается с шага `12`, но если переход идет с границы шага `11`, приоритет у `REVIEW` (а не у `INTEGRATION`) до approve-review.

## 5) Приложение: слои логики

В Project Context выделены отдельные слои:

- `useProjectDataLayer` — merge server/meta/buildings-state + `isReadOnly` по роли/статусу.
- `useProjectSyncLayer` — очередь сохранений, отложенные изменения, пакетная синхронизация.
- `useProjectWorkflowLayer` — переходы workflow (`complete`, `rollback`, `review`).

Это упрощает локализацию проблем по типам:

- UX/доступы → data-layer
- Потери/гонки сохранений → sync-layer
- Неверные переходы статусов/этапов → workflow-layer

## 6) API и маппинг

`src/lib/api-service.js` содержит:

- Единый словарь `UPSERT_ON_CONFLICT` для upsert-идемпотентности.
- Guard: ошибка при upsert таблицы без явного `onConflict` ключа.
- Нормализацию статусов проекта между DB-code и UI-label.

## 7) Что это значит для ближайшей диагностики проблем

Когда вы пришлете конкретную проблему, удобно сразу классифицировать ее по 4 категориям:

1. **Schema/constraint issue** (ошибки insert/upsert, дубликаты, FK, unique)
2. **Mapper/DTO issue** (данные сохранились, но «не там/не в том формате»)
3. **Workflow transition issue** (не тот статус/этап/шаг)
4. **UI state/sync issue** (видно одно, в БД другое, race-condition)

Я готов разбирать точечно в этом порядке: **воспроизводимость → слой → корневая причина → минимальный фикс + проверка**.
