package uz.reestrmkd.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record BuildingDataDto(
    String label,
    String category,
    @JsonProperty("house_number") String houseNumber
) {}
