package uz.reestrmkd.backend.dto;

import jakarta.validation.constraints.NotNull;

public record CatalogActiveRequestDto(
    @NotNull(message = "isActive must be provided")
    Boolean isActive
) {}
