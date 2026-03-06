package uz.reestrmkd.backend.domain.workflow.api;

public record WorkflowActionRequestDto(
    String comment,
    String reason
) {}
