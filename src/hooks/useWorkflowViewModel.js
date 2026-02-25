import { useMemo } from 'react';
import { STEPS_CONFIG, WORKFLOW_STAGES } from '@lib/constants';
import { getStepStage } from '@lib/workflow-utils';

const STEPS_WITH_CUSTOM_SAVE = new Set([
  'registry_nonres',
  'registry_res',
  'floors',
  'entrances',
  'apartments',
  'mop',
  'registry_apartments',
  'registry_commercial',
  'registry_parking',
]);

const INTEGRATION_START_IDX = 12;

export const useWorkflowViewModel = ({ currentStep }) => {
  return useMemo(() => {
    const currentStageNum = getStepStage(currentStep);
    const currentStepId = STEPS_CONFIG[currentStep]?.id;
    const isCustomSaveStep = STEPS_WITH_CUSTOM_SAVE.has(currentStepId);

    const stageConfig = WORKFLOW_STAGES[currentStageNum];
    const isStageBoundary = Boolean(stageConfig && stageConfig.lastStepIndex === currentStep);
    const isLastStepGlobal = currentStep === STEPS_CONFIG.length - 1;
    const isIntegrationStage = currentStep >= INTEGRATION_START_IDX;

    let actionBtnText = 'Перейти к следующей задаче';
    let confirmMsg = 'Завершить текущую задачу и перейти к следующему шагу?';

    if (isLastStepGlobal) {
      actionBtnText = 'Завершить проект';
      confirmMsg = 'Это последний шаг. Вы уверены, что хотите полностью завершить проект?';
    } else if (isStageBoundary) {
      actionBtnText = 'Отправить на проверку';
      confirmMsg = `Вы завершаете Этап ${currentStageNum}. Отправить все данные на проверку Бригадиру?`;
    }

    return {
      isCustomSaveStep,
      isStageBoundary,
      isLastStepGlobal,
      isIntegrationStage,
      actionBtnText,
      confirmMsg,
    };
  }, [currentStep]);
};
