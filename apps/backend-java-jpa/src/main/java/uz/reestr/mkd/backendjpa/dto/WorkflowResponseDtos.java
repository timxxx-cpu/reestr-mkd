package uz.reestr.mkd.backendjpa.dto;

public final class WorkflowResponseDtos {

  private WorkflowResponseDtos() {
  }

  public record WorkflowActionResponse(
      String applicationStatus,
      String workflowSubstatus,
      Integer currentStep,
      Integer currentStage
  ) {
  }
}
