import { useCallback } from 'react';
import { STEPS_CONFIG } from '@lib/constants';
import { waitForPendingMutations, validateWorkflowStepViaBff } from '@lib/workflow-validation';

export const useWorkflowCompletion = ({
  currentStep,
  isCustomSaveStep,
  hasUnsavedChanges,
  dbScope,
  projectId,
  queryClient,
  refetch,
  saveProjectImmediate,
}) => {
  const runCompletionPrecheck = useCallback(async () => {
    if (isCustomSaveStep && hasUnsavedChanges) {
      return {
        ok: false,
        reason: 'custom-save-required',
        errors: [],
        error: null,
      };
    }

    try {
      if (!isCustomSaveStep) {
        await saveProjectImmediate({ shouldRefetch: false });
        await waitForPendingMutations(queryClient);
        await refetch();
      }

      const currentStepId = STEPS_CONFIG[currentStep]?.id;
      const validationResponse = await validateWorkflowStepViaBff({
        scope: dbScope,
        projectId,
        stepId: currentStepId,
      });

      return {
        ok: validationResponse.errors.length === 0,
        reason: validationResponse.errors.length > 0 ? 'validation-errors' : 'ok',
        errors: validationResponse.errors,
        error: null,
      };
    } catch (error) {
      return {
        ok: false,
        reason: 'validation-failed',
        errors: [],
        error,
      };
    }
  }, [
    currentStep,
    dbScope,
    hasUnsavedChanges,
    isCustomSaveStep,
    projectId,
    queryClient,
    refetch,
    saveProjectImmediate,
  ]);

  return { runCompletionPrecheck };
};
