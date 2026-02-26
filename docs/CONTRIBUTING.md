# CONTRIBUTING (frontend workflow steps)

## Step entry points and registry rules

1. Любые новые шаговые entry points добавляйте только в `src/features/steps/*`.
2. Для building-scoped selector/editor шагов используйте фабрики из `src/features/steps/shared/step-entry-factories.jsx`:
   - `createBuildingSelectorStep(stepId)`
   - `createBuildingEditorStep(EditorComponent, mapProps)`
3. В `src/features/workflow/step-registry.jsx` задавайте `render` только через:
   - `renderStaticStep(...)` для статических шагов
   - `renderBuildingScopedStep(...)` для selector/editor шагов
4. После изменения шагов запускайте `npm run check:step-registry`.

## Import style

- Используйте alias-импорты (`@/features/*`, `@lib/*`, `@hooks/*`, `@context/*`).
- Не используйте legacy пути `@components/editors/*` (блокируется ESLint).


## Mandatory guardrails checks

Перед merge изменений, затрагивающих workflow/steps/API, запускайте:

- `npm run lint`
- `npm run check:step-registry`
- `npm run test:smoke`
- `npm run test:backend-workflow-sync`

Для удобства можно запускать единый агрегированный чек:

- `npm run guardrails:all`
