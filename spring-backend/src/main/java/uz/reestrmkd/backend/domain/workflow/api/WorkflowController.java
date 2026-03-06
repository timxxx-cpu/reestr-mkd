package uz.reestrmkd.backend.domain.workflow.api;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import uz.reestrmkd.backend.domain.auth.service.SecurityPolicyService;
import uz.reestrmkd.backend.domain.common.api.MapResponseDto;
import uz.reestrmkd.backend.domain.workflow.model.ApplicationEntity;
import uz.reestrmkd.backend.domain.workflow.repository.ApplicationJpaRepository;
import uz.reestrmkd.backend.domain.workflow.service.ApplicationRepositoryService;
import uz.reestrmkd.backend.domain.workflow.service.WorkflowService;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.security.ActorPrincipal;
import uz.reestrmkd.backend.security.CurrentUser;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/applications/{applicationId}/workflow")
public class WorkflowController {
    private final ApplicationJpaRepository applicationJpaRepository;
    private final ApplicationRepositoryService applicationRepositoryService;
    private final WorkflowService workflowService;
    private final SecurityPolicyService securityPolicyService;

    public WorkflowController(ApplicationJpaRepository applicationJpaRepository, ApplicationRepositoryService applicationRepositoryService, WorkflowService workflowService, SecurityPolicyService securityPolicyService) {
        this.applicationJpaRepository = applicationJpaRepository;
        this.applicationRepositoryService = applicationRepositoryService;
        this.workflowService = workflowService;
        this.securityPolicyService = securityPolicyService;
    }

    @PostMapping("/complete-step")
    public MapResponseDto completeStep(
            @PathVariable @org.springframework.lang.NonNull UUID applicationId, 
            @Valid @RequestBody CompleteStepRequestDto body, 
            @RequestHeader(value = "x-user-role", required = false) String role,
            @CurrentUser ActorPrincipal actor
    ) {
        requirePolicy(actor, "workflow", "mutate", "Role cannot mutate workflow");
        applicationRepositoryService.assertActiveActorLock(applicationId, actor.userId());
        ApplicationEntity app = getApp(applicationId);
        Integer stepIndex = body.stepIndex();
        if (stepIndex == null || stepIndex < 0) {
            throw new ApiException("stepIndex must be a non-negative integer", "INVALID_STEP_INDEX", null, 400);
        }
        int currentStep = app.getCurrentStep() == null ? 0 : app.getCurrentStep();
        if (currentStep != stepIndex) {
            throw new ApiException("stepIndex does not match current step", "INVALID_STEP_STATE", Map.of("expectedStepIndex", currentStep, "gotStepIndex", stepIndex), 409);
        }

        var t = workflowService.buildCompletionTransition(app, role == null ? actor.userRole() : role);
        ApplicationEntity updated = applicationRepositoryService.updateApplicationState(applicationId, t.nextStatus(), t.nextSubstatus(), t.nextStepIndex(), t.nextStage()).orElseThrow(() -> new ApiException("Application not found", "NOT_FOUND", null, 404));
        applicationRepositoryService.updateStepCompletion(applicationId, stepIndex, true);
        UUID historyEventId = applicationRepositoryService.addHistory(applicationId, "COMPLETE_STEP", app.getStatus(), t.nextStatus(), actor.userId(), body.comment() == null ? "Step completed" : body.comment());
        return workflowResponse(updated, historyEventId);
    }

    @PostMapping("/rollback-step")
    public MapResponseDto rollback(
            @PathVariable @org.springframework.lang.NonNull UUID applicationId, 
            @Valid @RequestBody WorkflowActionRequestDto body, 
            @RequestHeader(value = "x-user-role", required = false) String role,
            @CurrentUser ActorPrincipal actor
    ) {
        requirePolicy(actor, "workflow", "mutate", "Role cannot mutate workflow");
        applicationRepositoryService.assertActiveActorLock(applicationId, actor.userId());
        ApplicationEntity app = getApp(applicationId);
        var t = workflowService.buildRollbackTransition(app, role == null ? actor.userRole() : role);
        ApplicationEntity updated = applicationRepositoryService.updateApplicationState(applicationId, t.nextStatus(), t.nextSubstatus(), t.nextStepIndex(), t.nextStage()).orElseThrow(() -> new ApiException("Application not found", "NOT_FOUND", null, 404));
        applicationRepositoryService.updateStepCompletion(applicationId, app.getCurrentStep() == null ? 0 : app.getCurrentStep(), false);
        UUID historyEventId = applicationRepositoryService.addHistory(applicationId, "ROLLBACK_STEP", app.getStatus(), t.nextStatus(), actor.userId(), body.reason() == null ? "Rollback step" : body.reason());
        return workflowResponse(updated, historyEventId);
    }

