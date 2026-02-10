# Предложение: Редизайн статусов заявлений + Версионирование объектов ЖК + Роль «Начальник филиала»

**Дата**: 2026-02-10  
**Обновлено**: 2026-02-10  
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
| `PENDING_DECLINE` | `IN_PROGRESS` | Техник запросил отказ — на рассмотрении у начальника филиала |
| `RETURNED_BY_MANAGER` | `IN_PROGRESS` | Начальник филиала вернул технику на доработку (отказ не подтвержден) |
| `INTEGRATION` | `IN_PROGRESS` | Этап интеграции с УЗКАД |
| `DONE` | `COMPLETED` | Все шаги пройдены |
| `DECLINED_BY_ADMIN` | `DECLINED` | Отказано администратором |
| `DECLINED_BY_CONTROLLER` | `DECLINED` | Отказано контролером |
| `DECLINED_BY_MANAGER` | `DECLINED` | Отказано начальником филиала |

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
  ('DRAFT',                 'IN_PROGRESS', 'Ввод данных',              10),
  ('REVIEW',                'IN_PROGRESS', 'На проверке',              20),
  ('REVISION',              'IN_PROGRESS', 'На доработке',             30),
  ('PENDING_DECLINE',       'IN_PROGRESS', 'Запрос на отказ',          35),
  ('RETURNED_BY_MANAGER',   'IN_PROGRESS', 'Возвращено начальником',   37),
  ('INTEGRATION',           'IN_PROGRESS', 'Интеграция',               40),
  ('DONE',                  'COMPLETED',   'Завершено',                50),
  ('DECLINED_BY_ADMIN',     'DECLINED',    'Отказано (админ)',          60),
  ('DECLINED_BY_CONTROLLER','DECLINED',    'Отказано (контролер)',      70),
  ('DECLINED_BY_MANAGER',   'DECLINED',    'Отказано (нач. филиала)',   75);
```

### 1.5 Изменения в коде (перечень файлов и точек изменения)

#### `src/lib/constants.js`

- **`APP_STATUS`** — заменить 7 значений на 3: `IN_PROGRESS`, `COMPLETED`, `DECLINED`.
- **Новая константа `WORKFLOW_SUBSTATUS`** — перечисление подстатусов: `DRAFT`, `REVIEW`, `REVISION`, `PENDING_DECLINE`, `RETURNED_BY_MANAGER`, `INTEGRATION`, `DONE`, `DECLINED_BY_ADMIN`, `DECLINED_BY_CONTROLLER`, `DECLINED_BY_MANAGER`.
- **`APP_STATUS_LABELS`** — упростить до 3 записей.
- **`ROLES`** — добавить `BRANCH_MANAGER: 'branch_manager'`.

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
- `branch_manager` — при подстатусе `PENDING_DECLINE` (по запросу техника), а также с рабочего стола (см. Часть 7).

**Обязательные данные при отказе:**
- Причина отказа (текстовый комментарий, минимум 10 символов).
- Дата и автор фиксируются автоматически.

**Workflow при отказе:**
```
applications.status       = 'DECLINED'
applications.workflow_substatus = 'DECLINED_BY_ADMIN' | 'DECLINED_BY_CONTROLLER' | 'DECLINED_BY_MANAGER'
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
   - Для `branch_manager`: видна всегда, кроме `COMPLETED` и `DECLINED` (основное право роли).
   - Для `controller`: видна только при подстатусе `REVIEW`.
   - Для `technician`: не видна (техник использует кнопку «Запросить отказ» внутри проекта, см. Часть 7).
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
export const getDeclineTransition = (currentAppInfo, declinedBy) => {
  const substatusMap = {
    controller: 'DECLINED_BY_CONTROLLER',
    branch_manager: 'DECLINED_BY_MANAGER',
    admin: 'DECLINED_BY_ADMIN',
  };
  return {
    action: WORKFLOW_ACTIONS.DECLINE,
    nextStatus: 'DECLINED',
    nextSubstatus: substatusMap[declinedBy] || 'DECLINED_BY_ADMIN',
    prevStatus: currentAppInfo.status,
    prevSubstatus: currentAppInfo.workflowSubstatus,
  };
};
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

---

## Часть 7. Новая роль: Начальник филиала (`branch_manager`)

### 7.1 Описание роли

