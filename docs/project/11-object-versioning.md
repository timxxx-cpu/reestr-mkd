# 11. Версионирование объектов и логика работы

## 11.1 Назначение


> ⚠️ **Временный режим (DEV):** подсистема версионирования на уровне приложения временно отключена feature-flag (`VERSIONING_ENABLED=false` в `src/lib/api-service.js`).
>
> - Схема БД (`object_versions`, `dict_version_statuses`) **не изменялась**.
> - API-методы версионирования возвращают безопасные значения без записи в БД.
> - После возврата флага в `true` логика может быть включена обратно без миграций.

Подсистема версионирования фиксирует снимки (snapshot) состояния сущностей проекта и обеспечивает управляемый жизненный цикл версий:

- хранение истории изменений объектов;
- контроль «единственной активной рабочей версии» (`PENDING`) на объект;
- перевод версии в `CURRENT` с переводом предыдущей текущей в `PREVIOUS`;
- отклонение и восстановление версии;
- привязка версии к заявлению (`application_id`) и пользователю (`created_by`, `approved_by`, `declined_by`).

## 11.2 Область применения

Версионирование реализовано через универсальную таблицу `object_versions` (полиморфная ссылка):

- `entity_type` — тип сущности (`project`, `building`, `building_block`, `floor`, `unit`, `common_area`);
- `entity_id` — UUID конкретной записи в соответствующей таблице;
- `snapshot_data` — JSON-снимок состояния.

## 11.3 Модель данных

### Таблица `object_versions`

Ключевые поля:

- `version_number` — порядковый номер версии в рамках пары (`entity_type`, `entity_id`);
- `version_status` — один из `CURRENT`, `PENDING`, `REJECTED`, `PREVIOUS`;
- `snapshot_data` — снимок данных объекта;
- `application_id` — ссылка на `applications.id` (контекст заявки);
- `created_by`, `approved_by`, `declined_by`, `decline_reason` — аудит операций.

Ограничения:

1. `UNIQUE(entity_type, entity_id, version_number)`
2. Частичный `UNIQUE` для `version_status = 'CURRENT'`
3. Частичный `UNIQUE` для `version_status = 'PENDING'`

Это гарантирует:

- не более одной актуальной версии объекта;
- не более одной рабочей версии объекта.

### Таблица `dict_version_statuses`

Справочник UI-статусов версий:

- `CURRENT` — Текущая
- `PENDING` — В ожидании
- `REJECTED` — Отклонена
- `PREVIOUS` — Предыдущая

## 11.4 API версионирования

### 11.4.1 Сервисный слой `ApiService`

Поддерживаемые операции:

- `getVersions(entityType, entityId)`
- `createVersion({ entityType, entityId, snapshotData, createdBy, applicationId })`
- `approveVersion({ versionId, approvedBy })`
- `declineVersion({ versionId, reason, declinedBy })`
- `getVersionSnapshot(versionId)`
- `restoreVersion({ versionId })`

### 11.4.2 Standalone API `VersionsApi`

Аналогичный набор методов присутствует в `src/lib/api/versions-api.js` для независимого использования.

## 11.5 Правила переходов версий

### Создание версии (`createVersion`)

Алгоритм:

1. Чтение текущего `max(version_number)` по объекту.
2. Перевод предыдущей `PENDING` в `PREVIOUS` (если есть).
3. Создание новой версии со статусом `PENDING`.

Почему так: это исключает конфликт с уникальным индексом `uq_entity_in_work`.

### Утверждение версии (`approveVersion`)

Алгоритм:

1. Находим версию `versionId`.
2. Переводим текущую `CURRENT` (если есть) в `PREVIOUS`.
3. Устанавливаем выбранной версии `version_status='CURRENT'`.
4. Очищаем поля отказа (`decline_reason`, `declined_by`).

### Отклонение версии (`declineVersion`)

Алгоритм:

1. Устанавливаем `version_status='REJECTED'`.
2. Фиксируем `decline_reason`, `declined_by`.

### Восстановление версии (`restoreVersion`)

Алгоритм:

1. Находим версию `versionId`.
2. Переводим текущую `PENDING` по объекту (кроме восстанавливаемой) в `PREVIOUS`.
3. Переводим выбранную версию в `PENDING`.

## 11.6 UI-компоненты

### `VersionBadge`

Отвечает за компактное визуальное отображение:

- статуса версии;
- номера версии;
- tooltip с автором и датой создания.

### `VersionHistory`

Компонент просмотра истории версий:

- список версий слева;
- просмотр snapshot JSON справа;
- кнопки действий: «Утвердить», «Отклонить», «Восстановить».

## 11.7 Контроль корректности

### Инварианты

1. На один объект максимум одна `PENDING`.
2. На один объект максимум одна `CURRENT`.
3. Создание новой рабочей версии не должно падать по unique-ограничению.
4. Восстановление старой версии не должно оставлять две `PENDING`.

### Рекомендуемые тест-кейсы

1. **Create twice**: создать две версии подряд — первая должна перейти в `PREVIOUS`, вторая быть `PENDING`.
2. **Approve flow**: утвердить `PENDING`, затем утвердить новую — старая `CURRENT` станет `PREVIOUS`.
3. **Decline flow**: отклонить `PENDING` с причиной — статус `REJECTED`, причина заполнена.
4. **Restore flow**: восстановить `REJECTED` при наличии другой `PENDING` — текущая `PENDING` переводится в `PREVIOUS`.

## 11.8 Связь с workflow заявки

Версии связаны с процессом заявки через `application_id` и историю действий.

Ожидаемая модель использования:

- при изменениях объекта в рамках заявки создается/обновляется `PENDING` версия;
- при контрольных точках этапа возможны пакетные решения (approve/decline) для набора версий;
- при отказе заявки версии могут быть переведены в `REJECTED` (по бизнес-правилу процесса).

## 11.9 Ограничения текущей реализации

- `VersionHistory` и `VersionBadge` реализованы как переиспользуемые блоки, но интеграция в каждый редактор выполняется поэтапно.
- Snapshot хранится как полный JSON состояния, без встроенного дифф-механизма.
- Массовые операции по этапу (batch approve/decline versions) пока не вынесены в отдельный orchestration слой.

## 11.10 Источники реализации

- БД: `db/reset_schema.sql`
- Константы статусов: `src/lib/constants.js`
- API (facade): `src/lib/api-service.js`, `src/lib/api/versions-api-factory.js`
- Standalone API: `src/lib/api/versions-api.js`
- UI: `src/components/ui/VersionBadge.jsx`, `src/components/VersionHistory.jsx`
