package uz.reestr.mkd.backendjpa.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "project_geometry_candidates")
public class ProjectGeometryCandidateEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @Column(name = "project_id", nullable = false)
  private UUID projectId;

  @Column(name = "source_index", nullable = false)
  private Integer sourceIndex;

  @Column(name = "label")
  private String label;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "properties", nullable = false, columnDefinition = "jsonb")
  private JsonNode properties;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "geom_geojson", nullable = false, columnDefinition = "jsonb")
  private JsonNode geomGeojson;

  @Column(name = "area_m2", precision = 14, scale = 2)
  private BigDecimal areaM2;

  @Column(name = "is_selected_land_plot", nullable = false)
  private Boolean isSelectedLandPlot;

  @Column(name = "assigned_building_id")
  private UUID assignedBuildingId;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;
}
