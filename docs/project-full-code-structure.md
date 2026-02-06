# Полное описание структуры кода

Документ описывает, как организован код в `src/`, какие есть слои и за что отвечает каждый крупный модуль.

## 1. Корневой layout проекта

- `src/` — приложение
- `db/` — SQL reset-схема DEV
- `tests/` — smoke/contract тесты
- `docs/` — эксплуатационная и архитектурная документация

---

## 2. Структура `src/`

## 2.1 Entry и глобальная инициализация

- `main.jsx` — точка входа React
- `App.jsx` — главный контейнер маршрутов/экранов
- `index.css`, `App.css` — базовые стили

## 2.2 Context-и

### `context/ProjectContext.jsx`

Центральный runtime-контекст проекта:

- собирает `mergedState`;
- предоставляет сеттеры для всех доменных разделов;
- содержит операции workflow (`completeTask`, `rollbackTask`, `reviewStage`);
- инкапсулирует сохранение/удаление строительных объектов.

### `context/project/useProjectDataLayer.js`

- мерж `serverData + local projectMeta + buildingState`;
- формирование валидационного snapshot;
- вычисление `isReadOnly` через роль+статус.

### `context/project/useProjectSyncLayer.js`

- очередь сохранений (`saveQueueRef`);
- pending updates буфер;
- разделение «тяжелых» и «обычных» ключей модели;
- flush и refetch-координация.

### `context/project/useProjectWorkflowLayer.js`

- orchestration workflow-транзакций;
- запись событий в историю;
- обновление статуса/этапа/шага и verified/completed списков.

### Доп. контексты

- `ToastContext` — уведомления
- `ThemeContext` — тема интерфейса

---

## 3. Доменная библиотека `src/lib`

## 3.1 API и интеграционный слой

- `api-service.js` — основной фасад работы с Supabase.
- `api/project-api.js`, `api/workflow-api.js`, `api/registry-api.js` — разделение публичного API по доменам.
- `supabase.js` — клиент Supabase.
- `query-client.js` — конфигурация React Query.

Критичные особенности:

- строгий `UPSERT_ON_CONFLICT` словарь;
- ошибка, если table upsert вызывается без `onConflict`;
- нормализация кодов проекта (`project-status.js`).

## 3.2 Workflow и бизнес-правила

- `constants.js` — роли, статусы, конфиг шагов и этапов;
- `workflow-state-machine.js` — чистая state machine переходов;
- `workflow-utils.js` — вычисление stage по индексу шага;
- `step-validators.js` — валидации по шагам.

## 3.3 DTO / мапперы / модели

- `db-mappers.js` — DB row → UI model;
- `dto.js`, `types.js` — контрактные структуры;
- `model-keys.js` — ключи модели, heavy keys, mapping UI↔DB matrix;
- `validators.js`, `schemas.js` — схемы Zod и проверки.

## 3.4 Доменная математика и утилиты

- `calculations.js` — вычисления площадей/агрегатов;
- `floor-utils.js` — генерация/нормализация этажных списков;
- `building-details.js` — очистка/приведение детализации зданий;
- `cadastre.js` — генерация/формат кадастровых номеров;
- `utils.js` — общие утилиты.

## 3.5 Справочники

- `catalog-service.js` — загрузка/кэш каталогов из `dict_*`.

---

## 4. Hooks слой

## 4.1 Data-fetch hooks

- `useProjects` — список проектов
- `useProjectData` — полный агрегат проекта
- `useCatalogs` — справочники

## 4.2 API direct hooks

`hooks/api/*` — адресные операции по доменам:

- buildings, units, floors, matrix, parking, project info, integration.

## 4.3 Registry hooks

`hooks/registry/*` — подготовка данных по реестрам:

- apartments/commercial/parking.

---

## 5. Компонентный слой

## 5.1 Shell/navigation

- `Sidebar` — шаги, прогресс, блокировки
- `WorkflowBar` — действия процесса (complete/review/rollback)
- `StepIndicator` — визуальная индикация этапа
- `Breadcrumbs` — навигационная цепочка

## 5.2 Дашборды и сервисные экраны

- `ProjectsDashboard`
- `ApplicationsDashboard`
- `HistoryModal`
- `CatalogsAdminPanel`

## 5.3 Editor-экраны шагов

- `PassportEditor`
- `CompositionEditor`
- `BuildingSelector`
- `configurator/*` (standard/infrastructure/parking + cards)
- `FloorMatrixEditor`
- `EntranceMatrixEditor`
- `FlatMatrixEditor`
- `MopEditor`
- `ParkingConfigurator`
- `registry/UnitRegistry` + `registry/views/*`
- `IntegrationBuildings`
- `IntegrationUnits`
- `SummaryDashboard`

---

## 6. Поток данных внутри UI

1. `useProjectData` загружает агрегат через `ApiService.getProjectFullData`.
2. `ProjectProvider` формирует merged state.
3. Редакторы изменяют состояние через `set*` функции контекста.
4. `useProjectSyncLayer` буферизует изменения и отправляет в БД.
5. На workflow-действиях `useProjectWorkflowLayer` делает переход + save + refetch.

---

## 7. Ошибки и устойчивость

- Ошибки API логируются в консоль и показываются toast-сообщением.
- Сохранение сериализовано через очередь, чтобы не ронять состояние при частых кликах.
- Upsert-защита не позволяет «молчаливо» писать в таблицу без уникального ключа конфликта.

---

## 8. Точки расширения

1. Добавление нового шага workflow:
   - расширить `STEPS_CONFIG` и stage-границы;
   - обновить state-machine и step validators;
   - добавить UI-экран редактора.

2. Добавление новой сущности БД:
   - таблица + unique/FK в SQL;
   - mappers в `db-mappers.js`;
   - CRUD в `api-service.js`;
   - схемы в `schemas.js`;
   - экран/хуки в UI.

3. Переход от Supabase к прямому PostgreSQL API:
   - заменить адаптер data access в `api-service`;
   - сохранить формат DTO/UI моделей;
   - покрыть контрактными smoke-тестами.
