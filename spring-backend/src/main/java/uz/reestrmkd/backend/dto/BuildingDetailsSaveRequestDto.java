package uz.reestrmkd.backend.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.Map;

public record BuildingDetailsSaveRequestDto(
    Map<String, JsonNode> buildingDetails
) {
}
