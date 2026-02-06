import { WORKFLOW_STAGES } from './constants.js';

/**
 * Определяет номер этапа на основе индекса шага.
 * @param {number} stepIdx - Индекс текущего шага из STEPS_CONFIG
 * @returns {number} Номер этапа (1, 2, 3...)
 */
export const getStepStage = (stepIdx) => {
    for (const [stageNum, config] of Object.entries(WORKFLOW_STAGES)) {
        if (stepIdx <= config.lastStepIndex) return parseInt(stageNum);
    }
    return 1;
};