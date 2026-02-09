# 5. Workflow: роли, статусы, этапы, переходы

## 5.1 Роли пользователей

### Таблица ролей

| Роль | Код | Права доступа | Основные действия | Источник в БД |
|------|-----|---------------|------------------|--------------|
| **Администратор** | `admin` | Полный доступ | Все операции с данными и workflow | `dict_system_users.role='admin'` |
| **Техник-инвентаризатор** | `technician` | Ввод/редактирование данных | Заполнение шагов, завершение шагов | `dict_system_users.role='technician'` |
| **Контролер-бригадир** | `controller` | Только проверка | Approve/Reject этапов, просмотр | `dict_system_users.role='controller'` |

### Детальное описание ролей

#### Администратор (`admin`)

**Полномочия**:
- ✅ Создание и редактирование проектов
- ✅ Редактирование данных на любом шаге
- ✅ Выполнение всех workflow-операций (Complete, Rollback, Approve, Reject)
- ✅ Изменение статусов заявок вручную
- ✅ Управление участниками и документами
- ✅ Доступ ко всем этапам и шагам

**Ограничения**: Нет

**Функция проверки**: `canEditByRoleAndStatus(ROLES.ADMIN, status)` → всегда `true`

#### Техник-инвентаризатор (`technician`)

**Полномочия**:
- ✅ Редактирование данных на шагах в статусах: `DRAFT`, `NEW`, `REJECTED`, `INTEGRATION`
- ✅ Завершение текущего шага (`COMPLETE_STEP`)
- ✅ Откат на предыдущий шаг (`ROLLBACK_STEP`)
- ✅ Просмотр всех шагов

**Ограничения**:
- ❌ Нет доступа к редактированию в статусах: `REVIEW`, `APPROVED`, `COMPLETED`
- ❌ Не может выполнять Approve/Reject
- ❌ Не может изменять статусы вручную

**Функция проверки**: 
```javascript
canEditByRoleAndStatus(ROLES.TECHNICIAN, status) {
  return [APP_STATUS.DRAFT, APP_STATUS.NEW, APP_STATUS.REJECTED, APP_STATUS.INTEGRATION]
    .includes(status);
}
```

#### Контролер-бригадир (`controller`)

**Полномочия**:
- ✅ Просмотр всех данных
- ✅ Выполнение Approve/Reject для этапов в статусе `REVIEW`
- ✅ Добавление комментариев

**Ограничения**:
- ❌ Нет доступа к редактированию данных
- ❌ Не может завершать или откатывать шаги
- ❌ Не может изменять контент (composition, floors, units и т.д.)

**Функция проверки**: `canEditByRoleAndStatus(ROLES.CONTROLLER, status)` → всегда `false`

## 5.2 Статусы заявки

### Жизненный цикл заявки

```
NEW → DRAFT → REVIEW → (APPROVED → DRAFT) → INTEGRATION → COMPLETED
        ↑         ↓
        └─ REJECTED
```

### Таблица статусов

| Статус | Код | Описание | Кто может установить | Следующие статусы |
|--------|-----|----------|---------------------|------------------|
| **Новая** | `NEW` | Заявка создана, не взята в работу | Система при создании | `DRAFT` |
| **В работе** | `DRAFT` | Заявка в работе у техника | Система при COMPLETE_STEP | `REVIEW`, `DRAFT` |
| **На проверке** | `REVIEW` | Отправлена контролеру | Система при завершении этапа | `APPROVED`, `REJECTED` |
| **Принято** | `APPROVED` | Контролер принял этап | Контролер (APPROVE) | `DRAFT`, `INTEGRATION` |
| **Возврат** | `REJECTED` | Контролер вернул на доработку | Контролер (REJECT) | `DRAFT` |
| **Интеграция** | `INTEGRATION` | Готова к передаче в УЗКАД | Система при переходе на шаг 12 | `DRAFT`, `COMPLETED` |
| **Закрыта** | `COMPLETED` | Финальный статус | Система при завершении последнего шага | - |

### Детальное описание статусов

#### NEW (Новая)

**Поле БД**: `applications.status = 'NEW'`

