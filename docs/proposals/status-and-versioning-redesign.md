# Предложение: Редизайн статусов заявлений + Версионирование объектов ЖК

**Дата**: 2026-02-10  
**Статус**: Проект (без изменения кода)

---

## Часть 1. Упрощение статусов заявлений

### 1.1 Текущее состояние (AS-IS)

Сейчас система использует **7 статусов** заявления:

| Код | Название | Назначение |
|-----|----------|------------|
| `NEW` | Новая | Заявка создана из внешней системы, не взята в работу |
| `DRAFT` | В работе | Заявка в работе у техника |
| `REVIEW` | На проверке | Отправлена контролеру на проверку |
| `APPROVED` | Принято | Контролер принял этап (кратковременный, транзитный) |
| `REJECTED` | Возврат | Контролер вернул на доработку |
| `INTEGRATION` | Интеграция | Готова к передаче в УЗКАД |
| `COMPLETED` | Закрыта | Финальный статус |

**Проблемы текущей модели:**
- `NEW` — фактически не используется в рабочем процессе внутри приложения; заявка при принятии сразу переходит в `DRAFT`.
- `APPROVED` — транзитный статус (живет доли секунды), не несет бизнес-смысла для пользователя.
- `REVIEW` — промежуточный статус проверки контролером, сильно связан с внутренним workflow.
- `INTEGRATION` — специальный статус для 4-го этапа, усложняет логику.
- Итого пользователь видит 7 бейджей, хотя по бизнесу нужны только 3 конечных состояния.

### 1.2 Целевое состояние (TO-BE)

Оставить **3 статуса заявления**, видимых пользователю:

| Код | Название | Цвет (UI) | Описание |
|-----|----------|-----------|----------|
| `IN_PROGRESS` | В работе | `bg-blue-100 text-blue-700` | Заявка принята и находится в обработке (объединяет бывшие `NEW`, `DRAFT`, `REVIEW`, `APPROVED`, `INTEGRATION`) |
| `COMPLETED` | Завершено | `bg-emerald-100 text-emerald-700` | Заявка полностью обработана, все данные зафиксированы |
| `DECLINED` | Отказано | `bg-red-100 text-red-700` | Заявка отклонена (новый бизнес-статус — отказ) |

### 1.3 Разделение на «внешний статус» и «внутренний подстатус»

Чтобы не терять детальную информацию о текущем этапе workflow, предлагается двухуровневая модель:

**Внешний статус** (`applications.status`) — 3 значения видны пользователю на рабочем столе.

**Внутренний подстатус** (`applications.workflow_substatus`) — детали для workflow-движка внутри проекта:

| Подстатус | Принадлежность к внешнему статусу | Описание |
|-----------|----------------------------------|----------|
| `DRAFT` | `IN_PROGRESS` | Техник работает с данными |
| `REVIEW` | `IN_PROGRESS` | Отправлено на проверку контролеру |
| `REVISION` | `IN_PROGRESS` | Возвращено контролером на доработку (бывший `REJECTED`) |
| `INTEGRATION` | `IN_PROGRESS` | Этап интеграции с УЗКАД |
| `DONE` | `COMPLETED` | Все шаги пройдены |
| `DECLINED_BY_ADMIN` | `DECLINED` | Отказано администратором |
| `DECLINED_BY_CONTROLLER` | `DECLINED` | Отказано контролером |

### 1.4 Изменения в БД

#### Таблица `applications` — добавить поле:

```sql
ALTER TABLE applications
  ADD COLUMN workflow_substatus TEXT NOT NULL DEFAULT 'DRAFT';
```

#### Справочник `dict_application_statuses` — заменить записи:

```sql
-- Внешние статусы
DELETE FROM dict_application_statuses;
INSERT INTO dict_application_statuses (code, label, sort_order) VALUES
  ('IN_PROGRESS', 'В работе', 10),
  ('COMPLETED',   'Завершено', 20),
  ('DECLINED',    'Отказано', 30);
```

