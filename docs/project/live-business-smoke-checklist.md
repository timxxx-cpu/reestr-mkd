# Live business smoke checklist (backend-first)

Цель: прогон реальных пользовательских сценариев в живом окружении после hard-switch.

## Preconditions

- `VITE_BFF_ENABLED=true`
- `VITE_LEGACY_ROLLBACK_ENABLED=false`
- `AUTH_MODE=jwt`
- валидные JWT для ролей: `admin`, `branch_manager`, `technician`, `controller`

## Scenarios

1. Technician: взять lock → заполнить шаг → complete-step.
2. Branch manager: assign-technician.
3. Technician: request-decline.
4. Controller/manager: decline или review reject.
5. Admin/manager: return-from-decline.
6. Admin: restore.
7. Passport/admin операции: update participant/document.
8. Registry: floors/entrances/units/common-areas reconcile.
9. Versioning: create/approve/decline/restore.

## Acceptance

- Все сценарии успешны без критичных ошибок.
- В DEV summary `window.__reestrOperationSource.getSummary()` значение `legacy === 0` на критичных сценариях.
- В логах backend есть `x-request-id` корреляция для каждого сценария.

## Artifact

- прикладывается заполненный отчет + скрин/лог summary.
