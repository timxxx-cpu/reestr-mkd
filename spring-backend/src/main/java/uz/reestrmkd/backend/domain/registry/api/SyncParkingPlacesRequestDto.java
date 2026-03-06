package uz.reestrmkd.backend.domain.registry.api;

import jakarta.validation.constraints.Min;

public record SyncParkingPlacesRequestDto(
    @Min(value = 0, message = "targetCount must be greater than or equal to 0")
    Integer targetCount
) {
}
