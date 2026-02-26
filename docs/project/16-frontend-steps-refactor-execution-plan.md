# 16. План действий: рефакторинг структуры фронтенд-редакторов шагов

## Цель

Убрать путаницу в `src/components/editors/*`, собрать шаговые редакторы в единой навигационной структуре и перевести рендер шагов на декларативный registry-подход.

## Инварианты

1. Поведение workflow не меняется.
2. Шаги рендерятся только из `STEPS_CONFIG` + централизованного registry.
3. Существующие UI-компоненты продолжают работать без изменения бизнес-логики.

## Этапы выполнения

### Шаг 1. Создать целевую структуру шаговых фич

**Сделано:**
- Добавлены каталоги:
  - `src/features/steps/stage-1`
  - `src/features/steps/stage-2`
  - `src/features/steps/stage-3`
  - `src/features/steps/stage-4`
  - `src/features/workflow`
- В stage-папках созданы entry-point модули с экспортами шаговых экранов и редакторов.

**Следующий шаг:**
- Централизовать рендер шагов в `step-registry` и убрать step-switch из `App.jsx`.

### Шаг 2. Централизовать step routing в одном месте

**Сделано:**
- Добавлен `src/features/workflow/step-registry.jsx`.
- Реализован единый `STEP_REGISTRY` для всех шагов (включая шаги с `buildingId` flow).
- Добавлена функция `renderWorkflowStepContent(...)` как единая точка рендера шага.

**Следующий шаг:**
- Подключить registry в `App.jsx` и удалить разветвленную step-логику из app-shell.

### Шаг 3. Очистить App-shell от деталей шагов

**Сделано:**
- `src/App.jsx` теперь использует `renderWorkflowStepContent(...)`.
- Удалены прямые импорты шаговых редакторов из `App.jsx`.
- Логика выбора конкретного компонента по `stepId` больше не хранится в app-shell.

**Следующий шаг:**
- Прогнать тесты/сборку и зафиксировать baseline.

### Шаг 4. Валидация и фиксация baseline

**Сделано:**
- Прогон сборки и smoke/backend тестов после рефакторинга.

**Следующий шаг:**
- Второй этап рефакторинга: физическое перемещение legacy-компонентов из `src/components/editors/*` внутрь `src/features/steps/*` с постепенными re-export мостами.

## Что вошло в текущую реализацию

- Полная централизация рендера шагов в одном registry.
- Единая структура фич по этапам workflow.
- Разгрузка `App.jsx` от бизнес-ветвлений step-specific UI.

## Что запланировано следующим этапом

1. Миграция самих файлов editor-компонентов в `src/features/steps/*`.
2. Введение `@/features/steps/*` как основного import-path.
3. Удаление устаревших путей `@components/editors/*` выполнено; возврат блокируется lint-guardrail.


### Шаг 5. Перевести структуру с stage-каталогов на шаговые feature-каталоги

**Сделано:**
- Добавлены шаговые feature-модули `src/features/steps/<step-id>/index.jsx` для всех 14 шагов workflow.
- `step-registry` переведен на импорт через `@/features/steps/*` (шаговый путь вместо stage-группировки).
- Временные stage-каталоги удалены, чтобы не дублировать источники шаговых экранов.

**Следующий шаг:**
- Начать перенос самих legacy editor-компонентов из `src/components/editors/*` внутрь `src/features/steps/*` с thin re-export мостами для обратной совместимости.


### Шаг 6. Начать перенос legacy editor-файлов с re-export мостами

**Сделано:**
- Перенесены первые шаговые редакторы в feature-каталоги:
  - `PassportEditor`
  - `CompositionEditor`
  - `IntegrationBuildings`
  - `IntegrationUnits`
- В `src/components/editors/*` оставлены thin re-export файлы для обратной совместимости импортов.
- Step feature entry points переведены на локальные импорты перенесенных файлов.

**Следующий шаг:**
- Переносить следующую группу редакторов (`BuildingSelector`, `FloorMatrixEditor`, `EntranceMatrixEditor`, `MopEditor`, `FlatMatrixEditor`) с тем же шаблоном bridge-совместимости.


### Шаг 7. Перенести shared step editors и селектор зданий в feature/shared

**Сделано:**
- Перенесены в `src/features/steps/shared/*`:
  - `BuildingSelector`
  - `FloorMatrixEditor`
  - `EntranceMatrixEditor`
  - `MopEditor`
  - `FlatMatrixEditor`
