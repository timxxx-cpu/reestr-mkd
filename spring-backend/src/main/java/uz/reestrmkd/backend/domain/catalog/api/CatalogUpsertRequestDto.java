package uz.reestrmkd.backend.domain.catalog.api;

import jakarta.validation.constraints.NotNull;

import java.util.Map;

public record CatalogUpsertRequestDto(
    @NotNull(message = "item is required")
    Map<String, Object> item
) {}