**Когда устанавливается**:
- При создании заявки из внешней системы
- При создании проекта вручную без немедленного начала работы

**Доступные действия**:
- Просмотр
- Начало работы (переход в `DRAFT`)

**Цвет в UI**: Синий (`bg-blue-100 text-blue-700`)

#### DRAFT (В работе)

**Поле БД**: `applications.status = 'DRAFT'`

**Когда устанавливается**:
- При начале работы над заявкой
- После завершения шага внутри этапа
- После Approve контролера (продолжение работы)
- После возврата из REJECTED

**Доступные действия**:
- Редактирование данных (для techni cian/admin)
- Завершение шага (`COMPLETE_STEP`)
- Откат шага (`ROLLBACK_STEP`)

**Цвет в UI**: Серый (`bg-slate-100 text-slate-700`)

#### REVIEW (На проверке)

**Поле БД**: `applications.status = 'REVIEW'`

**Когда устанавливается**:
- Автоматически при завершении последнего шага этапа
- Условие: `isStageBoundary = true` при `COMPLETE_STEP`

**Доступные действия**:
- Просмотр данных (для всех ролей)
- Approve/Reject (только для controller/admin)

**Цвет в UI**: Оранжевый (`bg-orange-100 text-orange-700`)

#### APPROVED (Принято)

**Поле БД**: `applications.status = 'APPROVED'`

**Когда устанавливается**:
- При выполнении APPROVE контролером
- Длительность: Кратковременный, сразу переходит в DRAFT или INTEGRATION

**Доступные действия**:
- Автоматический переход в следующий статус

**Цвет в UI**: Зеленый (`bg-emerald-100 text-emerald-700`)

#### REJECTED (Возврат)

**Поле БД**: `applications.status = 'REJECTED'`

**Когда устанавливается**:
- При выполнении REJECT контролером

**Доступные действия**:
- Редактирование данных (для technician/admin)
- Исправление замечаний
- Повторное завершение этапа

**Цвет в UI**: Красный (`bg-red-100 text-red-700`)

#### INTEGRATION (Интеграция)

**Поле БД**: `applications.status = 'INTEGRATION'`

**Когда устанавливается**:
- Автоматически при переходе на шаг 12 (`integration_buildings`)
- После Approve этапа 3 (шаги 9-11)

**Доступные действия**:
- Работа с интеграционными шагами
- Редактирование данных (для technician/admin)
- Отправка данных в УЗКАД

**Цвет в UI**: Индиго (`bg-indigo-100 text-indigo-700`)

#### COMPLETED (Закрыта)

**Поле БД**: `applications.status = 'COMPLETED'`

**Когда устанавливается**:
- Автоматически при завершении последнего шага (индекс 16)

**Доступные действия**:
- Только просмотр
- Нет редактирования

**Цвет в UI**: Темно-серый (`bg-gray-800 text-white`)

## 5.3 Этапы и шаги workflow

### Конфигурация этапов

**Источник**: `src/lib/constants.js` → `WORKFLOW_STAGES`

| Этап | Последний шаг | Название | Шаги в этапе |
|------|--------------|---------|-------------|
| **1** | 5 | Этап 1: Инвентаризация | 0-5 (passport, composition, registry_nonres, registry_res, floors, entrances) |
| **2** | 8 | Этап 2: Конфигурация | 6-8 (apartments, mop, parking_config) |
| **3** | 11 | Этап 3: Реестры | 9-11 (registry_apartments, registry_commercial, registry_parking) |
| **4** | 16 | Финал: Интеграция | 12-16 (integration_buildings, integration_units, registry_nonres_view, registry_res_view, summary) |

### Полный список шагов

**Источник**: `src/lib/constants.js` → `STEPS_CONFIG`