| Атрибут | Значение |
|---------|----------|
| **Название** | Начальник филиала |
| **Код в системе** | `branch_manager` |
| **Уровень доступа** | Управленческий (между controller и admin) |
| **Основная задача** | Управление входящими заявлениями, назначение исполнителей, принятие решений об отказе |

### 7.2 Полномочия и ограничения

#### Полномочия (что МОЖЕТ делать)

| # | Действие | Описание | Контекст |
|---|----------|----------|----------|
| 1 | **Принимать входящие заявления** | Брать заявки из «Входящих» в работу, создавая проект | Рабочий стол → вкладка «Входящие» |
| 2 | **Назначать техника-исполнителя** | Выбирать конкретного техника из списка `dict_system_users` для работы над заявкой | Рабочий стол → строка заявки |
| 3 | **Отказывать заявления с рабочего стола** | Принимать решение об отказе заявления с обязательным указанием причины | Рабочий стол → кнопка «Отказать» |
| 4 | **Рассматривать запросы на отказ от техника** | Когда техник отправляет заявление на рассмотрение для отказа — утвердить отказ или вернуть технику | Рабочий стол → фильтр «На рассмотрении» / Внутри проекта |
| 5 | **Просматривать все данные проекта** | Доступ к просмотру всех шагов и данных (read-only) | Внутри проекта |
| 6 | **Просматривать историю действий** | Журнал всех workflow-операций | Внутри проекта |

#### Ограничения (что НЕ МОЖЕТ делать)

| # | Действие | Причина |
|---|----------|---------|
| 1 | Редактировать данные проекта | Ввод данных — прерогатива техника |
| 2 | Завершать/откатывать шаги workflow | `COMPLETE_STEP` / `ROLLBACK_STEP` — только техник и админ |
| 3 | Принимать/возвращать этапы (Approve/Reject) | Проверка качества — прерогатива контролера |
| 4 | Удалять проекты | Только админ |
| 5 | Управлять справочниками | Только админ |

### 7.3 Сравнение всех ролей (обновленная таблица)

| Действие | `technician` | `controller` | `branch_manager` | `admin` |
|----------|:---:|:---:|:---:|:---:|
| Просмотр данных | ✅ | ✅ | ✅ | ✅ |
| Редактирование данных | ✅ (в DRAFT/REVISION/INTEGRATION) | ❌ | ❌ | ✅ |
| Завершение шага (COMPLETE_STEP) | ✅ | ❌ | ❌ | ✅ |
| Откат шага (ROLLBACK_STEP) | ✅ | ❌ | ❌ | ✅ |
| Approve/Reject этапа | ❌ | ✅ | ❌ | ✅ |
| Принять входящую заявку | ❌ | ❌ | ✅ | ✅ |
| Назначить техника | ❌ | ❌ | ✅ | ✅ |
| Отказать заявление (рабочий стол) | ❌ | ✅ (при REVIEW) | ✅ | ✅ |
| Запросить отказ (отправка начальнику) | ✅ | ❌ | ❌ | ❌ |
| Рассмотреть запрос на отказ | ❌ | ❌ | ✅ | ✅ |
| Удалить проект | ❌ | ❌ | ❌ | ✅ |
| Управление справочниками | ❌ | ❌ | ❌ | ✅ |

### 7.4 Workflow: Запрос техника на отказ

Ключевая новая цепочка: техник на **любом шаге** может инициировать отказ заявления, но решение принимает начальник филиала.

#### Диаграмма

```
  ТЕХНИК (на любом шаге)                    НАЧАЛЬНИК ФИЛИАЛА
  ─────────────────────                     ──────────────────
         │                                         │
   [Запросить отказ]                               │
   (ввод причины)                                  │
         │                                         │
         ├── substatus = PENDING_DECLINE ──────────▶│
         │   step остается прежним                 │
         │   данные read-only                      │
         │                                   ┌─────┴─────┐
         │                                   │           │
         │                              [Утвердить   [Вернуть
         │                               отказ]     на доработку]
         │                                   │           │
         │                                   │           │
         │     status = DECLINED             │           │
         │     substatus = DECLINED_BY_MANAGER           │
         │     ◄─────────────────────────────┘           │
         │                                               │
         │     substatus = RETURNED_BY_MANAGER           │
         │     step = тот же шаг                         │
         │     данные снова editable                     │
         ◄───────────────────────────────────────────────┘
```

#### Подробный алгоритм

**Шаг 1. Техник инициирует запрос на отказ**

