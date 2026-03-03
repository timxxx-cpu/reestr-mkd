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
@ToString(exclude = {"participants", "documents"})
@EqualsAndHashCode(exclude = {"participants", "documents"})
@Entity
@Table(name = "projects")
public class Project {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
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

  @Column(name = "land_plot_area_m2", precision = 14, scale = 2)
  private BigDecimal landPlotAreaM2;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  @Builder.Default
  @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true)
  private List<ProjectParticipant> participants = new ArrayList<>();

  @Builder.Default
  @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true)
  private List<ProjectDocument> documents = new ArrayList<>();
}
