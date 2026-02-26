import { useEffect, useState } from 'react';

const DEFAULT_NOTICE = { open: false, status: 'saving', message: '', onOk: null };

export const useWorkflowBarState = ({ currentStep, contextStepIndex }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [saveNotice, setSaveNotice] = useState(DEFAULT_NOTICE);
  const [validationErrors, setValidationErrors] = useState([]);
  const [isTaskSwitchBlocking, setIsTaskSwitchBlocking] = useState(false);
  const [pendingStepTarget, setPendingStepTarget] = useState(null);

  useEffect(() => {
    if (!isTaskSwitchBlocking) return;
    if (pendingStepTarget === null) return;
    if (currentStep !== pendingStepTarget) return;
    if (contextStepIndex !== pendingStepTarget) return;

    const unlockTimer = setTimeout(() => {
      setIsTaskSwitchBlocking(false);
      setPendingStepTarget(null);
    }, 320);

    return () => clearTimeout(unlockTimer);
  }, [isTaskSwitchBlocking, pendingStepTarget, currentStep, contextStepIndex]);

  const closeSaveNotice = () => setSaveNotice(DEFAULT_NOTICE);
  const openSavingNotice = message => setSaveNotice({ open: true, status: 'saving', message, onOk: null });
  const openErrorNotice = (message, onOk) =>
    setSaveNotice({ open: true, status: 'error', message, onOk: onOk || closeSaveNotice });

  const handleSaveNoticeOk = () => {
    if (saveNotice.status === 'saving') return;
    const callback = saveNotice.onOk;
    closeSaveNotice();
    if (typeof callback === 'function') callback();
  };

  return {
    isLoading,
    setIsLoading,
    showExitConfirm,
    setShowExitConfirm,
    showCompleteConfirm,
    setShowCompleteConfirm,
    showRollbackConfirm,
    setShowRollbackConfirm,
    showApproveConfirm,
    setShowApproveConfirm,
    saveNotice,
    setSaveNotice,
    closeSaveNotice,
    openSavingNotice,
    openErrorNotice,
    handleSaveNoticeOk,
    validationErrors,
    setValidationErrors,
    isTaskSwitchBlocking,
    setIsTaskSwitchBlocking,
    pendingStepTarget,
    setPendingStepTarget,
  };
};
