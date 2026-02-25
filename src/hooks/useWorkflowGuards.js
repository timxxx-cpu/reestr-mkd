import { useMemo } from 'react';
import { ROLES, WORKFLOW_SUBSTATUS } from '@lib/constants';
import { isPendingDecline } from '@lib/workflow-utils';
import { canRequestDecline, canReviewDeclineRequest } from '@lib/workflow-state-machine';

export const useWorkflowGuards = ({
  userRole,
  currentStep,
  applicationInfo,
  isReadOnly,
  hasActionModal,
  isLoading,
  isCompleteConfirmOpen,
  isRollbackConfirmOpen,
  isExitConfirmOpen,
  isSaveNoticeOpen,
}) => {
  return useMemo(() => {
    const appSubstatus = applicationInfo?.workflowSubstatus || WORKFLOW_SUBSTATUS.DRAFT;
    const isReviewMode = appSubstatus === WORKFLOW_SUBSTATUS.REVIEW;
    const isPendingDeclineMode = isPendingDecline(appSubstatus);

    const isController = userRole === ROLES.CONTROLLER || userRole === ROLES.ADMIN;
    const isTechnician = userRole === ROLES.TECHNICIAN;
    const isAdmin = userRole === ROLES.ADMIN;

    const isCurrentTask = currentStep === (applicationInfo?.currentStepIndex || 0);
    const canGoBack = currentStep > 0;

    const canTechRequestDecline = canRequestDecline(userRole, appSubstatus);
    const canManagerReviewDecline = canReviewDeclineRequest(userRole, appSubstatus);

    const shortcutsEnabled =
      (isTechnician || isAdmin) &&
      !isReviewMode &&
      isCurrentTask &&
      !isReadOnly &&
      !isExitConfirmOpen &&
      !isCompleteConfirmOpen &&
      !isRollbackConfirmOpen &&
      !isSaveNoticeOpen &&
      !hasActionModal;

    const isActionDisabled = isLoading || !isTechnician || isSaveNoticeOpen || hasActionModal;

    return {
      appSubstatus,
      isReviewMode,
      isPendingDeclineMode,
      isController,
      isTechnician,
      isAdmin,
      isCurrentTask,
      canGoBack,
      canTechRequestDecline,
      canManagerReviewDecline,
      shortcutsEnabled,
      isActionDisabled,
    };
  }, [
    userRole,
    currentStep,
    applicationInfo,
    isReadOnly,
    hasActionModal,
    isLoading,
      isCompleteConfirmOpen,
    isRollbackConfirmOpen,
    isExitConfirmOpen,
    isSaveNoticeOpen,
  ]);
};
