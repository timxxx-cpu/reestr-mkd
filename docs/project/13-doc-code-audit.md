# 13. Аудит соответствия документации и кода

Дата полной сверки: 2026-02-25.

## Область проверки

- Проектная документация: `docs/project/*`.
- Backend-документация: `apps/backend/README.md`.
- Фактические маршруты backend: `apps/backend/src/*`.
- Контрактные/smoke тесты: `apps/backend/tests/*`, `tests/*`.

## Итоги сверки

### Что подтверждено

1. **Workflow-переходы и подстатусы** в документации соответствуют текущей реализации backend.
2. **Ролевая модель (RBAC)** и policy-ограничения совпадают с описанными ролями (`admin`, `branch_manager`, `technician`, `controller`).
3. **Контракт ошибок и idempotency-поведение** подтверждаются тестовым контуром.

### Исправленные расхождения

В ходе аудита был устранен ключевой источник дрейфа: API-раздел в `apps/backend/README.md` приведен к фактическому route-map (включены auth/catalogs/dashboard/registry-summary/step-block-statuses и другие ранее пропущенные маршруты).

## Статус рекомендаций

- **P1 (обновить backend README API-список)** — ✅ Выполнено.
- **P2 (единый source of truth + drift-check)** — ✅ Выполнено на уровне репозитория: добавлены `route-manifest.json` и скрипт `docs:routes:check`/`docs:routes:sync`.
- **P3 (регламент регулярной сверки docs↔code)** — ⏳ Рекомендуется внедрить процессно.

## Предложения на следующий этап

1. Подключить `npm --prefix apps/backend run docs:routes:check` в CI-пайплайн (как обязательный check PR).
2. Зафиксировать периодичность док-аудита (например, раз в релиз или ежеквартально).
3. При необходимости расширить route-manifest генератор до OpenAPI-публикации.

## Миграция front→backend: статус выполнения

- ✅ **Шаг 1 (workflow source-of-truth)**: фронт больше не выполняет локальные workflow-переходы как fallback; `useProjectWorkflowLayer` теперь выполняет workflow-операции только через BFF и обновляет состояние через `refetch`.
- ✅ **Шаг 2 (validation preflight endpoint)**: добавлен backend endpoint `POST /api/v1/projects/:projectId/validation/step`; WorkflowBar сначала валидирует шаг на backend и использует frontend-валидатор как fallback.
- ✅ **Шаг 3 (TEP read-model)**: добавлен backend endpoint `GET /api/v1/projects/:projectId/tep-summary`; SummaryDashboard использует серверную агрегацию вместо локального пересчёта.
- ✅ **Шаг 4 (legacy/direct cleanup)**: mock внешних заявок перенесён в backend endpoint `GET /api/v1/external-applications`; прямой frontend Supabase path для версий (`src/lib/api/versions-api.js`) удалён.
