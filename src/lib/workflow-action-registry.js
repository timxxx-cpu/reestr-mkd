export const WORKFLOW_COMMENT_ACTIONS = {
  REQUEST_DECLINE: 'REQUEST_DECLINE',
  CONFIRM_DECLINE: 'CONFIRM_DECLINE',
  RETURN_DECLINE: 'RETURN_DECLINE',
  REJECT_STAGE: 'REJECT_STAGE',
};

export const WORKFLOW_ACTION_CONFIGS = {
  [WORKFLOW_COMMENT_ACTIONS.REQUEST_DECLINE]: {
    title: 'Запрос на отказ от заявки',
    subtitle: 'Укажите причину, по которой вы не можете выполнить эту заявку.',
    label: 'Причина отказа',
    placeholder: 'Опишите подробно причину...',
    confirmText: 'Отправить запрос',
    intent: 'warning',
    required: true,
    minLength: 10,
    progressMessage: 'Отправка запроса на отказ...',
  },
  [WORKFLOW_COMMENT_ACTIONS.CONFIRM_DECLINE]: {
    title: 'Подтверждение отказа',
    subtitle: 'Вы собираетесь окончательно отклонить заявление.',
    label: 'Комментарий к отказу (необязательно)',
    placeholder: 'Укажите комментарий...',
    confirmText: 'Отклонить заявление',
    intent: 'destructive',
    required: false,
    minLength: 0,
    progressMessage: 'Отказ заявления...',
  },
  [WORKFLOW_COMMENT_ACTIONS.RETURN_DECLINE]: {
    title: 'Возврат на доработку',
    subtitle: 'Вернуть заявку технику для исправления или продолжения работ.',
    label: 'Причина возврата (необязательно)',
    placeholder: 'Укажите инструкции для техника...',
    confirmText: 'Вернуть в работу',
    intent: 'neutral',
    required: false,
    minLength: 0,
    progressMessage: 'Возврат на доработку...',
  },
  [WORKFLOW_COMMENT_ACTIONS.REJECT_STAGE]: {
    title: 'Вернуть этап на доработку',
    subtitle: 'Укажите замечания, которые необходимо исправить исполнителю.',
    label: 'Причина возврата',
    placeholder: 'Опишите список замечаний...',
    confirmText: 'Вернуть на доработку',
    intent: 'destructive',
    required: true,
    minLength: 5,
    progressMessage: 'Возврат на доработку...',
  },
};

export const getWorkflowActionConfig = type => WORKFLOW_ACTION_CONFIGS[type] || null;
export const getWorkflowActionProgressMessage = type => WORKFLOW_ACTION_CONFIGS[type]?.progressMessage || null;
