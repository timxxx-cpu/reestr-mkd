const PROJECT_STATUS_CODE_TO_LABEL = Object.freeze({
  project: 'Проектный',
  building: 'Строящийся',
  ready: 'Готовый к вводу',
  done: 'Введенный'
});

const PROJECT_STATUS_LABEL_TO_CODE = Object.freeze(
  Object.entries(PROJECT_STATUS_CODE_TO_LABEL).reduce((acc, [code, label]) => {
    acc[label] = code;
    return acc;
  }, {})
);

export const normalizeProjectStatusFromDb = (value) => {
  if (!value) return value;
  return PROJECT_STATUS_CODE_TO_LABEL[value] || value;
};

export const normalizeProjectStatusToDb = (value) => {
  if (!value) return value;
  return PROJECT_STATUS_LABEL_TO_CODE[value] || value;
};

export const PROJECT_STATUS_MAPPINGS = Object.freeze({
  codeToLabel: PROJECT_STATUS_CODE_TO_LABEL,
  labelToCode: PROJECT_STATUS_LABEL_TO_CODE
});
