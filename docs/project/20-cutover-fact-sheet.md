# 20. FE/BE cutover fact sheet (единая фактология)

## 1) Текущее целевое состояние (после текущей итерации)

- **Backend-first по умолчанию**: frontend считает BFF включенным по default.
- **Emergency rollback**: legacy можно вернуть только через `VITE_LEGACY_ROLLBACK_ENABLED=true`.
- **Auth profile**:
  - `AUTH_MODE=dev` — fallback через `x-user-id/x-user-role`;
  - `AUTH_MODE=jwt` — обязателен Bearer JWT (HS256 + `JWT_SECRET`), сервер маппит claims в actor-context.
- **Tracing**:
  - FE отправляет `x-operation-source`, `x-client-request-id`;
  - BE возвращает `x-request-id`, `x-operation-source`;
  - в DEV доступен runtime summary `window.__reestrOperationSource.getSummary()`.

## 2) Что уже закрыто

1. Workflow/locks, registry core, passport/admin, basements, versioning — имеют BFF path.
2. Observability базового cutover-уровня внедрена.
3. UI-операция `DECLINE` в dashboard переведена на backend-aware service path (без прямых Supabase writes в компоненте).
4. Восстановлен smoke-script `npm run test:smoke` (статический workflow-check критичного маршрута).
5. Buildings registry summary read-path переведен в BFF-first (`GET /api/v1/registry/buildings-summary`, флаг `VITE_BFF_REGISTRY_SUMMARY_ENABLED`).
6. Backend import-safe и покрыт тестами observability headers + jwt auth gate.
7. Расширена унификация backend guard-слоя: на общий helper `http-helpers` (`sendError` + `requirePolicyActor`) переведены `registry-routes`, `integration-routes`, `composition-routes`, `project-routes`, `project-extended-routes` (включая versioning/basements/passport/admin API).

## 3) Что остается до финального cutover

1. Завершить перенос оставшихся route-модулей backend на единый auth/policy helper без дублей проверок (основной оставшийся блок: workflow endpoints в `server.js`).
2. Довести RBAC policy matrix до единого server-side слоя (module-level).
3. Прогнать бизнес smoke в живом окружении с реальными сценариями пользователей.
4. Подтвердить отсутствие критичных legacy path в DEV summary.

Статические артефакты текущей ветки:
- `cutover-smoke-report.md` (автоматический smoke);
- `legacy-critical-path-report.md` (static critical-path check).

Для живого окружения: `live-business-smoke-checklist.md`.

## 4) Команды rehearsal

```bash
npm run cutover:smoke
npm test --prefix apps/backend
npm run build
```

Отчет smoke генерируется в `docs/project/cutover-smoke-report.md`.
