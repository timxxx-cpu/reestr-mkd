package uz.reestrmkd.backend.domain.workflow.api;

public record CompleteStepRequestDto(
    Integer stepIndex,
    String comment
) {}
