# 5. Workflow: роли, статусы, этапы, переходы

## 5.1 Роли пользователей

### Таблица ролей

| Роль | Код | Права доступа | Основные действия | Источник в БД |
|------|-----|---------------|------------------|--------------|
| **Администратор** | `admin` | Полный доступ | Все операции с данными и workflow | `dict_system_users.role='admin'` |
| **Начальник филиала** | `branch_manager` | Управление заявлениями | Принятие входящих, назначение техника, отказ, рассмотрение запросов | `dict_system_users.role='branch_manager'` |
| **Контролер-бригадир** | `controller` | Только проверка | Approve/Reject этапов, просмотр | `dict_system_users.role='controller'` |
| **Техник-инвентаризатор** | `technician` | Ввод/редактирование данных | Заполнение шагов, завершение шагов, запрос отказа | `dict_system_users.role='technician'` |

### Детальное описание ролей

#### Администратор (`admin`)

**Полномочия**:
- ✅ Создание и редактирование проектов
- ✅ Редактирование данных на любом шаге
- ✅ Выполнение всех workflow-операций (Complete, Rollback, Approve, Reject, Decline)
- ✅ Изменение статусов заявок вручную
- ✅ Управление участниками и документами
- ✅ Доступ ко всем этапам и шагам
- ✅ Принятие входящих заявлений
- ✅ Назначение техника-исполнителя
- ✅ Рассмотрение запросов на отказ

**Ограничения**: Нет

**Функция проверки**: `canEditByRoleAndStatus(ROLES.ADMIN, substatus)` → всегда `true`

#### Начальник филиала (`branch_manager`)

**Полномочия**:
- ✅ Принятие входящих заявлений из внешних систем
- ✅ Назначение техника-исполнителя
- ✅ Отказ заявлений с рабочего стола
- ✅ Рассмотрение запросов техника на отказ (утвердить / вернуть на доработку)
- ✅ Просмотр всех данных проекта (read-only)
- ✅ Просмотр истории действий

**Ограничения**:
- ❌ Нет доступа к редактированию данных проекта
- ❌ Не может завершать или откатывать шаги
- ❌ Не может выполнять Approve/Reject этапов
- ❌ Не может удалять проекты или управлять справочниками

**Функция проверки**: `canEditByRoleAndStatus(ROLES.BRANCH_MANAGER, substatus)` → всегда `false`

#### Техник-инвентаризатор (`technician`)

**Полномочия**:
- ✅ Редактирование данных в подстатусах: `DRAFT`, `REVISION`, `RETURNED_BY_MANAGER`, `INTEGRATION`
- ✅ Завершение текущего шага (`COMPLETE_STEP`)
- ✅ Откат на предыдущий шаг (`ROLLBACK_STEP`)
- ✅ Запрос на отказ заявления (`REQUEST_DECLINE`)
- ✅ Просмотр всех шагов

**Ограничения**:
- ❌ Нет доступа к редактированию в подстатусах: `REVIEW`, `PENDING_DECLINE`, `DONE`
- ❌ Не может выполнять Approve/Reject
- ❌ Не может отказывать заявления напрямую (только через запрос начальнику)

**Функция проверки**: 
```javascript
canEditByRoleAndStatus(ROLES.TECHNICIAN, substatus) {
  return ['DRAFT', 'REVISION', 'RETURNED_BY_MANAGER', 'INTEGRATION'].includes(substatus);
}
```

#### Контролер-бригадир (`controller`)

**Полномочия**:
- ✅ Просмотр всех данных
- ✅ Выполнение Approve/Reject для этапов в подстатусе `REVIEW`
- ✅ Добавление комментариев

**Ограничения**:
- ❌ Нет доступа к редактированию данных
- ❌ Не может завершать или откатывать шаги
- ❌ Не может изменять контент (composition, floors, units и т.д.)

**Функция проверки**: `canEditByRoleAndStatus(ROLES.CONTROLLER, substatus)` → всегда `false`

### Сравнение прав всех ролей

| Действие | technician | controller | branch_manager | admin |
|----------|:---:|:---:|:---:|:---:|
| Просмотр данных | ✅ | ✅ | ✅ | ✅ |
| Редактирование данных | ✅ (DRAFT/REVISION/RETURNED_BY_MANAGER/INTEGRATION) | ❌ | ❌ | ✅ |
| COMPLETE_STEP | ✅ | ❌ | ❌ | ✅ |
| ROLLBACK_STEP | ✅ | ❌ | ❌ | ✅ |
| Approve/Reject этапа | ❌ | ✅ | ❌ | ✅ |
| Принять входящую | ❌ | ❌ | ✅ | ✅ |
| Назначить техника | ❌ | ❌ | ✅ | ✅ |
| Отказать заявление | ❌ | ✅ (при REVIEW) | ✅ | ✅ |
| Запросить отказ | ✅ | ❌ | ❌ | ❌ |
| Рассмотреть запрос отказа | ❌ | ❌ | ✅ | ✅ |
| Удалить проект | ❌ | ❌ | ❌ | ✅ |
| Управление справочниками | ❌ | ❌ | ❌ | ✅ |

