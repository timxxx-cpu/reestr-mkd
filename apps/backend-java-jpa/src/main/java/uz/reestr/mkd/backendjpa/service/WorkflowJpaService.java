package uz.reestr.mkd.backendjpa.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestr.mkd.backendjpa.api.error.WorkflowGuardException;
import uz.reestr.mkd.backendjpa.dto.PaginatedResponseDto;
import uz.reestr.mkd.backendjpa.dto.WorkflowRequestDtos.CompleteStepRequest;
import uz.reestr.mkd.backendjpa.dto.WorkflowRequestDtos.DeclineRequest;
import uz.reestr.mkd.backendjpa.dto.WorkflowRequestDtos.ReviewApproveRequest;
import uz.reestr.mkd.backendjpa.dto.WorkflowRequestDtos.ReviewRejectRequest;
import uz.reestr.mkd.backendjpa.dto.WorkflowRequestDtos.AssignTechnicianRequest;
import uz.reestr.mkd.backendjpa.dto.WorkflowRequestDtos.RequestDeclineRequest;
import uz.reestr.mkd.backendjpa.dto.WorkflowRequestDtos.ReturnFromDeclineRequest;
import uz.reestr.mkd.backendjpa.dto.WorkflowRequestDtos.RestoreRequest;
import uz.reestr.mkd.backendjpa.dto.WorkflowRequestDtos.RollbackStepRequest;
import uz.reestr.mkd.backendjpa.dto.WorkflowResponseDtos.WorkflowActionResponse;
import uz.reestr.mkd.backendjpa.entity.ApplicationEntity;
import uz.reestr.mkd.backendjpa.entity.ApplicationHistoryEntity;
import uz.reestr.mkd.backendjpa.repository.ApplicationHistoryRepository;
import uz.reestr.mkd.backendjpa.repository.ApplicationRepository;

@Service
public class WorkflowJpaService {

  private static final int INTEGRATION_START_IDX = 13;
  private static final int TOTAL_STEPS = 15;
  private static final Map<Integer, Integer> LAST_STEP_INDEX_BY_STAGE = Map.of(
      1, 6,
      2, 9,
      3, 12,
      4, 14
  );

  private static final Set<String> MUTATE_ROLES = Set.of("admin", "branch_manager", "technician", "controller");
  private static final Set<String> DECLINE_ROLES = Set.of("admin", "branch_manager", "controller");

  private final ApplicationRepository applicationRepository;
  private final ApplicationHistoryRepository applicationHistoryRepository;
  private final WorkflowValidationJpaService workflowValidationJpaService;
  private final ObjectMapper objectMapper;

  public WorkflowJpaService(
      ApplicationRepository applicationRepository,
      ApplicationHistoryRepository applicationHistoryRepository,
      WorkflowValidationJpaService workflowValidationJpaService,
      ObjectMapper objectMapper
  ) {
    this.applicationRepository = applicationRepository;
    this.applicationHistoryRepository = applicationHistoryRepository;
    this.workflowValidationJpaService = workflowValidationJpaService;
    this.objectMapper = objectMapper;
  }

  @Transactional(readOnly = true)
  public PaginatedResponseDto<JsonNode> getInboxApplications(String scope, int page, int size) {
    if (scope == null || scope.isBlank()) {
      throw new WorkflowGuardException(400, "MISSING_SCOPE", "scope is required");
    }

    int resolvedPage = Math.max(0, page);
    int resolvedSize = Math.min(100, Math.max(1, size));
    Pageable pageable = PageRequest.of(resolvedPage, resolvedSize);

    Page<ApplicationEntity> result = applicationRepository.findByScopeIdOrderByUpdatedAtDesc(scope, pageable);
    List<JsonNode> data = result.getContent().stream().map(this::toInboxJson).toList();

    return new PaginatedResponseDto<>(data, result.getTotalElements(), resolvedPage, result.getTotalPages());
  }

