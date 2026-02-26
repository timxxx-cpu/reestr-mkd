# 17. План стабилизации `src/*` после миграции шагов

## Цель

Системно убрать оставшийся архитектурный хаос после переноса шаговых редакторов в `src/features/steps/*`: сократить монолиты, завершить выравнивание слоёв API/hooks/UI и закрепить guardrails в коде и документации.

## Основные проблемы (текущее состояние)

1. **Монолитные файлы UI-оркестрации** (`src/components/WorkflowBar.jsx`, `src/App.jsx`).
2. **Смешение слоёв в API** (большой `ApiService` + переходные facade-обёртки).
3. **Дублирование step-композиции** (однотипные selector/editor entry points и registry ветки).
4. **Несогласованный стиль импортов и transition-комментарии** (`[FIX]`, `[NEW]`, временные пометки).
5. **Накопленные lint warnings** в критичных workflow/editor модулях.

## Дорожная карта (выполнять сверху вниз)

### Этап A. Быстрая стабилизация структуры (1–2 PR)

- [x] Вынести modal-компоненты WorkflowBar в отдельный модуль `src/components/workflow/WorkflowModals.jsx`.
- [x] Нормализовать алиасы импортов в direct hooks (`@lib`, `@context` вместо `../../...`).
- [x] Удалить переходные служебные комментарии в API-facade файлах.
- [x] Базовая декомпозиция `src/App.jsx`: вынесены `LoginScreen`, `DevRoleSwitcher` и `PersonaContext` в отдельные модули.
- [x] Продолжить декомпозицию `src/App.jsx`: `ProjectEditorRoute` и `MainLayout` вынесены в отдельные файлы.

### Этап B. Декомпозиция workflow-логики (2–3 PR)

- [x] Вынести action-handlers (`request/confirm/return decline`, `review`) в `useWorkflowActions`.
- [x] Вынести save/notice/state-machine UI-логику в `useWorkflowBarState`.
- [x] Свести `WorkflowBar.jsx` к компоненту сборки, без хранения длинных локальных процедур.

### Этап C. Выравнивание API-слоёв (2 PR)

- [x] Вынести общие api-core helper-функции (`resolveActor`, `requireBffEnabled`, `createIdempotencyKey`) из `ApiService` в отдельный модуль.
- [x] Вынести первый доменный срез (`versions`) из `ApiService` в отдельный модуль (`versions-domain`).
- [x] Вынести следующий доменный срез (`workflow`) из `ApiService` в отдельный модуль (`workflow-domain`).
- [x] Вынести следующий доменный срез (`registry`) из `ApiService` в отдельный модуль (`registry-domain`).
- [x] Продолжить разделение `ApiService` на доменные модули (`project`, `composition`).
- [x] Удалить избыточный `legacyApi`-style proxy там, где BFF уже source of truth.
- [x] Добавить минимальные contract-check smoke тесты на критичные методы facade-слоя.

### Этап D. Упрощение step-registry и step entry points (1–2 PR)

- [x] Ввести декларативную фабрику для building-scoped шагов (selector/editor pattern).
- [x] Сократить дублирование в `src/features/workflow/step-registry.jsx`.
- [x] Добавить тест/чек на консистентность сигнатур рендер-функций registry.

### Этап E. Финальная гигиена кода (постепенно)

- [x] Постепенно закрыть текущие lint warnings в `App`, `WorkflowBar`, `shared editors`.
- [x] Очистить transition-комментарии (`[FIX]`, `[NEW]`, `[REMOVED]`) после стабилизации участков.
- [x] Зафиксировать style rules для импортов и размера модулей в docs/CONTRIBUTING.

## Критерии готовности (DoD)

1. В `src/components` и `src/features/workflow` отсутствуют "god files" с UI+domain+infra логикой одновременно.
2. Для шагов действует единый путь: `STEPS_CONFIG` -> `STEP_REGISTRY` -> feature entry point.
3. API-слой не содержит переходных TODO-комментариев и не дублирует фасады без необходимости.
4. Lint остаётся без ошибок, а warning backlog имеет фиксированный план снижения.

## Выполнено в текущем проходе

1. Вынесены все модальные окна из `WorkflowBar` в `src/components/workflow/WorkflowModals.jsx`.
2. Обновлены импорты в direct hooks на alias-стиль.
3. Удалён служебный комментарий-плейсхолдер из `src/lib/api/project-api.js`.
4. Начата декомпозиция `App.jsx`: вынесены `LoginScreen`, `DevRoleSwitcher`, `PersonaContext` в отдельные модули.
5. Продолжена декомпозиция `App.jsx`: вынесены `ProjectEditorRoute` и `MainLayout` в `src/components/app/*`.
6. Завершена декомпозиция `App.jsx`: `ProjectProviderWrapper` и `ErrorBoundary` вынесены в отдельные app-модули.

## Следующий конкретный шаг

Поддерживать стабильность: контролировать выполнение CI guardrails workflow и при необходимости оптимизировать длительность pipeline.
