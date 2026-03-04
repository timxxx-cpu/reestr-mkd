package uz.reestrmkd.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

public record ProjectDbDto(
    @JsonProperty("id") UUID id,
    @JsonProperty("scope_id") String scopeId,
    @JsonProperty("uj_code") String ujCode,
    @JsonProperty("name") String name,
    @JsonProperty("region") String region,
    @JsonProperty("district") String district,
    @JsonProperty("address") String address,
    @JsonProperty("region_soato") String regionSoato,
    @JsonProperty("district_soato") String districtSoato,
    @JsonProperty("street_id") String streetId,
    @JsonProperty("mahalla_id") String mahallaId,
    @JsonProperty("mahalla") String mahalla,
    @JsonProperty("building_no") String buildingNo,
    @JsonProperty("landmark") String landmark,
    @JsonProperty("cadastre_number") String cadastreNumber,
    @JsonProperty("construction_status") String constructionStatus,
    @JsonProperty("date_start_project") LocalDate dateStartProject,
    @JsonProperty("date_end_project") LocalDate dateEndProject,
    @JsonProperty("date_start_fact") LocalDate dateStartFact,
    @JsonProperty("date_end_fact") LocalDate dateEndFact,
    @JsonProperty("integration_data") Map<String, Object> integrationData,
    @JsonProperty("address_id") UUID addressId,
    @JsonProperty("land_plot_geojson") Map<String, Object> landPlotGeojson,
    @JsonProperty("land_plot_area_m2") BigDecimal landPlotAreaM2,
    @JsonProperty("created_at") Instant createdAt,
    @JsonProperty("updated_at") Instant updatedAt
) {}