- В старых `src/components/editors/*` путях оставлены thin re-export bridge-файлы.
- Step-модули обновлены на новые импорты из `@/features/steps/shared/*`.

**Следующий шаг:**
- Перенести `ParkingConfigurator` и `configurator/*` (включая `ConfigHeader` и подмодули) в feature-папки с тем же паттерном совместимости.


### Шаг 8. Перенести ParkingConfigurator + configurator module в feature-каталоги

**Сделано:**
- Перенесены:
  - `ParkingConfigurator` -> `src/features/steps/parking-config/ParkingConfigurator.jsx`
  - `configurator/*` -> `src/features/steps/configurator/*`
- Step-модули и shared editors переключены на импорты из `@/features/steps/configurator/*`.
- В legacy-путях `src/components/editors/ParkingConfigurator.jsx` и `src/components/editors/configurator/*` оставлены bridge re-export файлы.

**Следующий шаг:**
- Перенести registry views/modals (`src/components/editors/registry/*`) в feature-модули с поэтапной заменой импортов и bridge-совместимостью.


### Шаг 9. Перенести registry views/modals в feature-структуру

**Сделано:**
- Перенесен модуль `registry/*` из legacy-пути в `src/features/steps/registry/*` (views, modals, таблицы и фильтры).
- Step-модули реестров переведены на прямые импорты из `@/features/steps/registry/views/*`.
- В `src/components/editors/registry/*` восстановлены thin re-export bridge-файлы для обратной совместимости.

**Следующий шаг:**
- Перенести оставшиеся editor-агрегаторы (`RegistryView`, `UnitRegistry` usage paths и related imports) и сократить bridge-слой до минимально необходимого.


### Шаг 10. Перенести report/aggregate editors и сократить legacy-импорты

**Сделано:**
- Перенесены агрегирующие editor-экраны:
  - `RegistryView` -> `src/features/steps/reports/RegistryView.jsx`
  - `SummaryDashboard` -> `src/features/steps/reports/SummaryDashboard.jsx`
- В legacy `src/components/editors/*` оставлены thin re-export bridge-файлы.
- Один из прямых legacy-импортов в `ApplicationsDashboard` переведен на feature-путь (`@/features/steps/registry/BuildingsRegistryTable`).

**Следующий шаг:**
- Провести sweep по всему `src/` и заменить оставшиеся потребители `@components/editors/*` на feature-пути там, где это безопасно, после чего сократить bridge-слой.


### Шаг 11. Завершить sweep legacy imports по editor-модулям

**Сделано:**
- Перенесен `ParkingEditModal` в `src/features/steps/shared/ParkingEditModal.jsx`.
- `ParkingRegistry` переведен на прямой feature-импорт (`@/features/steps/shared/ParkingEditModal`).
- В legacy-пути `src/components/editors/ParkingEditModal.jsx` оставлен bridge re-export.

**Следующий шаг:**
- Сократить bridge-слой до целевого минимума: зафиксировать список обязательных legacy-алиасов и удалить неиспользуемые bridge-файлы после контрольного sweep.


### Шаг 12. Сократить bridge-слой legacy editors до нуля

**Сделано:**
- После контрольного sweep по `src/` (поиск `@components/editors/*`) подтверждено отсутствие потребителей legacy-путей.
- Удалены bridge-файлы `src/components/editors/**/*` как неиспользуемые.
- Документация обновлена на новый source-of-truth путей шаговых компонентов (`src/features/steps/*`).

**Следующий шаг:**
- При необходимости добавить alias/redirect policy в CONTRIBUTING (или docs) для новых импортов, чтобы не допускать возврата к legacy-путям.


### Шаг 13. Добавить guardrail против возврата к legacy imports

**Сделано:**
- В `eslint.config.js` добавлено правило `no-restricted-imports`, запрещающее `@components/editors` и `@components/editors/*`.
- Для нарушений настроен `error`-уровень с явным сообщением о переходе на `@/features/steps/*`.

**Следующий шаг:**
- Зафиксировать финальный статус в docs-index (`docs/project/README.md`) и закрыть фронтенд-рефакторинг как завершенный трек.


### Шаг 14. Закрыть doc-sweep и зафиксировать финальный статус рефакторинга

**Сделано:**
- Во всех шагах плана bridge-слой и legacy-пути описаны как историческая фаза миграции, а не как текущее состояние.
- Зафиксировано, что запрет на `@components/editors/*` закреплён через ESLint guardrail и действует как постоянный policy-check.
- Обновлен docs-index, чтобы источник шаговых UI-компонентов явно ссылался на `src/features/steps/*`.

