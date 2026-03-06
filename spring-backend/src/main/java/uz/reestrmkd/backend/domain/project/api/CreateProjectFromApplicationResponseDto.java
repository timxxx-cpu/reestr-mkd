package uz.reestrmkd.backend.domain.project.api;

import java.util.UUID;

public record CreateProjectFromApplicationResponseDto(
    boolean ok,
    UUID projectId
) {}
