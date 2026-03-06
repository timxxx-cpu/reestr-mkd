package uz.reestrmkd.backend.domain.workflow.api;

import jakarta.validation.constraints.NotBlank;

public record AssignTechnicianRequestDto(
    @NotBlank(message = "assigneeUserId is required")
    String assigneeUserId,
    String reason
) {}