#### Новый справочник `dict_workflow_substatuses`:

```sql
CREATE TABLE dict_workflow_substatuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  parent_status TEXT NOT NULL,  -- ссылка на внешний статус
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO dict_workflow_substatuses (code, parent_status, label, sort_order) VALUES
  ('DRAFT',                 'IN_PROGRESS', 'Ввод данных',          10),
  ('REVIEW',                'IN_PROGRESS', 'На проверке',          20),
  ('REVISION',              'IN_PROGRESS', 'На доработке',         30),
  ('INTEGRATION',           'IN_PROGRESS', 'Интеграция',           40),
  ('DONE',                  'COMPLETED',   'Завершено',            50),
  ('DECLINED_BY_ADMIN',     'DECLINED',    'Отказано (админ)',      60),
  ('DECLINED_BY_CONTROLLER','DECLINED',    'Отказано (контролер)',  70);
```

### 1.5 Изменения в коде (перечень файлов и точек изменения)

#### `src/lib/constants.js`

- **`APP_STATUS`** — заменить 7 значений на 3: `IN_PROGRESS`, `COMPLETED`, `DECLINED`.
- **Новая константа `WORKFLOW_SUBSTATUS`** — перечисление подстатусов: `DRAFT`, `REVIEW`, `REVISION`, `INTEGRATION`, `DONE`, `DECLINED_BY_ADMIN`, `DECLINED_BY_CONTROLLER`.
- **`APP_STATUS_LABELS`** — упростить до 3 записей.

#### `src/lib/workflow-state-machine.js`

- **`canEditByRoleAndStatus`** — проверять подстатус (`workflow_substatus`) вместо основного статуса.
- **`getCompletionTransition`** — менять `workflow_substatus`, а не `status`. Внешний `status` всегда остается `IN_PROGRESS` до финального завершения.
- **`getRollbackTransition`** — аналогично: оперировать подстатусом.
- **`getReviewTransition`** — APPROVE меняет подстатус с `REVIEW` на `DRAFT`/`INTEGRATION`; REJECT меняет подстатус на `REVISION`.

#### `src/components/ApplicationsDashboard.jsx`

- Метрики (KPI-карточки) — перестроить с 4 плиток на 3: «В работе», «Завершено», «Отказано».
- Фильтры задач — 3 фильтра по внешнему статусу.
- Таблица проектов — показывать бейдж внешнего статуса + подробность подстатуса (tooltip или иконка).
- **Кнопка «Отказать»** — добавить в строку таблицы для ролей `admin` и `controller`.

#### `src/components/WorkflowBar.jsx`

- Внутренняя логика — использовать подстатус для определения режима (редактирование, ревью, read-only).
- Кнопки действий — без изменений по составу, только ссылки на подстатус.

#### `src/context/project/useProjectWorkflowLayer.js`

- Функции `completeTask`, `rollbackTask`, `reviewStage` — обновлять оба поля: `status` и `workflow_substatus`.

#### `src/lib/api/workflow-api.js`

- API-вызовы — передавать и сохранять подстатус.

#### `src/lib/db-mappers.js`

- Маппинг БД -> UI: добавить `workflow_substatus` → `applicationInfo.workflowSubstatus`.

---

## Часть 2. Возможность отказа заявления на рабочем столе

### 2.1 Бизнес-логика

**Кто может отказать:**
- `admin` — в любом статусе, кроме `COMPLETED` и `DECLINED`.
- `controller` — только если подстатус `REVIEW`.

**Обязательные данные при отказе:**
- Причина отказа (текстовый комментарий, минимум 10 символов).
- Дата и автор фиксируются автоматически.

**Workflow при отказе:**
```
applications.status       = 'DECLINED'
applications.workflow_substatus = 'DECLINED_BY_ADMIN' | 'DECLINED_BY_CONTROLLER'
```

