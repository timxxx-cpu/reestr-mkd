package uz.reestrmkd.backend.domain.workflow.api;

public record RequestDeclineRequestDto(
    String reason,
    Integer stepIndex
) {}
