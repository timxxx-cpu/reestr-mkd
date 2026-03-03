package uz.reestr.mkd.backendjpa.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString(exclude = {"block", "extension", "units", "commonAreas"})
@EqualsAndHashCode(exclude = {"block", "extension", "units", "commonAreas"})
@Entity
@Table(name = "floors")
public class FloorEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "block_id")
  private BlockEntity block;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "extension_id")
  private BlockExtensionEntity extension;

  @Column(name = "index", nullable = false)
  private Integer floorIndex;

  @Column(name = "floor_key")
  private String floorKey;

  private String label;

  @Column(name = "floor_type")
  private String floorType;

  private BigDecimal height;

  @Column(name = "area_proj", precision = 14, scale = 2)
  private BigDecimal areaProj;

  @Column(name = "area_fact", precision = 14, scale = 2)
  private BigDecimal areaFact;

  @Column(name = "is_duplex")
  private Boolean isDuplex;

  @Column(name = "parent_floor_index")
  private Integer parentFloorIndex;

  @Column(name = "basement_id")
  private UUID basementId;

  @Column(name = "is_technical")
  private Boolean isTechnical;

  @Column(name = "is_commercial")
  private Boolean isCommercial;

  @Column(name = "is_stylobate")
  private Boolean isStylobate;

  @Column(name = "is_basement")
  private Boolean isBasement;

  @Column(name = "is_attic")
  private Boolean isAttic;

  @Column(name = "is_loft")
  private Boolean isLoft;

  @Column(name = "is_roof")
  private Boolean isRoof;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  @Builder.Default
  @OneToMany(mappedBy = "floor", cascade = CascadeType.ALL, orphanRemoval = true)
  private List<UnitEntity> units = new ArrayList<>();

  @Builder.Default
  @OneToMany(mappedBy = "floor", cascade = CascadeType.ALL, orphanRemoval = true)
  private List<CommonAreaEntity> commonAreas = new ArrayList<>();
}
