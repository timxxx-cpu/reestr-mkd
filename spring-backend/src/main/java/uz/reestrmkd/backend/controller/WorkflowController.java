package uz.reestrmkd.backend.controller;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backend.dto.AssignTechnicianRequestDto;
import uz.reestrmkd.backend.dto.AssignTechnicianResponseDto;
import uz.reestrmkd.backend.dto.HistoryEventResponseDto;
import uz.reestrmkd.backend.dto.OkResponseDto;
import uz.reestrmkd.backend.dto.RequestDeclineRequestDto;
import uz.reestrmkd.backend.dto.WorkflowActionRequestDto;
import uz.reestrmkd.backend.dto.WorkflowTransitionResponseDto;
import uz.reestrmkd.backend.entity.ApplicationEntity;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.repository.ApplicationJpaRepository;
import uz.reestrmkd.backend.security.ActorPrincipal;
import uz.reestrmkd.backend.service.ApplicationRepositoryService;
import uz.reestrmkd.backend.service.SecurityPolicyService;
import uz.reestrmkd.backend.service.WorkflowService;

import java.time.Instant;
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
    public WorkflowTransitionResponseDto completeStep(@PathVariable UUID applicationId, @Valid @RequestBody WorkflowActionRequestDto body, @RequestHeader(value = "x-user-role", required = false) String role, @RequestHeader(value = "x-user-id", required = false) String userId) {
        requirePolicy("workflow", "mutate", "Role cannot mutate workflow");
        ActorPrincipal actor = getActor();
        applicationRepositoryService.assertActiveActorLock(applicationId, actor.userId());
        ApplicationEntity app = getApp(applicationId);
        var t = workflowService.buildCompletionTransition(app, role == null ? actor.userRole() : role);
        ApplicationEntity updated = applicationRepositoryService.updateApplicationState(applicationId, t.nextStatus(), t.nextSubstatus(), t.nextStepIndex(), t.nextStage()).orElseThrow(() -> new ApiException("Application not found", "NOT_FOUND", null, 404));
        applicationRepositoryService.updateStepCompletion(applicationId, app.getCurrentStep() == null ? 0 : app.getCurrentStep(), true);
        UUID h = applicationRepositoryService.addHistory(applicationId, "COMPLETE_STEP", app.getStatus(), t.nextStatus(), actor.userId(), body.comment() == null ? "Step completed" : body.comment());
        return new WorkflowTransitionResponseDto(updated.getId(), updated.getWorkflowSubstatus(), h);
    }

    @PostMapping("/rollback-step")
    public WorkflowTransitionResponseDto rollback(@PathVariable UUID applicationId, @Valid @RequestBody WorkflowActionRequestDto body, @RequestHeader(value = "x-user-role", required = false) String role, @RequestHeader(value = "x-user-id", required = false) String userId) {
        requirePolicy("workflow", "mutate", "Role cannot mutate workflow");
        ApplicationEntity app = getApp(applicationId);
        var t = workflowService.buildRollbackTransition(app, role);
        ApplicationEntity updated = applicationRepositoryService.updateApplicationState(applicationId, t.nextStatus(), t.nextSubstatus(), t.nextStepIndex(), t.nextStage()).orElseThrow();
        applicationRepositoryService.updateStepCompletion(applicationId, app.getCurrentStep() == null ? 0 : app.getCurrentStep(), false);
        UUID h = applicationRepositoryService.addHistory(applicationId, "ROLLBACK_STEP", app.getStatus(), t.nextStatus(), userId, body.reason() == null ? "Rollback step" : body.reason());
        return new WorkflowTransitionResponseDto(updated.getId(), updated.getWorkflowSubstatus(), h);
    }

    @PostMapping("/review-approve")
    public WorkflowTransitionResponseDto reviewApprove(@PathVariable UUID applicationId, @Valid @RequestBody WorkflowActionRequestDto body, @RequestHeader(value = "x-user-role", required = false) String role, @RequestHeader(value = "x-user-id", required = false) String userId) {
        return review(applicationId, body, role, userId, "APPROVE", "REVIEW_APPROVE");
    }

    @PostMapping("/review-reject")
    public WorkflowTransitionResponseDto reviewReject(@PathVariable UUID applicationId, @Valid @RequestBody WorkflowActionRequestDto body, @RequestHeader(value = "x-user-role", required = false) String role, @RequestHeader(value = "x-user-id", required = false) String userId) {
        return review(applicationId, body, role, userId, "REJECT", "REVIEW_REJECT");
    }

    @PostMapping("/assign-technician")
    public AssignTechnicianResponseDto assign(@PathVariable UUID applicationId, @Valid @RequestBody AssignTechnicianRequestDto body, @RequestHeader(value = "x-user-id", required = false) String userId, @RequestHeader(value = "x-user-role", required = false) String role) {
        requirePolicy("workflow", "assignTechnician", "Role cannot assign technician");
        ApplicationEntity app = getApp(applicationId);
        String assigneeUserId = body.assigneeUserId();
        app.setAssigneeName(assigneeUserId);
        app.setUpdatedAt(Instant.now());
        applicationJpaRepository.save(app);
        UUID h = applicationRepositoryService.addHistory(applicationId, "ASSIGN_TECHNICIAN", app.getStatus(), app.getStatus(), userId, body.reason() == null ? "Assigned" : body.reason());
        return new AssignTechnicianResponseDto(assigneeUserId, app.getWorkflowSubstatus(), h);
    }

    @PostMapping("/request-decline")
    public ResponseEntity<OkResponseDto> requestDecline(@PathVariable UUID applicationId, @Valid @RequestBody RequestDeclineRequestDto body) {
        requirePolicy("workflow", "requestDecline", "Role cannot request decline");
        ApplicationEntity app = getApp(applicationId);
        app.setRequestedDeclineReason(body.reason());
        app.setRequestedDeclineStep(body.stepIndex() == null ? app.getCurrentStep() : body.stepIndex());
        app.setRequestedDeclineAt(Instant.now());
        applicationJpaRepository.save(app);
        return ResponseEntity.ok(new OkResponseDto(true));
    }

    @PostMapping("/decline")
    public HistoryEventResponseDto decline(@PathVariable UUID applicationId, @Valid @RequestBody WorkflowActionRequestDto body, @RequestHeader(value = "x-user-id", required = false) String userId) {
        requirePolicy("workflow", "decline", "Role cannot decline workflow");
        ActorPrincipal actor = getActor();
        applicationRepositoryService.assertActiveActorLock(applicationId, actor.userId());
        ApplicationEntity app = getApp(applicationId);
        app.setStatus("DECLINED");
        app.setWorkflowSubstatus("DECLINED_BY_ADMIN");
        app.setUpdatedAt(Instant.now());
        applicationJpaRepository.save(app);
        UUID h = applicationRepositoryService.addHistory(applicationId, "DECLINE", "IN_PROGRESS", "DECLINED", actor.userId(), body.reason() == null ? "Declined" : body.reason());
        return new HistoryEventResponseDto(true, h);
    }

    @PostMapping("/return-from-decline")
    public HistoryEventResponseDto returnFromDecline(@PathVariable UUID applicationId, @Valid @RequestBody WorkflowActionRequestDto body, @RequestHeader(value = "x-user-id", required = false) String userId) {
        requirePolicy("workflow", "returnFromDecline", "Role cannot return from decline");
        ApplicationEntity app = getApp(applicationId);
        app.setStatus("IN_PROGRESS");
        app.setWorkflowSubstatus("REVISION");
        applicationJpaRepository.save(app);
        UUID h = applicationRepositoryService.addHistory(applicationId, "RETURN_FROM_DECLINE", "DECLINED", "IN_PROGRESS", userId, body.comment() == null ? "Return" : body.comment());
        return new HistoryEventResponseDto(true, h);
    }

    @PostMapping("/restore")
    public HistoryEventResponseDto restore(@PathVariable UUID applicationId, @Valid @RequestBody WorkflowActionRequestDto body, @RequestHeader(value = "x-user-id", required = false) String userId) {
        requirePolicy("workflow", "restore", "Role cannot restore workflow");
        ApplicationEntity app = getApp(applicationId);
        app.setStatus("IN_PROGRESS");
        app.setWorkflowSubstatus("DRAFT");
        applicationJpaRepository.save(app);
        UUID h = applicationRepositoryService.addHistory(applicationId, "RESTORE", "DECLINED", "IN_PROGRESS", userId, body.comment() == null ? "Restore" : body.comment());
        return new HistoryEventResponseDto(true, h);
    }

    private WorkflowTransitionResponseDto review(UUID applicationId, WorkflowActionRequestDto body, String role, String userId, String action, String historyAction) {
        requirePolicy("workflow", "mutate", "Role cannot mutate workflow");
        ActorPrincipal actor = getActor();
        applicationRepositoryService.assertActiveActorLock(applicationId, actor.userId());
        ApplicationEntity app = getApp(applicationId);
        var t = workflowService.buildReviewTransition(app, action, role == null ? actor.userRole() : role);
        ApplicationEntity updated = applicationRepositoryService.updateApplicationState(applicationId, t.nextStatus(), t.nextSubstatus(), t.nextStepIndex(), t.nextStage()).orElseThrow();
        int reviewedStage = Math.max(1, (app.getCurrentStage() == null ? 1 : app.getCurrentStage()) - 1);
        applicationRepositoryService.updateStageVerification(applicationId, reviewedStage, "APPROVE".equals(action));
        String comment = body.comment() != null ? body.comment() : (body.reason() != null ? body.reason() : historyAction);
        UUID h = applicationRepositoryService.addHistory(applicationId, historyAction, app.getStatus(), t.nextStatus(), actor.userId(), comment);
        return new WorkflowTransitionResponseDto(updated.getId(), updated.getWorkflowSubstatus(), h);
    }

    private ActorPrincipal getActor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof ActorPrincipal actor)) {
            throw new ApiException("Role cannot mutate workflow", "FORBIDDEN", null, 403);
        }
        return actor;
    }

    private ApplicationEntity getApp(UUID id) {
        return applicationJpaRepository.findById(id).orElseThrow(() -> new ApiException("Application not found", "NOT_FOUND", null, 404));
    }

    private void requirePolicy(String module, String action, String message) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof ActorPrincipal actor)) {
            throw new ApiException(message, "FORBIDDEN", null, 403);
        }
        if (!securityPolicyService.allowByPolicy(actor.userRole(), module, action)) {
            throw new ApiException(message, "FORBIDDEN", null, 403);
        }
    }
}