## 5.2 Двухуровневая статусная модель

### Внешние статусы заявки (3 значения)

| Статус | Код | Цвет UI | Описание |
|--------|-----|---------|----------|
| **В работе** | `IN_PROGRESS` | Синий (`bg-blue-100 text-blue-700`) | Заявка принята и находится в обработке |
| **Завершено** | `COMPLETED` | Зеленый (`bg-emerald-100 text-emerald-700`) | Все шаги пройдены, данные зафиксированы |
| **Отказано** | `DECLINED` | Красный (`bg-red-100 text-red-700`) | Заявка отклонена |

### Подстатусы workflow (10 значений)

| Подстатус | Внешний статус | Описание | Кто устанавливает |
|-----------|---------------|----------|-------------------|
| `DRAFT` | `IN_PROGRESS` | Техник работает с данными | Система при переходах |
| `REVIEW` | `IN_PROGRESS` | Отправлено на проверку контролеру | Система при checkpoint |
| `REVISION` | `IN_PROGRESS` | Возвращено контролером на доработку | Контролер (REJECT) |
| `PENDING_DECLINE` | `IN_PROGRESS` | Техник запросил отказ — на рассмотрении | Техник (REQUEST_DECLINE) |
| `RETURNED_BY_MANAGER` | `IN_PROGRESS` | Начальник вернул технику (отказ не утвержден) | Начальник (RETURN_FROM_DECLINE) |
| `INTEGRATION` | `IN_PROGRESS` | Этап интеграции с УЗКАД | Система при переходе на шаг 12 |
| `DONE` | `COMPLETED` | Все шаги пройдены | Система при завершении шага 16 |
| `DECLINED_BY_ADMIN` | `DECLINED` | Отказано администратором | Админ (DECLINE) |
| `DECLINED_BY_CONTROLLER` | `DECLINED` | Отказано контролером | Контролер (DECLINE) |
| `DECLINED_BY_MANAGER` | `DECLINED` | Отказано начальником филиала | Начальник (DECLINE) |

### Диаграмма переходов подстатусов

```
                    ┌───────────┐
                    │   DRAFT   │ ← Начало работы / После Approve / После возврата
                    └─────┬─────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
     COMPLETE_STEP  REQUEST_DECLINE   │
     (checkpoint)        │            │
              │           │           │
              ▼           ▼           │
       ┌──────────┐ ┌────────────────┐│
       │  REVIEW  │ │PENDING_DECLINE ││
       └────┬─────┘ └───────┬────────┘│
            │               │         │
       ┌────┼────┐    ┌─────┼─────┐   │
       │         │    │           │   │
    APPROVE   REJECT  DECLINE   RETURN│
       │         │    │           │   │
       ▼         ▼    ▼           ▼   │
    DRAFT    REVISION DECLINED_*  RETURNED_BY_MANAGER
       │                              │
       │         ┌────────────────────┘
       │         │
       ▼         ▼
    INTEGRATION → DONE (COMPLETED)
```

## 5.3 Workflow-операции

### 5.3.1 COMPLETE_STEP (Завершение шага)

**Кто**: `technician`, `admin`

**Подстатусы для выполнения**: `DRAFT`, `REVISION`, `RETURNED_BY_MANAGER`, `INTEGRATION`

**Автонормализация**: Если подстатус `RETURNED_BY_MANAGER`, при выполнении шага он сначала переходит в `DRAFT`.

**Алгоритм**: При завершении checkpoint-а подстатус → `REVIEW`. При переходе на шаг 12 → `INTEGRATION`. При завершении шага 16 → `DONE` (внешний: `COMPLETED`).

### 5.3.2 ROLLBACK_STEP (Откат шага)

**Кто**: `technician`, `admin`

**Логика**: Если подстатус `REVIEW` или `DONE` → переход в `DRAFT`. Иначе подстатус сохраняется.

### 5.3.3 REVIEW_APPROVE (Принятие этапа)

**Кто**: `controller`, `admin`

**Условие**: подстатус = `REVIEW`

**Результат**: подстатус → `DRAFT` (или `INTEGRATION` для шага 12)

### 5.3.4 REVIEW_REJECT (Возврат на доработку)

**Кто**: `controller`, `admin`

**Условие**: подстатус = `REVIEW`

**Результат**: подстатус → `REVISION`, шаг возвращается на последний шаг предыдущего этапа

### 5.3.5 REQUEST_DECLINE (Запрос на отказ от техника)