| Индекс | ID шага | Название | Этап | Checkpoint | Описание |
|--------|---------|----------|------|-----------|----------|
| 0 | `passport` | Паспорт ЖК | 1 | - | Основные данные проекта |
| 1 | `composition` | Здания и сооружения | 1 | - | Состав объектов |
| 2 | `registry_nonres` | Нежилые блоки и инфраструктура | 1 | - | Конфигурация нежилых объектов |
| 3 | `registry_res` | Жилые блоки | 1 | - | Конфигурация жилых блоков |
| 4 | `floors` | Внешняя инвентаризация | 1 | - | Высоты и площади этажей |
| 5 | `entrances` | Инвентаризация подъездов | 1 | ✓ | Квартирография **→ CHECKPOINT 1** |
| 6 | `apartments` | Нумерация квартир | 2 | - | Реестр помещений |
| 7 | `mop` | Инвентаризация МОП | 2 | - | Места общего пользования |
| 8 | `parking_config` | Конфигурация паркинга | 2 | ✓ | Уровни и машиноместа **→ CHECKPOINT 2** |
| 9 | `registry_apartments` | Реестр квартир | 3 | - | Жилой фонд |
| 10 | `registry_commercial` | Реестр нежилых помещений | 3 | - | Коммерция и офисы |
| 11 | `registry_parking` | Реестр машиномест | 3 | ✓ | Парковочные места **→ CHECKPOINT 3** |
| 12 | `integration_buildings` | Регистрация зданий (УЗКАД) | 4 | - | Кадастровые номера зданий |
| 13 | `integration_units` | Регистрация помещений (УЗКАД) | 4 | - | Кадастровые номера помещений |
| 14 | `registry_nonres_view` | Сводная по нежилым блокам | 4 | - | Ведомость сооружений |
| 15 | `registry_res_view` | Сводная по жилым блокам | 4 | - | Ведомость жилых зданий |
| 16 | `summary` | Сводная по ЖК | 4 | ✓ | Аналитика и графики ТЭП **→ FINAL** |

## 5.4 Ключевые поля workflow в БД

### Таблица `applications`

| Поле БД | UI-поле | Тип | Назначение | Когда изменяется |
|---------|---------|-----|-----------|-----------------|
| `status` | `applicationInfo.status` | TEXT | Текущий статус заявки | При всех workflow-операциях |
| `current_step` | `applicationInfo.currentStepIndex` | INT | Текущий шаг (0-16) | При COMPLETE_STEP / ROLLBACK_STEP |
| `current_stage` | `applicationInfo.currentStage` | INT | Текущий этап (1-4) | При переходе на новый этап |
| `updated_at` | (служебно) | TIMESTAMPTZ | Время последнего изменения | При любом UPDATE |

### Таблица `application_steps`

| Поле БД | UI-поле | Тип | Назначение | Когда изменяется |
|---------|---------|-----|-----------|-----------------|
| `application_id` | (связь) | UUID | Заявка | При создании записи шага |
| `step_index` | (индекс) | INT | Номер шага (0-16) | При создании записи шага |
| `is_completed` | `applicationInfo.completedSteps` | BOOLEAN | Шаг выполнен техником | При COMPLETE_STEP |
| `is_verified` | `applicationInfo.verifiedSteps` | BOOLEAN | Шаг проверен контролером | При REVIEW_APPROVE |

### Таблица `application_history`

| Поле БД | UI-поле | Тип | Назначение | Когда создается |
|---------|---------|-----|-----------|----------------|
| `application_id` | (связь) | UUID | Заявка | При любом действии |
| `action` | `history[].action` | TEXT | Тип действия | При любом действии |
| `prev_status` | `history[].prevStatus` | TEXT | Предыдущий статус | При любом действии |
| `next_status` | `history[].nextStatus` | TEXT | Новый статус | При любом действии |
| `user_name` | `history[].user` | TEXT | Пользователь | При любом действии |
| `comment` | `history[].comment` | TEXT | Комментарий/причина | При REJECT (обязательно) |
| `created_at` | `history[].date` | TIMESTAMPTZ | Время действия | При создании записи |

## 5.5 Workflow-операции

### 5.5.1 COMPLETE_STEP (Завершение шага)

**Кто может выполнять**: `technician`, `admin`

**Условия выполнения**:
1. Текущий шаг = указанный шаг
2. Статус заявки: `DRAFT`, `NEW`, `REJECTED`, `INTEGRATION`
3. Валидация шага пройдена (нет ошибок)

