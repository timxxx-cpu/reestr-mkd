package uz.reestr.mkd.backendjpa.dto;

public final class WorkflowRequestDtos {

  private WorkflowRequestDtos() {
  }

  public record CompleteStepRequest(Integer stepIndex, String comment) {
  }

  public record RollbackStepRequest(String reason) {
  }

  public record DeclineRequest(String reason) {
  }

  public record ReviewApproveRequest(String comment) {
  }

  public record ReviewRejectRequest(String reason) {
  }

  public record AssignTechnicianRequest(String assigneeUserId, String reason) {
  }

  public record RequestDeclineRequest(String reason, Integer stepIndex) {
  }

  public record ReturnFromDeclineRequest(String comment) {
  }

  public record RestoreRequest(String comment) {
  }
}
