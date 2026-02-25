import React from 'react';
import { Loader2 } from 'lucide-react';
import { STEPS_CONFIG } from '@lib/constants';
import {
  ActionCommentModal,
  ApproveStageModal,
  CompleteTaskModal,
  ExitConfirmationModal,
  RollbackConfirmationModal,
  SaveProgressModal,
  ValidationErrorsModal,
} from '@components/workflow/WorkflowDialogs';

const CommonWorkflowOverlays = ({ saveNotice, onSaveNoticeOk, actionModal, closeActionModal, onActionConfirm, isLoading }) => (
  <>
    {saveNotice.open && (
      <SaveProgressModal status={saveNotice.status} message={saveNotice.message} onOk={onSaveNoticeOk} />
    )}
    {actionModal && (
      <ActionCommentModal
        config={actionModal.config}
        onCancel={closeActionModal}
        onConfirm={onActionConfirm}
        isLoading={isLoading}
      />
    )}
  </>
);

export const ReviewModeOverlays = ({
  saveNotice,
  onSaveNoticeOk,
  showApproveConfirm,
  closeApproveConfirm,
  stageNum,
  onApprove,
  actionModal,
  closeActionModal,
  onActionConfirm,
  isLoading,
}) => (
  <>
    <CommonWorkflowOverlays
      saveNotice={saveNotice}
      onSaveNoticeOk={onSaveNoticeOk}
      actionModal={actionModal}
      closeActionModal={closeActionModal}
      onActionConfirm={onActionConfirm}
      isLoading={isLoading}
    />
    {showApproveConfirm && (
      <ApproveStageModal
        stageNum={stageNum}
        onCancel={closeApproveConfirm}
        onConfirm={onApprove}
        isLoading={isLoading}
      />
    )}
  </>
);

export const ManagerDeclineOverlays = ({
  saveNotice,
  onSaveNoticeOk,
  actionModal,
  closeActionModal,
  onActionConfirm,
  isLoading,
}) => (
  <CommonWorkflowOverlays
    saveNotice={saveNotice}
    onSaveNoticeOk={onSaveNoticeOk}
    actionModal={actionModal}
    closeActionModal={closeActionModal}
    onActionConfirm={onActionConfirm}
    isLoading={isLoading}
  />
);

export const ActiveTaskOverlays = ({
  validationErrors,
  clearValidationErrors,
  showExitConfirm,
  closeExitConfirm,
  onExitConfirm,
  showCompleteConfirm,
  closeCompleteConfirm,
  confirmMsg,
  onCompleteConfirm,
  showRollbackConfirm,
  closeRollbackConfirm,
  currentStep,
  onRollbackConfirm,
  isLoading,
  actionModal,
  closeActionModal,
  onActionConfirm,
  saveNotice,
  onSaveNoticeOk,
  isTaskSwitchBlocking,
}) => (
  <>
    {validationErrors.length > 0 && <ValidationErrorsModal errors={validationErrors} onClose={clearValidationErrors} />}

    {showExitConfirm && <ExitConfirmationModal onCancel={closeExitConfirm} onConfirm={onExitConfirm} />}

    {showCompleteConfirm && (
      <CompleteTaskModal message={confirmMsg} onCancel={closeCompleteConfirm} onConfirm={onCompleteConfirm} />
    )}

    {showRollbackConfirm && (
      <RollbackConfirmationModal
        currentStepTitle={STEPS_CONFIG[currentStep]?.title || 'Текущий шаг'}
        prevStepTitle={STEPS_CONFIG[Math.max(0, currentStep - 1)]?.title || 'Предыдущий шаг'}
        onCancel={closeRollbackConfirm}
        onConfirm={onRollbackConfirm}
        isLoading={isLoading}
      />
    )}

    <CommonWorkflowOverlays
      saveNotice={saveNotice}
      onSaveNoticeOk={onSaveNoticeOk}
      actionModal={actionModal}
      closeActionModal={closeActionModal}
      onActionConfirm={onActionConfirm}
      isLoading={isLoading}
    />

    {isTaskSwitchBlocking && (
      <div className="fixed inset-0 z-[140] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center pointer-events-auto">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 px-6 py-5 flex items-center gap-3">
          <Loader2 size={18} className="animate-spin text-blue-600" />
          <div>
            <div className="text-sm font-bold text-slate-800">Переход к следующей задаче</div>
            <div className="text-xs text-slate-500">Пожалуйста, подождите. Экран временно заблокирован.</div>
          </div>
        </div>
      </div>
    )}
  </>
);
