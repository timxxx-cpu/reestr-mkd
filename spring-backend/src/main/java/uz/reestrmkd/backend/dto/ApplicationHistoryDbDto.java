package uz.reestrmkd.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.UUID;

public record ApplicationHistoryDbDto(
    @JsonProperty("id") UUID id,
    @JsonProperty("application_id") UUID applicationId,
    @JsonProperty("action") String action,
    @JsonProperty("prev_status") String prevStatus,
    @JsonProperty("next_status") String nextStatus,
    @JsonProperty("user_name") String userName,
    @JsonProperty("comment") String comment,
    @JsonProperty("created_at") Instant createdAt
) {}