**Запись в историю:**
```sql
INSERT INTO application_history (application_id, action, prev_status, next_status, user_name, comment)
VALUES (?, 'DECLINE', prev_status, 'DECLINED', user_name, 'Причина отказа...');
```

### 2.2 Изменения в UI (ApplicationsDashboard)

1. **Новая кнопка в строке таблицы** — иконка `Ban` (lucide) красного цвета, расположена рядом с кнопкой удаления.
2. **Видимость кнопки:**
   - Для `admin`: видна всегда, кроме `COMPLETED` и `DECLINED`.
   - Для `controller`: видна только при подстатусе `REVIEW`.
   - Для `technician`: не видна.
3. **Модальное окно подтверждения:**
   - Заголовок: «Отказать в обработке заявления»
   - Текстовое поле для причины (обязательное, минимум 10 символов).
   - Кнопки: «Отменить» / «Подтвердить отказ» (красная).
4. **После отказа:**
   - Строка в таблице получает стиль `bg-red-50` и бейдж «Отказано».
   - Toast-уведомление: «Заявление отклонено».

### 2.3 Изменения в workflow-state-machine

Добавить новое действие:

```javascript
export const WORKFLOW_ACTIONS = {
  ...existing,
  DECLINE: 'DECLINE',  // Новое действие
};
```

Новая функция:

```javascript
export const getDeclineTransition = (currentAppInfo, declinedBy) => ({
  action: WORKFLOW_ACTIONS.DECLINE,
  nextStatus: 'DECLINED',
  nextSubstatus: declinedBy === 'controller' ? 'DECLINED_BY_CONTROLLER' : 'DECLINED_BY_ADMIN',
  prevStatus: currentAppInfo.status,
  prevSubstatus: currentAppInfo.workflowSubstatus,
});
```

### 2.4 Восстановление из отказа

Предлагается предусмотреть возможность восстановления отказанной заявки (только для `admin`):
- Кнопка «Восстановить» в строке с отказанной заявкой.
- Заявка переходит в `IN_PROGRESS` / `DRAFT`.
- Запись в историю: `action='RESTORE'`.

---

## Часть 3. Версионирование объектов ЖК

### 3.1 Концепция

Каждый объект жилого комплекса (проект, здание, блок, этаж, помещение, МОП) получает поддержку **версий**. Версия фиксирует состояние данных объекта на определенный момент времени.

**Цели версионирования:**
- Отслеживание истории изменений объектов.
- Возможность отката к предыдущей версии.
- Параллельная работа с несколькими версиями (например: текущая актуальная + новая в работе).
- Архивирование старых версий.

### 3.2 Статусы версий

| Код | Название | Описание | Количество на объект |
|-----|----------|----------|---------------------|
| `ACTUAL` | Актуальная | Текущая действующая версия объекта. Используется по умолчанию. | Максимум 1 |
| `IN_WORK` | В работе | Версия, в которую вносятся изменения. Еще не утверждена. | Максимум 1 |
| `DECLINED` | Отказанная | Версия, которая была отклонена при проверке. | Без ограничений |
| `ARCHIVED` | Архивированная | Предыдущая актуальная версия, замещённая новой. Только для чтения. | Без ограничений |

### 3.3 Жизненный цикл версии

```
                 ┌──────────────┐
                 │   IN_WORK    │ ← Создание новой версии
                 └──────┬───────┘
                        │
              ┌─────────┼──────────┐
              │ Утвердить│          │ Отказать
              ▼         │          ▼
     ┌────────────┐     │   ┌───────────┐
     │   ACTUAL   │     │   │  DECLINED │
     └────────────┘     │   └───────────┘
              │         │
              │ Новая версия создана
              ▼
     ┌────────────┐
     │  ARCHIVED  │
     └────────────┘
```

