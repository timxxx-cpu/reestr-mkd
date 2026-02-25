import { useCallback, useMemo, useState } from 'react';
import { getWorkflowActionProgressMessage } from '@lib/workflow-action-registry';

const createClosedSaveNotice = () => ({
  open: false,
  status: 'saving',
  message: '',
  onOk: null,
});


export const useWorkflowFeedback = () => {
  const [saveNotice, setSaveNotice] = useState(createClosedSaveNotice);

  const closeSaveNotice = useCallback(() => {
    setSaveNotice(createClosedSaveNotice());
  }, []);

  const openSavingNotice = useCallback((message) => {
    setSaveNotice({
      open: true,
      status: 'saving',
      message,
      onOk: null,
    });
  }, []);

  const openErrorNotice = useCallback((message) => {
    setSaveNotice({
      open: true,
      status: 'error',
      message,
      onOk: closeSaveNotice,
    });
  }, [closeSaveNotice]);

  const handleSaveNoticeOk = useCallback(() => {
    if (saveNotice.status === 'saving') return;
    const callback = saveNotice.onOk;
    closeSaveNotice();
    if (typeof callback === 'function') callback();
  }, [closeSaveNotice, saveNotice.onOk, saveNotice.status]);

  const getActionProgressMessage = useCallback(type => getWorkflowActionProgressMessage(type), []);

  const feedbackApi = useMemo(() => ({
    saveNotice,
    closeSaveNotice,
    openSavingNotice,
    openErrorNotice,
    handleSaveNoticeOk,
    getActionProgressMessage,
  }), [saveNotice, closeSaveNotice, openSavingNotice, openErrorNotice, handleSaveNoticeOk, getActionProgressMessage]);

  return feedbackApi;
};
