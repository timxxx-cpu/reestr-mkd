import { useCallback, useState } from 'react';
import { WORKFLOW_COMMENT_ACTIONS, getWorkflowActionConfig } from '@lib/workflow-action-registry';

export const useWorkflowModals = () => {
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [actionModal, setActionModal] = useState(null);

  const openExitConfirm = useCallback(() => setShowExitConfirm(true), []);
  const closeExitConfirm = useCallback(() => setShowExitConfirm(false), []);
  const openCompleteConfirm = useCallback(() => setShowCompleteConfirm(true), []);
  const closeCompleteConfirm = useCallback(() => setShowCompleteConfirm(false), []);
  const openRollbackConfirm = useCallback(() => setShowRollbackConfirm(true), []);
  const closeRollbackConfirm = useCallback(() => setShowRollbackConfirm(false), []);
  const openApproveConfirm = useCallback(() => setShowApproveConfirm(true), []);
  const closeApproveConfirm = useCallback(() => setShowApproveConfirm(false), []);
  const closeActionModal = useCallback(() => setActionModal(null), []);

  const openActionModal = useCallback((type) => {
    const config = getWorkflowActionConfig(type);
    if (!config) return;
    setActionModal({ type, config });
  }, []);

  return {
    showExitConfirm,
    showCompleteConfirm,
    showRollbackConfirm,
    showApproveConfirm,
    actionModal,
    openExitConfirm,
    closeExitConfirm,
    openCompleteConfirm,
    closeCompleteConfirm,
    openRollbackConfirm,
    closeRollbackConfirm,
    openApproveConfirm,
    closeApproveConfirm,
    openActionModal,
    closeActionModal,
  };
};
