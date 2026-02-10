# 8. Маппинг UI ↔ DB, синхронизация и миграция

## UI -> DB (ключевые соответствия)

- `complexInfo` -> `projects` -> **Паспорт проекта**.
- `applicationInfo` -> `applications` -> **Статусы/шаги/этапы заявки**.
- `participants` -> `project_participants` -> **Участники проекта**.
- `documents` -> `project_documents` -> **Документы проекта**.
- `composition` -> `buildings` + `building_blocks` -> **Состав объектов**.
- `buildingDetails` -> `building_blocks` + `block_construction` + `block_engineering` + `basements` + `basement_parking_levels` + `block_floor_markers` -> **Параметры блоков**.
- `floorData` -> `floors` -> **Параметры этажей**.
- `entrancesData` -> `entrance_matrix` -> **Матрица подъезд/этаж**.
- `flatMatrix` -> `units` + `rooms` -> **Реестр помещений/экспликация**.
- `mopData` -> `common_areas` -> **МОП**.

## Синхронизация записей

- `saveData` пишет пакетами в бизнес-таблицы.
- `saveProjectImmediate` сериализует очередь сохранений.
- Post-sync:
  - `syncEntrances` обновляет `entrances` и чистит хвост в `entrance_matrix`;
  - sync floors from details пересобирает `floors` по конфигурации блока.

## Интеграция

- `applications.integration_data` -> **Служебные статусы интеграционных операций**.
- `buildings.cadastre_number` -> **Кадастровый номер здания**.
- `units.cadastre_number` -> **Кадастровый номер помещения**.

## Миграционные акценты

- `db/reset_schema.sql` = baseline схемы.
- Сохранить контракты имен полей БД/UI.
- DEV RLS-политики заменить на production-ограничения.
- Сохранить правила генерации уникальных кодов (`projects.uj_code`, `buildings.building_code`, `units.unit_code`).

## Повторная подача по ЖК: интеграционная логика

### UI -> API

Дополнительно для входящих заявок поддерживаются поля:

- `cadastre` -> используется для проверки дубликата активного процесса по ЖК;
- `reapplicationForProjectId` -> явная ссылка на исходный проект (если повторная подача сформирована из реестра);
- `reapplicationForProjectName` -> служебное UI-поле отображения, в БД не пишется.

### API-проверка перед созданием проекта

В `createProjectFromApplication`:

1. Если заявка повторная (`reapplicationForProjectId` или `cadastre`), ищется активная заявка:
   - `applications.status = 'IN_PROGRESS'`
   - фильтр по `project_id` или по `projects.cadastre_number`.
2. При наличии активной записи создание проекта останавливается и возвращается отказ.
3. При отсутствии активной записи создается новый проект/заявка стандартным потоком.

### Поведение UI при отказе

Если API возвращает отказ в принятии:

- входящая заявка помечается локально как `DECLINED`;
- запоминается причина (`declineReason`);
- кнопка «Принять» блокируется.

### Миграционные заметки

- Проверка повторной подачи зависит от корректного заполнения `projects.cadastre_number`.
- Для существующих данных рекомендуется аудит качества кадастровых номеров (нормализованный формат),
  чтобы избежать ложных пропусков/совпадений при проверке дубликатов.

## Work lock: защита от одновременного редактирования

### Где хранится lock

Lock хранится в таблице `application_locks` (1 lock = 1 заявка),
а журнал событий — в `application_lock_audit`.

Ключевые поля:

- `application_id` (UNIQUE)
- `owner_user_id`
- `expires_at`

### Атомарные серверные операции (RPC / SQL function)

- `acquire_application_lock(p_application_id, p_owner_user_id, p_owner_role, p_ttl_seconds)`
- `refresh_application_lock(p_application_id, p_owner_user_id, p_ttl_seconds)`
- `release_application_lock(p_application_id, p_owner_user_id)`

Эти функции выполняют проверку и изменение lock в рамках одной транзакционной операции на стороне БД.

### Аудит

В `application_lock_audit` пишутся события:

- `ACQUIRE`
- `REFRESH`
- `RELEASE`
- `DENY`

Это позволяет проследить, кто и когда захватывал/освобождал lock, и почему доступ был отклонен.

### Особенность

Вынесение lock в отдельные таблицы и SQL-функции повышает устойчивость конкурентного доступа
и исключает гонки, характерные для client-side update JSON-полей.
