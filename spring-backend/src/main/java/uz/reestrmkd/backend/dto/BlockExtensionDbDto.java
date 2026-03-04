package uz.reestrmkd.backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record BlockExtensionDbDto(
    @JsonProperty("id") UUID id,
    @JsonProperty("building_id") UUID buildingId,
    @JsonProperty("parent_block_id") UUID parentBlockId,
    @JsonProperty("label") String label,
    @JsonProperty("extension_type") String extensionType,
    @JsonProperty("construction_kind") String constructionKind,
    @JsonProperty("floors_count") Integer floorsCount,
    @JsonProperty("start_floor_index") Integer startFloorIndex,
    @JsonProperty("vertical_anchor_type") String verticalAnchorType,
    @JsonProperty("anchor_floor_key") String anchorFloorKey,
    @JsonProperty("notes") String notes,
    @JsonProperty("created_at") Instant createdAt,
    @JsonProperty("updated_at") Instant updatedAt
) {}
