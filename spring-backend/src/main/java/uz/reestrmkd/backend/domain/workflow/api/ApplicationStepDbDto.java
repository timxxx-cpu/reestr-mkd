package uz.reestrmkd.backend.domain.workflow.api;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record ApplicationStepDbDto(
    @JsonProperty("id") UUID id,
    @JsonProperty("application_id") UUID applicationId,
    @JsonProperty("step_index") Integer stepIndex,
    @JsonProperty("is_completed") Boolean isCompleted,
    @JsonProperty("is_verified") Boolean isVerified,
    @JsonProperty("block_statuses") Map<String, Object> blockStatuses,
    @JsonProperty("created_at") Instant createdAt,
    @JsonProperty("updated_at") Instant updatedAt
) {}
