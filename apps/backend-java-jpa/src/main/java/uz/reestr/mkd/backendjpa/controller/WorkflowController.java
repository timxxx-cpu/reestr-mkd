package uz.reestr.mkd.backendjpa.controller;

import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import uz.reestr.mkd.backendjpa.dto.WorkflowRequestDtos.CompleteStepRequest;
import uz.reestr.mkd.backendjpa.dto.WorkflowRequestDtos.DeclineRequest;
import uz.reestr.mkd.backendjpa.dto.WorkflowRequestDtos.ReviewApproveRequest;
import uz.reestr.mkd.backendjpa.dto.WorkflowRequestDtos.RollbackStepRequest;
import uz.reestr.mkd.backendjpa.service.WorkflowJpaService;

@RestController
@RequestMapping("/api/v1/applications/{applicationId}/workflow")
public class WorkflowController {

  private final WorkflowJpaService workflowJpaService;

  public WorkflowController(WorkflowJpaService workflowJpaService) {
    this.workflowJpaService = workflowJpaService;
  }

  @PostMapping("/complete-step")
  public ResponseEntity<WorkflowJpaService.WorkflowResult> completeStep(
      @PathVariable UUID applicationId,
      @RequestBody CompleteStepRequest request,
      @RequestHeader(value = "x-user-id", required = false) String actorUserId
  ) {
    return ResponseEntity.ok(workflowJpaService.completeStep(applicationId, request, actorUserId));
  }

  @PostMapping("/rollback-step")
  public ResponseEntity<WorkflowJpaService.WorkflowResult> rollbackStep(
      @PathVariable UUID applicationId,
      @RequestBody RollbackStepRequest request,
      @RequestHeader(value = "x-user-id", required = false) String actorUserId
  ) {
    return ResponseEntity.ok(workflowJpaService.rollbackStep(applicationId, request, actorUserId));
  }

  @PostMapping("/review-approve")
  public ResponseEntity<WorkflowJpaService.WorkflowResult> reviewApprove(
      @PathVariable UUID applicationId,
      @RequestBody ReviewApproveRequest request,
      @RequestHeader(value = "x-user-id", required = false) String actorUserId,
      @RequestHeader(value = "x-user-role", required = false) String actorRole
  ) {
    return ResponseEntity.ok(workflowJpaService.reviewApprove(applicationId, request, actorUserId, actorRole));
  }

  @PostMapping("/decline")
  public ResponseEntity<WorkflowJpaService.WorkflowResult> decline(
      @PathVariable UUID applicationId,
      @RequestBody DeclineRequest request,
      @RequestHeader(value = "x-user-id", required = false) String actorUserId,
      @RequestHeader(value = "x-user-role", required = false) String actorRole
  ) {
    return ResponseEntity.ok(workflowJpaService.decline(applicationId, request, actorUserId, actorRole));
  }
}
