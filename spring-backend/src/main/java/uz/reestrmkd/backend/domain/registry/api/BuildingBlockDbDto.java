package uz.reestrmkd.backend.domain.registry.api;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record BuildingBlockDbDto(
    @JsonProperty("id") UUID id,
    @JsonProperty("building_id") UUID buildingId,
    @JsonProperty("label") String label,
    @JsonProperty("type") String type,
    @JsonProperty("floors_count") Integer floorsCount,
    @JsonProperty("floors_from") Integer floorsFrom,
    @JsonProperty("floors_to") Integer floorsTo,
    @JsonProperty("entrances_count") Integer entrancesCount,
    @JsonProperty("elevators_count") Integer elevatorsCount,
    @JsonProperty("vehicle_entries") Integer vehicleEntries,
    @JsonProperty("levels_depth") Integer levelsDepth,
    @JsonProperty("light_structure_type") String lightStructureType,
    @JsonProperty("parent_blocks") UUID[] parentBlocks,
    @JsonProperty("is_basement_block") Boolean isBasementBlock,
    @JsonProperty("linked_block_ids") UUID[] linkedBlockIds,
    @JsonProperty("basement_depth") Integer basementDepth,
    @JsonProperty("basement_has_parking") Boolean basementHasParking,
    @JsonProperty("basement_parking_levels") JsonNode basementParkingLevels,
    @JsonProperty("basement_communications") JsonNode basementCommunications,
    @JsonProperty("has_basement") Boolean hasBasement,
    @JsonProperty("has_attic") Boolean hasAttic,
    @JsonProperty("has_loft") Boolean hasLoft,
    @JsonProperty("has_roof_expl") Boolean hasRoofExpl,
    @JsonProperty("has_custom_address") Boolean hasCustomAddress,
    @JsonProperty("custom_house_number") String customHouseNumber,
    @JsonProperty("address_id") UUID addressId,
    @JsonProperty("footprint_geojson") JsonNode footprintGeojson,
    @JsonProperty("block_footprint_area_m2") BigDecimal blockFootprintAreaM2,
    @JsonProperty("created_at") Instant createdAt,
    @JsonProperty("updated_at") Instant updatedAt,
    @JsonProperty("block_construction") List<BlockConstructionDbDto> blockConstruction,
    @JsonProperty("block_engineering") List<BlockEngineeringDbDto> blockEngineering,
    @JsonProperty("block_floor_markers") List<BlockFloorMarkerDbDto> blockFloorMarkers,
    @JsonProperty("block_extensions") List<BlockExtensionDbDto> blockExtensions
) {}
