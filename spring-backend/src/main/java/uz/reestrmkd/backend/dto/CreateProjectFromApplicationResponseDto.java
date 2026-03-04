package uz.reestrmkd.backend.dto;

import java.util.UUID;

public record CreateProjectFromApplicationResponseDto(
    boolean ok,
    UUID projectId
) {}