Условия:
- Роль: `technician`
- Подстатус заявки: `DRAFT`, `REVISION`, `RETURNED_BY_MANAGER` или `INTEGRATION`
- Заявка не в статусе `COMPLETED` или `DECLINED`

Действия:
```
applications.workflow_substatus = 'PENDING_DECLINE'
applications.status            = 'IN_PROGRESS' (без изменений)
applications.current_step      = без изменений (шаг сохраняется)
applications.current_stage     = без изменений
```

Запись в историю:
```sql
INSERT INTO application_history (application_id, action, prev_status, next_status, user_name, comment)
VALUES (?, 'REQUEST_DECLINE', 'IN_PROGRESS', 'IN_PROGRESS', 'Имя техника', 'Причина запроса на отказ...');
```

UI-эффект:
- Данные проекта переходят в read-only для техника.
- На рабочем столе у начальника филиала появляется заявка в фильтре «На рассмотрении».
- Бейдж подстатуса: `bg-amber-100 text-amber-700` — «Запрос на отказ».

**Шаг 2a. Начальник филиала утверждает отказ**

Условия:
- Роль: `branch_manager` или `admin`
- Подстатус заявки: `PENDING_DECLINE`

Действия:
```
applications.status            = 'DECLINED'
applications.workflow_substatus = 'DECLINED_BY_MANAGER'
```

Запись в историю:
```sql
INSERT INTO application_history (application_id, action, prev_status, next_status, user_name, comment)
VALUES (?, 'DECLINE', 'IN_PROGRESS', 'DECLINED', 'Имя начальника', 'Подтверждение отказа: ...');
```

UI-эффект:
- Заявка получает бейдж «Отказано» на рабочем столе.
- Toast-уведомление для техника (если онлайн): «Заявление отклонено начальником филиала».

**Шаг 2b. Начальник филиала возвращает на доработку**

Условия:
- Роль: `branch_manager` или `admin`
- Подстатус заявки: `PENDING_DECLINE`

Действия:
```
applications.workflow_substatus = 'RETURNED_BY_MANAGER'
applications.status            = 'IN_PROGRESS' (без изменений)
applications.current_step      = без изменений (тот же шаг, где техник остановился)
```

Запись в историю:
```sql
INSERT INTO application_history (application_id, action, prev_status, next_status, user_name, comment)
VALUES (?, 'RETURN_FROM_DECLINE', 'IN_PROGRESS', 'IN_PROGRESS', 'Имя начальника', 'Причина возврата: продолжите работу...');
```

UI-эффект:
- Техник видит заявку обратно в фильтре «В работе».
- Данные снова доступны для редактирования.
- Техник продолжает работу **с того же шага**, на котором отправил запрос.
- Бейдж подстатуса: «Возвращено начальником» (кратковременный, при первом действии техника переходит в `DRAFT`).

### 7.5 Изменения в БД

#### Обновить CHECK constraint роли в `dict_system_users`:

```sql
-- Добавить роль в валидацию (если есть CHECK constraint)
-- В текущей схеме проверка: CHECK (role IN ('admin', 'controller', 'technician'))
-- Нужно расширить:
ALTER TABLE dict_system_users DROP CONSTRAINT IF EXISTS dict_system_users_role_check;
ALTER TABLE dict_system_users ADD CONSTRAINT dict_system_users_role_check 
  CHECK (role IN ('admin', 'controller', 'technician', 'branch_manager'));
```

#### Добавить тестовых пользователей с ролью `branch_manager`:

```sql
INSERT INTO dict_system_users (code, name, role, group_name, sort_order) VALUES
  ('timur_manager',  'Тимур',      'branch_manager', 'Тимур',      15),
  ('abdu_manager',   'Абдурашид',  'branch_manager', 'Абдурашид',  45),
  ('vakhit_manager', 'Вахит',      'branch_manager', 'Вахит',      75),
  ('abbos_manager',  'Аббос',      'branch_manager', 'Аббос',      105)
ON CONFLICT (code) DO NOTHING;
```

#### Новое поле `applications.requested_decline_reason`:

```sql
ALTER TABLE applications
  ADD COLUMN requested_decline_reason TEXT;       -- Причина запроса на отказ (от техника)
  ADD COLUMN requested_decline_step   INT;        -- Шаг, на котором запрошен отказ
  ADD COLUMN requested_decline_by     TEXT;        -- Кто запросил отказ
  ADD COLUMN requested_decline_at     TIMESTAMPTZ; -- Когда запрошен отказ
```

