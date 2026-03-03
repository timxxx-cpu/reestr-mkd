package uz.reestr.mkd.backendjpa.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JoinFormula;
import org.hibernate.annotations.UpdateTimestamp;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString(exclude = {"floor", "extension", "entrance", "block"})
@EqualsAndHashCode(exclude = {"floor", "extension", "entrance", "block"})
@Entity
@Table(name = "units")
public class UnitEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "floor_id", nullable = false)
  private FloorEntity floor;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "extension_id")
  private BlockExtensionEntity extension;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "entrance_id")
  private EntranceEntity entrance;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinFormula("(select f.block_id from floors f where f.id = floor_id)")
  private BlockEntity block;

  @Column(name = "unit_code")
  private String unitCode;

  private String number;

  @Column(name = "unit_type", nullable = false)
  private String unitType;

  @Column(name = "has_mezzanine", nullable = false)
  private Boolean hasMezzanine;

  @Column(name = "mezzanine_type")
  private String mezzanineType;

  @Column(name = "total_area", precision = 14, scale = 2)
  private BigDecimal totalArea;

  @Column(name = "living_area", precision = 14, scale = 2)
  private BigDecimal livingArea;

  @Column(name = "useful_area", precision = 14, scale = 2)
  private BigDecimal usefulArea;

  @Column(name = "rooms_count")
  private Integer roomsCount;

  private String status;

  @Column(name = "cadastre_number")
  private String cadastreNumber;

  @Column(name = "address_id")
  private UUID addressId;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;
}
