package uz.reestrmkd.backend.domain.workflow.api;

import java.util.UUID;

public record WorkflowTransitionResponseDto(
    UUID application,
    String workflowSubstatus,
    UUID historyEventId
) {}