**Следующий шаг:**
- Поддерживать policy: любые новые шаговые редакторы добавлять только в `src/features/steps/*` и подключать через centralized step-registry.


### Шаг 15. Добавить автоматическую проверку синхронизации шагов

**Сделано:**
- Добавлен скрипт `scripts/check-step-registry-sync.mjs`, который проверяет соответствие `STEPS_CONFIG` и `STEP_REGISTRY`.
- В `package.json` добавлен npm-скрипт `check:step-registry` для быстрого запуска проверки после изменений шагов.

**Следующий шаг:**
- Подключить `npm run check:step-registry` в CI как обязательный guard на изменения workflow-шагов и step-registry.


### Шаг 16. Начать декомпозицию src-монолитов после миграции шагов

**Сделано:**
- Из `WorkflowBar` вынесены модальные окна в отдельный модуль `src/components/workflow/WorkflowModals.jsx`.
- Для direct hooks (`useDirectUnits`, `useDirectCommonAreas`) нормализованы импорты на alias-пути.
- Добавлен отдельный план стабилизации `docs/project/17-src-refactor-stabilization-plan.md` как source-of-truth для следующих рефакторинг-итераций.

**Следующий шаг:**
- Декомпозировать `src/App.jsx` на независимые модули app-shell/auth/persona/project-route без изменения поведения.


### Шаг 17. Продолжить декомпозицию App-shell после выноса Workflow модалок

**Сделано:**
- Из `src/App.jsx` вынесены `LoginScreen` и `DevRoleSwitcher` в `src/components/app/*`.
- `PersonaContext` выделен в отдельный модуль `src/context/PersonaContext.js` для повторного использования и упрощения app-shell.

**Следующий шаг:**
- Вынести из `App.jsx` оставшиеся крупные контейнеры (`ProjectEditorRoute`, `MainLayout`) в отдельные модули и закрепить тонкий app-shell.


### Шаг 18. Вынести ProjectEditorRoute и MainLayout из App.jsx

**Сделано:**
- `ProjectEditorRoute` вынесен в `src/components/app/ProjectEditorRoute.jsx` без изменения пользовательского поведения.
- `MainLayout` вынесен в `src/components/app/MainLayout.jsx` с сохранением существующей логики dashboard/refresh/logout.
- `src/App.jsx` упрощен до app-shell: auth bootstrap + route composition + provider wiring.

**Следующий шаг:**
- Вынести `ProjectProviderWrapper`/`ErrorBoundary` в отдельные модули и довести `App.jsx` до минимальной оркестрации уровня роутинга.


### Шаг 19. Завершить декомпозицию App-shell провайдера и error-boundary

**Сделано:**
- `ProjectProviderWrapper` вынесен из `src/App.jsx` в `src/components/app/ProjectProviderWrapper.jsx`.
- `ErrorBoundary` вынесен в `src/components/app/AppErrorBoundary.jsx` и переиспользуется в provider-wrapper.
- `src/App.jsx` оставлен как тонкий слой bootstrap + routing composition.

**Следующий шаг:**
- Перейти к этапу B из stabilization-plan: вынести action-handlers из `WorkflowBar` в отдельный hook (`useWorkflowActions`).


### Шаг 20. Начать этап B: вынести action-handlers из WorkflowBar

**Сделано:**
- Добавлен хук `src/components/workflow/useWorkflowActions.js`, инкапсулирующий action-modal сценарии (`REQUEST_DECLINE`, `CONFIRM_DECLINE`, `RETURN_DECLINE`, `REJECT_STAGE`).
- `src/components/WorkflowBar.jsx` переведен на использование `useWorkflowActions`, локальные обработчики действий удалены.
- UI-поведение action-модалок и сообщений сохранено без изменения пользовательского контракта.

**Следующий шаг:**
- Вынести save/notice/state orchestration из `WorkflowBar` в отдельный hook `useWorkflowBarState` (этап B.2).


### Шаг 21. Продолжить этап B: вынести state-оркестрацию WorkflowBar

