package uz.reestr.mkd.backendjpa.controller;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import uz.reestr.mkd.backendjpa.dto.PaginatedResponseDto;
import uz.reestr.mkd.backendjpa.dto.WorkflowRequestDtos.CompleteStepRequest;
import uz.reestr.mkd.backendjpa.dto.WorkflowRequestDtos.DeclineRequest;
import uz.reestr.mkd.backendjpa.dto.WorkflowRequestDtos.ReviewRejectRequest;
import uz.reestr.mkd.backendjpa.dto.WorkflowRequestDtos.AssignTechnicianRequest;
import uz.reestr.mkd.backendjpa.dto.WorkflowRequestDtos.RequestDeclineRequest;
import uz.reestr.mkd.backendjpa.dto.WorkflowRequestDtos.ReturnFromDeclineRequest;
import uz.reestr.mkd.backendjpa.dto.WorkflowRequestDtos.RestoreRequest;
import uz.reestr.mkd.backendjpa.dto.WorkflowRequestDtos.ReviewApproveRequest;
import uz.reestr.mkd.backendjpa.dto.WorkflowRequestDtos.RollbackStepRequest;
import uz.reestr.mkd.backendjpa.dto.WorkflowResponseDtos.WorkflowActionResponse;
import uz.reestr.mkd.backendjpa.service.WorkflowJpaService;

@RestController
@RequestMapping("/api/v1")
public class WorkflowController {

  private final WorkflowJpaService workflowJpaService;

  public WorkflowController(WorkflowJpaService workflowJpaService) {
    this.workflowJpaService = workflowJpaService;
  }

  @GetMapping("/workflow/inbox")
  public ResponseEntity<PaginatedResponseDto<JsonNode>> getInboxApplications(
      @RequestParam String scope,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size
  ) {
    return ResponseEntity.ok(workflowJpaService.getInboxApplications(scope, page, size));
  }

  @PostMapping("/applications/{applicationId}/workflow/complete-step")
  public ResponseEntity<WorkflowActionResponse> completeStep(
      @PathVariable UUID applicationId,
      @RequestBody CompleteStepRequest request,
      @RequestHeader(value = "x-user-id", required = false) String actorUserId,
      @RequestHeader(value = "x-user-role", required = false) String actorRole
  ) {
    return ResponseEntity.ok(workflowJpaService.completeStep(applicationId, request, actorUserId, actorRole));
  }

  @PostMapping("/applications/{applicationId}/workflow/rollback-step")
  public ResponseEntity<WorkflowActionResponse> rollbackStep(
      @PathVariable UUID applicationId,
      @RequestBody RollbackStepRequest request,
      @RequestHeader(value = "x-user-id", required = false) String actorUserId,
      @RequestHeader(value = "x-user-role", required = false) String actorRole
  ) {
    return ResponseEntity.ok(workflowJpaService.rollbackStep(applicationId, request, actorUserId, actorRole));
  }

  @PostMapping("/applications/{applicationId}/workflow/review-approve")
  public ResponseEntity<WorkflowActionResponse> reviewApprove(
      @PathVariable UUID applicationId,
      @RequestBody ReviewApproveRequest request,
      @RequestHeader(value = "x-user-id", required = false) String actorUserId,
      @RequestHeader(value = "x-user-role", required = false) String actorRole
  ) {
    return ResponseEntity.ok(workflowJpaService.reviewApprove(applicationId, request, actorUserId, actorRole));
  }

  @PostMapping("/applications/{applicationId}/workflow/decline")
  public ResponseEntity<WorkflowActionResponse> decline(
      @PathVariable UUID applicationId,
      @RequestBody DeclineRequest request,
      @RequestHeader(value = "x-user-id", required = false) String actorUserId,
      @RequestHeader(value = "x-user-role", required = false) String actorRole
  ) {
    return ResponseEntity.ok(workflowJpaService.decline(applicationId, request, actorUserId, actorRole));
  }

  @PostMapping("/applications/{applicationId}/workflow/review-reject")
  public ResponseEntity<WorkflowActionResponse> reviewReject(
      @PathVariable UUID applicationId,
      @RequestBody ReviewRejectRequest request,
      @RequestHeader(value = "x-user-id", required = false) String actorUserId,
      @RequestHeader(value = "x-user-role", required = false) String actorRole
  ) {
    return ResponseEntity.ok(workflowJpaService.reviewReject(applicationId, request, actorUserId, actorRole));
  }

  @PostMapping("/applications/{applicationId}/workflow/assign-technician")
  public ResponseEntity<WorkflowActionResponse> assignTechnician(
      @PathVariable UUID applicationId,
      @RequestBody AssignTechnicianRequest request,
      @RequestHeader(value = "x-user-id", required = false) String actorUserId,
      @RequestHeader(value = "x-user-role", required = false) String actorRole
  ) {
    return ResponseEntity.ok(workflowJpaService.assignTechnician(applicationId, request, actorUserId, actorRole));
  }

  @PostMapping("/applications/{applicationId}/workflow/request-decline")
  public ResponseEntity<WorkflowActionResponse> requestDecline(
      @PathVariable UUID applicationId,
      @RequestBody RequestDeclineRequest request,
      @RequestHeader(value = "x-user-id", required = false) String actorUserId,
      @RequestHeader(value = "x-user-role", required = false) String actorRole
  ) {
    return ResponseEntity.ok(workflowJpaService.requestDecline(applicationId, request, actorUserId, actorRole));
  }

  @PostMapping("/applications/{applicationId}/workflow/return-from-decline")
  public ResponseEntity<WorkflowActionResponse> returnFromDecline(
      @PathVariable UUID applicationId,
      @RequestBody ReturnFromDeclineRequest request,
      @RequestHeader(value = "x-user-id", required = false) String actorUserId,
      @RequestHeader(value = "x-user-role", required = false) String actorRole
  ) {
    return ResponseEntity.ok(workflowJpaService.returnFromDecline(applicationId, request, actorUserId, actorRole));
  }

  @PostMapping("/applications/{applicationId}/workflow/restore")
  public ResponseEntity<WorkflowActionResponse> restore(
      @PathVariable UUID applicationId,
      @RequestBody RestoreRequest request,
      @RequestHeader(value = "x-user-id", required = false) String actorUserId,
      @RequestHeader(value = "x-user-role", required = false) String actorRole
  ) {
    return ResponseEntity.ok(workflowJpaService.restore(applicationId, request, actorUserId, actorRole));
  }
}
