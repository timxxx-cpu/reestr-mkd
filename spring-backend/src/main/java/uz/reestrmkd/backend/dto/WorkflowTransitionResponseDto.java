package uz.reestrmkd.backend.dto;

import java.util.UUID;

public record WorkflowTransitionResponseDto(
    UUID application,
    String workflowSubstatus,
    UUID historyEventId
) {}
