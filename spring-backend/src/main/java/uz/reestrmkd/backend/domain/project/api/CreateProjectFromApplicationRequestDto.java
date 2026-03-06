package uz.reestrmkd.backend.domain.project.api;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record CreateProjectFromApplicationRequestDto(
    @NotNull(message = "applicationId is required")
    UUID applicationId,
    String name,
    String address
) {}
