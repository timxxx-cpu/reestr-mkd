package uz.reestrmkd.backend.application;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backend.common.ApiException;

import java.time.Instant;
import java.util.Map;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;

@Service
public class WorkflowService {
    private final ApplicationRepository repository;

    public WorkflowService(ApplicationRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public Map<String, Object> completeStep(String applicationId, String actorUserId, int stepIndex, String comment) {
        if (stepIndex < 0) throw new ApiException(BAD_REQUEST, "INVALID_STEP_INDEX", "stepIndex must be a non-negative integer");
        repository.ensureActorLock(applicationId, actorUserId);
        AppRow app = repository.getApplication(applicationId);
        if (app.currentStep() != stepIndex) {
            throw new ApiException(CONFLICT, "INVALID_STEP_STATE", "stepIndex does not match current step",
                Map.of("expectedStepIndex", app.currentStep(), "gotStepIndex", stepIndex));
        }

        var transition = WorkflowTransitions.buildCompletionTransition(app);
        AppRow updated = repository.updateApplicationState(applicationId, transition);
        repository.updateStepCompletion(applicationId, stepIndex, true);
        long eventId = repository.addHistory(applicationId, "COMPLETE_STEP", app.status(), transition.nextStatus(), actorUserId,
            comment == null || comment.isBlank() ? "Complete step " + stepIndex : comment);
        return buildWorkflowResponse(updated, eventId);
    }

    @Transactional
    public Map<String, Object> rollbackStep(String applicationId, String actorUserId, String reason) {
        repository.ensureActorLock(applicationId, actorUserId);
        AppRow app = repository.getApplication(applicationId);
        var transition = WorkflowTransitions.buildRollbackTransition(app);
        AppRow updated = repository.updateApplicationState(applicationId, transition);
        repository.updateStepCompletion(applicationId, app.currentStep(), false);
        long eventId = repository.addHistory(applicationId, "ROLLBACK_STEP", app.status(), transition.nextStatus(), actorUserId,
            reason == null || reason.isBlank() ? "Rollback step" : reason);
        return buildWorkflowResponse(updated, eventId);
    }

    @Transactional
    public Map<String, Object> reviewApprove(String applicationId, String actorUserId, String comment) {
        AppRow app = repository.getApplication(applicationId);
        var transition = WorkflowTransitions.buildReviewTransition(app, true);
        AppRow updated = repository.updateApplicationState(applicationId, transition);
        repository.updateStageVerification(applicationId, app.currentStage() - 1, true);
        long eventId = repository.addHistory(applicationId, "REVIEW_APPROVE", app.status(), transition.nextStatus(), actorUserId,
            comment == null || comment.isBlank() ? "Review approve" : comment);
        return buildWorkflowResponse(updated, eventId);
    }

    @Transactional
    public Map<String, Object> reviewReject(String applicationId, String actorUserId, String comment) {
        AppRow app = repository.getApplication(applicationId);
        var transition = WorkflowTransitions.buildReviewTransition(app, false);
        AppRow updated = repository.updateApplicationState(applicationId, transition);
        repository.updateStageVerification(applicationId, app.currentStage() - 1, false);
        long eventId = repository.addHistory(applicationId, "REVIEW_REJECT", app.status(), transition.nextStatus(), actorUserId,
            comment == null || comment.isBlank() ? "Review reject" : comment);
        return buildWorkflowResponse(updated, eventId);
    }

    @Transactional
    public Map<String, Object> requestDecline(String applicationId, String actorUserId, String reason, Integer stepIndex) {
        AppRow app = repository.getApplication(applicationId);
        repository.updateApplicationState(applicationId, new WorkflowTransitions.Transition(
            app.currentStep(), "IN_PROGRESS", "PENDING_DECLINE", app.currentStage()
        ));
        repository.addHistory(applicationId, "REQUEST_DECLINE", app.status(), "IN_PROGRESS", actorUserId,
            reason == null || reason.isBlank() ? "Request decline" : reason);
        return Map.of("workflowSubstatus", "PENDING_DECLINE", "requestedDeclineAt", Instant.now().toString());
    }

    @Transactional
    public Map<String, Object> decline(String applicationId, String actorUserId, String actorRole, String reason) {
        AppRow app = repository.getApplication(applicationId);
        String substatus = switch (actorRole) {
            case "controller" -> "DECLINED_BY_CONTROLLER";
            case "branch_manager" -> "DECLINED_BY_MANAGER";
            default -> "DECLINED_BY_ADMIN";
        };
        AppRow updated = repository.updateApplicationState(applicationId,
            new WorkflowTransitions.Transition(app.currentStep(), "DECLINED", substatus, app.currentStage()));
        long eventId = repository.addHistory(applicationId, "DECLINE", app.status(), "DECLINED", actorUserId,
            reason == null || reason.isBlank() ? "Declined" : reason);
        return buildWorkflowResponse(updated, eventId);
    }

    @Transactional
    public Map<String, Object> returnFromDecline(String applicationId, String actorUserId, String comment) {
        AppRow app = repository.getApplication(applicationId);
        repository.updateApplicationState(applicationId,
            new WorkflowTransitions.Transition(app.currentStep(), "IN_PROGRESS", "RETURNED_BY_MANAGER", app.currentStage()));
        long eventId = repository.addHistory(applicationId, "RETURN_FROM_DECLINE", app.status(), "IN_PROGRESS", actorUserId,
            comment == null || comment.isBlank() ? "Return from decline" : comment);
        return Map.of("workflowSubstatus", "RETURNED_BY_MANAGER", "historyEventId", eventId);
    }

    @Transactional
    public Map<String, Object> restore(String applicationId, String actorUserId, String comment) {
        AppRow app = repository.getApplication(applicationId);
        AppRow updated = repository.updateApplicationState(applicationId,
            new WorkflowTransitions.Transition(app.currentStep(), "IN_PROGRESS", "DRAFT", app.currentStage()));
        long eventId = repository.addHistory(applicationId, "RESTORE", app.status(), "IN_PROGRESS", actorUserId,
            comment == null || comment.isBlank() ? "Restore" : comment);
        return buildWorkflowResponse(updated, eventId);
    }

    private Map<String, Object> buildWorkflowResponse(AppRow updated, long eventId) {
        return Map.of(
            "applicationStatus", updated.status(),
            "workflowSubstatus", updated.workflowSubstatus(),
            "currentStep", updated.currentStep(),
            "currentStage", updated.currentStage(),
            "historyEventId", eventId
        );
    }
}
