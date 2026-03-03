package uz.reestr.mkd.backendjpa.service;

import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import uz.reestr.mkd.backendjpa.dto.WorkflowRequestDtos.CompleteStepRequest;
import uz.reestr.mkd.backendjpa.dto.WorkflowRequestDtos.DeclineRequest;
import uz.reestr.mkd.backendjpa.dto.WorkflowRequestDtos.ReviewApproveRequest;
import uz.reestr.mkd.backendjpa.dto.WorkflowRequestDtos.RollbackStepRequest;
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

  private final ApplicationRepository applicationRepository;
  private final ApplicationHistoryRepository applicationHistoryRepository;

  public WorkflowJpaService(
      ApplicationRepository applicationRepository,
      ApplicationHistoryRepository applicationHistoryRepository
  ) {
    this.applicationRepository = applicationRepository;
    this.applicationHistoryRepository = applicationHistoryRepository;
  }

  @Transactional
  public WorkflowResult completeStep(UUID applicationId, CompleteStepRequest request, String actorUserId) {
    ApplicationEntity app = getApplication(applicationId);

    Integer stepIndex = request.stepIndex();
    if (stepIndex == null || stepIndex < 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "stepIndex must be a non-negative integer");
    }
    if (!stepIndex.equals(app.getCurrentStep())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "stepIndex does not match current step");
    }

    int currentStep = app.getCurrentStep() == null ? 0 : app.getCurrentStep();
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
    return new WorkflowResult(nextStatus, nextSubstatus, nextStepIndex, nextStage);
  }

  @Transactional
  public WorkflowResult rollbackStep(UUID applicationId, RollbackStepRequest request, String actorUserId) {
    ApplicationEntity app = getApplication(applicationId);

    int prevIndex = Math.max(0, (app.getCurrentStep() == null ? 0 : app.getCurrentStep()) - 1);
    String currentSubstatus = app.getWorkflowSubstatus() == null ? "DRAFT" : app.getWorkflowSubstatus();
    String nextSubstatus = ("REVIEW".equals(currentSubstatus) || "DONE".equals(currentSubstatus)) ? "DRAFT" : currentSubstatus;

    String prevStatus = app.getStatus();
    app.setCurrentStep(prevIndex);
    app.setStatus("IN_PROGRESS");
    app.setWorkflowSubstatus(nextSubstatus);
    applicationRepository.save(app);

    addHistory(app, "ROLLBACK_STEP", prevStatus, "IN_PROGRESS", actorUserId, request.reason());
    return new WorkflowResult(app.getStatus(), app.getWorkflowSubstatus(), app.getCurrentStep(), app.getCurrentStage());
  }

  @Transactional
  public WorkflowResult reviewApprove(UUID applicationId, ReviewApproveRequest request, String actorUserId, String actorRole) {
    ApplicationEntity app = getApplication(applicationId);

    if (!"REVIEW".equals(app.getWorkflowSubstatus())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Review approve is allowed only in REVIEW substatus");
    }
    if (!("controller".equals(actorRole) || "admin".equals(actorRole) || "branch_manager".equals(actorRole))) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Role cannot approve review");
    }

    int currentStep = app.getCurrentStep() == null ? 0 : app.getCurrentStep();
    String nextSubstatus = currentStep == INTEGRATION_START_IDX ? "INTEGRATION" : "DRAFT";

    String prevStatus = app.getStatus();
    app.setStatus("IN_PROGRESS");
    app.setWorkflowSubstatus(nextSubstatus);
    applicationRepository.save(app);

    addHistory(app, "REVIEW_APPROVE", prevStatus, "IN_PROGRESS", actorUserId, request.comment());
    return new WorkflowResult(app.getStatus(), app.getWorkflowSubstatus(), app.getCurrentStep(), app.getCurrentStage());
  }

  @Transactional
  public WorkflowResult decline(UUID applicationId, DeclineRequest request, String actorUserId, String actorRole) {
    ApplicationEntity app = getApplication(applicationId);

    if ("COMPLETED".equals(app.getStatus()) || "DECLINED".equals(app.getStatus())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Decline is forbidden for completed or declined applications");
    }
    boolean allowed = "admin".equals(actorRole)
        || "branch_manager".equals(actorRole)
        || ("controller".equals(actorRole) && "REVIEW".equals(app.getWorkflowSubstatus()));
    if (!allowed) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Role cannot decline application in current status");
    }

    String nextSubstatus = switch (actorRole) {
      case "controller" -> "DECLINED_BY_CONTROLLER";
      case "branch_manager" -> "DECLINED_BY_MANAGER";
      default -> "DECLINED_BY_ADMIN";
    };

    String prevStatus = app.getStatus();
    app.setStatus("DECLINED");
    app.setWorkflowSubstatus(nextSubstatus);
    applicationRepository.save(app);

    addHistory(app, "DECLINE", prevStatus, "DECLINED", actorUserId, request.reason());
    return new WorkflowResult(app.getStatus(), app.getWorkflowSubstatus(), app.getCurrentStep(), app.getCurrentStage());
  }

  private ApplicationEntity getApplication(UUID applicationId) {
    return applicationRepository.findById(applicationId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Application not found"));
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

  public record WorkflowResult(
      String applicationStatus,
      String workflowSubstatus,
      Integer currentStep,
      Integer currentStage
  ) {
  }
}
