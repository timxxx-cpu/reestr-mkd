package uz.reestrmkd.backend.application;

public record AppRow(String id, String status, String workflowSubstatus, int currentStep, int currentStage) {
    public static AppRow normalize(String id, String status, String workflowSubstatus, Integer currentStep, Integer currentStage) {
        return new AppRow(
            id,
            status == null ? "IN_PROGRESS" : status,
            workflowSubstatus == null ? "DRAFT" : workflowSubstatus,
            currentStep == null ? 0 : currentStep,
            currentStage == null ? 1 : currentStage
        );
    }
}