### 7.6 Изменения в коде

#### `src/lib/constants.js`

```javascript
export const ROLES = {
  TECHNICIAN: 'technician',
  CONTROLLER: 'controller',
  BRANCH_MANAGER: 'branch_manager',  // НОВАЯ РОЛЬ
  ADMIN: 'admin',
};
```

#### `src/lib/workflow-state-machine.js`

Новая функция проверки прав редактирования:

```javascript
export const canEditByRoleAndStatus = (role, substatus) => {
  if (role === ROLES.ADMIN) return true;
  if (role === ROLES.CONTROLLER) return false;
  if (role === ROLES.BRANCH_MANAGER) return false;  // НЕ редактирует данные

  if (role === ROLES.TECHNICIAN) {
    return ['DRAFT', 'REVISION', 'RETURNED_BY_MANAGER', 'INTEGRATION'].includes(substatus);
    // PENDING_DECLINE → read-only для техника (ждет решения начальника)
  }

  return false;
};
```

Новые workflow-действия:

```javascript
export const WORKFLOW_ACTIONS = {
  ...existing,
  DECLINE: 'DECLINE',
  REQUEST_DECLINE: 'REQUEST_DECLINE',           // Техник → начальнику
  RETURN_FROM_DECLINE: 'RETURN_FROM_DECLINE',   // Начальник → технику
};
```

Новые функции переходов:

```javascript
// Техник запрашивает отказ
export const getRequestDeclineTransition = (currentAppInfo) => ({
  action: WORKFLOW_ACTIONS.REQUEST_DECLINE,
  nextStatus: currentAppInfo.status,               // IN_PROGRESS — не меняется
  nextSubstatus: 'PENDING_DECLINE',
  nextStepIndex: currentAppInfo.currentStepIndex,   // Шаг не меняется
  nextStage: currentAppInfo.currentStage,           // Этап не меняется
  prevSubstatus: currentAppInfo.workflowSubstatus,
});

// Начальник филиала возвращает на доработку
export const getReturnFromDeclineTransition = (currentAppInfo) => ({
  action: WORKFLOW_ACTIONS.RETURN_FROM_DECLINE,
  nextStatus: currentAppInfo.status,               // IN_PROGRESS — не меняется
  nextSubstatus: 'RETURNED_BY_MANAGER',
  nextStepIndex: currentAppInfo.currentStepIndex,   // Тот же шаг
  nextStage: currentAppInfo.currentStage,           // Тот же этап
  prevSubstatus: currentAppInfo.workflowSubstatus,
});
```

#### `src/components/ApplicationsDashboard.jsx`

**Доступ к вкладке «Входящие»:**
```javascript
// БЫЛО:
const canViewInbox = isAdmin;

// СТАЛО:
const canViewInbox = isAdmin || user.role === ROLES.BRANCH_MANAGER;
```

**Доступ к действию «Принять заявку»:**
```javascript
// Кнопка "Принять" во входящих доступна для admin и branch_manager
const canTakeInbox = isAdmin || user.role === ROLES.BRANCH_MANAGER;
```

**Новый фильтр задач — «На рассмотрении» (для начальника филиала):**
```javascript
// Новый фильтр для branch_manager
if (taskFilter === 'pending_decline') {
  filtered = filtered.filter(p => 
    p.applicationInfo?.workflowSubstatus === 'PENDING_DECLINE'
  );
}
```

**Новая KPI-плитка — «На рассмотрении»:**
```javascript
// Для branch_manager и admin
counts.pendingDecline = projects.filter(
  p => p.applicationInfo?.workflowSubstatus === 'PENDING_DECLINE'
).length;
```

**Назначение исполнителя (новый элемент в строке таблицы):**
- Для `branch_manager` и `admin`: выпадающий список технников рядом с колонкой «Исполнитель».
- Данные: из `dict_system_users` фильтрация по `role = 'technician'`.
- При выборе: `applications.assignee_name = выбранный_техник.name`.

#### `src/components/WorkflowBar.jsx`

**Новая кнопка «Запросить отказ» для техника:**

Расположение: в панели действий WorkflowBar, рядом с кнопкой «Выйти без сохранения».

Видимость:
- Роль: `technician`
- Подстатус: `DRAFT`, `REVISION`, `RETURNED_BY_MANAGER`, `INTEGRATION`
- Не на шагах с подстатусом `REVIEW`, `PENDING_DECLINE`, `COMPLETED`, `DECLINED`

