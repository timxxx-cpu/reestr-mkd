import {
  WORKFLOW_STAGES,
  APP_STATUS,
  WORKFLOW_SUBSTATUS,
  SUBSTATUS_TO_STATUS,
} from './constants.js';

/**
 * Определяет номер этапа на основе индекса шага.
 * @param {number} stepIdx - Индекс текущего шага из STEPS_CONFIG
 * @returns {number} Номер этапа (1, 2, 3...)
 */
export const getStepStage = stepIdx => {
  for (const [stageNum, config] of Object.entries(WORKFLOW_STAGES)) {
    if (stepIdx <= config.lastStepIndex) return parseInt(stageNum);
  }
  return 1;
};

/**
 * Получить внешний статус по подстатусу.
 * @param {string} substatus
 * @returns {string} Внешний статус (IN_PROGRESS, COMPLETED, DECLINED)
 */
export const getStatusFromSubstatus = substatus => {
  return SUBSTATUS_TO_STATUS[substatus] || APP_STATUS.IN_PROGRESS;
};

/**
 * Является ли подстатус «рабочим» (техник может редактировать данные).
 * @param {string} substatus
 * @returns {boolean}
 */
export const isEditableSubstatus = substatus => {
  return [
    WORKFLOW_SUBSTATUS.DRAFT,
    WORKFLOW_SUBSTATUS.REVISION,
    WORKFLOW_SUBSTATUS.RETURNED_BY_MANAGER,
    WORKFLOW_SUBSTATUS.INTEGRATION,
  ].includes(substatus);
};

/**
 * Является ли подстатус одним из «отказанных».
 * @param {string} substatus
 * @returns {boolean}
 */
export const isDeclinedSubstatus = substatus => {
  return [
    WORKFLOW_SUBSTATUS.DECLINED_BY_ADMIN,
    WORKFLOW_SUBSTATUS.DECLINED_BY_CONTROLLER,
    WORKFLOW_SUBSTATUS.DECLINED_BY_MANAGER,
  ].includes(substatus);
};

/**
 * Является ли подстатус финальным (нельзя выполнять workflow-операции).
 * @param {string} substatus
 * @returns {boolean}
 */
export const isFinalSubstatus = substatus => {
  return substatus === WORKFLOW_SUBSTATUS.DONE || isDeclinedSubstatus(substatus);
};

/**
 * Является ли заявка на рассмотрении у начальника филиала.
 * @param {string} substatus
 * @returns {boolean}
 */
export const isPendingDecline = substatus => {
  return substatus === WORKFLOW_SUBSTATUS.PENDING_DECLINE;
};

/**
 * Нормализация подстатуса RETURNED_BY_MANAGER → DRAFT при первом действии техника.
 * @param {string} substatus
 * @returns {string}
 */
export const normalizeReturnedSubstatus = substatus => {
  if (substatus === WORKFLOW_SUBSTATUS.RETURNED_BY_MANAGER) {
    return WORKFLOW_SUBSTATUS.DRAFT;
  }
  return substatus;
};
