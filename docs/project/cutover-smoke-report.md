# Cutover smoke report

- generatedAt: 2026-02-24T04:00:01.019Z
- mode: backend-first (all BFF flags true, legacy rollback disabled)
- result: PASS

## Flags

```json
{
  "VITE_BFF_ENABLED": "true",
  "VITE_LEGACY_ROLLBACK_ENABLED": "false",
  "VITE_BFF_COMPOSITION_ENABLED": "true",
  "VITE_BFF_FLOORS_ENABLED": "true",
  "VITE_BFF_ENTRANCES_ENABLED": "true",
  "VITE_BFF_UNITS_ENABLED": "true",
  "VITE_BFF_MOP_ENABLED": "true",
  "VITE_BFF_PARKING_ENABLED": "true",
  "VITE_BFF_INTEGRATION_ENABLED": "true",
  "VITE_BFF_CADASTRE_ENABLED": "true",
  "VITE_BFF_PROJECT_INIT_ENABLED": "true",
  "VITE_BFF_PROJECT_PASSPORT_ENABLED": "true",
  "VITE_BFF_BASEMENTS_ENABLED": "true",
  "VITE_BFF_VERSIONING_ENABLED": "true",
  "VITE_BFF_FULL_REGISTRY_ENABLED": "true",
  "VITE_BFF_PROJECT_CONTEXT_ENABLED": "true",
  "VITE_BFF_PROJECT_CONTEXT_DETAILS_ENABLED": "true",
  "VITE_BFF_SAVE_META_ENABLED": "true",
  "VITE_BFF_SAVE_BUILDING_DETAILS_ENABLED": "true",
  "VITE_BFF_REGISTRY_SUMMARY_ENABLED": "true"
}
```

## Checks

- ✅ npm test --prefix apps/backend (1546ms)
- ✅ npm run build (9096ms)

## Next actions

- If FAIL: keep `VITE_LEGACY_ROLLBACK_ENABLED=true` in emergency profile only.
- If PASS: proceed with backend-only rehearsal and monitor `window.__reestrOperationSource.getSummary()`.