**Сделано:**
- Добавлен хук `src/components/workflow/useWorkflowBarState.js` для централизации UI-state (`saveNotice`, confirm-модалки, `validationErrors`, блокировка task-switch).
- `src/components/WorkflowBar.jsx` переведен на использование `useWorkflowBarState` вместо локального набора `useState/useEffect` для ключевых orchestration-состояний.
- Добавлены helper-методы (`openSavingNotice`, `openErrorNotice`, `closeSaveNotice`, `handleSaveNoticeOk`) и применены в `WorkflowBar`.

**Следующий шаг:**
- Свести `WorkflowBar` к компоненту-сборке: доизвлечь оставшиеся операции сохранения/complete/rollback в специализированный hook и сократить размер файла.


### Шаг 22. Завершить этап B: вынести операции WorkflowBar в orchestration-hook

**Сделано:**
- Добавлен хук `src/components/workflow/useWorkflowOperations.js`, инкапсулирующий операции `save/saveAndExit/complete/rollback/review`.
- `src/components/WorkflowBar.jsx` переведен на использование `useWorkflowOperations`, локальные процедурные обработчики удалены.
- Снижен объём `WorkflowBar` и уменьшено дублирование save-notice/error-обработки.

**Следующий шаг:**
- Перейти к этапу C: начать декомпозицию `ApiService` на доменные модули и устранение избыточных legacy-facade прослоек.


### Шаг 23. Начать этап C: вынести api-core helpers из ApiService

**Сделано:**
- Добавлен модуль `src/lib/api/api-core.js` с общими helper-функциями `resolveActor`, `requireBffEnabled`, `createIdempotencyKey`.
- `src/lib/api-service.js` очищен от локальных копий этих helper-функций и переведен на импорт из `api-core`.
- Подготовлена база для следующего шага этапа C: дальнейшее разбиение `ApiService` по доменным модулям.

**Следующий шаг:**
- Вынести из `ApiService` первый доменный срез (например workflow-операции) в отдельный модуль и подключить его через compose-подход.


### Шаг 24. Продолжить этап C: вынести versions-domain из ApiService

**Сделано:**
- Добавлен модуль `src/lib/api/versions-domain.js`, инкапсулирующий операции версионирования (`create/approve/decline/get snapshot/restore`).
- `LegacyApiService` в `src/lib/api-service.js` переведен на подключение versions-операций через `createVersionsDomainApi(...)`.
- Сокращена концентрация доменной логики в одном файле `api-service` и подготовлен шаблон для следующего domain-slice extraction.

**Следующий шаг:**
- Вынести следующий доменный срез (workflow или registry) из `ApiService` в отдельный модуль с тем же compose-паттерном.


### Шаг 25. Продолжить этап C: вынести workflow-domain из ApiService

**Сделано:**
- Добавлен модуль `src/lib/api/workflow-domain.js` с workflow/integration-операциями (`integration status`, `decline/request/return`, `assign`, `restore`).
- `LegacyApiService` в `src/lib/api-service.js` переведен на compose-подключение workflow-операций через `createWorkflowDomainApi(...)`.
- Сокращен объём и плотность доменной логики внутри `api-service`, сохранив публичный API-контракт.

**Следующий шаг:**
- Вынести следующий domain-slice (`registry` или `project`) из `ApiService` по тому же compose-паттерну.


### Шаг 26. Продолжить этап C: вынести registry-domain из ApiService

**Сделано:**
- Добавлен модуль `src/lib/api/registry-domain.js`, в который перенесены registry/composition/units/common-areas/parking операции.
- `LegacyApiService` в `src/lib/api-service.js` переведен на compose-подключение через `createRegistryDomainApi(...)`.
- Снижена концентрация CRUD и матричной логики в одном файле `api-service` при сохранении текущего контракта `ApiService`.

**Следующий шаг:**
- Вынести project-domain с оставшимися project/meta/read-model операциями из `ApiService` для завершения этапа C.


### Шаг 27. Завершить этап C: вынести project-domain из ApiService

**Сделано:**
- Добавлен модуль `src/lib/api/project-domain.js`, в который вынесены project/meta/read-model операции (`create/delete project`, `project context`, `passport`, `participants/documents`, `saveData`).
- `LegacyApiService` в `src/lib/api-service.js` переведен на compose-подключение через `createProjectDomainApi(...)`.
- Снижен объём и связность `api-service` за счёт отделения последнего крупного project-среза в отдельный доменный модуль.

**Следующий шаг:**
- Перейти к cleanup-итерации: убрать избыточные `legacyApi`-style proxy и добавить минимальные contract-check smoke tests для критичных facade-методов.


### Шаг 28. Cleanup этапа C: удалить legacy API proxy-файлы

