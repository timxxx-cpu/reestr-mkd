package uz.reestrmkd.backend.domain.workflow.api;

import java.util.UUID;

public record AssignTechnicianResponseDto(
    String assigneeUserId,
    String workflowSubstatus,
    UUID historyEventId
) {}
