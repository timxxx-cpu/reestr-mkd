package uz.reestrmkd.backend.domain.registry.api;

import com.fasterxml.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.util.UUID;

public record GeometryCandidateResponseDto(
    UUID id,
    Integer sourceIndex,
    String label,
    JsonNode properties,
    JsonNode geometry,
    BigDecimal areaM2,
    Boolean isSelectedLandPlot,
    UUID assignedBuildingId
) {
}
