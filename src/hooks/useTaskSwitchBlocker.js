import { useCallback, useEffect, useState } from 'react';

export const useTaskSwitchBlocker = ({ currentStep, contextStepIndex }) => {
  const [isTaskSwitchBlocking, setIsTaskSwitchBlocking] = useState(false);
  const [pendingStepTarget, setPendingStepTarget] = useState(null);

  const startTaskSwitchBlock = useCallback(targetStep => {
    setIsTaskSwitchBlocking(true);
    setPendingStepTarget(targetStep);
  }, []);

  const resetTaskSwitchBlock = useCallback(() => {
    setIsTaskSwitchBlocking(false);
    setPendingStepTarget(null);
  }, []);

  useEffect(() => {
    if (!isTaskSwitchBlocking) return;
    if (pendingStepTarget === null) return;
    if (currentStep !== pendingStepTarget) return;
    if (contextStepIndex !== pendingStepTarget) return;

    const unlockTimer = setTimeout(() => {
      resetTaskSwitchBlock();
    }, 320);

    return () => clearTimeout(unlockTimer);
  }, [contextStepIndex, currentStep, isTaskSwitchBlocking, pendingStepTarget, resetTaskSwitchBlock]);

  return {
    isTaskSwitchBlocking,
    pendingStepTarget,
    startTaskSwitchBlock,
    resetTaskSwitchBlock,
  };
};
