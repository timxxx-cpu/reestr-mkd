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
@ToString(exclude = {"building", "floors", "entrances", "units"})
@EqualsAndHashCode(exclude = {"building", "floors", "entrances", "units"})
@Entity
@Table(name = "building_blocks")
public class BlockEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "building_id", nullable = false)
  private BuildingEntity building;

  @Column(nullable = false)
  private String label;

  @Column(nullable = false)
  private String type;

  @Column(name = "floors_count")
  private Integer floorsCount;

  @Column(name = "floors_from")
  private Integer floorsFrom;

  @Column(name = "floors_to")
  private Integer floorsTo;

  @Column(name = "entrances_count")
  private Integer entrancesCount;

  @Column(name = "elevators_count")
  private Integer elevatorsCount;

  @Column(name = "vehicle_entries")
  private Integer vehicleEntries;

  @Column(name = "levels_depth")
  private Integer levelsDepth;

  @Column(name = "light_structure_type")
  private String lightStructureType;

  @Column(name = "is_basement_block", nullable = false)
  private Boolean isBasementBlock;

  @Column(name = "basement_depth")
  private Integer basementDepth;

  @Column(name = "basement_has_parking", nullable = false)
  private Boolean basementHasParking;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "basement_parking_levels", nullable = false, columnDefinition = "jsonb")
  private Map<String, Object> basementParkingLevels;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "basement_communications", nullable = false, columnDefinition = "jsonb")
  private Map<String, Object> basementCommunications;

  @Column(name = "has_basement")
  private Boolean hasBasement;

  @Column(name = "has_attic")
  private Boolean hasAttic;

  @Column(name = "has_loft")
  private Boolean hasLoft;

  @Column(name = "has_roof_expl")
  private Boolean hasRoofExpl;

  @Column(name = "has_custom_address")
  private Boolean hasCustomAddress;

  @Column(name = "custom_house_number")
  private String customHouseNumber;

  @Column(name = "address_id")
  private UUID addressId;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "footprint_geojson", columnDefinition = "jsonb")
  private Map<String, Object> footprintGeojson;

  @Column(name = "block_footprint_area_m2", precision = 14, scale = 2)
  private BigDecimal blockFootprintAreaM2;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  @Builder.Default
  @OneToMany(mappedBy = "block", cascade = CascadeType.ALL, orphanRemoval = true)
  private List<FloorEntity> floors = new ArrayList<>();

  @Builder.Default
  @OneToMany(mappedBy = "block", cascade = CascadeType.ALL, orphanRemoval = true)
  private List<EntranceEntity> entrances = new ArrayList<>();

  @Builder.Default
  @OneToMany(mappedBy = "block", cascade = CascadeType.ALL, orphanRemoval = true)
  private List<UnitEntity> units = new ArrayList<>();
}
