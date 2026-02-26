# 1. Обзор проекта и архитектура

## Назначение

Система ведет реестр МКД и процесс обработки заявок:
- паспорт объекта,
- состав зданий и блоков,
- инвентаризация этажей/подъездов/помещений/МОП,
- интеграционные кадастровые операции.

## Базовые сущности (БД -> UI -> русское значение)

- `projects` -> `complexInfo/cadastre` -> **Карточка проекта (ЖК)**.
- `applications` -> `applicationInfo` -> **Заявка и ее workflow-состояние** (статус + подстатус).
- `buildings` + `building_blocks` -> `composition` -> **Состав объектов и блоков**.
- `floors` -> `floorData` -> **Этажная структура и параметры этажей**.
- `entrances` + `entrance_matrix` -> `entrancesData` -> **Подъезды и плановые матрицы по этажам**.
- `units` + `rooms` -> `flatMatrix` -> **Реестр помещений и экспликация**.
- `common_areas` -> `mopData` -> **Места общего пользования**.
- `dict_workflow_substatuses` -> **Справочник подстатусов workflow**.

## Ролевая модель (4 роли)

| Роль | Код | Назначение |
|------|-----|------------|
| Администратор | `admin` | Полный доступ ко всем операциям |
| Начальник филиала | `branch_manager` | Принятие входящих, назначение техника, отказ заявлений |
| Контролер-бригадир | `controller` | Проверка этапов (approve/reject) |
| Техник-инвентаризатор | `technician` | Ввод и редактирование данных, завершение шагов |

## Статусная модель (двухуровневая)

**Внешний статус** (`applications.status`) — 3 значения, видны пользователю:
- `IN_PROGRESS` — В работе
- `COMPLETED` — Завершено
- `DECLINED` — Отказано

**Подстатус** (`applications.workflow_substatus`) — 10 значений, для workflow-движка:
- `DRAFT`, `REVIEW`, `REVISION`, `PENDING_DECLINE`, `RETURNED_BY_MANAGER`, `INTEGRATION`, `DONE`, `DECLINED_BY_ADMIN`, `DECLINED_BY_CONTROLLER`, `DECLINED_BY_MANAGER`

## Архитектурные слои

1. UI-слой (редакторы шагов).
2. Project Context:
   - data-layer (агрегация и read-only),
   - sync-layer (очередь сохранений),
   - workflow-layer (переходы статусов/подстатусов/шагов/этапов).
3. ApiService (чтение/запись PostgreSQL через Supabase-клиент в DEV-контуре).
4. db-mappers (snake_case БД -> camelCase UI).
5. validators/state-machine (проверки и правила workflow).

## Экранная модель рабочего пространства

Верхнеуровневая навигация UI разделена на 3 сущности:

1. **Рабочий стол** — обработка текущих заявлений (в работе/на проверке/интеграция/на рассмотрении), а также вкладка «Входящие» для ролей `admin` и `branch_manager`.
2. **Реестр** — архивный режим просмотра:
   - подрежим **«Заявления»**: только закрытые заявки (`applications.status in ('COMPLETED','DECLINED')`);
   - подрежим **«Жилые комплексы»**: только завершенные ЖК (`applications.status='COMPLETED'`).
3. **Администрирование** — доступ к редактированию справочников (`dict_*`) в DEV-контуре.

Навигация между сущностями (`Рабочий стол` / `Реестр` / `Администрирование`) реализована через выпадающий переключатель в шапке дашборда. Фильтры и кнопки управления вынесены в правую сворачиваемую панель, чтобы освободить ширину под таблицу заявлений.

## Текущий runtime-контур (этап миграции)

- Целевая БД: PostgreSQL (схема описана в `db/reset_schema.sql`).
- Текущий DEV-рантайм: Supabase (`src/lib/supabase.js`, `src/lib/api-service.js`).
- Это означает, что документация и SQL описывают **PostgreSQL-модель данных**, а прикладной слой в DEV обращается к этой модели через Supabase SDK.

## Загрузка и сохранение (обобщение)

- Загрузка проекта читает таблицы: `projects`, `applications`, `application_history`, `application_steps`, `project_participants`, `project_documents`, `buildings`, `building_blocks`, `block_construction`, `block_engineering`, `floors`, `entrances`, `entrance_matrix`, `units`, `rooms`, `common_areas`, `building_blocks` (в т.ч. basement-блоки с `is_basement_block`, `basement_depth`, `basement_parking_levels`, `basement_communications`, `entrances_count`).
- В `application_steps` дополнительно читаются `block_statuses` — статус заполнения блоков **в разрезе конкретного шага**.
- Сохранение делает обратный маппинг UI -> БД по тем же сущностям.
- При сохранении `applicationInfo` записываются оба поля: `status` и `workflow_substatus`.
- На шагах с блоками (`registry_nonres`, `registry_res`, `floors`, `entrances`, `apartments`, `mop`) статус заполнения по зданию сохраняется отдельно в `application_steps.block_statuses` по кнопке «Сохранить» в редакторе здания.
