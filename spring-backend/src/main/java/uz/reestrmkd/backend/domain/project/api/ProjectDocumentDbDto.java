package uz.reestrmkd.backend.domain.project.api;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ProjectDocumentDbDto(
    @JsonProperty("id") UUID id,
    @JsonProperty("project_id") UUID projectId,
    @JsonProperty("name") String name,
    @JsonProperty("doc_type") String docType,
    @JsonProperty("doc_date") LocalDate docDate,
    @JsonProperty("doc_number") String docNumber,
    @JsonProperty("file_url") String fileUrl,
    @JsonProperty("created_at") Instant createdAt,
    @JsonProperty("updated_at") Instant updatedAt
) {}
