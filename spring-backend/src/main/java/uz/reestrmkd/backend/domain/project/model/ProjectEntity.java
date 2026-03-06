package uz.reestrmkd.backend.domain.project.model;

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
@Table(name = "projects")
public class ProjectEntity {
    @Id
    private UUID id;

    @Column(name = "scope_id", nullable = false)
    private String scopeId;

    @Column(name = "uj_code")
    private String ujCode;

    @Column(nullable = false)
    private String name;

    private String region;
    private String district;
    private String address;
    private String landmark;

    @Column(name = "cadastre_number")
    private String cadastreNumber;

    @Column(name = "construction_status")
    private String constructionStatus;

    @Column(name = "date_start_project")
    private LocalDate dateStartProject;
    @Column(name = "date_end_project")
    private LocalDate dateEndProject;
    @Column(name = "date_start_fact")
    private LocalDate dateStartFact;
    @Column(name = "date_end_fact")
    private LocalDate dateEndFact;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "integration_data", columnDefinition = "jsonb")
    private Map<String, Object> integrationData;

    @Column(name = "address_id")
    private UUID addressId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "land_plot_geojson", columnDefinition = "jsonb")
    private Map<String, Object> landPlotGeojson;

    @Column(name = "land_plot_area_m2")
    private BigDecimal landPlotAreaM2;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getScopeId() { return scopeId; }
    public void setScopeId(String scopeId) { this.scopeId = scopeId; }
    public String getUjCode() { return ujCode; }
    public void setUjCode(String ujCode) { this.ujCode = ujCode; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }
    public String getDistrict() { return district; }
    public void setDistrict(String district) { this.district = district; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getLandmark() { return landmark; }
    public void setLandmark(String landmark) { this.landmark = landmark; }
    public String getCadastreNumber() { return cadastreNumber; }
    public void setCadastreNumber(String cadastreNumber) { this.cadastreNumber = cadastreNumber; }
    public String getConstructionStatus() { return constructionStatus; }
    public void setConstructionStatus(String constructionStatus) { this.constructionStatus = constructionStatus; }
    public LocalDate getDateStartProject() { return dateStartProject; }
    public void setDateStartProject(LocalDate dateStartProject) { this.dateStartProject = dateStartProject; }
    public LocalDate getDateEndProject() { return dateEndProject; }
    public void setDateEndProject(LocalDate dateEndProject) { this.dateEndProject = dateEndProject; }
    public LocalDate getDateStartFact() { return dateStartFact; }
    public void setDateStartFact(LocalDate dateStartFact) { this.dateStartFact = dateStartFact; }
    public LocalDate getDateEndFact() { return dateEndFact; }
    public void setDateEndFact(LocalDate dateEndFact) { this.dateEndFact = dateEndFact; }
    public Map<String, Object> getIntegrationData() { return integrationData; }
    public void setIntegrationData(Map<String, Object> integrationData) { this.integrationData = integrationData; }
    public UUID getAddressId() { return addressId; }
    public void setAddressId(UUID addressId) { this.addressId = addressId; }
    public Map<String, Object> getLandPlotGeojson() { return landPlotGeojson; }
    public void setLandPlotGeojson(Map<String, Object> landPlotGeojson) { this.landPlotGeojson = landPlotGeojson; }
    public BigDecimal getLandPlotAreaM2() { return landPlotAreaM2; }
    public void setLandPlotAreaM2(BigDecimal landPlotAreaM2) { this.landPlotAreaM2 = landPlotAreaM2; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