**Переходы:**
1. `IN_WORK` → `ACTUAL` — версия утверждена (предыдущая `ACTUAL` → `ARCHIVED`).
2. `IN_WORK` → `DECLINED` — версия отклонена контролером.
3. `ACTUAL` → `ARCHIVED` — автоматически при утверждении новой версии.
4. `DECLINED` → `IN_WORK` — доработка отклоненной версии (опционально).

### 3.4 Модель данных: Таблица версий

Предлагается единая таблица версий для всех типов объектов (подход «полиморфная таблица»):

```sql
CREATE TABLE object_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Полиморфная ссылка на объект
  entity_type TEXT NOT NULL,          -- 'project', 'building', 'building_block', 'floor', 'unit', 'common_area'
  entity_id   UUID NOT NULL,          -- ID записи в соответствующей таблице
  
  -- Версионирование
  version_number  INT NOT NULL DEFAULT 1,
  version_status  TEXT NOT NULL DEFAULT 'IN_WORK',  -- ACTUAL, IN_WORK, DECLINED, ARCHIVED
  
  -- Снимок данных (JSON-слепок всех полей объекта на момент создания версии)
  snapshot_data   JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Метаданные
  created_by      TEXT,               -- Кто создал версию
  approved_by     TEXT,               -- Кто утвердил
  declined_by     TEXT,               -- Кто отклонил
  decline_reason  TEXT,               -- Причина отклонения
  
  -- Связь с заявкой (в рамках какой заявки создана версия)
  application_id  UUID REFERENCES applications(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ограничения
  CONSTRAINT uq_entity_version UNIQUE (entity_type, entity_id, version_number),
  CONSTRAINT chk_version_status CHECK (version_status IN ('ACTUAL', 'IN_WORK', 'DECLINED', 'ARCHIVED'))
);

-- Индексы
CREATE INDEX idx_obj_versions_entity ON object_versions (entity_type, entity_id);
CREATE INDEX idx_obj_versions_status ON object_versions (version_status);
CREATE INDEX idx_obj_versions_app    ON object_versions (application_id);

-- Гарантия: не более одной ACTUAL-версии на объект
CREATE UNIQUE INDEX uq_entity_actual ON object_versions (entity_type, entity_id)
  WHERE version_status = 'ACTUAL';

-- Гарантия: не более одной IN_WORK-версии на объект
CREATE UNIQUE INDEX uq_entity_in_work ON object_versions (entity_type, entity_id)
  WHERE version_status = 'IN_WORK';
```

### 3.5 Альтернативный подход: версионирование в самих таблицах

Вместо отдельной таблицы можно добавить поля версии непосредственно в каждую таблицу объектов:

```sql
-- Добавить в каждую таблицу (projects, buildings, building_blocks, floors, units, common_areas):
ALTER TABLE buildings ADD COLUMN version_number  INT NOT NULL DEFAULT 1;
ALTER TABLE buildings ADD COLUMN version_status  TEXT NOT NULL DEFAULT 'ACTUAL';
ALTER TABLE buildings ADD COLUMN version_parent  UUID REFERENCES buildings(id) ON DELETE SET NULL;
ALTER TABLE buildings ADD COLUMN version_created_by TEXT;
```

**Плюсы**: проще запросы, нет JOIN с таблицей версий.  
**Минусы**: дублирование строк в таблице, сложнее миграция.

### 3.6 Рекомендованный подход

**Рекомендуется подход с единой таблицей `object_versions`** (п. 3.4) по следующим причинам:

1. **Не меняет существующую схему** — все текущие таблицы остаются без изменений.
2. **Единая точка управления версиями** — один API, одна логика.
3. **Snapshot-подход** — JSON-снимок данных позволяет отслеживать полное состояние объекта.
4. **Легко расширяется** — добавление нового типа объекта требует только нового значения `entity_type`.

### 3.7 Справочник статусов версий