    @PostMapping("/review-approve")
    public MapResponseDto reviewApprove(
            @PathVariable @org.springframework.lang.NonNull UUID applicationId, 
            @Valid @RequestBody WorkflowActionRequestDto body, 
            @RequestHeader(value = "x-user-role", required = false) String role,
            @CurrentUser ActorPrincipal actor
    ) {
        return review(applicationId, body, role, "APPROVE", "REVIEW_APPROVE", actor);
    }

    @PostMapping("/review-reject")
    public MapResponseDto reviewReject(
            @PathVariable @org.springframework.lang.NonNull UUID applicationId, 
            @Valid @RequestBody WorkflowActionRequestDto body, 
            @RequestHeader(value = "x-user-role", required = false) String role,
            @CurrentUser ActorPrincipal actor
    ) {
        return review(applicationId, body, role, "REJECT", "REVIEW_REJECT", actor);
    }

    @PostMapping("/assign-technician")
    public MapResponseDto assign(
            @PathVariable @org.springframework.lang.NonNull UUID applicationId, 
            @Valid @RequestBody AssignTechnicianRequestDto body,
            @CurrentUser ActorPrincipal actor
    ) {
        requirePolicy(actor, "workflow", "assignTechnician", "Role cannot assign technician");
        ApplicationEntity app = getApp(applicationId);
        String assigneeUserId = body.assigneeUserId();
        app.setAssigneeName(assigneeUserId);
        app.setUpdatedAt(Instant.now());
        applicationJpaRepository.save(app);
        UUID historyEventId = applicationRepositoryService.addHistory(applicationId, "ASSIGN_TECHNICIAN", app.getStatus(), app.getStatus(), actor.userId(), body.reason() == null ? "Assigned" : body.reason());
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("assigneeUserId", assigneeUserId);
        payload.put("workflowSubstatus", app.getWorkflowSubstatus());
        payload.put("historyEventId", historyEventId);
        return MapResponseDto.of(payload);
    }

    @PostMapping("/request-decline")
    public MapResponseDto requestDecline(
            @PathVariable @org.springframework.lang.NonNull UUID applicationId, 
            @Valid @RequestBody RequestDeclineRequestDto body,
            @CurrentUser ActorPrincipal actor
    ) {
        requirePolicy(actor, "workflow", "requestDecline", "Role cannot request decline");
        ApplicationEntity app = getApp(applicationId);
        String prevStatus = app.getStatus();
        app.setStatus("IN_PROGRESS");
        app.setWorkflowSubstatus("PENDING_DECLINE");
        app.setRequestedDeclineReason(body.reason());
        app.setRequestedDeclineStep(body.stepIndex() == null ? app.getCurrentStep() : body.stepIndex());
        app.setRequestedDeclineBy(actor.userId());
        app.setRequestedDeclineAt(Instant.now());
        app.setUpdatedAt(Instant.now());
        applicationJpaRepository.save(app);
        UUID historyEventId = applicationRepositoryService.addHistory(applicationId, "REQUEST_DECLINE", prevStatus, "IN_PROGRESS", actor.userId(), body.reason() == null ? "Request decline" : body.reason());
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("workflowSubstatus", "PENDING_DECLINE");
        payload.put("requestedDeclineAt", app.getRequestedDeclineAt());
        payload.put("historyEventId", historyEventId);
        return MapResponseDto.of(payload);
    }

    @PostMapping("/decline")
    public MapResponseDto decline(
            @PathVariable @org.springframework.lang.NonNull UUID applicationId, 
            @Valid @RequestBody WorkflowActionRequestDto body,
            @CurrentUser ActorPrincipal actor
    ) {
        requirePolicy(actor, "workflow", "decline", "Role cannot decline workflow");
        ApplicationEntity app = getApp(applicationId);
        String declinedSubstatus = switch (actor.userRole()) {
            case "controller" -> "DECLINED_BY_CONTROLLER";
            case "branch_manager" -> "DECLINED_BY_MANAGER";
            default -> "DECLINED_BY_ADMIN";
        };
        String prevStatus = app.getStatus();
        app.setStatus("DECLINED");
        app.setWorkflowSubstatus(declinedSubstatus);
        app.setUpdatedAt(Instant.now());
        applicationJpaRepository.save(app);
        UUID historyEventId = applicationRepositoryService.addHistory(applicationId, "DECLINE", prevStatus, "DECLINED", actor.userId(), body.reason() == null ? "Declined" : body.reason());
        return workflowResponse(app, historyEventId);
    }

