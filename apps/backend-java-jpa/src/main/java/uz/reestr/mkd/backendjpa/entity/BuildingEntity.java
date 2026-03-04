package uz.reestr.mkd.backendjpa.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString(exclude = {"blocks", "extensions"})
@EqualsAndHashCode(exclude = {"blocks", "extensions"})
@Entity
@Table(name = "buildings")
public class BuildingEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
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

  @Column(name = "has_non_res_part", nullable = false)
  private Boolean hasNonResPart;

  @Column(name = "cadastre_number")
  private String cadastreNumber;

  @Column(name = "external_id")
  private String externalId;

  @Column(name = "integration_status")
  private String integrationStatus;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "footprint_geojson", columnDefinition = "jsonb")
  private Map<String, Object> footprintGeojson;

  @Column(name = "building_footprint_area_m2", precision = 14, scale = 2)
  private BigDecimal buildingFootprintAreaM2;

  @Column(name = "geometry_candidate_id")
  private UUID geometryCandidateId;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  @Builder.Default
  @OneToMany(mappedBy = "building", cascade = CascadeType.ALL, orphanRemoval = true)
  private List<BlockEntity> blocks = new ArrayList<>();

  @Builder.Default
  @OneToMany(mappedBy = "building", cascade = CascadeType.ALL, orphanRemoval = true)
  private List<BlockExtensionEntity> extensions = new ArrayList<>();
}
