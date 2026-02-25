const UI_TELEMETRY_KEY = '__reestrUiTelemetry';

const canUseWindow = () => typeof window !== 'undefined';

const ensureStore = () => {
  if (!canUseWindow()) return null;

  if (!window[UI_TELEMETRY_KEY]) {
    window[UI_TELEMETRY_KEY] = {
      validationFailures: {
        total: 0,
        byStep: {},
        byRole: {},
      },
      updatedAt: null,
      initializedAt: new Date().toISOString(),
    };
  }

  return window[UI_TELEMETRY_KEY];
};

export const trackBackendValidationFailure = ({ stepId, role, errorCode = null }) => {
  const store = ensureStore();
  const safeStepId = stepId || 'unknown';
  const safeRole = role || 'unknown';

  if (store) {
    store.validationFailures.total += 1;
    store.validationFailures.byStep[safeStepId] =
      (store.validationFailures.byStep[safeStepId] || 0) + 1;
    store.validationFailures.byRole[safeRole] =
      (store.validationFailures.byRole[safeRole] || 0) + 1;
    store.updatedAt = new Date().toISOString();
  }

  console.error('[UI_TELEMETRY] backend_validation_failed', {
    stepId: safeStepId,
    role: safeRole,
    errorCode,
    total: store?.validationFailures?.total || null,
    updatedAt: store?.updatedAt || null,
  });
};