**Сделано:**
- Удалены неиспользуемые proxy-фабрики `src/lib/api/project-api.js`, `src/lib/api/workflow-api.js`, `src/lib/api/registry-api.js`.
- `ApiService` уже использует прямую композицию доменных модулей, поэтому удаление proxy-слоя не меняет runtime-контракт методов.
- Снижен технический долг и устранено дублирование thin-wrapper-файлов в API-слое.

**Следующий шаг:**
- Добавить минимальные contract-check smoke tests на критичные facade-методы (workflow/project).


### Шаг 29. Cleanup этапа C: добавить contract-check smoke tests для project/workflow facade

**Сделано:**
- Расширен `tests/workflow-smoke.test.mjs` проверками project-domain контракта (`createProjectFromApplication`, `saveData`) с явной BFF-gate валидацией.
- Добавлена проверка compose-подключения `createProjectDomainApi(...)` в `ApiService`.
- Усилен regression-guard для facade-слоя после удаления legacy proxy-файлов.

**Следующий шаг:**
- Перейти к этапу D: начать декомпозицию `step-registry` через декларативную factory для building-scoped шагов.


### Шаг 30. Начать этап D: ввести декларативную factory для building-scoped шагов

**Сделано:**
- `src/features/workflow/step-registry.jsx` переведен на декларативный helper `renderBuildingScopedStep(...)` для selector/editor pattern.
- Убрано дублирование однотипной логики `editingBuildingId ? Editor : Selector` для building-scoped шагов (`registry_*`, `floors`, `entrances`, `apartments`, `mop`).
- Поддержан вариант с дополнительными пропсами редактора через `mapEditorProps` (используется для registry-шагов с `projectId`).

**Следующий шаг:**
- Добавить чек на консистентность сигнатур `render`-функций в step-registry и закрыть оставшееся дублирование этапа D.


### Шаг 31. Продолжить этап D: добавить чек сигнатур render-функций step-registry

**Сделано:**
- В `src/features/workflow/step-registry.jsx` введен helper `renderStaticStep(...)`, чтобы унифицировать способ задания `render` для static-шагов.
- Скрипт `scripts/check-step-registry-sync.mjs` расширен проверкой согласованности render-сигнатур: каждый шаг должен использовать `renderStaticStep(...)` или `renderBuildingScopedStep(...)`.
- `check:step-registry` теперь проверяет не только id-синхронизацию, но и единый декларативный контракт рендера шагов.

**Следующий шаг:**
- Завершить этап D: дополнительно сократить дублирование entry points и зафиксировать правила для новых шагов в docs/CONTRIBUTING.


### Шаг 32. Завершить этап D: сократить дублирование step entry points и зафиксировать правила

**Сделано:**
- Добавлен модуль `src/features/steps/shared/step-entry-factories.jsx` с фабриками `createBuildingSelectorStep(...)` и `createBuildingEditorStep(...)`.
- Building-scoped entry points (`registry_*`, `floors`, `entrances`, `apartments`, `mop`) переведены на общие фабрики, убрано шаблонное дублирование.
- Добавлен `docs/CONTRIBUTING.md` с правилами для step entry points, step-registry render-фабрик и импортов.

**Следующий шаг:**
- Перейти к этапу E: начать плановое закрытие lint warnings в `WorkflowBar` и shared editor модулях.


### Шаг 33. Начать этап E: сократить часть lint warnings в workflow/shared модулях

**Сделано:**
- Удалены неиспользуемые значения в `WorkflowBar` и `FlatMatrixEditor` (`getValidationSnapshot`, `useRef`, `isUnitsLoading`).
- Удален неиспользуемый расчет/импорт `calculateProgress` в `PassportEditor`.
- Количество lint warnings снижено (с 8 до 5) без изменения runtime-поведения.

**Следующий шаг:**
- Продолжить этап E: закрыть предупреждения в `CommercialRegistry`, `EntranceMatrixEditor`, `MopEditor`.


### Шаг 34. Продолжить этап E: почти закрыть lint warnings в shared/registry

**Сделано:**
- В `CommercialRegistry` удалены неиспользуемые `formatFullIdentifier` и `complexInfo`.
- В `MopEditor` стабилизирован `getTargetQty` через `useCallback` и обновлены зависимости `useEffect`.
- В `EntranceMatrixEditor` `isFieldEnabled` переведен на `useCallback`, устранены предупреждения о нестабильной зависимости `useMemo`.

