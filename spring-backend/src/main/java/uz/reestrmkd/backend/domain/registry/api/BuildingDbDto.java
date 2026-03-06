package uz.reestrmkd.backend.domain.registry.api;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record BuildingDbDto(
    @JsonProperty("id") UUID id,
    @JsonProperty("project_id") UUID projectId,
    @JsonProperty("building_code") String buildingCode,
    @JsonProperty("label") String label,
    @JsonProperty("house_number") String houseNumber,
    @JsonProperty("address_id") UUID addressId,
    @JsonProperty("category") String category,
    @JsonProperty("stage") String stage,
    @JsonProperty("date_start") LocalDate dateStart,
    @JsonProperty("date_end") LocalDate dateEnd,
    @JsonProperty("construction_type") String constructionType,
    @JsonProperty("parking_type") String parkingType,
    @JsonProperty("infra_type") String infraType,
    @JsonProperty("has_non_res_part") Boolean hasNonResPart,
    @JsonProperty("cadastre_number") String cadastreNumber,
    @JsonProperty("footprint_geojson") JsonNode footprintGeojson,
    @JsonProperty("building_footprint_area_m2") BigDecimal buildingFootprintAreaM2,
    @JsonProperty("geometry_candidate_id") UUID geometryCandidateId,
    @JsonProperty("created_at") Instant createdAt,
    @JsonProperty("updated_at") Instant updatedAt,
    @JsonProperty("building_blocks") List<BuildingBlockDbDto> buildingBlocks
) {}
