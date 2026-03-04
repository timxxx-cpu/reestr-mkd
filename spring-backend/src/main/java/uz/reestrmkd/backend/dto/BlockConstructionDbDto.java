package uz.reestrmkd.backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record BlockConstructionDbDto(
    @JsonProperty("id") UUID id,
    @JsonProperty("block_id") UUID blockId,
    @JsonProperty("foundation") String foundation,
    @JsonProperty("walls") String walls,
    @JsonProperty("slabs") String slabs,
    @JsonProperty("roof") String roof,
    @JsonProperty("seismicity") Integer seismicity,
    @JsonProperty("created_at") Instant createdAt,
    @JsonProperty("updated_at") Instant updatedAt
) {}