**Кто**: `technician`

**Условие**: подстатус ∈ (`DRAFT`, `REVISION`, `RETURNED_BY_MANAGER`, `INTEGRATION`)

**Результат**: подстатус → `PENDING_DECLINE`. Шаг и этап **не меняются**. Данные переходят в read-only для техника. Начальник филиала видит заявку в фильтре «На рассмотрении».

**Дополнительные поля**: `requested_decline_reason`, `requested_decline_step`, `requested_decline_by`, `requested_decline_at`

### 5.3.6 DECLINE (Отказ заявления)

**Кто**: `admin`, `branch_manager`, `controller` (только при `REVIEW`)

**Результат**: статус → `DECLINED`, подстатус → `DECLINED_BY_*` (зависит от роли)

### 5.3.7 RETURN_FROM_DECLINE (Возврат на доработку от начальника)

**Кто**: `branch_manager`, `admin`

**Условие**: подстатус = `PENDING_DECLINE`

**Результат**: подстатус → `RETURNED_BY_MANAGER`. Шаг остается тем же (где техник остановился). Данные снова доступны для редактирования техником.

### 5.3.8 RESTORE (Восстановление из отказа)

**Кто**: `admin`

**Условие**: статус = `DECLINED`

**Результат**: статус → `IN_PROGRESS`, подстатус → `DRAFT`

## 5.4 Ключевые поля workflow в БД

### Таблица `applications`

| Поле БД | UI-поле | Тип | Назначение |
|---------|---------|-----|-----------|
| `status` | `applicationInfo.status` | TEXT | Внешний статус (IN_PROGRESS/COMPLETED/DECLINED) |
| `workflow_substatus` | `applicationInfo.workflowSubstatus` | TEXT | Подстатус workflow |
| `current_step` | `applicationInfo.currentStepIndex` | INT | Текущий шаг (0-16) |
| `current_stage` | `applicationInfo.currentStage` | INT | Текущий этап (1-4) |
| `requested_decline_reason` | `applicationInfo.requestedDeclineReason` | TEXT | Причина запроса на отказ |
| `requested_decline_step` | `applicationInfo.requestedDeclineStep` | INT | Шаг запроса на отказ |
| `requested_decline_by` | `applicationInfo.requestedDeclineBy` | TEXT | Кто запросил отказ |
| `requested_decline_at` | `applicationInfo.requestedDeclineAt` | TIMESTAMPTZ | Когда запрошен отказ |

## 5.5 Этапы и шаги workflow

### Конфигурация этапов

**Источник**: `src/lib/constants.js` → `WORKFLOW_STAGES`

| Этап | Последний шаг | Название | Шаги в этапе |
|------|--------------|---------|-------------|
| **1** | 5 | Этап 1: Инвентаризация | 0-5 (passport, composition, registry_nonres, registry_res, floors, entrances) |
| **2** | 8 | Этап 2: Конфигурация | 6-8 (apartments, mop, parking_config) |
| **3** | 11 | Этап 3: Реестры | 9-11 (registry_apartments, registry_commercial, registry_parking) |
| **4** | 16 | Финал: Интеграция | 12-16 (integration_buildings, integration_units, registry_nonres_view, registry_res_view, summary) |

### Полный список шагов

| Индекс | ID шага | Название | Этап | Checkpoint |
|--------|---------|----------|------|-----------|
| 0 | `passport` | Паспорт ЖК | 1 | - |
| 1 | `composition` | Здания и сооружения | 1 | - |
| 2 | `registry_nonres` | Нежилые блоки и инфраструктура | 1 | - |
| 3 | `registry_res` | Жилые блоки | 1 | - |
| 4 | `floors` | Внешняя инвентаризация | 1 | - |
| 5 | `entrances` | Инвентаризация подъездов | 1 | ✓ CHECKPOINT 1 |
| 6 | `apartments` | Нумерация квартир | 2 | - |
| 7 | `mop` | Инвентаризация МОП | 2 | - |
| 8 | `parking_config` | Конфигурация паркинга | 2 | ✓ CHECKPOINT 2 |
| 9 | `registry_apartments` | Реестр квартир | 3 | - |
| 10 | `registry_commercial` | Реестр нежилых помещений | 3 | - |
| 11 | `registry_parking` | Реестр машиномест | 3 | ✓ CHECKPOINT 3 |
| 12 | `integration_buildings` | Регистрация зданий (УЗКАД) | 4 | - |
| 13 | `integration_units` | Регистрация помещений (УЗКАД) | 4 | - |
| 14 | `registry_nonres_view` | Сводная по нежилым блокам | 4 | - |
| 15 | `registry_res_view` | Сводная по жилым блокам | 4 | - |
| 16 | `summary` | Сводная по ЖК | 4 | ✓ FINAL |
