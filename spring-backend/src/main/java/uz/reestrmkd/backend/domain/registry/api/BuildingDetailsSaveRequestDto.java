package uz.reestrmkd.backend.domain.registry.api;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.Map;

public record BuildingDetailsSaveRequestDto(
    Map<String, JsonNode> buildingDetails
) {
}
