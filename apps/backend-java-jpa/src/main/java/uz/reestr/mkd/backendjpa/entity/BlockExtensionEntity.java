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
@ToString(exclude = {"building", "parentBlock", "floors", "units"})
@EqualsAndHashCode(exclude = {"building", "parentBlock", "floors", "units"})
@Entity
@Table(name = "block_extensions")
public class BlockExtensionEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "building_id", nullable = false)
  private BuildingEntity building;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "parent_block_id", nullable = false)
  private BlockEntity parentBlock;

  @Column(nullable = false)
  private String label;

  @Column(name = "extension_type", nullable = false)
  private String extensionType;

  @Column(name = "construction_kind", nullable = false)
  private String constructionKind;

  @Column(name = "floors_count", nullable = false)
  private Integer floorsCount;

  @Column(name = "start_floor_index", nullable = false)
  private Integer startFloorIndex;

  @Column(name = "vertical_anchor_type", nullable = false)
  private String verticalAnchorType;

  @Column(name = "anchor_floor_key")
  private String anchorFloorKey;

  private String notes;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  @Builder.Default
  @OneToMany(mappedBy = "extension", cascade = CascadeType.ALL, orphanRemoval = true)
  private List<FloorEntity> floors = new ArrayList<>();

  @Builder.Default
  @OneToMany(mappedBy = "extension", cascade = CascadeType.ALL, orphanRemoval = true)
  private List<UnitEntity> units = new ArrayList<>();
}
