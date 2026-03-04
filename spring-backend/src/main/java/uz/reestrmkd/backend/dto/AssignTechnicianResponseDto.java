package uz.reestrmkd.backend.dto;

import java.util.UUID;

public record AssignTechnicianResponseDto(
    String assigneeUserId,
    String workflowSubstatus,
    UUID historyEventId
) {}