  @Transactional
  public WorkflowActionResponse completeStep(UUID applicationId, CompleteStepRequest request, String actorUserId, String actorRole) {
    requireRole(actorRole, MUTATE_ROLES, "FORBIDDEN", "Role cannot mutate workflow");
    ApplicationEntity app = getApplication(applicationId);

    Integer stepIndex = request == null ? null : request.stepIndex();
    if (stepIndex == null || stepIndex < 0) {
      throw new WorkflowGuardException(400, "INVALID_STEP_INDEX", "stepIndex must be a non-negative integer");
    }

    Integer currentStep = app.getCurrentStep() == null ? 0 : app.getCurrentStep();
    if (!stepIndex.equals(currentStep)) {
      throw new WorkflowGuardException(
          409,
          "INVALID_STEP_STATE",
          "stepIndex does not match current step",
          Map.of("expectedStepIndex", currentStep, "gotStepIndex", stepIndex)
      );
    }

    workflowValidationJpaService.validateStepBeforeCompletion(app, stepIndex);

    int currentStage = app.getCurrentStage() == null ? 1 : app.getCurrentStage();
    int nextStepIndex = currentStep + 1;
    boolean isStageBoundary = LAST_STEP_INDEX_BY_STAGE.getOrDefault(currentStage, -1) == currentStep;
    boolean isLastStepGlobal = nextStepIndex >= TOTAL_STEPS;

    String nextStatus;
    String nextSubstatus;
    int nextStage = currentStage;

    if (isLastStepGlobal) {
      nextStatus = "COMPLETED";
      nextSubstatus = "DONE";
    } else if (isStageBoundary) {
      nextStatus = "IN_PROGRESS";
      nextSubstatus = "REVIEW";
      nextStage = currentStage + 1;
    } else if (nextStepIndex == INTEGRATION_START_IDX) {
      nextStatus = "IN_PROGRESS";
      nextSubstatus = "INTEGRATION";
    } else {
      nextStatus = "IN_PROGRESS";
      nextSubstatus = "INTEGRATION".equals(app.getWorkflowSubstatus()) ? "INTEGRATION" : "DRAFT";
    }

    String prevStatus = app.getStatus();
    app.setCurrentStep(nextStepIndex);
    app.setCurrentStage(nextStage);
    app.setStatus(nextStatus);
    app.setWorkflowSubstatus(nextSubstatus);
    applicationRepository.save(app);

    addHistory(app, "COMPLETE_STEP", prevStatus, nextStatus, actorUserId, request.comment());
    return new WorkflowActionResponse(nextStatus, nextSubstatus, nextStepIndex, nextStage);
  }

  @Transactional
  public WorkflowActionResponse rollbackStep(UUID applicationId, RollbackStepRequest request, String actorUserId, String actorRole) {
    requireRole(actorRole, MUTATE_ROLES, "FORBIDDEN", "Role cannot mutate workflow");
    ApplicationEntity app = getApplication(applicationId);

    int prevIndex = Math.max(0, (app.getCurrentStep() == null ? 0 : app.getCurrentStep()) - 1);
    String currentSubstatus = app.getWorkflowSubstatus() == null ? "DRAFT" : app.getWorkflowSubstatus();
    String nextSubstatus = ("REVIEW".equals(currentSubstatus) || "DONE".equals(currentSubstatus)) ? "DRAFT" : currentSubstatus;

    String prevStatus = app.getStatus();
    app.setCurrentStep(prevIndex);
    app.setStatus("IN_PROGRESS");
    app.setWorkflowSubstatus(nextSubstatus);
    applicationRepository.save(app);

    addHistory(app, "ROLLBACK_STEP", prevStatus, "IN_PROGRESS", actorUserId, request == null ? null : request.reason());
    return new WorkflowActionResponse(app.getStatus(), app.getWorkflowSubstatus(), app.getCurrentStep(), app.getCurrentStage());
  }

  @Transactional
  public WorkflowActionResponse reviewApprove(UUID applicationId, ReviewApproveRequest request, String actorUserId, String actorRole) {
    requireRole(actorRole, MUTATE_ROLES, "FORBIDDEN", "Role cannot mutate workflow");
    ApplicationEntity app = getApplication(applicationId);

    int currentStep = app.getCurrentStep() == null ? 0 : app.getCurrentStep();
    String nextSubstatus = currentStep == INTEGRATION_START_IDX ? "INTEGRATION" : "DRAFT";

    String prevStatus = app.getStatus();
    app.setStatus("IN_PROGRESS");
    app.setWorkflowSubstatus(nextSubstatus);
    applicationRepository.save(app);

    addHistory(app, "REVIEW_APPROVE", prevStatus, "IN_PROGRESS", actorUserId, request == null ? null : request.comment());
    return new WorkflowActionResponse(app.getStatus(), app.getWorkflowSubstatus(), app.getCurrentStep(), app.getCurrentStage());
  }

  @Transactional
  public WorkflowActionResponse decline(UUID applicationId, DeclineRequest request, String actorUserId, String actorRole) {
    requireRole(actorRole, DECLINE_ROLES, "FORBIDDEN", "Role cannot decline application");
    ApplicationEntity app = getApplication(applicationId);

    String nextSubstatus = switch (actorRole) {
      case "controller" -> "DECLINED_BY_CONTROLLER";
      case "branch_manager" -> "DECLINED_BY_MANAGER";
      default -> "DECLINED_BY_ADMIN";
    };

    String prevStatus = app.getStatus();
    app.setStatus("DECLINED");
    app.setWorkflowSubstatus(nextSubstatus);
    applicationRepository.save(app);

    addHistory(app, "DECLINE", prevStatus, "DECLINED", actorUserId, request == null ? null : request.reason());
    return new WorkflowActionResponse(app.getStatus(), app.getWorkflowSubstatus(), app.getCurrentStep(), app.getCurrentStage());
  }