```sql
CREATE TABLE dict_version_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  color TEXT,          -- CSS-классы для бейджа
  sort_order INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO dict_version_statuses (code, label, color, sort_order) VALUES
  ('ACTUAL',   'Актуальная',      'bg-emerald-100 text-emerald-700 border-emerald-200', 10),
  ('IN_WORK',  'В работе',        'bg-blue-100 text-blue-700 border-blue-200',          20),
  ('DECLINED', 'Отказанная',      'bg-red-100 text-red-700 border-red-200',             30),
  ('ARCHIVED', 'Архивированная',  'bg-slate-100 text-slate-500 border-slate-200',       40);
```

### 3.8 Изменения в коде (перечень)

#### `src/lib/constants.js`

```javascript
// Новая константа
export const VERSION_STATUS = {
  ACTUAL:   'ACTUAL',
  IN_WORK:  'IN_WORK',
  DECLINED: 'DECLINED',
  ARCHIVED: 'ARCHIVED',
};

export const VERSION_STATUS_LABELS = {
  [VERSION_STATUS.ACTUAL]:   { label: 'Актуальная',     color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  [VERSION_STATUS.IN_WORK]:  { label: 'В работе',       color: 'bg-blue-100 text-blue-700 border-blue-200' },
  [VERSION_STATUS.DECLINED]: { label: 'Отказанная',     color: 'bg-red-100 text-red-700 border-red-200' },
  [VERSION_STATUS.ARCHIVED]: { label: 'Архивированная', color: 'bg-slate-100 text-slate-500 border-slate-200' },
};
```

#### Новый файл `src/lib/api/versions-api.js`

API-сервис для работы с версиями:
- `getVersions(entityType, entityId)` — список всех версий объекта.
- `createVersion(entityType, entityId, snapshotData)` — создание новой версии `IN_WORK`.
- `approveVersion(versionId)` — утверждение версии (`IN_WORK` → `ACTUAL`, предыдущая `ACTUAL` → `ARCHIVED`).
- `declineVersion(versionId, reason)` — отклонение версии (`IN_WORK` → `DECLINED`).
- `getVersionSnapshot(versionId)` — получение снимка данных.
- `restoreVersion(versionId)` — восстановление из архива или отклоненной.

#### Новый компонент `src/components/ui/VersionBadge.jsx`

- Бейдж отображения текущей версии и её статуса.
- Tooltip с информацией: номер версии, кто создал, дата.

#### Новый компонент `src/components/VersionHistory.jsx`

- Модальное окно / боковая панель со списком всех версий объекта.
- Сравнение версий (diff двух JSON-снимков).
- Кнопки: «Утвердить», «Отклонить», «Восстановить».

#### Изменения в существующих редакторах

Во все редакторы объектов (PassportEditor, CompositionEditor, FloorMatrixEditor и т.д.) добавить:
- Индикатор текущей версии в заголовке.
- Кнопка «История версий».
- При сохранении — автоматическое создание snapshot-а.

### 3.9 Workflow версионирования

1. **Техник создает/редактирует объект** → автоматически создается или обновляется версия `IN_WORK`.
2. **При завершении этапа (COMPLETE_STEP на checkpoint)** → snapshot всех объектов этапа сохраняется в `object_versions`.
3. **Контролер проверяет этап:**
   - `APPROVE` → все `IN_WORK` версии объектов этапа → `ACTUAL` (предыдущие `ACTUAL` → `ARCHIVED`).
   - `REJECT` → все `IN_WORK` версии → остаются `IN_WORK` (подстатус заявки → `REVISION`).
4. **Отказ заявления** → все `IN_WORK` версии → `DECLINED`.

### 3.10 Интеграция версионирования с workflow заявления

