package uz.reestrmkd.backend.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "project_geometry_candidates")
public class ProjectGeometryCandidateEntity {
    @Id
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "source_index")
    private Integer sourceIndex;

    @Column(name = "label")
    private String label;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "properties", columnDefinition = "jsonb")
    private JsonNode properties;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "geom_geojson", columnDefinition = "jsonb")
    private JsonNode geometry;

    @Column(name = "area_m2")
    private BigDecimal areaM2;

    @Column(name = "is_selected_land_plot")
    private Boolean isSelectedLandPlot;

    @Column(name = "assigned_building_id")
    private UUID assignedBuildingId;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getProjectId() { return projectId; }
    public void setProjectId(UUID projectId) { this.projectId = projectId; }
    public Integer getSourceIndex() { return sourceIndex; }
    public void setSourceIndex(Integer sourceIndex) { this.sourceIndex = sourceIndex; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public JsonNode getProperties() { return properties; }
    public void setProperties(JsonNode properties) { this.properties = properties; }
    public JsonNode getGeometry() { return geometry; }
    public void setGeometry(JsonNode geometry) { this.geometry = geometry; }
    public BigDecimal getAreaM2() { return areaM2; }
    public void setAreaM2(BigDecimal areaM2) { this.areaM2 = areaM2; }
    public Boolean getIsSelectedLandPlot() { return isSelectedLandPlot; }
    public void setIsSelectedLandPlot(Boolean isSelectedLandPlot) { this.isSelectedLandPlot = isSelectedLandPlot; }
    public UUID getAssignedBuildingId() { return assignedBuildingId; }
    public void setAssignedBuildingId(UUID assignedBuildingId) { this.assignedBuildingId = assignedBuildingId; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
