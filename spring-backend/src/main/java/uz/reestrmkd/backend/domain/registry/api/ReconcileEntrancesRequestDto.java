package uz.reestrmkd.backend.domain.registry.api;

import jakarta.validation.constraints.Min;

public record ReconcileEntrancesRequestDto(
    @Min(value = 0, message = "count must be greater than or equal to 0")
    Integer count
) {
}
