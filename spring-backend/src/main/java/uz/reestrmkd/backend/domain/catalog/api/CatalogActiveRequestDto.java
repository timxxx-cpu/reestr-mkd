package uz.reestrmkd.backend.domain.catalog.api;

import jakarta.validation.constraints.NotNull;

public record CatalogActiveRequestDto(
    @NotNull(message = "isActive must be provided")
    Boolean isActive
) {}
