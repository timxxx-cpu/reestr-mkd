package uz.reestrmkd.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "buildings")
public class BuildingEntity {
    @Id
    private UUID id;
    @Column(name = "project_id", nullable = false)
    private UUID projectId;
    @Column(name = "building_code")
    private String buildingCode;
    @Column(nullable = false)
    private String label;
    @Column(name = "house_number")
    private String houseNumber;
    @Column(name = "address_id")
    private UUID addressId;
    @Column(nullable = false)
    private String category;
    private String stage;
    @Column(name = "date_start")
    private LocalDate dateStart;
    @Column(name = "date_end")
    private LocalDate dateEnd;
    @Column(name = "construction_type")
    private String constructionType;
    @Column(name = "parking_type")
    private String parkingType;
    @Column(name = "infra_type")
    private String infraType;
    @Column(name = "has_non_res_part")
    private Boolean hasNonResPart;
    @Column(name = "cadastre_number")
    private String cadastreNumber;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "footprint_geojson", columnDefinition = "jsonb")
    private Map<String, Object> footprintGeojson;

    @Column(name = "building_footprint_area_m2")
    private BigDecimal buildingFootprintAreaM2;
    @Column(name = "geometry_candidate_id")
    private UUID geometryCandidateId;
    @Column(name = "created_at")
    private Instant createdAt;
    @Column(name = "updated_at")
    private Instant updatedAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getProjectId() { return projectId; }
    public void setProjectId(UUID projectId) { this.projectId = projectId; }
    public String getBuildingCode() { return buildingCode; }
    public void setBuildingCode(String buildingCode) { this.buildingCode = buildingCode; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public String getHouseNumber() { return houseNumber; }
    public void setHouseNumber(String houseNumber) { this.houseNumber = houseNumber; }
    public UUID getAddressId() { return addressId; }
    public void setAddressId(UUID addressId) { this.addressId = addressId; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getStage() { return stage; }
    public void setStage(String stage) { this.stage = stage; }
    public LocalDate getDateStart() { return dateStart; }
    public void setDateStart(LocalDate dateStart) { this.dateStart = dateStart; }
    public LocalDate getDateEnd() { return dateEnd; }
    public void setDateEnd(LocalDate dateEnd) { this.dateEnd = dateEnd; }
    public String getConstructionType() { return constructionType; }
    public void setConstructionType(String constructionType) { this.constructionType = constructionType; }
    public String getParkingType() { return parkingType; }
    public void setParkingType(String parkingType) { this.parkingType = parkingType; }
    public String getInfraType() { return infraType; }
    public void setInfraType(String infraType) { this.infraType = infraType; }
    public Boolean getHasNonResPart() { return hasNonResPart; }
    public void setHasNonResPart(Boolean hasNonResPart) { this.hasNonResPart = hasNonResPart; }
    public String getCadastreNumber() { return cadastreNumber; }
    public void setCadastreNumber(String cadastreNumber) { this.cadastreNumber = cadastreNumber; }
    public Map<String, Object> getFootprintGeojson() { return footprintGeojson; }
    public void setFootprintGeojson(Map<String, Object> footprintGeojson) { this.footprintGeojson = footprintGeojson; }
    public BigDecimal getBuildingFootprintAreaM2() { return buildingFootprintAreaM2; }
    public void setBuildingFootprintAreaM2(BigDecimal buildingFootprintAreaM2) { this.buildingFootprintAreaM2 = buildingFootprintAreaM2; }
    public UUID getGeometryCandidateId() { return geometryCandidateId; }
    public void setGeometryCandidateId(UUID geometryCandidateId) { this.geometryCandidateId = geometryCandidateId; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
