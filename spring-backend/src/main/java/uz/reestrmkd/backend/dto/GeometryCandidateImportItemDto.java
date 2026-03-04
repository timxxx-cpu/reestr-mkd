package uz.reestrmkd.backend.dto;

import com.fasterxml.jackson.databind.JsonNode;

public record GeometryCandidateImportItemDto(
    Integer sourceIndex,
    String label,
    JsonNode properties,
    JsonNode geometry
) {
}
