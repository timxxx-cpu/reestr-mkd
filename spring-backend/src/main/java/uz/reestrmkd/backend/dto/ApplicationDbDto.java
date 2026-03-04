package uz.reestrmkd.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record ApplicationDbDto(
    @JsonProperty("id") UUID id,
    @JsonProperty("project_id") UUID projectId,
    @JsonProperty("scope_id") String scopeId,
    @JsonProperty("internal_number") String internalNumber,
    @JsonProperty("external_source") String externalSource,
    @JsonProperty("external_id") String externalId,
    @JsonProperty("applicant") String applicant,
    @JsonProperty("submission_date") Instant submissionDate,
    @JsonProperty("assignee_name") String assigneeName,
    @JsonProperty("status") String status,
    @JsonProperty("workflow_substatus") String workflowSubstatus,
    @JsonProperty("current_step") Integer currentStep,
    @JsonProperty("current_stage") Integer currentStage,
    @JsonProperty("integration_data") Map<String, Object> integrationData,
    @JsonProperty("requested_decline_reason") String requestedDeclineReason,
    @JsonProperty("requested_decline_step") Integer requestedDeclineStep,
    @JsonProperty("requested_decline_by") String requestedDeclineBy,
    @JsonProperty("requested_decline_at") Instant requestedDeclineAt,
    @JsonProperty("created_at") Instant createdAt,
    @JsonProperty("updated_at") Instant updatedAt
) {}