**Следующий шаг:**
- Закрыть финальное lint warning (если останется) и отметить завершение этапа E.


### Шаг 35. Завершить подэтап E.1: закрыть оставшиеся lint warnings

**Сделано:**
- В `CommercialRegistry` удалены неиспользуемые import/переменные, приводившие к `no-unused-vars`.
- В `MopEditor` и `EntranceMatrixEditor` стабилизированы hook-зависимости через `useCallback` для устранения `react-hooks/exhaustive-deps`.
- `npm run lint` теперь проходит без warnings и errors.

**Следующий шаг:**
- Продолжить этап E: убрать transition-комментарии (`[FIX]`, `[NEW]`, `[REMOVED]`) в стабилизированных workflow/editor модулях.


### Шаг 36. Продолжить этап E: очистить transition-комментарии в editor модулях

**Сделано:**
- В стабилизированных editor-модулях (`CommercialRegistry`, `FlatMatrixEditor`, `FloorMatrixEditor`) удалены transition-комментарии формата `[FIX]/[NEW]/[REMOVED]/[CHANGED]`.
- Сохранены смысловые комментарии без переходных пометок, чтобы код оставался читаемым без временных маркеров миграции.
- Подготовлена база для финальной гигиены этапа E без изменения runtime-поведения шагов.

**Следующий шаг:**
- Завершить этап E: пройтись по оставшимся transition-комментариям в non-critical модулях и обновить docs/README при необходимости.


### Шаг 37. Завершить этап E: убрать transition-комментарии в src

**Сделано:**
- Удалены transition-маркеры `[FIX]/[NEW]/[REMOVED]/[CHANGED]` из оставшихся модулей `src/*` (workflow/ui/features/shared), при сохранении смысловых комментариев.
- Приведен к единому стилю комментариев код после миграционного рефакторинга.
- `npm run lint`, `npm run check:step-registry`, `npm run test:smoke` проходят без регрессий.

**Следующий шаг:**
- Финализировать этап E документационно: при необходимости сократить избыточные поясняющие комментарии и выровнять README/плановые документы.


### Шаг 38. Закрепить guardrails: добавить отдельный backend workflow-sync script

**Сделано:**
- В `package.json` добавлен npm-скрипт `test:backend-workflow-sync` для запуска `apps/backend/tests/workflow-step-sync.test.mjs`.
- Обновлен stabilization next-step: backend workflow-sync тест добавлен в обязательный набор guardrails наряду с `lint`, `test:smoke`, `check:step-registry`.
- Снижен риск пропуска backend-границ этапов/шагов при дальнейших изменениях workflow.

**Следующий шаг:**
- Поддерживать guardrails в CI и при каждом изменении workflow/step-registry/API-контрактов.


### Шаг 39. Документально закрепить единый guardrails-чеклист

**Сделано:**
- В `docs/CONTRIBUTING.md` добавлен раздел `Mandatory guardrails checks` с единым pre-merge набором проверок.
- В `docs/project/README.md` добавлена явная строка про пакет обязательных guardrails-команд.
- Упрощена точка входа для команды: требования к проверкам теперь зафиксированы в двух базовых документах.

**Следующий шаг:**
- Поддерживать чеклист актуальным при изменении test/lint инфраструктуры.


### Шаг 40. Добавить единый агрегированный guardrails-скрипт

**Сделано:**
- В `package.json` добавлен `guardrails:all`, объединяющий `lint`, `check:step-registry`, `test:smoke`, `test:backend-workflow-sync`.
- В `docs/CONTRIBUTING.md` и `docs/project/README.md` добавлена рекомендация использовать единый guardrails-запуск.
- Снижена операционная нагрузка на разработчиков при обязательной pre-merge проверке.

**Следующий шаг:**
- Поддерживать `guardrails:all` синхронным с обязательным набором проверок при изменении инфраструктуры тестов/линта.


### Шаг 41. Подключить guardrails в CI

**Сделано:**
- Добавлен workflow `.github/workflows/guardrails.yml` для запуска guardrails на `push`/`pull_request`.
- В CI выполняются установки зависимостей root и `apps/backend`, затем единый `npm run guardrails:all`.
- Закрыт action-item про обязательный guard на изменения workflow/step-registry/API-контрактов.

**Следующий шаг:**
- Отслеживать стабильность и время выполнения guardrails-пайплайна; при росте времени — декомпозировать на параллельные джобы.