  @Transactional
  public WorkflowActionResponse reviewReject(UUID applicationId, ReviewRejectRequest request, String actorUserId, String actorRole) {
    return decline(applicationId, new DeclineRequest(request == null ? null : request.reason()), actorUserId, actorRole);
  }

  @Transactional
  public WorkflowActionResponse assignTechnician(UUID applicationId, AssignTechnicianRequest request, String actorUserId, String actorRole) {
    requireRole(actorRole, MUTATE_ROLES, "FORBIDDEN", "Role cannot mutate workflow");
    ApplicationEntity app = getApplication(applicationId);
    app.setAssigneeName(request == null ? null : request.assigneeUserId());
    applicationRepository.save(app);
    addHistory(app, "ASSIGN_TECHNICIAN", app.getStatus(), app.getStatus(), actorUserId, request == null ? null : request.reason());
    return new WorkflowActionResponse(app.getStatus(), app.getWorkflowSubstatus(), app.getCurrentStep(), app.getCurrentStage());
  }

  @Transactional
  public WorkflowActionResponse requestDecline(UUID applicationId, RequestDeclineRequest request, String actorUserId, String actorRole) {
    requireRole(actorRole, MUTATE_ROLES, "FORBIDDEN", "Role cannot mutate workflow");
    ApplicationEntity app = getApplication(applicationId);
    app.setWorkflowSubstatus("PENDING_DECLINE");
    applicationRepository.save(app);
    addHistory(app, "REQUEST_DECLINE", app.getStatus(), app.getStatus(), actorUserId, request == null ? null : request.reason());
    return new WorkflowActionResponse(app.getStatus(), app.getWorkflowSubstatus(), app.getCurrentStep(), app.getCurrentStage());
  }

  @Transactional
  public WorkflowActionResponse returnFromDecline(UUID applicationId, ReturnFromDeclineRequest request, String actorUserId, String actorRole) {
    requireRole(actorRole, MUTATE_ROLES, "FORBIDDEN", "Role cannot mutate workflow");
    ApplicationEntity app = getApplication(applicationId);
    app.setStatus("IN_PROGRESS");
    app.setWorkflowSubstatus("DRAFT");
    applicationRepository.save(app);
    addHistory(app, "RETURN_FROM_DECLINE", "DECLINED", "IN_PROGRESS", actorUserId, request == null ? null : request.comment());
    return new WorkflowActionResponse(app.getStatus(), app.getWorkflowSubstatus(), app.getCurrentStep(), app.getCurrentStage());
  }

  @Transactional
  public WorkflowActionResponse restore(UUID applicationId, RestoreRequest request, String actorUserId, String actorRole) {
    return returnFromDecline(applicationId, new ReturnFromDeclineRequest(request == null ? null : request.comment()), actorUserId, actorRole);
  }

  private JsonNode toInboxJson(ApplicationEntity app) {
    ObjectNode node = objectMapper.createObjectNode();
    node.put("id", app.getId() == null ? null : app.getId().toString());
    node.put("projectId", app.getProjectId() == null ? null : app.getProjectId().toString());
    node.put("scope", app.getScopeId());
    node.put("status", app.getStatus());
    node.put("workflowSubstatus", app.getWorkflowSubstatus());
    node.put("assigneeName", app.getAssigneeName());
    node.put("updatedAt", app.getUpdatedAt() == null ? null : app.getUpdatedAt().toString());
    return node;
  }

  private void requireRole(String actorRole, Set<String> allowedRoles, String code, String message) {
    if (actorRole == null || !allowedRoles.contains(actorRole)) {
      throw new WorkflowGuardException(403, code, message);
    }
  }

  private ApplicationEntity getApplication(UUID applicationId) {
    return applicationRepository.findById(applicationId)
        .orElseThrow(() -> new WorkflowGuardException(404, "NOT_FOUND", "Application not found"));
  }

  private void addHistory(
      ApplicationEntity app,
      String action,
      String prevStatus,
      String nextStatus,
      String actorUserId,
      String comment
  ) {
    ApplicationHistoryEntity history = ApplicationHistoryEntity.builder()
        .application(app)
        .action(action)
        .prevStatus(prevStatus)
        .nextStatus(nextStatus)
        .userName(actorUserId)
        .comment(comment)
        .build();
    applicationHistoryRepository.save(history);
  }
}