UI:
```jsx
<Button
  onClick={handleRequestDecline}
  className="text-red-400 hover:text-red-300 hover:bg-red-900/20 px-3 h-10 border border-transparent"
>
  <Ban size={16} className="mr-2" />
  Запросить отказ
</Button>
```

**Модалка подтверждения запроса на отказ:**
- Заголовок: «Запрос на отказ заявления»
- Описание: «Заявление будет направлено начальнику филиала для рассмотрения. Укажите причину.»
- Текстовое поле: обязательное, минимум 10 символов.
- Кнопки: «Отмена» / «Отправить на рассмотрение» (красная).
- После подтверждения: данные сохраняются, затем выход на рабочий стол.

**Режим read-only при `PENDING_DECLINE`:**
Когда подстатус `PENDING_DECLINE`, техник видит специальную панель:
```jsx
<div className="bg-amber-900 border-b border-amber-800 px-8 py-4 ...">
  <span>Заявление направлено начальнику филиала для рассмотрения отказа</span>
  <span>Ожидайте решения. Данные доступны только для просмотра.</span>
</div>
```

**Панель действий для начальника филиала (при `PENDING_DECLINE`):**
Когда начальник филиала открывает проект с подстатусом `PENDING_DECLINE`:
```jsx
<div className="bg-amber-900 border-b ...">
  <div>
    <span>Запрос на отказ от техника: {requestedDeclineBy}</span>
    <span>Причина: {requestedDeclineReason}</span>
    <span>Шаг: {STEPS_CONFIG[requestedDeclineStep]?.title}</span>
  </div>
  <div>
    <Button onClick={handleReturnToTechnician}>Вернуть на доработку</Button>
    <Button onClick={handleConfirmDecline}>Подтвердить отказ</Button>
  </div>
</div>
```

#### `src/context/project/useProjectWorkflowLayer.js`

Новые функции:

```javascript
// Техник запрашивает отказ
const requestDecline = async (reason) => {
  const transition = getRequestDeclineTransition(applicationInfo);
  await ApiService.updateApplicationWorkflow(applicationId, {
    status: transition.nextStatus,
    workflow_substatus: transition.nextSubstatus,
    requested_decline_reason: reason,
    requested_decline_step: applicationInfo.currentStepIndex,
    requested_decline_by: user.name,
    requested_decline_at: new Date().toISOString(),
  });
  await ApiService.addApplicationHistory(applicationId, {
    action: 'REQUEST_DECLINE',
    prev_status: applicationInfo.status,
    next_status: transition.nextStatus,
    user_name: user.name,
    comment: reason,
  });
};

// Начальник филиала подтверждает отказ
const confirmDecline = async (comment) => {
  const transition = getDeclineTransition(applicationInfo, 'branch_manager');
  // ... аналогично declineApplication
};

// Начальник филиала возвращает на доработку
const returnFromDecline = async (comment) => {
  const transition = getReturnFromDeclineTransition(applicationInfo);
  await ApiService.updateApplicationWorkflow(applicationId, {
    status: transition.nextStatus,
    workflow_substatus: transition.nextSubstatus,
    requested_decline_reason: null,  // Очищаем
  });
  await ApiService.addApplicationHistory(applicationId, {
    action: 'RETURN_FROM_DECLINE',
    prev_status: applicationInfo.status,
    next_status: transition.nextStatus,
    user_name: user.name,
    comment: comment,
  });
};
```

### 7.7 Примеры сценариев

#### Сценарий 1: Техник запрашивает отказ, начальник утверждает

```
1. Техник работает на шаге 3 (registry_res), подстатус DRAFT
2. Техник нажимает «Запросить отказ», вводит: "Объект снесен, инвентаризация невозможна"
3. → substatus = PENDING_DECLINE, step = 3
4. Техник выходит на рабочий стол, заявка в read-only
5. Начальник филиала видит заявку в фильтре «На рассмотрении»
6. Начальник открывает проект, видит причину и данные
7. Начальник нажимает «Подтвердить отказ», вводит: "Подтверждаю, объект не подлежит инвентаризации"
8. → status = DECLINED, substatus = DECLINED_BY_MANAGER
```

#### Сценарий 2: Техник запрашивает отказ, начальник возвращает

