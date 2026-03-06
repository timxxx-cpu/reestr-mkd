package uz.reestrmkd.backend.domain.registry.api;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record BlockEngineeringDbDto(
    @JsonProperty("id") UUID id,
    @JsonProperty("block_id") UUID blockId,
    @JsonProperty("has_electricity") Boolean hasElectricity,
    @JsonProperty("has_water") Boolean hasWater,
    @JsonProperty("has_hot_water") Boolean hasHotWater,
    @JsonProperty("has_sewerage") Boolean hasSewerage,
    @JsonProperty("has_gas") Boolean hasGas,
    @JsonProperty("has_heating_local") Boolean hasHeatingLocal,
    @JsonProperty("has_heating_central") Boolean hasHeatingCentral,
    @JsonProperty("has_heating") Boolean hasHeating,
    @JsonProperty("has_ventilation") Boolean hasVentilation,
    @JsonProperty("has_firefighting") Boolean hasFirefighting,
    @JsonProperty("has_lowcurrent") Boolean hasLowcurrent,
    @JsonProperty("has_internet") Boolean hasInternet,
    @JsonProperty("has_solar_panels") Boolean hasSolarPanels,
    @JsonProperty("created_at") Instant createdAt,
    @JsonProperty("updated_at") Instant updatedAt
) {}
