package uz.reestrmkd.backend.domain.workflow.service;

import org.springframework.stereotype.Service;

import uz.reestrmkd.backend.domain.auth.service.SecurityPolicyService;
import uz.reestrmkd.backend.domain.workflow.model.ApplicationEntity;

import java.util.List;
import java.util.Map;

@Service
public class WorkflowService {

    /**
     * Must stay in sync with frontend step registry/order
     * (see src/features/workflow/step-registry.jsx).
     */
    public static final List<String> WORKFLOW_STEP_IDS = List.of(
        "passport",
        "composition",
        "registry_nonres",
        "basement_inventory",
        "registry_res",
        "floors",
        "entrances",
        "apartments",
        "mop",
        "parking_config",
        "registry_apartments",
        "registry_commercial",
        "registry_parking",
        "integration_buildings",
        "integration_units"
    );

    public static final int INTEGRATION_START_IDX = WORKFLOW_STEP_IDS.indexOf("integration_buildings");

    public static final Map<Integer, Integer> LAST_STEP_INDEX_BY_STAGE = Map.of(
        1, 6,
        2, 9,
        3, 12,
        4, 14
    );

    public static final int TOTAL_STEPS = WORKFLOW_STEP_IDS.size();

    private final SecurityPolicyService securityPolicyService;

    public WorkflowService(SecurityPolicyService securityPolicyService) {
        this.securityPolicyService = securityPolicyService;
    }

    public StageStepRange getStageStepRange(Integer stage) {
        int normalizedStage = stage == null ? 1 : stage;
        Integer rangeEnd = LAST_STEP_INDEX_BY_STAGE.get(normalizedStage);
        if (rangeEnd == null || rangeEnd < 0) {
            return null;
        }

        int prevStage = normalizedStage - 1;
        Integer prevEnd = prevStage >= 1 ? LAST_STEP_INDEX_BY_STAGE.get(prevStage) : -1;
        int rangeStart = prevEnd != null ? prevEnd + 1 : 0;

        return new StageStepRange(rangeStart, rangeEnd);
    }

    public CompletionTransition buildCompletionTransition(ApplicationEntity current, String actorRole) {
        securityPolicyService.requireAllowed(actorRole, "workflow", "mutate");

        int currentStep = normalizeStepIndex(current.getCurrentStep());
        int currentStage = current.getCurrentStage() == null ? 1 : current.getCurrentStage();
        int nextStepIndex = currentStep + 1;
        boolean stageBoundary = LAST_STEP_INDEX_BY_STAGE.get(currentStage) != null && LAST_STEP_INDEX_BY_STAGE.get(currentStage) == currentStep;
        boolean isLastStepGlobal = nextStepIndex >= TOTAL_STEPS;

        String nextStatus = current.getStatus() == null ? "IN_PROGRESS" : current.getStatus();
        String nextSubstatus = current.getWorkflowSubstatus() == null ? "DRAFT" : current.getWorkflowSubstatus();
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
            if (!"INTEGRATION".equals(nextSubstatus)) {
                nextSubstatus = "DRAFT";
            }
        }

        return new CompletionTransition(nextStepIndex, nextStatus, nextSubstatus, nextStage);
    }

    public RollbackTransition buildRollbackTransition(ApplicationEntity current, String actorRole) {
        securityPolicyService.requireAllowed(actorRole, "workflow", "mutate");

        int currentStep = normalizeStepIndex(current.getCurrentStep());
        int prevIndex = Math.max(0, currentStep - 1);
        String currentSubstatus = current.getWorkflowSubstatus() == null ? "DRAFT" : current.getWorkflowSubstatus();

        String nextSubstatus = currentSubstatus;
        if ("REVIEW".equals(currentSubstatus) || "DONE".equals(currentSubstatus)) {
            nextSubstatus = "DRAFT";
        }

        return new RollbackTransition(
            prevIndex,
            current.getCurrentStage() == null ? 1 : current.getCurrentStage(),
            "IN_PROGRESS",
            nextSubstatus
        );
    }

    public ReviewTransition buildReviewTransition(ApplicationEntity current, String action, String actorRole) {
        securityPolicyService.requireAllowed(actorRole, "workflow", "mutate");

        boolean isApprove = "APPROVE".equals(action);
        int currentStage = current.getCurrentStage() == null ? 1 : current.getCurrentStage();
        String nextStatus = current.getStatus() == null ? "IN_PROGRESS" : current.getStatus();
        String nextSubstatus = current.getWorkflowSubstatus() == null ? "DRAFT" : current.getWorkflowSubstatus();
        int nextStepIndex = normalizeStepIndex(current.getCurrentStep());
        int nextStage = currentStage;

        if (isApprove) {
            nextSubstatus = "DRAFT";
            if (nextStepIndex == INTEGRATION_START_IDX) {
                nextSubstatus = "INTEGRATION";
            }
            nextStatus = "IN_PROGRESS";
        } else {
            nextStage = Math.max(1, currentStage - 1);
            nextStepIndex = LAST_STEP_INDEX_BY_STAGE.getOrDefault(nextStage, 0);
            nextSubstatus = "REVISION";
            nextStatus = "IN_PROGRESS";
        }

        return new ReviewTransition(isApprove, nextStatus, nextSubstatus, nextStepIndex, nextStage);
    }

    private int normalizeStepIndex(Integer stepIndex) {
        if (stepIndex == null || stepIndex < 0) return 0;
        if (stepIndex >= TOTAL_STEPS) return TOTAL_STEPS - 1;
        return stepIndex;
    }

    public record StageStepRange(int start, int end) {
    }

    public record CompletionTransition(int nextStepIndex, String nextStatus, String nextSubstatus, int nextStage) {
    }

    public record RollbackTransition(int nextStepIndex, int nextStage, String nextStatus, String nextSubstatus) {
    }

    public record ReviewTransition(boolean isApprove, String nextStatus, String nextSubstatus, int nextStepIndex, int nextStage) {
    }
}