| Действие workflow | Влияние на версии |
|-------------------|-------------------|
| `COMPLETE_STEP` (checkpoint) | Создание snapshot-ов для объектов этапа |
| `REVIEW_APPROVE` | `IN_WORK` → `ACTUAL`, предыдущие `ACTUAL` → `ARCHIVED` |
| `REVIEW_REJECT` | Версии остаются `IN_WORK` |
| `DECLINE` | `IN_WORK` → `DECLINED` |
| `ROLLBACK_STEP` | Нет влияния на версии (данные просто редактируются) |

---

## Часть 4. Сводка изменений по файлам

### БД (миграции)

| Файл / Объект | Действие |
|---------------|----------|
| `applications.status` | Изменить допустимые значения на 3 |
| `applications.workflow_substatus` | Новое поле |
| `dict_application_statuses` | Обновить записи (3 вместо 7) |
| `dict_workflow_substatuses` | Новая таблица |
| `object_versions` | Новая таблица |
| `dict_version_statuses` | Новая таблица-справочник |

### Frontend (файлы для изменения)

| Файл | Изменения |
|------|-----------|
| `src/lib/constants.js` | `APP_STATUS` → 3 статуса; новые: `WORKFLOW_SUBSTATUS`, `VERSION_STATUS` |
| `src/lib/workflow-state-machine.js` | Оперировать подстатусами; новая функция `getDeclineTransition` |
| `src/lib/workflow-utils.js` | Хелперы для подстатусов |
| `src/lib/db-mappers.js` | Маппинг `workflow_substatus`, `object_versions` |
| `src/lib/api/workflow-api.js` | Передача подстатуса; новый endpoint `declineApplication` |
| `src/lib/api/versions-api.js` | **Новый файл** — API для версий |
| `src/components/ApplicationsDashboard.jsx` | 3 метрики; кнопка «Отказать»; модалка отказа |
| `src/components/WorkflowBar.jsx` | Использование подстатуса; без изменений по кнопкам |
| `src/components/ui/VersionBadge.jsx` | **Новый файл** |
| `src/components/VersionHistory.jsx` | **Новый файл** |
| `src/context/project/useProjectWorkflowLayer.js` | Обновление обоих полей статуса; `declineApplication` |
| `src/context/project/useProjectDataLayer.js` | Загрузка версий |

---

## Часть 5. Порядок реализации (рекомендуемый)

### Фаза 1: Упрощение статусов
1. Миграция БД: новое поле `workflow_substatus`, обновление справочников.
2. Обновление `constants.js`, `workflow-state-machine.js`.
3. Обновление `ApplicationsDashboard.jsx` (метрики, фильтры, бейджи).
4. Обновление `WorkflowBar.jsx` и `useProjectWorkflowLayer.js`.
5. Обновление маппингов и API.

### Фаза 2: Отказ заявлений
1. Новая функция `getDeclineTransition` в state-machine.
2. Кнопка «Отказать» на рабочем столе + модалка.
3. API endpoint для отказа.
4. Запись в `application_history`.

### Фаза 3: Версионирование
1. Миграция БД: таблица `object_versions` и справочник.
2. API-сервис `versions-api.js`.
3. Интеграция с workflow (автоматическое создание snapshot-ов).
4. UI-компоненты: `VersionBadge`, `VersionHistory`.
5. Интеграция в редакторы объектов.

---

## Часть 6. Открытые вопросы

1. **Миграция существующих данных**: как конвертировать текущие 7 статусов в новые 3 + подстатус для существующих заявок?
2. **Гранулярность версионирования**: делать snapshot на уровне здания целиком (с блоками, этажами, помещениями) или каждый объект версионируется отдельно?
3. **Объем snapshot-а**: JSON со всеми полями или только diff (дельта изменений)?
4. **Автоматическое создание версий**: при каждом сохранении или только на checkpoint-ах этапов?
5. **Права на операции с версиями**: может ли техник просматривать историю версий? Может ли он восстанавливать отклоненную версию?
6. **Отказ на рабочем столе vs. отказ внутри проекта**: можно ли отказать заявление только с рабочего стола или также изнутри проекта (WorkflowBar)?