    @PostMapping("/return-from-decline")
    public MapResponseDto returnFromDecline(
            @PathVariable @org.springframework.lang.NonNull UUID applicationId, 
            @Valid @RequestBody WorkflowActionRequestDto body,
            @CurrentUser ActorPrincipal actor
    ) {
        requirePolicy(actor, "workflow", "returnFromDecline", "Role cannot return from decline");
        ApplicationEntity app = getApp(applicationId);
        String prevStatus = app.getStatus();
        app.setStatus("IN_PROGRESS");
        app.setWorkflowSubstatus("RETURNED_BY_MANAGER");
        app.setRequestedDeclineReason(null);
        app.setRequestedDeclineStep(null);
        app.setRequestedDeclineBy(null);
        app.setRequestedDeclineAt(null);
        app.setUpdatedAt(Instant.now());
        applicationJpaRepository.save(app);
        UUID historyEventId = applicationRepositoryService.addHistory(applicationId, "RETURN_FROM_DECLINE", prevStatus, "IN_PROGRESS", actor.userId(), body.comment() == null ? "Return" : body.comment());
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("workflowSubstatus", "RETURNED_BY_MANAGER");
        payload.put("historyEventId", historyEventId);
        return MapResponseDto.of(payload);
    }

    @PostMapping("/restore")
    public MapResponseDto restore(
            @PathVariable @org.springframework.lang.NonNull UUID applicationId, 
            @Valid @RequestBody WorkflowActionRequestDto body,
            @CurrentUser ActorPrincipal actor
    ) {
        requirePolicy(actor, "workflow", "restore", "Role cannot restore workflow");
        ApplicationEntity app = getApp(applicationId);
        String prevStatus = app.getStatus();
        app.setStatus("IN_PROGRESS");
        app.setWorkflowSubstatus("DRAFT");
        app.setUpdatedAt(Instant.now());
        applicationJpaRepository.save(app);
        UUID historyEventId = applicationRepositoryService.addHistory(applicationId, "RESTORE", prevStatus, "IN_PROGRESS", actor.userId(), body.comment() == null ? "Restore" : body.comment());
        return workflowResponse(app, historyEventId);
    }

    private MapResponseDto review(@org.springframework.lang.NonNull UUID applicationId, WorkflowActionRequestDto body, String role, String action, String historyAction, ActorPrincipal actor) {
        requirePolicy(actor, "workflow", "mutate", "Role cannot mutate workflow");
        ApplicationEntity app = getApp(applicationId);
        var t = workflowService.buildReviewTransition(app, action, role == null ? actor.userRole() : role);
        ApplicationEntity updated = applicationRepositoryService.updateApplicationState(applicationId, t.nextStatus(), t.nextSubstatus(), t.nextStepIndex(), t.nextStage()).orElseThrow(() -> new ApiException("Application not found", "NOT_FOUND", null, 404));
        int reviewedStage = Math.max(1, (app.getCurrentStage() == null ? 1 : app.getCurrentStage()) - 1);
        applicationRepositoryService.updateStageVerification(applicationId, reviewedStage, "APPROVE".equals(action));
        String comment = body.comment() != null ? body.comment() : (body.reason() != null ? body.reason() : historyAction);
        UUID historyEventId = applicationRepositoryService.addHistory(applicationId, historyAction, app.getStatus(), t.nextStatus(), actor.userId(), comment);
        return workflowResponse(updated, historyEventId);
    }

    private MapResponseDto workflowResponse(ApplicationEntity app, UUID historyEventId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("applicationStatus", app.getStatus());
        payload.put("workflowSubstatus", app.getWorkflowSubstatus());
        payload.put("currentStep", app.getCurrentStep());
        payload.put("currentStage", app.getCurrentStage());
        payload.put("historyEventId", historyEventId);
        return MapResponseDto.of(payload);
    }

    private ApplicationEntity getApp(@org.springframework.lang.NonNull UUID id) {
        return applicationJpaRepository.findById(id).orElseThrow(() -> new ApiException("Application not found", "NOT_FOUND", null, 404));
    }

    private void requirePolicy(ActorPrincipal actor, String module, String action, String message) {
        if (actor == null) {
            throw new ApiException(message, "FORBIDDEN", null, 403);
        }
        if (!securityPolicyService.allowByPolicy(actor.userRole(), module, action)) {
            throw new ApiException(message, "FORBIDDEN", null, 403);
        }
    }
}