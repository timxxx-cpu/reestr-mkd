package uz.reestrmkd.backend.application;

import java.util.Map;

public final class WorkflowTransitions {
    private WorkflowTransitions() {}

    public static final int INTEGRATION_START_IDX = 13;
    public static final Map<Integer, Integer> LAST_STEP_INDEX_BY_STAGE = Map.of(1, 6, 2, 9, 3, 12, 4, 14);
    public static final int TOTAL_STEPS = 15;

    public record Transition(int nextStepIndex, String nextStatus, String nextSubstatus, int nextStage) {}
    public record StageRange(int start, int end) {}

    public static StageRange getStageStepRange(int stage) {
        Integer end = LAST_STEP_INDEX_BY_STAGE.get(stage);
        if (end == null || end < 0) return null;
        int prevEnd = stage > 1 ? LAST_STEP_INDEX_BY_STAGE.getOrDefault(stage - 1, -1) : -1;
        return new StageRange(prevEnd + 1, end);
    }

    public static Transition buildCompletionTransition(AppRow current) {
        int currentStep = current.currentStep();
        int currentStage = current.currentStage();
        int nextStepIndex = currentStep + 1;
        boolean stageBoundary = LAST_STEP_INDEX_BY_STAGE.getOrDefault(currentStage, -1) == currentStep;
        boolean isLastStepGlobal = nextStepIndex >= TOTAL_STEPS;

        String nextStatus = current.status();
        String nextSubstatus = current.workflowSubstatus();
        int nextStage = currentStage;

        if (isLastStepGlobal) {
            nextStatus = "COMPLETED";
            nextSubstatus = "DONE";
        } else if (stageBoundary) {
            nextStatus = "IN_PROGRESS";
            nextSubstatus = "REVIEW";
            nextStage = currentStage + 1;
        } else if (nextStepIndex == INTEGRATION_START_IDX) {
            nextStatus = "IN_PROGRESS";
            nextSubstatus = "INTEGRATION";
        } else {
            nextStatus = "IN_PROGRESS";
            if (!"INTEGRATION".equals(nextSubstatus)) nextSubstatus = "DRAFT";
        }
        return new Transition(nextStepIndex, nextStatus, nextSubstatus, nextStage);
    }

    public static Transition buildRollbackTransition(AppRow current) {
        int prevIndex = Math.max(0, current.currentStep() - 1);
        String nextSubstatus = current.workflowSubstatus();
        if ("REVIEW".equals(nextSubstatus) || "DONE".equals(nextSubstatus)) nextSubstatus = "DRAFT";
        return new Transition(prevIndex, "IN_PROGRESS", nextSubstatus, current.currentStage());
    }

    public static Transition buildReviewTransition(AppRow current, boolean approve) {
        if (approve) {
            String sub = current.currentStep() == INTEGRATION_START_IDX ? "INTEGRATION" : "DRAFT";
            return new Transition(current.currentStep(), "IN_PROGRESS", sub, current.currentStage());
        }
        int nextStage = Math.max(1, current.currentStage() - 1);
        int nextStep = LAST_STEP_INDEX_BY_STAGE.getOrDefault(nextStage, 0);
        return new Transition(nextStep, "IN_PROGRESS", "REVISION", nextStage);
    }
}
