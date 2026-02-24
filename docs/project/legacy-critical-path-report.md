# Critical legacy-path static check

- result: PASS
- assumption: backend-first default and emergency-only legacy rollback (`VITE_LEGACY_ROLLBACK_ENABLED=true` only)

## Checks

- ✅ acquireApplicationLock
- ✅ completeWorkflowStepViaBff
- ✅ createProjectFromApplication
- ✅ updateProjectPassport
- ✅ getBasements
- ✅ createVersion
- ✅ getProjectFullRegistry
- ✅ getBuildingsRegistrySummary

## Note

This is a static safety check. Runtime confirmation for real users is tracked via DEV summary: `window.__reestrOperationSource.getSummary()`.
