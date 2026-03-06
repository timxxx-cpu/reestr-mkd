package uz.reestrmkd.backend.domain.registry.api;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.UUID;

public record BlockFloorMarkerDbDto(
    @JsonProperty("id") UUID id,
    @JsonProperty("block_id") UUID blockId,
    @JsonProperty("marker_key") String markerKey,
    @JsonProperty("floor_index") Integer floorIndex,
    @JsonProperty("is_technical") Boolean isTechnical,
    @JsonProperty("is_commercial") Boolean isCommercial,
    @JsonProperty("created_at") Instant createdAt,
    @JsonProperty("updated_at") Instant updatedAt
) {}