```
1. Техник работает на шаге 7 (mop), подстатус DRAFT
2. Техник нажимает «Запросить отказ», вводит: "Застройщик отказался предоставлять документы"
3. → substatus = PENDING_DECLINE, step = 7
4. Начальник видит заявку, открывает проект
5. Начальник нажимает «Вернуть на доработку», вводит: "Свяжитесь повторно с застройщиком"
6. → substatus = RETURNED_BY_MANAGER, step = 7 (тот же шаг!)
7. Техник видит заявку обратно в «В работе»
8. Техник продолжает работу с шага 7 (mop)
```

#### Сценарий 3: Начальник филиала принимает входящую заявку и назначает техника

```
1. Внешняя заявка поступает во «Входящие»
2. Начальник филиала открывает вкладку «Входящие»
3. Нажимает «Принять» → создается проект
4. В строке проекта выбирает техника-исполнителя из выпадающего списка
5. → applications.assignee_name = 'Выбранный техник'
6. Техник видит назначенную заявку в своих задачах
```

### 7.8 Рабочий стол начальника филиала

#### Вкладки

| Вкладка | Видимость | Содержимое |
|---------|-----------|------------|
| **Задачи** | Всегда | Заявки, требующие внимания начальника |
| **Входящие** | Всегда | Входящие заявки из внешних систем |
| **Реестр** | Всегда | Все заявки (read-only просмотр) |

#### Фильтры в «Задачах»

| Фильтр | Что показывает | Счетчик |
|--------|----------------|---------|
| **На рассмотрении** | `substatus = PENDING_DECLINE` | Количество запросов на отказ |
| **В работе** | `status = IN_PROGRESS`, исключая `PENDING_DECLINE` | Все активные заявки |
| **Без исполнителя** | `assignee_name IS NULL AND status = IN_PROGRESS` | Заявки, которым нужен техник |

#### KPI-плитки

| Метрика | Значение | Цвет |
|---------|----------|------|
| На рассмотрении | Количество `PENDING_DECLINE` | Янтарный (`text-amber-600`) |
| В работе | Количество `IN_PROGRESS` | Синий (`text-blue-600`) |
| Без исполнителя | Количество без `assignee_name` | Красный (`text-red-600`) |
| Завершено | Количество `COMPLETED` | Зеленый (`text-emerald-600`) |

### 7.9 Автоматический переход подстатуса `RETURNED_BY_MANAGER` → `DRAFT`

После того как начальник возвращает заявление технику, подстатус `RETURNED_BY_MANAGER` носит информационный характер. При первом действии техника (сохранение данных или завершение шага) подстатус автоматически меняется на `DRAFT`:

```javascript
// В useProjectWorkflowLayer.js или в saveProjectImmediate:
if (applicationInfo.workflowSubstatus === 'RETURNED_BY_MANAGER') {
  await ApiService.updateApplicationWorkflow(applicationId, {
    workflow_substatus: 'DRAFT',
  });
}
```

---

## Часть 8. Обновленная сводка изменений по файлам

### БД (миграции)

| Файл / Объект | Действие |
|---------------|----------|
| `applications.status` | Изменить допустимые значения на 3 |
| `applications.workflow_substatus` | Новое поле |
| `applications.requested_decline_reason` | Новое поле — причина запроса на отказ |
| `applications.requested_decline_step` | Новое поле — шаг, на котором запрошен отказ |
| `applications.requested_decline_by` | Новое поле — кто запросил отказ |
| `applications.requested_decline_at` | Новое поле — время запроса |
| `dict_application_statuses` | Обновить записи (3 вместо 7) |
| `dict_workflow_substatuses` | Новая таблица (10 подстатусов) |
| `dict_system_users` | Расширить CHECK на role, добавить `branch_manager` пользователей |
| `object_versions` | Новая таблица |
| `dict_version_statuses` | Новая таблица-справочник |

### Frontend (файлы для изменения)

