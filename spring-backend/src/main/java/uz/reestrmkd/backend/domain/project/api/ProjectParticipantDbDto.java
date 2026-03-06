package uz.reestrmkd.backend.domain.project.api;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.UUID;

public record ProjectParticipantDbDto(
    @JsonProperty("id") UUID id,
    @JsonProperty("project_id") UUID projectId,
    @JsonProperty("role") String role,
    @JsonProperty("name") String name,
    @JsonProperty("inn") String inn,
    @JsonProperty("created_at") Instant createdAt,
    @JsonProperty("updated_at") Instant updatedAt
) {}
