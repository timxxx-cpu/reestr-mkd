package uz.reestrmkd.backend.domain.catalog.api;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;

public record CatalogItemDto(
    @NotBlank(message = "item.id is required")
    String id,
    String code,
    String label,
    @JsonProperty("sort_order") Integer sortOrder,
    @JsonProperty("is_active") Boolean isActive
) {}