| Файл | Изменения |
|------|-----------|
| `src/lib/constants.js` | `APP_STATUS` → 3; `ROLES` → 4; `WORKFLOW_SUBSTATUS` — 10 подстатусов; `VERSION_STATUS` |
| `src/lib/workflow-state-machine.js` | Подстатусы; `branch_manager` в проверках прав; `getDeclineTransition`, `getRequestDeclineTransition`, `getReturnFromDeclineTransition` |
| `src/lib/workflow-utils.js` | Хелперы для подстатусов |
| `src/lib/auth-service.js` | Поддержка роли `branch_manager` |
| `src/lib/db-mappers.js` | Маппинг `workflow_substatus`, `requested_decline_*`, `object_versions` |
| `src/lib/api/workflow-api.js` | Эндпоинты: `declineApplication`, `requestDecline`, `returnFromDecline`, `assignTechnician` |
| `src/lib/api/versions-api.js` | **Новый файл** — API для версий |
| `src/components/ApplicationsDashboard.jsx` | Вкладка «Входящие» для `branch_manager`; назначение техника; фильтр «На рассмотрении»; кнопка «Отказать»; KPI-плитки по роли |
| `src/components/WorkflowBar.jsx` | Кнопка «Запросить отказ» для техника; панель `PENDING_DECLINE` для обеих ролей; read-only режим |
| `src/components/ui/VersionBadge.jsx` | **Новый файл** |
| `src/components/VersionHistory.jsx` | **Новый файл** |
| `src/context/project/useProjectWorkflowLayer.js` | `requestDecline`, `confirmDecline`, `returnFromDecline`, `assignTechnician` |
| `src/context/project/useProjectDataLayer.js` | Загрузка версий; маппинг `requested_decline_*` |
| `db/reset_schema.sql` | Расширение роли, новые поля, новые таблицы |

---

## Часть 9. Обновленный порядок реализации

### Фаза 1: Упрощение статусов + новая роль `branch_manager`
1. Миграция БД: `workflow_substatus`, `requested_decline_*` поля, расширение ролей.
2. Обновление `constants.js` (ROLES, APP_STATUS, WORKFLOW_SUBSTATUS).
3. Обновление `workflow-state-machine.js` (все новые функции и проверки).
4. Обновление `auth-service.js` (поддержка роли).

### Фаза 2: Рабочий стол начальника филиала
1. `ApplicationsDashboard.jsx` — вкладки, фильтры, KPI по роли.
2. Принятие входящих заявлений для `branch_manager`.
3. Назначение техника-исполнителя (выпадающий список).
4. Кнопка «Отказать» на рабочем столе.

### Фаза 3: Запрос на отказ от техника
1. `WorkflowBar.jsx` — кнопка «Запросить отказ», модалка, read-only при `PENDING_DECLINE`.
2. `useProjectWorkflowLayer.js` — функция `requestDecline`.
3. Панель действий для начальника филиала при `PENDING_DECLINE`.
4. `confirmDecline` и `returnFromDecline`.

### Фаза 4: Версионирование
1. Миграция БД: `object_versions`, справочник.
2. API и UI компоненты версий.

---

## Часть 10. Открытые вопросы

### Статусы и миграция

1. **Миграция существующих данных**: как конвертировать текущие 7 статусов в новые 3 + подстатус для существующих заявок?

### Версионирование

2. **Гранулярность версионирования**: делать snapshot на уровне здания целиком (с блоками, этажами, помещениями) или каждый объект версионируется отдельно?
3. **Объем snapshot-а**: JSON со всеми полями или только diff (дельта изменений)?
4. **Автоматическое создание версий**: при каждом сохранении или только на checkpoint-ах этапов?
5. **Права на операции с версиями**: может ли техник просматривать историю версий? Может ли он восстанавливать отклоненную версию?

### Отказ заявлений

6. **Отказ на рабочем столе vs. отказ внутри проекта**: может ли начальник филиала отказать заявление только с рабочего стола или также изнутри проекта (WorkflowBar)?
7. **Повторный запрос на отказ**: может ли техник повторно запросить отказ после того, как начальник вернул заявление на доработку? (Предлагается: да, без ограничений.)
8. **Лимит попыток**: нужно ли ограничивать количество запросов на отказ от одного техника по одной заявке?

### Роль начальника филиала

9. **Область видимости**: видит ли начальник филиала только заявки «своего» филиала или все заявки в системе? (Если да — нужно поле `branch_id` в `dict_system_users` и фильтрация по нему.)
10. **Назначение техника — обязательность**: может ли заявка существовать без назначенного техника? Или начальник обязан назначить исполнителя сразу при принятии?
11. **Переназначение техника**: может ли начальник сменить техника на лету, если заявка уже в работе?
12. **Уведомления**: нужна ли система уведомлений (in-app или email) при: запросе на отказ, решении начальника, назначении техника?
13. **Совмещение ролей**: может ли один пользователь иметь одновременно роль `branch_manager` и `controller`? Или роли строго взаимоисключающие?