**Алгоритм** (`getCompletionTransition`):
```javascript
1. nextStepIndex = currentIndex + 1
2. currentStageNum = getStepStage(currentIndex)
3. stageConfig = WORKFLOW_STAGES[currentStageNum]
4. isStageBoundary = (stageConfig.lastStepIndex === currentIndex)
5. isLastStepGlobal = (nextStepIndex >= STEPS_CONFIG.length)

6. IF isLastStepGlobal:
     nextStatus = 'COMPLETED'
   ELSE IF isStageBoundary:
     nextStatus = 'REVIEW'
     nextStage = currentStageNum + 1
   ELSE IF nextStepIndex === 12:
     nextStatus = 'INTEGRATION'
   ELSE:
     nextStatus = текущий статус

7. RETURN { action, nextStepIndex, nextStatus, nextStage, ... }
```

**Изменения в БД**:
```sql
-- 1. Обновление заявки
UPDATE applications SET
  status = nextStatus,
  current_step = nextStepIndex,
  current_stage = nextStage,
  updated_at = now()
WHERE id = application_id;

-- 2. Отметка шага как выполненного
INSERT INTO application_steps (application_id, step_index, is_completed)
VALUES (application_id, currentIndex, true)
ON CONFLICT (application_id, step_index)
DO UPDATE SET is_completed = true, updated_at = now();

-- 3. Добавление записи в историю
INSERT INTO application_history (
  application_id, action, prev_status, next_status, user_name, created_at
) VALUES (
  application_id, 'COMPLETE_STEP', prevStatus, nextStatus, userName, now()
);
```

**Примеры**:

1. **Завершение обычного шага** (внутри этапа):
   - Текущий: шаг 1 (`composition`), статус `DRAFT`
   - Результат: шаг 2 (`registry_nonres`), статус `DRAFT`

2. **Завершение последнего шага этапа** (checkpoint):
   - Текущий: шаг 5 (`entrances`), статус `DRAFT`
   - Результат: шаг 6 (`apartments`), статус `REVIEW`, stage `2`

3. **Переход на интеграцию**:
   - Текущий: шаг 11 (`registry_parking`), статус `DRAFT` (после Approve)
   - Результат: шаг 12 (`integration_buildings`), статус `INTEGRATION`

4. **Завершение финального шага**:
   - Текущий: шаг 16 (`summary`), статус `INTEGRATION`
   - Результат: статус `COMPLETED`

### 5.5.2 ROLLBACK_STEP (Откат шага)

**Кто может выполнять**: `technician`, `admin`

**Условия выполнения**:
1. Текущий шаг > 0
2. Статус заявки: `DRAFT`, `REVIEW`, `INTEGRATION`

**Алгоритм** (`getRollbackTransition`):
```javascript
1. currentIndex = currentAppInfo.currentStepIndex
2. prevIndex = Math.max(0, currentIndex - 1)
3. nextStatus = (status IN ['COMPLETED', 'REVIEW']) ? 'DRAFT' : status
4. nextStage = getStepStage(prevIndex)

5. RETURN { action: 'ROLLBACK_STEP', prevIndex, nextStatus, nextStage }
```

**Изменения в БД**:
```sql
-- 1. Обновление заявки
UPDATE applications SET
  status = nextStatus,
  current_step = prevIndex,
  current_stage = nextStage,
  updated_at = now()
WHERE id = application_id;

-- 2. Сброс флагов шага
UPDATE application_steps SET
  is_completed = false,
  is_verified = false,
  updated_at = now()
WHERE application_id = application_id
  AND step_index = currentIndex;

-- 3. Добавление записи в историю
INSERT INTO application_history (
  application_id, action, prev_status, next_status, user_name, created_at
) VALUES (
  application_id, 'ROLLBACK_STEP', prevStatus, nextStatus, userName, now()
);
```

**Примеры**:

1. **Откат внутри этапа**:
   - Текущий: шаг 2, статус `DRAFT`
   - Результат: шаг 1, статус `DRAFT`

