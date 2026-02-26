import { useState } from 'react';

const ACTION_MODAL_CONFIG = {
  REQUEST_DECLINE: {
    title: 'Запрос на отказ от заявки',
    subtitle: 'Укажите причину, по которой вы не можете выполнить эту заявку.',
    label: 'Причина отказа',
    placeholder: 'Опишите подробно причину...',
    confirmText: 'Отправить запрос',
    intent: 'warning',
    required: true,
    minLength: 10,
  },
  CONFIRM_DECLINE: {
    title: 'Подтверждение отказа',
    subtitle: 'Вы собираетесь окончательно отклонить заявление.',
    label: 'Комментарий к отказу (необязательно)',
    placeholder: 'Укажите комментарий...',
    confirmText: 'Отклонить заявление',
    intent: 'destructive',
    required: false,
    minLength: 0,
  },
  RETURN_DECLINE: {
    title: 'Возврат на доработку',
    subtitle: 'Вернуть заявку технику для исправления или продолжения работ.',
    label: 'Причина возврата (необязательно)',
    placeholder: 'Укажите инструкции для техника...',
    confirmText: 'Вернуть в работу',
    intent: 'neutral',
    required: false,
    minLength: 0,
  },
  REJECT_STAGE: {
    title: 'Вернуть этап на доработку',
    subtitle: 'Укажите замечания, которые необходимо исправить исполнителю.',
    label: 'Причина возврата',
    placeholder: 'Опишите список замечаний...',
    confirmText: 'Вернуть на доработку',
    intent: 'destructive',
    required: true,
    minLength: 5,
  },
};

export const useWorkflowActions = ({ requestDecline, confirmDecline, returnFromDecline, reviewStage, setSaveNotice, setIsLoading, toast, onExit }) => {
  const [actionModal, setActionModal] = useState(null);

  const openActionModal = type => {
    const config = ACTION_MODAL_CONFIG[type];
    if (!config) return;
    setActionModal({ type, config });
  };

  const handleActionConfirm = async comment => {
    if (!actionModal) return;

    const type = actionModal.type;
    setActionModal(null);
    setIsLoading(true);

    try {
      if (type === 'REQUEST_DECLINE') {
        setSaveNotice({ open: true, status: 'saving', message: 'Отправка запроса на отказ...', onOk: null });
        await requestDecline(comment);
        setSaveNotice({ open: false, status: 'saving', message: '', onOk: null });
        toast.info('Запрос на отказ отправлен начальнику филиала');
        onExit(true);
      } else if (type === 'CONFIRM_DECLINE') {
        setSaveNotice({ open: true, status: 'saving', message: 'Отказ заявления...', onOk: null });
        await confirmDecline(comment);
        setSaveNotice({ open: false, status: 'saving', message: '', onOk: null });
        toast.error('Заявление отклонено');
        onExit(true);
      } else if (type === 'RETURN_DECLINE') {
        setSaveNotice({ open: true, status: 'saving', message: 'Возврат на доработку...', onOk: null });
        await returnFromDecline(comment);
        setSaveNotice({ open: false, status: 'saving', message: '', onOk: null });
        toast.success('Заявление возвращено технику на доработку');
        onExit(true);
      } else if (type === 'REJECT_STAGE') {
        setSaveNotice({ open: true, status: 'saving', message: 'Возврат на доработку...', onOk: null });
        await reviewStage('REJECT', comment);
        setSaveNotice({ open: false, status: 'saving', message: '', onOk: null });
        toast.error('Возвращено на доработку');
        onExit(true);
      }
    } catch (e) {
      console.error(e);
      setSaveNotice({
        open: true,
        status: 'error',
        message: 'Произошла ошибка при выполнении операции',
        onOk: () => setSaveNotice({ open: false, status: 'saving', message: '', onOk: null }),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    actionModal,
    setActionModal,
    handleActionConfirm,
    handleRequestDecline: () => openActionModal('REQUEST_DECLINE'),
    handleConfirmDecline: () => openActionModal('CONFIRM_DECLINE'),
    handleReturnFromDecline: () => openActionModal('RETURN_DECLINE'),
    handleRejectStage: () => openActionModal('REJECT_STAGE'),
  };
};
