import { ApiService } from './api-service';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export const waitForPendingMutations = async (
  queryClient,
  {
    timeoutMs = 8000,
    pollMs = 120,
    timeoutWarning = 'Timed out waiting for pending mutations before validation',
  } = {}
) => {
  const startedAt = Date.now();

  while (queryClient.isMutating() > 0) {
    if (Date.now() - startedAt > timeoutMs) {
      console.warn(timeoutWarning);
      break;
    }
    await sleep(pollMs);
  }
};

export const mapBackendValidationErrors = errors => {
  const backendErrors = Array.isArray(errors) ? errors : [];

  return backendErrors.map((err, idx) => ({
    id: `${err.code || 'VALIDATION'}-${idx}`,
    title: err.code || 'VALIDATION_ERROR',
    description: err.message || 'Ошибка проверки данных',
    source: 'backend',
  }));
};

export const validateWorkflowStepViaBff = async ({ scope, projectId, stepId }) => {
  const response = await ApiService.validateStepCompletionViaBff({
    scope,
    projectId,
    stepId,
  });

  return {
    ok: Boolean(response?.ok),
    errors: mapBackendValidationErrors(response?.errors),
  };
};

