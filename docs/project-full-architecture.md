# Полная архитектура проекта reestr-mkd

> Контекст: это тестовый стенд, где прикладная модель уже адаптируется под PostgreSQL, а в DEV в качестве backend-слоя используется Supabase (PostgreSQL + API + RLS).

## 1. Назначение системы

`reestr-mkd` — рабочее место для ведения инвентаризации жилых комплексов/объектов и формирования поэтапных реестров:

- паспорт проекта;
- состав комплекса (объекты, блоки);
- инвентаризация этажей/подъездов;
- квартирография, МОП, паркинг;
- итоговые реестры и этап интеграции.

Система строится как «процессная оболочка» над данными объекта: есть **проект**, к нему привязана **заявка** и формализованный **workflow** (шаги + статусы + этапы ревью).

---

## 2. Технологический стек

### Frontend

- React 18
- Vite 7
- React Router
- TanStack React Query
- Recharts (дашборды)
- Tailwind CSS
- Zod (валидации)

### Data/Backend (DEV)

- Supabase JS SDK (`@supabase/supabase-js`)
- PostgreSQL-схема в `db/reset_schema.sql`
- RLS включен на таблицах, но DEV-политики выданы как full-access для `anon`/`authenticated`

### Тесты

- Node test runner (`node --test`)
- Smoke/контрактные тесты для workflow и схем-валидации

---

## 3. Логические слои приложения

## 3.1 UI слой

Основной маршрутный и композиционный файл — `src/App.jsx`:

- entry-login/mock auth;
- dashboard проектов/заявок;
- рабочее пространство проекта по шагам;
- переключение персон/ролей в DEV;
- боковое меню с шагами и индикатором прогресса.

Ключевые контейнеры:

- `ProjectsDashboard` / `ApplicationsDashboard` — списки проектов и заявок;
- `ProjectsPage` — оболочка для работы с конкретным проектом;
- `Sidebar`, `WorkflowBar`, `StepIndicator` — управление навигацией и статусами процесса;
- редакторы шагов в `src/components/editors/*`.

## 3.2 Контекст проекта (state orchestration)

`ProjectProvider` ( `src/context/ProjectContext.jsx` ) агрегирует три независимых слоя:

1. **Data Layer** (`useProjectDataLayer`)  
   Мерж серверных данных + локальных правок, расчет read-only по роли/статусу.

2. **Sync Layer** (`useProjectSyncLayer`)  
   Очередь изменений, отложенные/пакетные сохранения, flush в Supabase.

3. **Workflow Layer** (`useProjectWorkflowLayer`)  
   Переходы complete/rollback/review, генерация history-событий и запись статуса/этапа.

Это позволяет локализовать ошибки по типу:

- доступы/readonly → data layer;
- race/потеря сохранений → sync layer;
- неверный статус/этап → workflow layer.

## 3.3 API слой

`src/lib/api-service.js` — центральный фасад данных:

- получение агрегата проекта;
- CRUD по объектам/блокам/этажам/юнитам/МОП/паркингу;
- операции workflow-полей заявки;
- upsert-операции с обязательным `onConflict` через `UPSERT_ON_CONFLICT`;
- нормализация кодов статусов (UI↔DB);
- маппинг DB rows ↔ UI model через `db-mappers`.

Дополнительно API разбит на фасады:

- `project-api`;
- `workflow-api`;
- `registry-api`.

## 3.4 Валидация/доменные схемы

`src/lib/schemas.js` содержит контракты ключевых доменных сущностей:

- Unit, Floor, Parking, Participants, ComplexInfo, BuildingConfig и др.
- Валидации значений, диапазонов, форматов (например UUID/ИНН/даты).

### Принцип

UI может работать с частично заполненными структурами, но перед сохранением/критичным действием должны проходить схемы и step-validators.

---

## 4. Сквозной процесс работы (кратко)

1. Пользователь открывает DEV-окружение (`DB_SCOPE = shared_dev_env`).
2. Выбирает/создает проект.
3. Проходит шаги процесса (0..16), заполняя данные.
4. На границах этапов статус уходит в `REVIEW`.
5. Контролер принимает (`APPROVE`) или возвращает (`REJECT`).
6. После финала заявка переводится в `COMPLETED`.

Подробная схема переходов — в `docs/project-full-workflow.md`.

---

## 5. Ролевая модель

Роли:

- `admin` — полный доступ;
- `technician` — редактирование в `DRAFT/NEW/REJECTED/INTEGRATION`;
- `controller` — режим проверки (readonly в форме).

Проверка редактирования реализуется в `canEditByRoleAndStatus`.

---

## 6. Принципы DEV-эксплуатации

- База тестовая и может пересоздаваться полностью.
- Основной reset-скрипт: `db/reset_schema.sql`.
- Данные не считаются долгоживущими; ключевой актив — корректная схема и логика переходов.

---

## 7. Где смотреть детали

- Полная структура БД: `docs/project-full-db-schema.md`
- Полная карта кода: `docs/project-full-code-structure.md`
- Полный workflow и state machine: `docs/project-full-workflow.md`