2. **Откат из статуса REVIEW**:
   - Текущий: шаг 6, статус `REVIEW`
   - Результат: шаг 5, статус `DRAFT`, stage `1`

### 5.5.3 REVIEW_APPROVE (Принятие этапа)

**Кто может выполнять**: `controller`, `admin`

**Условия выполнения**:
1. Статус заявки: `REVIEW`
2. Все шаги этапа завершены и проверены

**Алгоритм** (`getReviewTransition`):
```javascript
1. reviewedStage = Math.max(1, currentAppInfo.currentStage - 1)
2. nextStatus = 'DRAFT'
3. IF currentStepIndex === 12:
     nextStatus = 'INTEGRATION'

4. RETURN {
     action: 'REVIEW_APPROVE',
     isApprove: true,
     reviewedStage,
     nextStatus,
     nextStepIndex: currentStepIndex,
     nextStage: currentStage
   }
```

**Изменения в БД**:
```sql
-- 1. Обновление заявки
UPDATE applications SET
  status = nextStatus,
  updated_at = now()
WHERE id = application_id;

-- 2. Отметка всех шагов этапа как проверенных
UPDATE application_steps SET
  is_verified = true,
  updated_at = now()
WHERE application_id = application_id
  AND step_index IN (шаги этапа reviewedStage);

-- 3. Добавление записи в историю
INSERT INTO application_history (
  application_id, action, prev_status, next_status, user_name, comment, created_at
) VALUES (
  application_id, 'REVIEW_APPROVE', 'REVIEW', nextStatus, userName, comment, now()
);
```

**Примеры**:

1. **Принятие этапа 1**:
   - Текущий: шаг 6, статус `REVIEW`, stage `2`
   - Результат: шаг 6, статус `DRAFT`, stage `2`
   - Отметка: шаги 0-5 `is_verified=true`

2. **Принятие этапа 3 (перед интеграцией)**:
   - Текущий: шаг 12, статус `REVIEW`, stage `4`
   - Результат: шаг 12, статус `INTEGRATION`, stage `4`
   - Отметка: шаги 9-11 `is_verified=true`

### 5.5.4 REVIEW_REJECT (Возврат на доработку)

**Кто может выполнять**: `controller`, `admin`

**Условия выполнения**:
1. Статус заявки: `REVIEW`
2. Комментарий обязателен

**Алгоритм** (`getReviewTransition`):
```javascript
1. reviewedStage = Math.max(1, currentAppInfo.currentStage - 1)
2. nextStage = Math.max(1, currentAppInfo.currentStage - 1)
3. prevStageConfig = WORKFLOW_STAGES[nextStage]
4. nextStepIndex = prevStageConfig.lastStepIndex
5. nextStatus = 'REJECTED'

6. RETURN {
     action: 'REVIEW_REJECT',
     isApprove: false,
     reviewedStage,
     nextStatus,
     nextStepIndex,
     nextStage
   }
```

**Изменения в БД**:
```sql
-- 1. Обновление заявки
UPDATE applications SET
  status = 'REJECTED',
  current_step = nextStepIndex,
  current_stage = nextStage,
  updated_at = now()
WHERE id = application_id;

-- 2. Сброс флагов проверки шагов этапа
UPDATE application_steps SET
  is_verified = false,
  updated_at = now()
WHERE application_id = application_id
  AND step_index IN (шаги этапа reviewedStage);

-- 3. Добавление записи в историю с причиной
INSERT INTO application_history (
  application_id, action, prev_status, next_status, user_name, comment, created_at
) VALUES (
  application_id, 'REVIEW_REJECT', 'REVIEW', 'REJECTED', userName, comment, now()
);
```

**Примеры**:

1. **Возврат этапа 1**:
   - Текущий: шаг 6, статус `REVIEW`, stage `2`
   - Результат: шаг 5, статус `REJECTED`, stage `1`
   - Комментарий: "Неверные площади этажей, проверьте замеры"

2. **Возврат этапа 2**:
   - Текущий: шаг 9, статус `REVIEW`, stage `3`
   - Результат: шаг 8, статус `REJECTED`, stage `2`
   - Комментарий: "Не все квартиры пронумерованы"
